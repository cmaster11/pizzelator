import { Alert, Badge, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import type { ReactNode } from 'react';

import { PALETTE_SEARCHES, REDRAW_METHODS, type RedrawMethodId } from '../engine/types';
import { resultCaption, settingsKey, settingsLabel } from '../lib/params';
import type { OutputOptions } from '../lib/output';
import { ResultCard } from './ResultCard';
import type { JobState, ResultView, RunState } from './useRun';

/** One target size, palette method, threshold and redraw method, with every palette search's images. */
interface Section {
  key: string;
  /** In run order, so clusters come before the tolerance search. */
  jobs: JobState[];
  redrawMethod: RedrawMethodId;
  results: ResultView[];
}

function sections(state: RunState): Section[] {
  const byKey = new Map<string, Section>();
  for (const jobState of state.jobs) {
    for (const redrawMethod of jobState.job.redrawMethods) {
      const key = `${settingsKey(jobState.job)}/${redrawMethod}`;
      const section = byKey.get(key) ?? { key, jobs: [], redrawMethod, results: [] };
      section.jobs.push(jobState);
      section.results.push(
        ...state.results
          .filter((r) => r.jobId === jobState.job.id && r.redrawMethod === redrawMethod)
          .sort((a, b) => (a.tolerance ?? 0) - (b.tolerance ?? 0)),
      );
      byKey.set(key, section);
    }
  }
  return [...byKey.values()];
}

function searchLabel(jobState: JobState): string {
  const { source } = jobState.job;
  return source.kind === 'forced'
    ? 'forced palette'
    : (PALETTE_SEARCHES.find((s) => s.id === source.search)?.label ?? source.search);
}

function StatusBadge({
  jobs,
  cancelled,
  count,
}: {
  jobs: JobState[];
  cancelled: boolean;
  count: number;
}) {
  if (jobs.some((j) => j.status === 'running')) {
    return cancelled ? <Badge color="gray">cancelled</Badge> : <Loader size="xs" />;
  }
  return (
    <Group gap={4}>
      {jobs.some((j) => j.status === 'error') && <Badge color="red">failed</Badge>}
      <Badge variant="light">{count === 1 ? '1 image' : `${String(count)} images`}</Badge>
    </Group>
  );
}

/**
 * Fitted results share the width in columns; fixed-size ones keep their own
 * width and wrap onto as many rows as the width needs.
 */
function Gallery({ fit, children }: { fit: boolean; children: ReactNode }) {
  return fit ? (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
      {children}
    </SimpleGrid>
  ) : (
    <Group gap="sm" align="flex-start">
      {children}
    </Group>
  );
}

function SectionView({
  section,
  cancelled,
  output,
}: {
  section: Section;
  cancelled: boolean;
  output: OutputOptions;
}) {
  const [first] = section.jobs;
  if (first === undefined) {
    return null;
  }
  const { job } = first;
  const failed = section.jobs.filter((j) => j.status === 'error');
  const redraw =
    REDRAW_METHODS.find((m) => m.id === section.redrawMethod)?.label ?? section.redrawMethod;
  const sample = section.results[0];
  return (
    <Stack gap="xs" data-testid="result-section">
      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Title order={5}>
            {job.targetSize}px · {settingsLabel(job.source)} · {redraw}
          </Title>
          {sample !== undefined && (
            <Text size="xs" c="dimmed">
              {sample.image.width}×{sample.image.height}, step {sample.step}
            </Text>
          )}
        </Group>
        <StatusBadge jobs={section.jobs} cancelled={cancelled} count={section.results.length} />
      </Group>
      {failed.map((j) => (
        <Alert key={j.job.id} color="red" variant="light" p="xs">
          {section.jobs.length > 1 ? `${searchLabel(j)}: ${j.message ?? ''}` : j.message}
        </Alert>
      ))}
      {section.results.length > 0 && (
        <Gallery fit={output.display === 'fit'}>
          {section.results.map((r) => (
            <ResultCard
              key={r.key}
              result={r}
              caption={resultCaption(
                section.jobs.find((j) => j.job.id === r.jobId)?.job.source ?? job.source,
                r.tolerance,
              )}
              output={output}
            />
          ))}
        </Gallery>
      )}
    </Stack>
  );
}

export function Results({ state, output }: { state: RunState; output: OutputOptions }) {
  return (
    <Stack gap="xl">
      {sections(state).map((section) => (
        <SectionView
          key={section.key}
          section={section}
          cancelled={state.status === 'cancelled'}
          output={output}
        />
      ))}
    </Stack>
  );
}
