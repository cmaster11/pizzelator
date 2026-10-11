import { Group, Input, NumberInput, SegmentedControl } from '@mantine/core';
import { useState } from 'react';

const PRESETS = [16, 24, 32];
const CUSTOM = 'custom';

/** Palette size: a preset button, or "Custom" with a number input for any count. */
export function PaletteCountInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  const [custom, setCustom] = useState(!PRESETS.includes(value));

  return (
    <Input.Wrapper label="Palette colors" description="Colors in each searched palette.">
      <Group gap="xs" mt={6} wrap="nowrap">
        <SegmentedControl
          size="xs"
          style={{ flex: 1 }}
          aria-label="Palette colors"
          value={custom ? CUSTOM : String(value)}
          onChange={(v) => {
            setCustom(v === CUSTOM);
            if (v !== CUSTOM) {
              onChange(Number(v));
            }
          }}
          data={[
            ...PRESETS.map((n) => ({ value: String(n), label: String(n) })),
            { value: CUSTOM, label: 'Custom' },
          ]}
          disabled={disabled}
        />
        {custom && (
          <NumberInput
            size="xs"
            w={80}
            aria-label="Custom palette colors"
            value={value}
            onChange={(v) => {
              if (typeof v === 'number') {
                onChange(v);
              }
            }}
            min={1}
            max={256}
            allowDecimal={false}
            disabled={disabled}
          />
        )}
      </Group>
    </Input.Wrapper>
  );
}
