---
paths:
  - '.claude/rules/**'
  - 'CLAUDE.md'
---

# Authoring rule files (MANDATORY)

Auto-loads when `.claude/rules/**` or `CLAUDE.md` is touched.

## Two kinds of rule

- **Path-scoped**: the file opens with a `paths:` frontmatter block and loads
  only when a read or edited file matches one of its globs. This is the
  default for anything about specific code.
- **Always-on**: no frontmatter; it loads into every session like `CLAUDE.md`.
  Reserve it for principles whose trigger is a conclusion or an action
  ("this is verified", "about to commit"), not a file path.

Always-on text is charged to every session before the user types anything.
Path-scope by default.

## The hard rule

A rule that states its scope in prose ("Auto-loads when … is touched") MUST
carry a `paths:` block with matching globs, and the two must stay in sync.
Without the block the loader treats the file as always-on and silently
contradicts its own sentence. An always-on rule has neither the block nor the
sentence.

Write globs out in full: `engine/**` and `web/**` as separate entries, never
brace shorthand.

## Shape of a rule

1. A `# Title`, with `(MANDATORY)` when it is binding.
2. The scope sentence (path-scoped) or why it is always-on.
3. The rule itself, then the reason, then carve-outs.
4. How to check compliance, when there is a command for it.

Keep each rule focused and short. When an always-on rule grows, move the
detail into a path-scoped companion and leave a pointer behind. Move text in
one commit and reword it in another, and keep headings stable: other files cite
them.

## When a rule changes

Update the table in `CLAUDE.md` § "Always-on rules" when an always-on rule is
added, renamed or removed, and the path-scoped list below it when a scoped
rule is.
