/** Runs jobs across a pool of engine workers and streams their results. */
import type {
  Downsampled,
  Job,
  PaletteColor,
  ResultImage,
  SourceImage,
  WorkerRequest,
  WorkerResponse,
} from './types';

export interface RunCallbacks {
  onResult: (result: ResultImage) => void;
  onJobDone: (jobId: number, palettesFound: number) => void;
  onJobError: (jobId: number, message: string) => void;
}

export interface Run {
  /** Resolves when every job has finished or the run was cancelled. */
  done: Promise<void>;
  cancel: () => void;
}

const MAX_WORKERS = 8;

function createWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
}

function send(worker: Worker, message: WorkerRequest): void {
  worker.postMessage(message);
}

export function workerCount(jobs: number): number {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(jobs, cores - 1, MAX_WORKERS));
}

/** Takes the next job, preferring one whose target size the worker already downsampled. */
function takeJob(queue: Job[], lastTargetSize: number | undefined): Job | undefined {
  const sameSize = queue.findIndex((j) => j.targetSize === lastTargetSize);
  const [job] = queue.splice(sameSize === -1 ? 0 : sameSize, 1);
  return job;
}

/**
 * Runs `jobs` on `image`. The image is downsampled once per target size in a
 * single task worker; the run workers only ever receive those small grids,
 * so a large photo is held by one worker instead of every one of them.
 */
export function startRun(image: SourceImage, jobs: Job[], callbacks: RunCallbacks): Run {
  const cancelled = new AbortController();
  let run: Run | null = null;
  const targetSizes = [...new Set(jobs.map((j) => j.targetSize))];
  const done = (async () => {
    let images: Downsampled[];
    try {
      images = targetSizes.length === 0 ? [] : await downsampleInWorker(image, targetSizes);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      for (const job of cancelled.signal.aborted ? [] : jobs) {
        callbacks.onJobError(job.id, reason);
      }
      return;
    }
    if (!cancelled.signal.aborted) {
      run = runJobs(images, jobs, callbacks);
      await run.done;
    }
  })();
  return {
    done,
    cancel: () => {
      cancelled.abort();
      run?.cancel();
    },
  };
}

function runJobs(images: Downsampled[], jobs: Job[], callbacks: RunCallbacks): Run {
  const queue = [...jobs];
  let remaining = jobs.length;
  let finish = (): void => undefined;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const workers: Worker[] = [];
  let alive = 0;

  const stop = (): void => {
    for (const worker of workers) {
      worker.terminate();
    }
    finish();
  };

  const settle = (): void => {
    remaining -= 1;
    if (remaining === 0) {
      stop();
    }
  };

  const feed = (worker: Worker, last: Job | undefined): Job | undefined => {
    const job = takeJob(queue, last?.targetSize);
    if (job !== undefined) {
      send(worker, { type: 'job', job });
    }
    return job;
  };

  for (let i = 0; i < workerCount(jobs.length); i++) {
    const worker = createWorker();
    workers.push(worker);
    alive += 1;
    send(worker, { type: 'images', images });
    let current = feed(worker, undefined);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'result') {
        callbacks.onResult(message.result);
        return;
      }
      if (message.type === 'job-done') {
        callbacks.onJobDone(message.jobId, message.palettesFound);
      } else if (message.type === 'job-error') {
        callbacks.onJobError(message.jobId, message.message);
      } else {
        return;
      }
      current = feed(worker, current);
      settle();
    };

    // A crashed worker takes no more jobs; when none are left alive, the
    // queued jobs fail instead of waiting forever.
    worker.onerror = (event) => {
      event.preventDefault();
      const reason = `engine worker crashed: ${event.message}`;
      alive -= 1;
      const failed = current === undefined ? [] : [current];
      current = undefined;
      if (alive === 0) {
        failed.push(...queue.splice(0));
      }
      for (const job of failed) {
        callbacks.onJobError(job.id, reason);
        settle();
      }
    };
  }

  if (jobs.length === 0) {
    stop();
  }
  return { done, cancel: stop };
}

/** Runs one request on a fresh worker and resolves with the reply `pick` accepts. */
function runTask<T>(
  request: WorkerRequest,
  transfer: Transferable[],
  pick: (message: WorkerResponse) => T | undefined,
): Promise<T> {
  const worker = createWorker();
  return new Promise<T>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'task-error') {
        reject(new Error(message.message));
        return;
      }
      const value = pick(message);
      if (value !== undefined) {
        resolve(value);
      }
    };
    worker.onerror = (event) => {
      reject(new Error(event.message));
    };
    worker.postMessage(request, transfer);
  }).finally(() => {
    worker.terminate();
  });
}

/** `image` downsampled for each target size, computed off the UI thread. */
function downsampleInWorker(image: SourceImage, targetSizes: number[]): Promise<Downsampled[]> {
  return runTask({ type: 'downsample', image, targetSizes }, [], (m) =>
    m.type === 'downsampled' ? m.images : undefined,
  );
}

/** Every distinct color of a palette image, computed off the UI thread. */
export function extractPalette(image: SourceImage): Promise<PaletteColor[]> {
  return runTask({ type: 'extract-palette', image }, [], (m) =>
    m.type === 'palette' ? m.colors : undefined,
  );
}

/** Decodes a PNG with the engine's decoder, off the UI thread. */
export function decodePngInWorker(bytes: ArrayBuffer): Promise<SourceImage> {
  return runTask({ type: 'decode-png', bytes }, [bytes], (m) =>
    m.type === 'decoded' ? m.image : undefined,
  );
}
