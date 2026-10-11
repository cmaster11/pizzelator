import { Button, FileInput, Group, Stack, Text } from '@mantine/core';
import { IconPalette } from '@tabler/icons-react';
import { useState } from 'react';

import { extractPalette } from '../engine/pool';
import type { PaletteColor } from '../engine/types';
import { decodeImage } from '../lib/image';
import { parsePaletteJson } from '../lib/palette';
import { PaletteSwatches } from './PaletteSwatches';

async function loadPalette(file: File): Promise<PaletteColor[]> {
  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    return parsePaletteJson(await file.text());
  }
  return extractPalette(await decodeImage(file));
}

/** Loads a palette from a palette JSON file or from every distinct color of an image. */
export function ForcedPaletteInput({
  value,
  onChange,
  disabled,
}: {
  value: PaletteColor[] | null;
  onChange: (colors: PaletteColor[] | null) => void;
  disabled: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = (picked: File | null): void => {
    setFile(picked);
    setError(null);
    if (picked === null) {
      onChange(null);
      return;
    }
    setLoading(true);
    loadPalette(picked)
      .then((colors) => {
        onChange(colors);
      })
      .catch((err: unknown) => {
        setFile(null);
        onChange(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Stack gap={6}>
      <FileInput
        label="Forced palette"
        description="Skip the palette search and redraw with this palette: a palette JSON file, or an image whose distinct colors become the palette."
        placeholder="None"
        accept="application/json,.json,image/*"
        leftSection={<IconPalette size={16} />}
        value={file}
        onChange={pick}
        error={error}
        clearable
        disabled={disabled || loading}
      />
      {value !== null && (
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {value.length} colors
            </Text>
            <PaletteSwatches colors={value} size={14} />
          </Stack>
          <Button
            variant="subtle"
            size="compact-xs"
            disabled={disabled}
            onClick={() => {
              pick(null);
            }}
          >
            Clear
          </Button>
        </Group>
      )}
    </Stack>
  );
}
