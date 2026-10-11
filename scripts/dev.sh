#!/usr/bin/env bash
# Development loop: rebuilds the WASM engine whenever the Rust sources change
# and serves the web app with Vite on port 10099. Vite reloads the page when
# the rebuilt engine lands. Run it through scripts/dev-service.sh so it stays
# up in the background.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

scripts/build-engine.sh
watchexec \
  --postpone \
  --watch engine/src --watch engine/Cargo.toml \
  --exts rs,toml \
  --debounce 500ms \
  --on-busy-update restart \
  -- scripts/build-engine.sh &
pnpm --dir web exec vite &

# If either process exits, stop the other and exit non-zero so systemd restarts both.
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT
wait -n
exit 1
