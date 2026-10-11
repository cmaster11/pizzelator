import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';
import { ReactCrop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { cropToPercent, snapCrop, type CropRect } from '../lib/crop';
import type { LoadedImage } from './ImageInput';

function initialSelection(image: LoadedImage, crop: CropRect | null): PercentCrop | undefined {
  return crop === null
    ? undefined
    : { unit: '%', ...cropToPercent(crop, image.width, image.height) };
}

/**
 * Drag on the image to select the area to paint; drag the selection or its
 * handles to adjust it. Works with a mouse and with touch. Mounted only while
 * open, so the selection starts from the current area each time.
 */
export function CropDialog({
  image,
  crop,
  onClose,
  onApply,
}: {
  image: LoadedImage;
  crop: CropRect | null;
  onClose: () => void;
  onApply: (crop: CropRect | null) => void;
}) {
  const small = useMediaQuery('(max-width: 48em)');
  const [selection, setSelection] = useState(() => initialSelection(image, crop));
  const snapped = selection === undefined ? null : snapCrop(selection, image.width, image.height);

  return (
    <Modal
      opened
      onClose={onClose}
      title="Select the area to paint"
      size="xl"
      fullScreen={small}
      centered
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Drag on the image to select an area; drag the selection or its handles to adjust it.
        </Text>
        <div style={{ textAlign: 'center' }}>
          <ReactCrop
            crop={selection}
            onChange={(_, percent) => {
              setSelection(percent);
            }}
            ruleOfThirds
            // As wide as the dialog allows, but no taller than the viewport allows, so small
            // images scale up into an easy touch target.
            style={{
              width: `min(100%, calc(${small ? 65 : 70}dvh * ${image.width / image.height}))`,
            }}
          >
            <img
              src={image.url}
              alt="Image to crop"
              style={{ display: 'block', width: '100%', imageRendering: 'pixelated' }}
            />
          </ReactCrop>
        </div>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm" data-testid="crop-size">
            {snapped === null
              ? `Whole image · ${image.width} × ${image.height} px`
              : `${snapped.width} × ${snapped.height} px at ${snapped.x}, ${snapped.y}`}
          </Text>
          <Group gap="xs">
            <Button
              variant="default"
              onClick={() => {
                setSelection(undefined);
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                onApply(snapped);
              }}
            >
              Use this area
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
