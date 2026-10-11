---
paths:
  - 'engine/**'
  - '.cargo/**'
  - 'scripts/zig-cc'
---

# Engine rules (MANDATORY)

Auto-loads when files under `engine/**` or `.cargo/**`, or `scripts/zig-cc`,
are touched.

The engine is a Rust crate built two ways: `cdylib` for WebAssembly
(`scripts/build-engine.sh`, wasm-bindgen `--target web`) and `rlib` for native
tests. `engine/src/wasm.rs` is the only file that knows about JavaScript;
everything else is plain Rust tested natively.

## The golden fixtures

`engine/tests/golden.rs` replays the fixtures in `engine/tests/golden/`: the
quantized pixels, every palette tolerance and weight, colors within 1e-12,
and every redraw hash must match.

- A change that should not alter output keeps every fixture green. If one
  reddens, the change is wrong until proven otherwise.
- A deliberate change of output is a product decision. Confirm it with the
  user, then edit the affected fixtures in the same commit and
  explain the change in its body.
- **Optimizations must be exact-safe.** A shortcut may skip work only where a
  proven bound shows the skipped result cannot change the outcome, as the
  CIEDE2000 lightness lower bound and cheap upper bound in the grouping scan
  do. Each bound has a unit test that checks it over many pairs, and the
  shortcut has a test against the unoptimized algorithm.

## Floating-point fidelity

- Keep each formula's operation order: `a * b / c` is not `a * (b / c)` in
  floating point. Constants go-colorful folds at arbitrary precision are
  written as their folded `f64` literals.
- Transcendental functions come from the `libm` crate, so native tests and the
  WASM build share one implementation. Use `split_pow` for powers, never `powf`.
- Never let ordering depend on float noise. Sort keys go through `sort_key`
  (rounded to 1e-9); sorts are stable; ties keep insertion order.
- Input pixels enter as straight-alpha 16-bit RGBA and go through
  `Rgb::from_rgba16`, which premultiplies and divides again in integers.
  PNGs are decoded by `engine/src/decode.rs`, never by a browser canvas.

## Errors and panics

- Fallible paths return `Result<_, EngineError>`. Every variant's message is
  shown to the user as is, so it names the problem and what to change.
- No `unwrap`, `expect` or indexing that can panic on user input in library
  code: a panic in WASM aborts the worker's job with an opaque "unreachable".
  Tests may unwrap.
- Validate parameters at the API boundary (`optimizer::validate`,
  `PaletteMethod::parse`, `image::step_for_target`).
- Loops whose termination depends on data have an explicit bound
  (`MAX_ITERATIONS`, `MIN_TOLERANCE_STEP`).

## Style and lints

- `cargo fmt`; `cargo clippy` with `clippy::all` denied, for both the host and
  the `wasm32-unknown-unknown` target. `mise run lint` runs all of them.
- Functions stay under 80 lines (`clippy::too_many_lines`, `clippy.toml`).
  Split by phase into helpers with typed inputs and outputs; never raise the
  threshold to pass.
- An `#[allow(...)]` is scoped to the smallest item and its reason is obvious
  from context or written beside it.
- Enums over strings: method ids are parsed into `PaletteMethod` and
  `RedrawMethod` once, at the boundary.
- `unsafe` is forbidden (`[lints.rust]` in `Cargo.toml`).

## Performance

Measure before optimizing, with `--release` and a real fixture image, and
record the before and after numbers in the commit body. The heavy step is
grouping colors (`palette::group_colors`); the optimizer calls it once per
tolerance, and `optimizer::GroupCache` shares groupings across palette methods
for the same target size.

## Toolchain

- Host builds link through zig (`scripts/zig-cc`, wired in
  `.cargo/config.toml`), so no system C toolchain is needed.
- The `wasm-bindgen` crate version in `Cargo.toml` and the CLI version in
  `.mise.toml` are the same exact version; bump both together.
