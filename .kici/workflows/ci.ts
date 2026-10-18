// Checks every pull request against main and every push to main: lint, tests
// and the production build. A push to main then publishes the built site to
// the gh-pages branch, which GitHub Pages serves.

import { isEventType, job, pr, push, rule, step, workflow } from '@kici-dev/sdk';

// The orchestrator's container pool: a fresh agent container per job.
const runsOn = ['linux', 'container'];

const check = job('check', {
  runsOn,
  // Installs the toolchain pinned in .mise.toml; the preset caches it under a
  // key derived from that file.
  init: { mise: { version: '2026.5.1' } },
  steps: [
    step('unshallow', async ({ $ }) => {
      // The agent clones shallow, and gitleaks in `mise run lint` scans the
      // whole history.
      const { stdout } = await $`git rev-parse --is-shallow-repository`;
      if (stdout.trim() === 'true') await $`git fetch --quiet --unshallow`;
    }),
    step('install', async ({ $ }) => {
      await $`pnpm install --frozen-lockfile`;
      await $`pnpm --dir .kici install --frozen-lockfile`;
    }),
    step('lint', async ({ $ }) => {
      await $`mise run lint`;
    }),
    step('test', async ({ $ }) => {
      await $`mise run test`;
    }),
    step('build', async ({ $, artifacts }) => {
      await $`mise run build`;
      await artifacts.upload('site', ['web/dist']);
    }),
  ],
});

const publish = job('publish', {
  runsOn,
  needs: [check],
  rules: [
    rule('push to main', (ctx) => {
      if (!isEventType(ctx.event, 'push')) return false;
      return ctx.event.payload.ref === 'refs/heads/main';
    }),
  ],
  // Holds the gh-pages deploy key. The context admits only trusted pushes to
  // main and runs one publish at a time.
  context: 'pages',
  gitCredentials: {
    default: { kind: 'ssh', privateKeySecret: 'pages:PAGES_DEPLOY_KEY' },
  },
  // The agent image has no ssh client.
  init: { apt: { packages: ['openssh-client'] } },
  steps: [
    step('publish', async ({ $, artifacts, repo }) => {
      if (!repo?.sha) throw new Error('publish needs the checked-out commit');
      await artifacts.download('site');
      await repo.withWrite({ permissions: { contents: 'write' } }, async () => {
        await $`scripts/publish-pages.sh ${repo.identifier} ${repo.sha}`;
      });
    }),
  ],
});

export default workflow('ci', {
  on: [pr({ target: 'main' }), push({ branches: ['main'] })],
  jobs: [check, publish],
});
