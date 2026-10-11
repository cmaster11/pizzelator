# A check that cannot fail is not verification (MANDATORY)

Always-on: the trigger is a conclusion ("this is verified"), not a file path.

## The question

Ask of every check: **could this fail for the reason it claims to test?** If
you cannot name the input that makes it fail, the check is decoration.

## Shapes of checks that cannot fail

- **Same expression on both sides.** The expected value is computed by the
  code under test, so the assertion holds for every value that code could
  produce. Compare against a literal, an independent artifact (the golden
  fixtures), or a property.
- **Inert guard.** Mounted, running, matching nothing: a validation on a field
  nothing sends, an error branch no input reaches.
- **Wrong environment.** The defect cannot occur where the check runs. A
  canvas-decoding bug cannot appear in a Rust test that decodes with the `png`
  crate; a worker-bundling bug cannot appear under the dev server.
- **Wrong moment.** The right tool at the wrong point, such as scanning
  committed history before the commit exists.
- **Bypassed seam.** The check reaches the far side without crossing the seam
  it tests, such as calling the engine directly when the defect lives in the
  worker messages.

## Prefer properties to fixtures

A property (two code paths agree, an upper bound holds over many pairs) keeps
holding when the code grows a case nobody tested. The grouping in
`engine/src/palette.rs` is checked against the naive algorithm over many
tolerances, not against one remembered output.

## Prove a guard once, adversarially

A new guard, validation or invariant is verified by **one input it must
refuse**, run against the real thing. Falsify through the input, never by
deleting the guard and restoring it: the input-level test stays in the suite
and proves the guard on every later run.

## What could this change break?

Any change that adds or tightens a guard, a bound or a cache must also assert
that the legitimate case still passes. Name the path the change could break,
and exercise it.

## Record it

For a non-obvious assertion, write the pair beside it:

    // fails-when: <the input that makes this fail>
    // breaks-if-wrong: <the legitimate path this change could break>
