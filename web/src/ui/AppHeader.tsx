import {
  ActionIcon,
  Anchor,
  Group,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconBrandGithub, IconMoon, IconSun } from '@tabler/icons-react';

const REPO_URL = 'https://github.com/cmaster11/pizzelator';
const AUTHOR_URL = 'https://github.com/cmaster11';

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  return (
    <ActionIcon
      variant="default"
      aria-label="Toggle color scheme"
      onClick={() => {
        setColorScheme(computed === 'light' ? 'dark' : 'light');
      }}
    >
      {computed === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
    </ActionIcon>
  );
}

/** The name, its author, the source link and the color scheme toggle. */
export function AppHeader() {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3}>Pizzelator</Title>
        <Text size="sm" c="dimmed">
          by{' '}
          <Anchor href={AUTHOR_URL} target="_blank" rel="noreferrer" inherit>
            cmaster11
          </Anchor>
        </Text>
        <Text size="sm" c="dimmed" visibleFrom="md">
          · pixel art from any image, computed in your browser
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <ActionIcon
          component="a"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          variant="default"
          aria-label="Source code on GitHub"
        >
          <IconBrandGithub size={16} />
        </ActionIcon>
        <ColorSchemeToggle />
      </Group>
    </Group>
  );
}
