---
paths:
  - 'engine/src/**'
  - 'engine/tests/**'
  - 'web/src/**'
  - 'web/e2e/**'
  - 'scripts/**'
---

# Dead code is deleted, not kept (MANDATORY)

Auto-loads when files under `engine/src/**`, `engine/tests/**`, `web/src/**`,
`web/e2e/**` or `scripts/**` are touched.

Code nothing reaches is deleted: not commented out, not marked unused, not
left behind a TODO. Git history is the undo. **Ambiguity resolves to delete**,
but only after the citation below.

## A deletion you cannot cite is not made

Acceptable evidence that code is dead:

- the compiler or language server: `cargo` warnings, find-all-references in
  rust-analyzer or the TypeScript server; or
- `command grep -rn` (the real binary) plus a positive control
  (`.claude/rules/search-false-negatives.md`).

The commit body names what was deleted and the evidence, in one line each.

## Never dead, whatever the reference count says

- **The WASM API** (`engine/src/wasm.rs`): its callers are in JavaScript, not
  Rust. Check `web/src/engine/` before removing an export.
- **Dynamic dispatch**: method ids parsed from strings (`PaletteMethod::parse`,
  `RedrawMethod::parse`), message types switched on in the worker.
- **Generated files** (`web/src/engine/wasm/`): regenerate them, never edit
  or prune them.
- **Golden fixtures and sample images** used by tests, even when nothing
  imports them by name.

## Wire it instead, when intent is citable

Unreferenced code with evidence it was meant to run (a sibling call site, a
test asserting the behavior, a doc promising it) is a missing call: a bug to
fix, not dead code.

## Encountered, not hunted

This rule covers dead code you meet in files the task already touches. It is
not a licence for a tree-wide sweep; that is a task of its own.
