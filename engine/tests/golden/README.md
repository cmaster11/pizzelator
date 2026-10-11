# Golden fixtures

Each JSON file pins the engine's output for one case: the downsampled image,
every palette the tolerance search finds, and a hash of every distinct
redraw. `tests/golden.rs` requires the engine to reproduce them exactly.

The fixtures fix the orderings the engine keeps: stable sorts,
insertion-ordered palettes and sort keys rounded to 1e-9. They are not
regenerated; a deliberate change of output edits the affected fixtures by
hand (`.claude/rules/engine.md`).
