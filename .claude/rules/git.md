# Git workflow (MANDATORY)

Always-on: the trigger is committing, deleting files or branching.

## Branches and commits

- Work on a short-lived branch, not on the default branch (`main`).
- Commit at each logical checkpoint, never one giant commit. Each commit is
  atomic: reverting it undoes exactly one logical change.
- Conventional commits: `type(scope): description`, in sentence case. Types:
  `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`. Scopes:
  `engine`, `web`, `dev`, `ci`, or none for repo-wide changes.
- The body says why and how it was verified: numbers, the test that pins it.
- `mise run lint` is clean before every commit. A warning counts as an error.
  A genuinely unavoidable lint exception gets a single-line disable with a
  reason, never a file-wide or global disable.

## Every commit is pushed

A local `post-commit` hook (`.git/hooks/post-commit`, running `git push`)
pushes each commit as soon as it is made, and `push.autoSetupRemote` (repo
config) gives a new branch its upstream on that first push. Hooks are not
versioned: on a fresh clone, recreate both with

```sh
printf '#!/bin/bash\ngit push 2>&1\n' > .git/hooks/post-commit
chmod +x .git/hooks/post-commit
git config push.autoSetupRemote true
```

A commit is therefore public the moment it is made; check what you stage.

## Specs and plans are never committed

Design specs, implementation plans and brainstorming notes (a skill's default
`docs/superpowers/` included) stay local and untracked; `.gitignore` covers
`docs/superpowers/`. This overrides any skill step that says to commit them.
What a design decided reaches the repository as code, tests, `README.md` and
these rules.

## Stage only your own paths

Commit pathspec-limited: `git commit -m "…" -- <exact paths>`. Never stage the
whole tree and never run a bare `git commit` on an index you did not build: a
concurrent session or tool may have staged work there.

## Deleting

- A command a session runs never deletes with `rm`: it triggers a permission
  prompt that stalls the session. Delete tracked files with
  `git rm -- <path>` as part of a commit. Leave scratch files in the session
  scratchpad, which is removed with the session. To set a file aside, move it
  into the scratchpad.
- A commit that deletes code names what it deleted and how deadness was
  established (`.claude/rules/dead-code.md`).

## Never

- Force-push or rewrite pushed history without being asked.
- Commit secrets. `gitleaks` runs in `mise run lint`.
- Skip hooks or checks (`--no-verify`) to get a commit through.
