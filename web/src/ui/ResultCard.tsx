import { ActionIcon, Card, Group, Text, Tooltip } from '@mantine/core';
import { IconDownload, IconPalette } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { adjustImage, adjustLabel, adjustPalette, type Adjustments } from '../lib/adjust';
import { downloadBlob } from '../lib/download';
import { encodePng } from '../lib/image';
import type { OutputOptions } from '../lib/output';
import { exportName, exportPalette, exportPng } from './export';
import { PaletteSwatches } from './PaletteSwatches';
import type { ResultView } from './useRun';

/**
 * Object URL of the result with `adjust` applied; the run's own URL without
 * adjustments. While new settings encode, the last adjusted image stays up.
 */
function useAdjustedUrl(result: ResultView, adjust: Adjustments): string | null {
  const key = adjustLabel(adjust);
  const [shown, setShown] = useState<string | null>(null);
  const { brightness, saturation } = adjust;
  useEffect(() => {
    if (key === '') {
      return undefined;
    }
    let live = true;
    void encodePng(adjustImage(result.image, { brightness, saturation })).then((blob) => {
      if (live) {
        setShown(URL.createObjectURL(blob));
      }
    });
    return () => {
      live = false;
    };
  }, [result, key, brightness, saturation]);
  // Each URL is revoked once it is replaced, or when the card goes away.
  useEffect(
    () => () => {
      if (shown !== null) {
        URL.revokeObjectURL(shown);
      }
    },
    [shown],
  );
  return key === '' ? result.url : shown;
}

export function ResultCard({
  result,
  caption,
  output,
}: {
  result: ResultView;
  caption: string;
  output: OutputOptions;
}) {
  const { width, height } = result.image;
  const url = useAdjustedUrl(result, output.adjust);
  const palette = useMemo(
    () => adjustPalette(result.palette, output.adjust),
    [result.palette, output.adjust],
  );
  const name = exportName(result, output);
  return (
    <Card withBorder padding="xs" data-testid="result-card">
      <Card.Section>
        <img
          src={url ?? undefined}
          alt={`Result ${name}`}
          width={width}
          height={height}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            imageRendering: 'pixelated',
          }}
        />
      </Card.Section>
      <Group justify="space-between" mt="xs" wrap="nowrap" gap={4}>
        <Text size="xs" c="dimmed">
          {caption}
        </Text>
        <Group gap={2} wrap="nowrap">
          <Tooltip label="Download palette JSON" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label="Download palette JSON"
              onClick={() => {
                downloadBlob(exportPalette(result, output), `${name}.palette.json`);
              }}
            >
              <IconPalette size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Download PNG" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label="Download PNG"
              onClick={() => {
                void exportPng(result, output).then((blob) => {
                  downloadBlob(blob, `${name}.png`);
                });
              }}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <PaletteSwatches colors={palette} size={12} />
    </Card>
  );
}
