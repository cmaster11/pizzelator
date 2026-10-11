import {
  Button,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  Slider,
  Stack,
  Text,
} from '@mantine/core';
import { IconFileZip } from '@tabler/icons-react';
import { useState } from 'react';

import { ADJUST_RANGE, formatPercent } from '../lib/adjust';
import { downloadBlob, zipFiles } from '../lib/download';
import { EXPORT_SCALES, type OutputOptions } from '../lib/output';
import { exportName, exportPalette, exportPng, pngName } from './export';
import { HELP } from './help';
import type { RunState } from './useRun';
import { WithHelp } from './WithHelp';

async function downloadAll(
  state: RunState,
  output: OutputOptions,
  baseName: string,
): Promise<void> {
  const files = await Promise.all(
    state.results.flatMap((r) => [
      exportPng(r, output).then((blob) => ({ name: `${pngName(r, output)}.png`, blob })),
      Promise.resolve({
        name: `palettes/${exportName(r, output)}.palette.json`,
        blob: exportPalette(r, output),
      }),
    ]),
  );
  downloadBlob(await zipFiles(files), `${baseName}_pixelart.zip`);
}

function RunSummary({ state }: { state: RunState }) {
  const finished = state.jobs.filter((j) => j.status !== 'running').length;
  const failed = state.jobs.filter((j) => j.status === 'error').length;
  const total = state.jobs.length;
  return (
    <Stack gap={4}>
      <Progress
        value={total === 0 ? 0 : (finished / total) * 100}
        animated={state.status === 'running'}
      />
      <Text size="xs" c="dimmed" data-testid="run-summary">
        {state.results.length} images · {finished}/{total} runs
        {failed > 0 ? ` · ${failed} failed` : ''}
        {state.status === 'finished' ? ` · done in ${(state.elapsedMs / 1000).toFixed(1)}s` : ''}
        {state.status === 'cancelled' ? ' · cancelled' : ''}
      </Text>
    </Stack>
  );
}

/**
 * One adjustment in percent. The value beside the label follows the thumb while
 * dragging; the results update when it is released, so dragging never
 * re-encodes the gallery.
 */
function AdjustSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const shown = dragged ?? value;
  return (
    <Stack gap={2} w={150}>
      <Group justify="space-between" gap="xs">
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="xs" fw={500}>
          {formatPercent(shown)}
        </Text>
      </Group>
      <Slider
        size="sm"
        min={ADJUST_RANGE.min}
        max={ADJUST_RANGE.max}
        step={ADJUST_RANGE.step}
        marks={[{ value: 0 }]}
        value={shown}
        onChange={setDragged}
        onChangeEnd={(v) => {
          setDragged(null);
          onChange(v);
        }}
        label={null}
        thumbLabel={label}
      />
    </Stack>
  );
}

/** Run progress, the output options and "Download all". */
export function OutputBar({
  state,
  output,
  onOutputChange,
  baseName,
}: {
  state: RunState;
  output: OutputOptions;
  onOutputChange: (output: OutputOptions) => void;
  baseName: string;
}) {
  const [zipping, setZipping] = useState(false);
  return (
    <Paper withBorder p="sm">
      <WithHelp topic={HELP.output}>
        <Group justify="space-between" align="flex-end" gap="sm">
          <div style={{ flex: 1, minWidth: 200 }}>
            <RunSummary state={state} />
          </div>
          <AdjustSlider
            label="Brightness"
            value={output.adjust.brightness}
            onChange={(brightness) => {
              onOutputChange({ ...output, adjust: { ...output.adjust, brightness } });
            }}
          />
          <AdjustSlider
            label="Saturation"
            value={output.adjust.saturation}
            onChange={(saturation) => {
              onOutputChange({ ...output, adjust: { ...output.adjust, saturation } });
            }}
          />
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Download size
            </Text>
            <SegmentedControl
              size="xs"
              value={output.scale}
              onChange={(v) => {
                onOutputChange({ ...output, scale: v });
              }}
              data={EXPORT_SCALES}
              aria-label="Download scale"
            />
          </Stack>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconFileZip size={16} />}
            disabled={state.results.length === 0 || state.status === 'running'}
            loading={zipping}
            onClick={() => {
              setZipping(true);
              void downloadAll(state, output, baseName).finally(() => {
                setZipping(false);
              });
            }}
          >
            Download all
          </Button>
        </Group>
      </WithHelp>
    </Paper>
  );
}
