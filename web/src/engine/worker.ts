/// Engine worker: owns one WASM instance and runs jobs for the pool.
import init, { Engine, decodePng, downsample, extractImagePalette } from './wasm/engine.js';
import type {
  Downsampled,
  Job,
  PaletteColor,
  ResultImage,
  SourceImage,
  WorkerRequest,
  WorkerResponse,
} from './types';

const ready = init();
/** This run's input, downsampled for each target size. */
let images = new Map<number, Downsampled>();
/** Downsampled sessions by target size; their palette groupings are reused across jobs. */
const engines = new Map<number, Engine>();

function post(message: WorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `[r, g, b, weight, …]` to palette colors. */
function unflatten(flat: Float64Array): PaletteColor[] {
  const colors: PaletteColor[] = [];
  for (let i = 0; i + 3 < flat.length; i += 4) {
    colors.push({
      r: flat[i] ?? 0,
      g: flat[i + 1] ?? 0,
      b: flat[i + 2] ?? 0,
      weight: flat[i + 3] ?? 0,
    });
  }
  return colors;
}

function engineFor(targetSize: number): Engine {
  let engine = engines.get(targetSize);
  if (engine === undefined) {
    const image = images.get(targetSize);
    if (image === undefined) {
      throw new Error(`no downsampled image for target size ${String(targetSize)}`);
    }
    engine = Engine.fromDownsampled(image.step, image.width, image.height, image.rgb);
    engines.set(targetSize, engine);
  }
  return engine;
}

/** Downsamples `image` for every target size, keeping no copy of it. */
function downsampleAll(image: SourceImage, targetSizes: number[]): Downsampled[] {
  return targetSizes.map((targetSize) => {
    const d = downsample(image.rgba16, image.width, image.height, targetSize);
    try {
      return {
        targetSize,
        step: d.step,
        width: d.width,
        height: d.height,
        rgb: new Float64Array(d.rgb),
      };
    } finally {
      d.free();
    }
  });
}

function postResult(result: ResultImage): void {
  post({ type: 'result', result }, [result.image.rgba.buffer]);
}

function runJob(job: Job): number {
  const engine = engineFor(job.targetSize);
  const base = { jobId: job.id, step: engine.step };
  const size = { width: engine.width, height: engine.height };

  if (job.source.kind === 'forced') {
    const rgb = Float64Array.from(job.source.colors.flatMap((c) => [c.r, c.g, c.b]));
    for (const redrawMethod of job.redrawMethods) {
      postResult({
        ...base,
        redrawMethod,
        tolerance: null,
        palette: job.source.colors,
        // Copies into a fresh ArrayBuffer that can be transferred to the UI thread.
        image: { ...size, rgba: new Uint8Array(engine.redrawWith(rgb, redrawMethod)) },
      });
    }
    return 1;
  }

  const { search, method, threshold } = job.source;
  const found =
    search === 'cluster'
      ? engine.cluster(method, threshold, job.paletteCount)
      : engine.search(
          method,
          threshold,
          job.paletteCount,
          job.tolerance,
          job.increment,
          job.maxImages,
        );
  for (const redrawMethod of job.redrawMethods) {
    engine.beginRedraw(redrawMethod);
    for (let r = engine.nextRedraw(); r !== undefined; r = engine.nextRedraw()) {
      const result: ResultImage = {
        ...base,
        redrawMethod,
        tolerance: r.tolerance ?? null,
        palette: unflatten(r.palette),
        image: { ...size, rgba: new Uint8Array(r.rgba) },
      };
      r.free();
      postResult(result);
    }
  }
  return found;
}

function decode(bytes: ArrayBuffer): SourceImage {
  const decoded = decodePng(new Uint8Array(bytes));
  try {
    return { width: decoded.width, height: decoded.height, rgba16: new Uint16Array(decoded.rgba) };
  } finally {
    decoded.free();
  }
}

/** Runs a one-off task and posts its reply, or `task-error`. */
function task(run: () => [WorkerResponse, Transferable[]]): void {
  try {
    post(...run());
  } catch (err) {
    post({ type: 'task-error', message: errorMessage(err) });
  }
}

function handle(message: WorkerRequest): void {
  switch (message.type) {
    case 'images':
      for (const engine of engines.values()) {
        engine.free();
      }
      engines.clear();
      images = new Map(message.images.map((d) => [d.targetSize, d]));
      return;
    case 'job':
      try {
        post({ type: 'job-done', jobId: message.job.id, palettesFound: runJob(message.job) });
      } catch (err) {
        post({ type: 'job-error', jobId: message.job.id, message: errorMessage(err) });
      }
      return;
    case 'downsample':
      task(() => {
        const downsampled = downsampleAll(message.image, message.targetSizes);
        return [{ type: 'downsampled', images: downsampled }, downsampled.map((d) => d.rgb.buffer)];
      });
      return;
    case 'extract-palette':
      task(() => {
        const { rgba16, width, height } = message.image;
        return [
          { type: 'palette', colors: unflatten(extractImagePalette(rgba16, width, height)) },
          [],
        ];
      });
      return;
    case 'decode-png':
      task(() => {
        const image = decode(message.bytes);
        return [{ type: 'decoded', image }, [image.rgba16.buffer]];
      });
      return;
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void ready.then(() => {
    handle(event.data);
  });
};
