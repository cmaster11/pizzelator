import { useCallback, useEffect, useRef, useState } from 'react';

import { startRun, type Run } from '../engine/pool';
import type { Job, ResultImage, SourceImage } from '../engine/types';
import { encodePng } from '../lib/image';
import { buildJobs, resultFileName, type Params } from '../lib/params';

export interface ResultView extends ResultImage {
  key: string;
  /** Object URL of the native-size PNG. */
  url: string;
  fileName: string;
}

export interface JobState {
  job: Job;
  status: 'running' | 'done' | 'error';
  message?: string;
}

export interface RunState {
  status: 'idle' | 'running' | 'finished' | 'cancelled';
  jobs: JobState[];
  results: ResultView[];
  elapsedMs: number;
}

const IDLE: RunState = { status: 'idle', jobs: [], results: [], elapsedMs: 0 };

function revokeAll(results: ResultView[]): void {
  for (const r of results) {
    URL.revokeObjectURL(r.url);
  }
}

/** Owns one run at a time: starting a new run cancels and discards the previous one. */
export function useRun(): {
  state: RunState;
  start: (image: SourceImage, baseName: string, params: Params) => void;
  cancel: () => void;
} {
  const [state, setState] = useState<RunState>(IDLE);
  const run = useRef<Run | null>(null);
  const token = useRef(0);
  const results = useRef<ResultView[]>([]);

  const cancel = useCallback(() => {
    run.current?.cancel();
    run.current = null;
    setState((s) => (s.status === 'running' ? { ...s, status: 'cancelled' } : s));
  }, []);

  const start = useCallback((image: SourceImage, baseName: string, params: Params) => {
    run.current?.cancel();
    revokeAll(results.current);
    results.current = [];
    const id = ++token.current;
    const jobs = buildJobs(params);
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const startedAt = performance.now();
    const current = (): boolean => token.current === id;
    const setJob = (jobId: number, patch: Partial<JobState>): void => {
      setState((s) => ({
        ...s,
        jobs: s.jobs.map((j) => (j.job.id === jobId ? { ...j, ...patch } : j)),
      }));
    };

    setState({
      status: 'running',
      jobs: jobs.map((job) => ({ job, status: 'running' })),
      results: [],
      elapsedMs: 0,
    });

    let pendingEncodes = Promise.resolve();
    run.current = startRun(image, jobs, {
      onResult: (result) => {
        const job = byId.get(result.jobId);
        if (job === undefined) {
          return;
        }
        const fileName = resultFileName(baseName, job, result.redrawMethod, result.tolerance);
        const encoded = encodePng(result.image).then((blob) => {
          if (!current()) {
            return;
          }
          const view: ResultView = {
            ...result,
            key: fileName,
            url: URL.createObjectURL(blob),
            fileName,
          };
          results.current = [...results.current, view];
          setState((s) => ({ ...s, results: results.current }));
        });
        pendingEncodes = pendingEncodes.then(() => encoded);
      },
      onJobDone: (jobId) => {
        if (current()) {
          setJob(jobId, { status: 'done' });
        }
      },
      onJobError: (jobId, message) => {
        if (current()) {
          setJob(jobId, { status: 'error', message });
        }
      },
    });

    void run.current.done
      .then(() => pendingEncodes)
      .then(() => {
        if (!current()) {
          return;
        }
        run.current = null;
        setState((s) => ({
          ...s,
          status: s.status === 'running' ? 'finished' : s.status,
          elapsedMs: performance.now() - startedAt,
        }));
      });
  }, []);

  useEffect(
    () => () => {
      run.current?.cancel();
      revokeAll(results.current);
    },
    [],
  );

  return { state, start, cancel };
}
