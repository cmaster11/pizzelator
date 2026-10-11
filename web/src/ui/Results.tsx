import { Alert, Badge, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import { REDRAW_METHODS, type RedrawMethodId } from '../engine/types';
import { resultCaption, sourceLabel } from '../lib/params';
import type { OutputOptions } from '../lib/output';
import { ResultCard } from './ResultCard';
import type { JobState, ResultView, RunState } from './useRun';

interface Section {
  key: string;
  jobState: JobState;
  redrawMethod: RedrawMethodId;
  results: ResultView[];
}

function sections(state: RunState): Section[] {
  return state.jobs.flatMap((jobState) =>
    jobState.job.redrawMethods.map((redrawMethod) => ({
      key: `${jobState.job.id}-${redrawMethod}`,
      jobState,
      redrawMethod,
      results: state.results
        .filter((r) => r.jobId === jobState.job.id && r.redrawMethod === redrawMethod)
        .sort((a, b) => (a.tolerance ?? 0) - (b.tolerance ?? 0)),
    })),
  );
}

function StatusBadge({
  status,
  cancelled,
  count,
}: {
  status: JobState['status'];
  cancelled: boolean;
  count: number;
}) {
  if (status === 'error') {
    return <Badge color="red">failed</Badge>;
  }
  if (status === 'running') {
    return cancelled ? <Badge color="gray">cancelled</Badge> : <Loader size="xs" />;
  }
  return <Badge variant="light">{count === 1 ? '1 image' : `${count} images`}</Badge>;
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
  const { job, status, message } = section.jobState;
  const redraw =
    REDRAW_METHODS.find((m) => m.id === section.redrawMethod)?.label ?? section.redrawMethod;
  const first = section.results[0];
  return (
    <Stack gap="xs" data-testid="result-section">
      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Title order={5}>
            {job.targetSize}px · {sourceLabel(job.source)} · {redraw}
          </Title>
          {first !== undefined && (
            <Text size="xs" c="dimmed">
              {first.image.width}×{first.image.height}, step {first.step}
            </Text>
          )}
        </Group>
        <StatusBadge status={status} cancelled={cancelled} count={section.results.length} />
      </Group>
      {status === 'error' && (
        <Alert color="red" variant="light" p="xs">
          {message}
        </Alert>
      )}
      {section.results.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
          {section.results.map((r) => (
            <ResultCard
              key={r.key}
              result={r}
              caption={resultCaption(job.source, r.tolerance)}
              output={output}
            />
          ))}
        </SimpleGrid>
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
