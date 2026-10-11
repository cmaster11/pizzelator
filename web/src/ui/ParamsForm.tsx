import { Button, NumberInput, SimpleGrid, Stack, TagsInput, VisuallyHidden } from '@mantine/core';

import { PALETTE_METHODS, PALETTE_SEARCHES, REDRAW_METHODS } from '../engine/types';
import { usesThreshold, type Params } from '../lib/params';
import { ChipField } from './ChipField';
import { ForcedPaletteInput } from './ForcedPaletteInput';
import { HELP } from './help';
import { PaletteCountInput } from './PaletteCountInput';
import { WithHelp } from './WithHelp';

function toNumbers(values: string[]): number[] {
  return values
    .flatMap((v) => v.split(/[\s,]+/))
    .filter((v) => v !== '')
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function asNumber(value: string | number, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/** Empties a field that holds many entries. */
function ClearAll({
  what,
  disabled,
  onClear,
}: {
  what: string;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <Button variant="subtle" size="compact-xs" disabled={disabled} onClick={onClear}>
      Clear all<VisuallyHidden> {what}</VisuallyHidden>
    </Button>
  );
}

export function ParamsForm({
  params,
  onChange,
  disabled,
}: {
  params: Params;
  onChange: (params: Params) => void;
  disabled: boolean;
}) {
  const set = (patch: Partial<Params>): void => {
    onChange({ ...params, ...patch });
  };
  const forced = params.forcedPalette !== null;
  const thresholdsUsed = params.paletteMethods.some(usesThreshold);
  /** Max images and the tolerances only steer the tolerance search. */
  const toleranceOff = disabled || forced || !params.paletteSearches.includes('tolerance');

  return (
    <Stack gap="md">
      <WithHelp
        topic={HELP.targetSizes}
        actions={
          <ClearAll
            what="target sizes"
            disabled={disabled || params.targetSizes.length === 0}
            onClear={() => {
              set({ targetSizes: [] });
            }}
          />
        }
      >
        <TagsInput
          label="Target sizes (px)"
          description="Pixels along the image's shorter side; one result set per size."
          value={params.targetSizes.map(String)}
          onChange={(v) => {
            set({ targetSizes: [...new Set(toNumbers(v).map(Math.round))] });
          }}
          splitChars={[',', ' ']}
          acceptValueOnBlur
          disabled={disabled}
        />
      </WithHelp>
      <WithHelp topic={HELP.paletteColors}>
        <PaletteCountInput
          value={params.paletteCount}
          onChange={(paletteCount) => {
            set({ paletteCount });
          }}
          disabled={disabled || forced}
        />
      </WithHelp>
      <WithHelp topic={HELP.paletteSearch}>
        <ChipField
          label="Palette search"
          description="How the palettes are found; each runs for every method and threshold."
          options={PALETTE_SEARCHES}
          value={params.paletteSearches}
          onChange={(paletteSearches) => {
            set({ paletteSearches });
          }}
          disabled={disabled || forced}
        />
      </WithHelp>
      <WithHelp topic={HELP.maxImages}>
        <NumberInput
          label="Max images"
          description="Palettes kept per tolerance search."
          value={params.maxImages}
          onChange={(v) => {
            set({ maxImages: asNumber(v, params.maxImages) });
          }}
          min={1}
          max={64}
          allowDecimal={false}
          disabled={toleranceOff}
        />
      </WithHelp>
      <WithHelp topic={HELP.paletteMethods}>
        <ChipField
          label="Palette methods"
          description="How each color group becomes one palette color."
          options={PALETTE_METHODS}
          value={params.paletteMethods}
          onChange={(paletteMethods) => {
            set({ paletteMethods });
          }}
          disabled={disabled || forced}
        />
      </WithHelp>
      <WithHelp
        topic={HELP.thresholds}
        actions={
          <ClearAll
            what="thresholds"
            disabled={disabled || forced || !thresholdsUsed || params.thresholds.length === 0}
            onClear={() => {
              set({ thresholds: [] });
            }}
          />
        }
      >
        <TagsInput
          label="Thresholds"
          description="Position from 0 to 1 within each sorted color group, for the HSLuv and HCL methods."
          value={params.thresholds.map(String)}
          onChange={(v) => {
            set({ thresholds: [...new Set(toNumbers(v))] });
          }}
          splitChars={[',', ' ']}
          acceptValueOnBlur
          disabled={disabled || forced || !thresholdsUsed}
        />
      </WithHelp>
      <WithHelp topic={HELP.redrawMethods}>
        <ChipField
          label="Redraw methods"
          description="Color distance used to map pixels onto the palette."
          options={REDRAW_METHODS}
          value={params.redrawMethods}
          onChange={(redrawMethods) => {
            set({ redrawMethods });
          }}
          disabled={disabled}
        />
      </WithHelp>
      <WithHelp topic={HELP.tolerance}>
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput
            label="Initial tolerance"
            description="CIEDE2000 grouping start"
            value={params.tolerance}
            onChange={(v) => {
              set({ tolerance: asNumber(v, params.tolerance) });
            }}
            min={0}
            step={0.005}
            decimalScale={5}
            disabled={toleranceOff}
          />
          <NumberInput
            label="Tolerance increment"
            description="Search step"
            value={params.increment}
            onChange={(v) => {
              set({ increment: asNumber(v, params.increment) });
            }}
            min={0}
            step={0.001}
            decimalScale={6}
            disabled={toleranceOff}
          />
        </SimpleGrid>
      </WithHelp>
      <WithHelp topic={HELP.forcedPalette}>
        <ForcedPaletteInput
          value={params.forcedPalette}
          onChange={(forcedPalette) => {
            set({ forcedPalette });
          }}
          disabled={disabled}
        />
      </WithHelp>
    </Stack>
  );
}
