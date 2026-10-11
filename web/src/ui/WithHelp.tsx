import { Anchor, Collapse, Group, Stack, Text, VisuallyHidden } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown } from '@tabler/icons-react';
import { useId, type ReactNode } from 'react';

import type { HelpTopic } from './help';

/**
 * A control with a "Learn more" toggle under it that expands its explanation.
 * `actions` sit on the same row, at the right.
 */
export function WithHelp({
  topic,
  actions,
  children,
}: {
  topic: HelpTopic;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure(false);
  const id = useId();
  return (
    <Stack gap={4}>
      {children}
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Anchor
          component="button"
          type="button"
          size="xs"
          onClick={toggle}
          aria-expanded={opened}
          aria-controls={id}
        >
          <Group gap={2} wrap="nowrap">
            <span>
              Learn more<VisuallyHidden> about {topic.about}</VisuallyHidden>
            </span>
            <IconChevronDown
              size={14}
              aria-hidden
              style={{
                transform: opened ? 'rotate(180deg)' : undefined,
                transition: 'transform 150ms',
              }}
            />
          </Group>
        </Anchor>
        {actions}
      </Group>
      <Collapse expanded={opened} id={id}>
        <Stack gap={6} pb={4}>
          {topic.paragraphs.map((p) => (
            <Text key={p} size="xs" c="dimmed">
              {p}
            </Text>
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );
}
