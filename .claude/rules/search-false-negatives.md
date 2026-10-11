# An empty search is not evidence of absence (MANDATORY)

Always-on: the trigger is a conclusion ("this does not exist"), not a file
path.

A search that returns nothing can mean the thing is absent, or that the search
never read the file. The shell `grep` here may be a wrapper (for example around
`ugrep` with `-I --ignore-files`) that silently skips binary-classified and
gitignored files. Wrappers, ignore files and generated directories all produce
the same silent empty result.

## The rule

For any negative conclusion that matters (a caller, a consumer or a reference
does not exist; a code path is dead; a case is unhandled), re-run the search
with the real binary and a positive control:

```sh
command grep -rn "<needle>" <path>   # the real binary, no wrapper flags
command grep -c "<known string>" <file>   # positive control: must be > 0
```

If the control comes back empty too, the file is being skipped and the
negative result means nothing.

A search that only has to find something needs no control: a hit is a hit.

## Never commit raw control bytes

Write a NUL or other control byte in source as an escape (`\0`, `\u0000`),
never as the raw byte. One raw byte makes the whole file binary to `grep -I`,
`file` and diff tools.
