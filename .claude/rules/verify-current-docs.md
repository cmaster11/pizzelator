# Verify current external information (MANDATORY)

Training knowledge goes stale. For anything external and version-sensitive,
treat memory as a hypothesis to check, not a fact.

## When this fires

- Adding a dependency, tool or API this repo does not use yet.
- Relying on specifics of any external thing, even one already pinned: the
  latest version, a flag, a config key, an API shape, a default, a
  deprecation.
- Any research request.

It does not fire for an already-pinned dependency used exactly as the
surrounding code uses it.

## What to do

1. Search for the current state as of today, and say "as of <date>".
2. Read the primary source: the project's docs, changelog or release notes.
3. Check the repo's own pins (`.mise.toml`, `web/package.json`,
   `engine/Cargo.toml`, the lock files) so what you cite matches what the repo
   uses.
4. Cite what you checked and when.

If you cannot verify, say so loudly ("from memory, not verified as of
<date>"). Never present recalled specifics as current fact.

## Pinning policy

- Every tool is pinned to an exact version in `.mise.toml`; every package to an
  exact version in its manifest. No ranges, no `latest`.
- New versions must be at least 48 hours old. `pnpm-workspace.yaml` enforces
  this for npm (`minimumReleaseAge`); apply the same bar by hand to crates and
  mise tools.
- When the same version is pinned in two places (the `wasm-bindgen` crate in
  `engine/Cargo.toml` and the `wasm-bindgen` CLI in `.mise.toml`), change both
  in the same commit. wasm-bindgen refuses to run when they differ.
