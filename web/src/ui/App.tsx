import { AppShell, Button, Grid, Group, List, Paper, Stack, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconRestore } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { cropImage, cropLabel } from '../lib/crop';
import type { OutputOptions } from '../lib/output';
import { maxResults, validateParams, type Params } from '../lib/params';
import { DEFAULT_SETTINGS, isDefaultSettings, loadSettings, saveSettings } from '../lib/settings';
import { AppHeader } from './AppHeader';
import { CropDialog } from './CropDialog';
import { EXAMPLE_NAME, fetchExample } from './example';
import { ImageInput } from './ImageInput';
import { OutputBar } from './OutputBar';
import { ParamsForm } from './ParamsForm';
import { Results } from './Results';
import { useRun } from './useRun';
import { useSourceImage } from './useSourceImage';

function baseNameOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_') || 'image';
}

/**
 * Below lg the KiCI link takes a second header row: 88px tall where its text
 * fits on one line, 102px on phones where it wraps (measured at 360 to 1440px).
 */
const HEADER_HEIGHT = { base: 104, xs: 90, lg: 56 };

const storage = (): Storage => window.localStorage;

/** The settings saved by the previous visit, read once per page load. */
const SAVED = loadSettings(storage);

function ResetSettings({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  return (
    <Group justify="space-between">
      <Text size="sm" fw={600}>
        Settings
      </Text>
      <Button
        variant="subtle"
        size="compact-xs"
        leftSection={<IconRestore size={14} />}
        disabled={disabled}
        onClick={onReset}
      >
        Reset all settings
      </Button>
    </Group>
  );
}

export function App() {
  const [params, setParams] = useState<Params>(SAVED.params);
  const { source, crop, setCrop, loading, error: loadError, load } = useSourceImage();
  const [cropOpen, setCropOpen] = useState(false);
  const [output, setOutput] = useState<OutputOptions>(SAVED.output);
  /** Bumped by "Reset all settings" so the form drops its own state too. */
  const [formKey, setFormKey] = useState(0);
  const { state, start, cancel } = useRun();

  useEffect(() => {
    saveSettings(storage, { params, output });
  }, [params, output]);

  /** Loads the example and paints it with the current settings, when they are valid. */
  const onExample = (): void => {
    void load(fetchExample).then((pixels) => {
      if (pixels !== null && validateParams(params, pixels).length === 0) {
        start(pixels, baseNameOf(EXAMPLE_NAME), params);
      }
    });
  };

  /** The pixels a run paints: the selected area, or the whole image. */
  const painted = useMemo(
    () => (source === null ? null : crop === null ? source.pixels : cropImage(source.pixels, crop)),
    [source, crop],
  );
  const errors = validateParams(params, painted);
  const running = state.status === 'running';
  const baseName = source === null ? 'image' : baseNameOf(source.info.name) + cropLabel(crop);

  return (
    <AppShell header={{ height: HEADER_HEIGHT }} padding="md">
      <AppShell.Header>
        <AppHeader />
      </AppShell.Header>
      <AppShell.Main>
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, md: 4, xl: 3 }}>
            {/* On wide screens the form scrolls on its own so results stay in view. */}
            <Paper
              withBorder
              p="md"
              pos={{ base: 'static', md: 'sticky' }}
              top="calc(var(--app-shell-header-height) + 16px)"
              mah={{ md: 'calc(100dvh - var(--app-shell-header-height) - 32px)' }}
              style={{ overflowY: 'auto' }}
            >
              <Stack gap="md">
                <ImageInput
                  image={source?.info ?? null}
                  crop={crop}
                  loading={loading}
                  error={loadError}
                  disabled={running}
                  onFile={(file) => {
                    void load(file);
                  }}
                  onExample={onExample}
                  onSelectArea={() => {
                    setCropOpen(true);
                  }}
                  onClearArea={() => {
                    setCrop(null);
                  }}
                />
                {source !== null && cropOpen && (
                  <CropDialog
                    image={source.info}
                    crop={crop}
                    onClose={() => {
                      setCropOpen(false);
                    }}
                    onApply={(area) => {
                      setCrop(area);
                      setCropOpen(false);
                    }}
                  />
                )}
                <ResetSettings
                  disabled={running || isDefaultSettings({ params, output })}
                  onReset={() => {
                    setParams(DEFAULT_SETTINGS.params);
                    setOutput(DEFAULT_SETTINGS.output);
                    setFormKey((k) => k + 1);
                  }}
                />
                <ParamsForm key={formKey} params={params} onChange={setParams} disabled={running} />
                {source !== null && errors.length > 0 && (
                  <List size="xs" c="red" spacing={2}>
                    {errors.map((e) => (
                      <List.Item key={e}>{e}</List.Item>
                    ))}
                  </List>
                )}
                {running ? (
                  <Button color="red" leftSection={<IconPlayerStop size={16} />} onClick={cancel}>
                    Cancel
                  </Button>
                ) : (
                  <Button
                    leftSection={<IconPlayerPlay size={16} />}
                    disabled={painted === null || errors.length > 0}
                    onClick={() => {
                      if (painted !== null) {
                        start(painted, baseName, params);
                      }
                    }}
                  >
                    Paint · up to {maxResults(params)} images
                  </Button>
                )}
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8, xl: 9 }}>
            {state.status === 'idle' ? (
              <Paper withBorder p="xl">
                <Text c="dimmed" ta="center">
                  {source === null
                    ? 'Pick an image to start.'
                    : 'Set the parameters and press Paint.'}
                </Text>
              </Paper>
            ) : (
              <Stack gap="md">
                <OutputBar
                  state={state}
                  output={output}
                  onOutputChange={setOutput}
                  baseName={baseName}
                />
                <Results state={state} output={output} />
              </Stack>
            )}
          </Grid.Col>
        </Grid>
      </AppShell.Main>
    </AppShell>
  );
}
