import { Button, Group, Image, Stack, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import {
  IconBuildingSkyscraper,
  IconCrop,
  IconPhoto,
  IconUpload,
  IconX,
} from '@tabler/icons-react';

import type { CropRect } from '../lib/crop';

export interface LoadedImage {
  name: string;
  url: string;
  width: number;
  height: number;
}

export function ImageInput({
  image,
  crop,
  loading,
  error,
  disabled,
  onFile,
  onExample,
  onSelectArea,
  onClearArea,
}: {
  image: LoadedImage | null;
  crop: CropRect | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  /** Loads the example image and paints it. */
  onExample: () => void;
  onSelectArea: () => void;
  onClearArea: () => void;
}) {
  return (
    <Stack gap="xs">
      <Dropzone
        onDrop={(files) => {
          const [file] = files;
          if (file !== undefined) {
            onFile(file);
          }
        }}
        accept={IMAGE_MIME_TYPE}
        multiple={false}
        loading={loading}
        disabled={disabled}
        aria-label="Input image"
      >
        <Group
          justify="center"
          gap="md"
          mih={image === null ? 120 : 64}
          style={{ pointerEvents: 'none' }}
        >
          <Dropzone.Accept>
            <IconUpload size={36} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={36} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto size={36} stroke={1.5} />
          </Dropzone.Idle>
          <div>
            <Text size="md" inline>
              {image === null
                ? 'Drop an image here or click to pick one'
                : 'Drop or click to replace the image'}
            </Text>
            <Text size="xs" c="dimmed" mt={6}>
              PNG, JPEG, WebP or GIF. Everything stays in your browser.
            </Text>
          </div>
        </Group>
      </Dropzone>
      <Group justify="center">
        <Button
          size="sm"
          variant="light"
          fw={700}
          leftSection={<IconBuildingSkyscraper size={18} />}
          onClick={onExample}
          disabled={disabled || loading}
        >
          Try the example: a city street
        </Button>
      </Group>
      {error !== null && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
      {image !== null && (
        <Group gap="sm" wrap="nowrap" align="center">
          <Image src={image.url} alt="Input preview" h={72} w={72} fit="contain" radius="sm" />
          <div>
            <Text size="sm" fw={500} lineClamp={1}>
              {image.name}
            </Text>
            <Text size="xs" c="dimmed">
              {image.width} × {image.height} px
            </Text>
            <Text size="xs" data-testid="painted-area">
              {crop === null
                ? 'Painting the whole image'
                : `Painting ${crop.width} × ${crop.height} px at ${crop.x}, ${crop.y}`}
            </Text>
          </div>
        </Group>
      )}
      {image !== null && (
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCrop size={16} />}
            onClick={onSelectArea}
            disabled={disabled}
          >
            Select area
          </Button>
          {crop !== null && (
            <Button size="xs" variant="subtle" onClick={onClearArea} disabled={disabled}>
              Use whole image
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
