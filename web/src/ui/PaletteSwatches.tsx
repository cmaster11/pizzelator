import { ColorSwatch, Group, Tooltip } from '@mantine/core';

import type { PaletteColor } from '../engine/types';
import { toCss } from '../lib/palette';

export function PaletteSwatches({ colors, size = 16 }: { colors: PaletteColor[]; size?: number }) {
  return (
    <Group gap={4} wrap="wrap" aria-label={`${colors.length}-color palette`}>
      {colors.map((c, i) => {
        const css = toCss(c);
        return (
          <Tooltip key={`${css}-${i}`} label={`${css} · ${c.weight} px`} withArrow>
            <ColorSwatch color={css} size={size} radius="xs" withShadow={false} />
          </Tooltip>
        );
      })}
    </Group>
  );
}
