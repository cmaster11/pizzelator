---
paths:
  - 'server/**'
---

# Backend rules (MANDATORY)

Auto-loads when files under `server/**` are touched.

There is no backend today. These rules apply from the moment one is added;
adding it is a product decision confirmed with the user first.

## Shape

- The server does only what the browser cannot: persistence shared between
  users, secrets, or work too large for a client. Image processing stays in
  the WASM engine, in the browser or reused on the server, never written twice.
- Every input from the network is untrusted: validate it at the boundary with
  a schema, and reject what does not parse.
- Configuration comes from environment variables with one project prefix
  (`PZ_`), read in one module and validated at startup. A missing required
  variable fails startup with a message naming it.

## Correctness

- No unhandled async work: every promise is awaited, returned, or explicitly
  handed to an error handler (`@typescript-eslint/no-floating-promises`
  without `ignoreVoid`, or the equivalent in the server's language).
- Destructive operations follow check, then confirm, then apply, and offer a
  dry run. The check is strictly read-only. A missing confirmation fails
  instead of applying.
- Database changes go through numbered migrations. An applied migration is
  never edited; a change is a new migration. A new unique index is tested
  against rows that already violate it.
- Eventually consistent state is polled until it settles, never asserted once.
  A loop over results first proves it has results.

## Compatibility

Anything a client depends on (HTTP routes, payload shapes, stored data) is
changed additively: the old form keeps working and is marked deprecated, and
removal happens only in a planned breaking release. Stored data survives
deploys.

## Observability

Logs are structured, carry a request id, and never contain secrets or image
data. Data you need for debugging but cannot find in the logs is a logging gap:
add the log line, do not work around it.
