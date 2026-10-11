# Pizzelator development context

Pizzelator turns an image into pixel art in the browser. A Rust engine
(`engine/`) compiled to WebAssembly runs in a pool of Web Workers under a Vite +
React + Mantine app (`web/`). There is no backend: decoding, the palette
search, redraws and PNG encoding all run client-side. Adding a server is a
product decision to confirm with the user first, not an implementation detail.

`README.md` covers the algorithm, the layout and every command.

## Persistence rule

When asked to "remember" something, write it into a committed file: this
`CLAUDE.md`, `.claude/rules/`, docs, or source. Local memory files are not
committed and do not reach other machines or sessions.

## The dev server (MANDATORY)

Development always uses the one permanent dev server on **port 10099**
(`http://0.0.0.0:10099/pizzelator/`), a systemd user unit managed by
`scripts/dev-service.sh`. It serves `web/` with Vite and rebuilds the WASM
engine when the Rust sources change.

- Never start a second Vite, `vite preview` or other server on 10099.
  `strictPort` makes a second one fail.
- Not running? Use `scripts/dev-service.sh status`, then `logs`, then
  `restart`, and fix the cause. Do not work around it with a foreground
  server.
- Verify in the browser against this server: `mise run e2e`, or Playwright
  driving `http://localhost:10099/pizzelator/`.

Details: `.claude/rules/dev-server.md`.

## Deployment

Every push to `main` runs `.github/workflows/pages.yml`: lint, tests and the
production build, then `web/dist/` goes to the `gh-pages` branch, which
GitHub Pages serves at `https://cmaster11.github.io/pizzelator/`. There is no
other deployment. Work on a branch and merge to `main` to release.

## Commands

| Command                 | When                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `mise run lint`         | Before every commit; zero errors and zero warnings              |
| `mise run test`         | Engine tests (including the golden fixtures) and web unit tests |
| `mise run e2e`          | Browser smoke test against the dev server                       |
| `mise run build`        | Production build; run it when bundling or worker setup changes  |
| `mise run build-engine` | Rebuild the WASM by hand (the dev server already does)          |

Every tool is pinned in `.mise.toml`. Run commands through mise
(`mise exec -- <cmd>` or `mise run <task>`).

## Engineering principles (MANDATORY)

- **No workarounds; fix root causes.** Never filter out data that should work,
  make a required input optional, add a fallback that hides a failure, or
  hardcode a value that should be computed. If the real fix is too large for
  the task, stop and say so. An honest "not done yet" beats a hidden
  regression.
- **No MVP-then-fix.** Choose the design you would keep. Do not ship a quick
  version planned for a later rewrite.
- **No "pre-existing" and no "flaky".** A failure you see in a run you started
  is yours: find the cause and fix it. "Flaky" is a hypothesis, not a verdict.
- **Determinism is a feature.** The same inputs give the same pixels in every
  browser and on every machine. Anything order- or float-sensitive gets a
  defined order (see `.claude/rules/engine.md`).
- **YAGNI.** Build what the task needs, with the boundaries it needs. Do not
  add speculative options or layers.

## Always-on rules

Each file is the full rule; read it when its trigger fires.

| Rule                                        | Trigger                                 |
| ------------------------------------------- | --------------------------------------- |
| `.claude/rules/completion-criteria.md`      | About to call any task done             |
| `.claude/rules/falsifiable-verification.md` | About to call anything verified         |
| `.claude/rules/search-false-negatives.md`   | A search came back empty                |
| `.claude/rules/verify-current-docs.md`      | Relying on a version, flag or API shape |
| `.claude/rules/git.md`                      | Committing, deleting files, branching   |

Path-scoped rules load on their own: `engine.md` (`engine/**`), `web.md`
(`web/**`), `backend.md` (`server/**`), `dev-server.md`, `comments-and-prose.md`,
`dead-code.md`, `claude-rules.md`.

## Writing

Use sentence case everywhere: commits, headings, comments, docs, UI labels.
Never use American title case. Comments and docs describe what the code does
now, not how it got there; history lives in commits. Full rule:
`.claude/rules/comments-and-prose.md`.
