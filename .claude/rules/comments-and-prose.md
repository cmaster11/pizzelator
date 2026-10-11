---
paths:
  - 'engine/**'
  - 'web/src/**'
  - 'web/e2e/**'
  - 'scripts/**'
  - 'docs/**'
  - 'README.md'
---

# Comments and prose (MANDATORY)

Auto-loads when files under `engine/**`, `web/src/**`, `web/e2e/**`,
`scripts/**` or `docs/**`, or `README.md`, are touched.

## Comments describe what the code does now

- No history: no "previously", "used to", "before the refactor", "the old
  version". History lives in commit messages.
- No planning or ticket identifiers in comments. Describe the behavior.
- A comment says what the code cannot: why, an invariant, a non-obvious
  constraint, a unit. It never restates the line beside it.
- Compatibility behavior that exists today is current behavior and is fine to
  document ("accepts the classic palette JSON").

## Never count code elements in prose

Do not write "the two functions below" or "these three calls" in a comment or
doc. The count rots the first time someone adds one. Name the things instead.

## Deleting text that carries nothing

Delete, with a reason you can point at:

- a comment restating the statement next to it;
- a TODO naming no owner, issue or condition;
- commented-out code (git history keeps it);
- banner or separator lines with no content;
- a sentence restating its predecessor or its heading.

Pattern matches only pick candidates; judge each one. Do not import essay
rules (em-dash bans, adverb bans, rhythm rules): reference text is read for
facts, not cadence.

## Clarity floor for docs and comments

- Short sentences, one idea each. Active voice. Present tense.
- One term, one meaning: the same thing keeps the same name everywhere,
  including UI labels and code identifiers.
- No filler ("just", "simply", "basically", "note that", "in order to").
- Sentence case for headings, labels and commit subjects.

A rewrite may change how a sentence reads, never what it asserts.
