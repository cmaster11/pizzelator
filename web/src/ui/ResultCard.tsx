import { ActionIcon, Card, Group, Text, Tooltip } from '@mantine/core';
import { IconDownload, IconPalette } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { adjustImage, adjustLabel, adjustPalette, type Adjustments } from '../lib/adjust';
import { downloadBlob } from '../lib/download';
import { encodePng } from '../lib/image';
import type { OutputOptions } from '../lib/output';
import { exportName, exportPalette, exportPng, pngName } from './export';
import { ExportMenu } from './ExportMenu';
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

/** A message that replaces the caption for a few seconds. */
function useStatus(): { text: string | null; show: (text: string) => void } {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (text === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setText(null);
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);
  return { text, show: setText };
}

/** The narrowest fixed-size card, in CSS pixels: room for a caption and three buttons. */
const MIN_FIXED_WIDTH = 160;

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
  const status = useStatus();
  const fit = output.display === 'fit';
  const factor = fit ? 1 : Number(output.display);
  return (
    // A fixed-size card is as wide as its image, but at least wide enough for
    // the caption and its buttons, so small results line up in even cards. It
    // is never wider than the gallery: a wider image scrolls inside the card.
    <Card
      withBorder
      padding="xs"
      w={fit ? undefined : 'min-content'}
      maw="100%"
      data-testid="result-card"
    >
      <Card.Section style={{ overflowX: 'auto', minWidth: fit ? undefined : MIN_FIXED_WIDTH }}>
        <img
          src={url ?? undefined}
          alt={`Result ${name}`}
          width={width}
          height={height}
          style={{
            width: fit ? '100%' : width * factor,
            height: fit ? 'auto' : height * factor,
            maxWidth: 'none',
            display: 'block',
            margin: '0 auto',
            imageRendering: 'pixelated',
          }}
        />
      </Card.Section>
      <Group justify="space-between" mt="xs" wrap="nowrap" gap={4}>
        <Text size="xs" c="dimmed" data-testid="result-caption">
          {status.text ?? caption}
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
                  downloadBlob(blob, `${pngName(result, output)}.png`);
                });
              }}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          <ExportMenu result={result} output={output} onStatus={status.show} />
        </Group>
      </Group>
      <PaletteSwatches colors={palette} size={12} />
    </Card>
  );
}
