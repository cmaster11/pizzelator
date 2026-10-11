import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconArrowUpRight,
  IconBrandGithub,
  IconMoon,
  IconStar,
  IconSun,
} from '@tabler/icons-react';

const REPO_URL = 'https://github.com/cmaster11/pizzelator';
const AUTHOR_URL = 'https://github.com/cmaster11';
const KICI_URL = 'https://kici.dev';
const KICI_HOOK = 'CI your LLM can develop and test autonomously';

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

/**
 * A link to the author's other project. A plain link: no tracking parameters
 * and nothing loaded from kici.dev. Narrow screens show the name only.
 */
function KiciLink() {
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="xs" c="dimmed" visibleFrom="lg" style={{ whiteSpace: 'nowrap' }}>
        also by cmaster11 ·
      </Text>
      <Button
        component="a"
        href={KICI_URL}
        target="_blank"
        rel="noreferrer"
        variant="light"
        size="compact-sm"
        rightSection={<IconArrowUpRight size={14} />}
        title={`KiCI: ${KICI_HOOK}`}
      >
        <Text span inherit visibleFrom="lg">
          KiCI: {KICI_HOOK}
        </Text>
        <Text span inherit hiddenFrom="lg">
          KiCI
        </Text>
      </Button>
    </Group>
  );
}

/**
 * Asks for a star on the source repository. No star count: showing one would
 * mean a request to GitHub from every visitor's browser.
 */
function StarOnGitHub() {
  return (
    <Button
      component="a"
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      variant="default"
      size="compact-sm"
      aria-label="Star Pizzelator on GitHub"
      leftSection={<IconBrandGithub size={16} />}
      rightSection={<IconStar size={14} />}
    >
      <Text span inherit visibleFrom="sm">
        Star on GitHub
      </Text>
    </Button>
  );
}

/** The name, its author, the KiCI link, the star link and the color scheme toggle. */
export function AppHeader() {
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3} fz={{ base: 'h4', sm: 'h3' }}>
          Pizzelator
        </Title>
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }} data-testid="byline">
          by{' '}
          <Anchor href={AUTHOR_URL} target="_blank" rel="noreferrer" inherit>
            cmaster11
          </Anchor>
        </Text>
        <Text size="sm" c="dimmed" visibleFrom="xl">
          · pixel art from any image, computed in your browser
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <KiciLink />
        <StarOnGitHub />
        <ColorSchemeToggle />
      </Group>
    </Group>
  );
}
