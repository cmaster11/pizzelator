import { ActionIcon, Menu, Text } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';

import { downloadBlob } from '../lib/download';
import { EXPORT_SCALES, type OutputOptions } from '../lib/output';
import { copyPng, copyUnavailable, exportPng, pngName } from './export';
import type { ResultView } from './useRun';

/**
 * Copies or downloads one result at any scale, whatever the download size
 * set for the run. `onStatus` reports how a copy went.
 */
export function ExportMenu({
  result,
  output,
  onStatus,
}: {
  result: ResultView;
  output: OutputOptions;
  onStatus: (status: string) => void;
}) {
  const noCopy = copyUnavailable();
  return (
    <Menu position="bottom-end" withArrow>
      <Menu.Target>
        <ActionIcon variant="subtle" size="sm" aria-label="More export options">
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Copy PNG</Menu.Label>
        {noCopy !== null && (
          <Text size="xs" c="dimmed" px="sm" maw={200}>
            {noCopy}
          </Text>
        )}
        {EXPORT_SCALES.map(({ value, label }) => (
          <Menu.Item
            key={`copy-${value}`}
            aria-label={`Copy PNG at ${label}`}
            disabled={noCopy !== null}
            onClick={() => {
              copyPng(result, { ...output, scale: value })
                .then(() => {
                  onStatus(`Copied ${label} PNG`);
                })
                .catch((err: unknown) => {
                  onStatus(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
                });
            }}
          >
            {label}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Label>Download PNG</Menu.Label>
        {EXPORT_SCALES.map(({ value, label }) => (
          <Menu.Item
            key={`download-${value}`}
            aria-label={`Download PNG at ${label}`}
            onClick={() => {
              const scaled = { ...output, scale: value };
              void exportPng(result, scaled).then((blob) => {
                downloadBlob(blob, `${pngName(result, scaled)}.png`);
              });
            }}
          >
            {label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
