---
paths:
  - 'scripts/dev.sh'
  - 'scripts/dev-service.sh'
  - 'scripts/build-engine.sh'
  - 'web/vite.config.ts'
  - 'web/playwright.config.ts'
---

# The permanent dev server (MANDATORY)

Auto-loads when `scripts/dev.sh`, `scripts/dev-service.sh`,
`scripts/build-engine.sh`, `web/vite.config.ts` or `web/playwright.config.ts`
is touched.

## What runs

`scripts/dev-service.sh install` writes and enables the systemd user unit
`pizzelator-dev.service`, which runs `scripts/dev.sh` through mise:

- `scripts/build-engine.sh` once, then `watchexec` rebuilding it whenever
  `engine/src/**` or `engine/Cargo.toml` changes;
- Vite on `0.0.0.0:10099` with `strictPort`, which reloads the page when the
  rebuilt engine lands in `web/src/engine/wasm/`.

If either process exits, `dev.sh` stops the other and exits non-zero, and
systemd restarts both (`Restart=always`).

## Rules

- **The `/pizzelator/` prefix** (`base` in `web/vite.config.ts`) is the path
  GitHub Pages serves the site under, and the dev server uses the same one.
- **Hosts stay out of the repo.** A reverse proxy in front of the dev server
  sends its own `Host` header, which Vite rejects unless it is allowed. The
  unit loads `~/.config/pizzelator/dev.env` when it exists, and
  `PZ_ALLOWED_HOSTS` there (comma-separated) extends `server.allowedHosts`.
  Never commit a host name.
- **Port 10099 is fixed.** It is `DEV_PORT` in `web/vite.config.ts` and the
  default `baseURL` in `web/playwright.config.ts`; change both together, and
  the docs that name it.
- **One server.** Never start Vite in a session shell. `vite preview` for a
  production-build check uses a different port and is stopped afterwards.
- **Diagnose through the unit:** `scripts/dev-service.sh status`, then
  `scripts/dev-service.sh logs` (journalctl). A WASM build error shows up there
  and the page keeps the last good engine, so check the logs when an engine
  change seems to have no effect.
- **The unit runs the checkout it was installed from.** It serves whatever
  branch that working tree has checked out. A worktree gets no dev server of
  its own; test it by checking the branch out in the main tree.
- **While logged out** the unit runs only with lingering enabled
  (`loginctl enable-linger`). That is the user's choice; do not change it.

## Long-running work

Anything that takes more than a few minutes (a full build matrix, a long
benchmark) runs detached as a transient unit, not in a session shell, which
the harness may kill:

```sh
systemd-run --user --unit=<name> --collect -p WorkingDirectory=<repo> \
  mise exec -C <repo> -- bash -c '<command> > <log> 2>&1; echo "EXIT=$?" >> <log>'
```

End the log with an `EXIT=` marker; a log without it means the unit died. Do
not edit the checkout while a detached run reads it.
