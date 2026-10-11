#!/usr/bin/env bash
# Manages the permanent dev server (scripts/dev.sh) as a systemd user unit.
#
#   scripts/dev-service.sh install    write the unit, enable it and start it
#   scripts/dev-service.sh uninstall  stop and remove the unit
#   scripts/dev-service.sh status|restart|stop|start
#   scripts/dev-service.sh logs       follow the server output
set -euo pipefail

unit=pizzelator-dev.service
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
unit_path="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$unit"

install_unit() {
  local mise
  mise="$(command -v mise)" || {
    echo "mise is required on PATH" >&2
    exit 1
  }
  mkdir -p "$(dirname "$unit_path")"
  cat >"$unit_path" <<UNIT
[Unit]
Description=pizzelator dev server (Vite on :10099, WASM engine rebuild on change)

[Service]
Type=simple
WorkingDirectory=$root
# Machine-specific settings, such as PZ_ALLOWED_HOSTS; optional and never committed.
EnvironmentFile=-%h/.config/pizzelator/dev.env
ExecStart=$mise exec -C $root -- $root/scripts/dev.sh
Restart=always
RestartSec=3
KillMode=control-group

[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload
  systemctl --user enable --now "$unit"
  echo "installed $unit_path"
}

case "${1:-}" in
  install) install_unit ;;
  uninstall)
    systemctl --user disable --now "$unit" || true
    mv "$unit_path" "$unit_path.removed"
    systemctl --user daemon-reload
    ;;
  status | restart | stop | start) systemctl --user "$1" "$unit" ;;
  logs) journalctl --user -u "$unit" -f -n 100 ;;
  *)
    sed -n '2,8p' "$0"
    exit 2
    ;;
esac
