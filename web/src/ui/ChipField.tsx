import { Chip, Group, Input, Tooltip } from '@mantine/core';

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  /** Shown in a tooltip over the chip. */
  description?: string;
}

/** A labelled multi-select of chips. */
export function ChipField<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  options: readonly ChipOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  disabled: boolean;
}) {
  return (
    <Input.Wrapper label={label} description={description}>
      <Chip.Group multiple value={value} onChange={onChange}>
        <Group gap={6} mt={6}>
          {options.map((o) => {
            const chip = (
              <Chip value={o.id} size="xs" disabled={disabled}>
                {o.label}
              </Chip>
            );
            return o.description === undefined ? (
              <div key={o.id}>{chip}</div>
            ) : (
              <Tooltip key={o.id} label={o.description} multiline w={260} withArrow>
                <div>{chip}</div>
              </Tooltip>
            );
          })}
        </Group>
      </Chip.Group>
    </Input.Wrapper>
  );
}
