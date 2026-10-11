# Completion criteria (MANDATORY)

A task is NOT complete unless all of these hold:

1. **Tests exist and pass.** New or changed logic has unit tests:
   `cargo test` beside the Rust code, vitest `*.test.ts` beside the TS code.
   `mise run test` is green.
2. **Existing tests that cover the change ran.** Find every test that drives
   the code you touched (grep `engine/tests/`, `web/src/**/*.test.ts`,
   `web/e2e/`) and run it. A broken existing test is yours to fix in the same
   session, never "unrelated".
3. **Engine changes keep the golden fixtures green.** `engine/tests/golden.rs` passes. A change
   that must alter results is a product decision: confirm it with the user,
   then update the fixtures in the same commit and say why in the body.
4. **The real app ran it.** Anything a user can reach (a control, a download,
   an engine path) is exercised in a real browser against the dev server on
   :10099: `mise run e2e`, extended when the feature is new, or a Playwright
   run that drives it. Unit tests mock the seams that break: worker messages,
   WASM loading, canvas encoding.
5. **Lint is clean.** `mise run lint` reports zero errors and zero warnings.
6. **The production build works** when bundling, workers, WASM loading or
   dependencies changed: `mise run build`, then the smoke test against
   `vite preview` on a spare port
   (`PZ_BASE_URL=http://localhost:<port>/pizzelator/`).
7. **Docs were reviewed.** `README.md`, `CLAUDE.md` and `.claude/rules/` match
   the new behavior. If nothing needed changing, the review still happened.

Each check must be able to fail for the reason it claims to test:
`.claude/rules/falsifiable-verification.md`.

When a check fails, fix it. Escalate to the user only when the fix needs a
decision that is theirs: a product change, a dependency the rules forbid, or
access you do not have.
