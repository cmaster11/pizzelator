#!/usr/bin/env bash
# Builds the Rust engine to WebAssembly and writes its JS bindings to
# web/src/engine/wasm/, where the web app imports them.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/web/src/engine/wasm"

cargo build \
  --manifest-path "$root/engine/Cargo.toml" \
  --lib --release --target wasm32-unknown-unknown
wasm-bindgen \
  --target web \
  --out-dir "$out" \
  --out-name engine \
  "$root/engine/target/wasm32-unknown-unknown/release/pizzelator_engine.wasm"
echo "engine built: $(du -h "$out/engine_bg.wasm" | cut -f1) wasm"
