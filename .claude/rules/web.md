---
paths:
  - 'web/**'
---

# Web app rules (MANDATORY)

Auto-loads when files under `web/**` are touched.

## Architecture

- **No backend.** Everything runs in the browser. Network calls are limited to
  loading the app's own assets.
- **Heavy work never runs on the UI thread.** The engine runs in Web Workers
  (`web/src/engine/worker.ts`) managed by `web/src/engine/pool.ts`; one-off
  tasks (PNG decoding, palette extraction) use `runTask`. The UI thread only
  renders, encodes small PNGs and builds zips.
- **One message protocol.** Every worker message is a member of
  `WorkerRequest` or `WorkerResponse` in `web/src/engine/types.ts`. Add a
  member there first, then handle it on both sides. Transfer large buffers
  (`postMessage(msg, { transfer })`) instead of copying them.
- **Engine input is 16-bit.** `SourceImage.rgba16` holds straight-alpha 16-bit
  RGBA. PNGs are decoded by the engine (`decodePngInWorker`); a canvas
  premultiplies alpha and shifts semi-transparent colors.
- **Pure logic lives in `web/src/lib/`** with unit tests beside it. Components
  in `web/src/ui/` stay thin.

## TypeScript

- Strict mode with `noUncheckedIndexedAccess`; ESM only.
- ESLint (`typescript-eslint` strict and stylistic, type-checked; React hooks)
  passes with zero warnings. `max-lines-per-function` is 200; split instead of
  disabling it.
- Prettier (single quotes, 100 columns) owns formatting.
- Enums over repeated strings: method ids come from `PALETTE_METHODS` and
  `REDRAW_METHODS`, and tests use those values.
- No `any`, no non-null assertions, no unchecked casts of untrusted data.
  Parse it, as `parsePaletteJson` does.

## UI

- Use Mantine components and theme tokens. Do not hand-roll a control Mantine
  has.
- **No hollow UI.** A control that looks implemented but does not work is worse
  than no control. Every input reaches the engine or is visibly disabled with
  a reason.
- Long work shows progress and can be cancelled. Errors appear where the user
  is looking, in words that say what to change.
- Check layouts at 390px and 1440px wide, in light and dark color schemes.
- Accessible names on every control (`aria-label` on icon buttons); tests
  select by role and name, or by `data-testid` for repeated cards.

## Tests

- Unit: vitest, `*.test.ts` beside the module, run by `mise run test`.
- Browser: Playwright specs in `web/e2e/`, run by `mise run e2e` against the
  dev server at `http://localhost:10099/pizzelator/` (`PZ_BASE_URL` points
  elsewhere and must include the base path; `PZ_CHROMIUM` picks a
  system browser).
- **Assert effects, not appearance.** A visible button proves nothing; the
  downloaded PNG's dimensions, the number of results and the absence of
  console errors do. Pin counts against an independent source (the engine's
  golden fixtures), not against a value the app computed.
