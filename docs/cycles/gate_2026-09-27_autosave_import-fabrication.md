# Gate — autosave-while-dirty + stop import fabrication (a82f52c...HEAD)

Date: 2026-09-27
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `origin/main...HEAD` (merge-base diff; base = origin/main a82f52c)
Verdict: **APPROVED**

## Commits

- 7857dae Make autosave fire while the diagram has unsaved changes
- b2b220e Stop imports from inventing death dates and sex

## Gates (run in src/frontend, on current HEAD)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 67 files, 701 passed, 13 skipped (714) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## Commit 1 — autosave while dirty (7857dae)

Two timers were keyed on callback identity and re-rendered every 500 ms while
dirty, so neither ever fired. Both fixes are behavioural, not cosmetic.

**`useAutosave`** (hooks/useAutosave.ts): the debounce timer is now keyed on
`[data, delay]` only; `onSave` is read through `onSaveRef` (assigned during
render). Traced the 10 call sites in DiagramEditor.tsx:1888–1966 — every one
passes a `useState` value as `data` (`people`, `partnerships`, …, `fileName`),
so `data` identity is stable across clock re-renders and the timer no longer
restarts. The hook's own tests cover the exact failure (fresh `onSave` every
500 ms → still fires once), latest-`onSave`-wins, debounce-on-data-change, and
no-fire-after-unmount.

**File autosave** (DiagramEditor.tsx:2432–2464): `saveDiagramToCurrentTargetRef`
was moved up from its old spot (was ~3236) so the effect can read it; the effect
deps drop `saveDiagramToCurrentTarget` (unstable — `buildDiagramPayload` is not
memoized) and keep only stable state values (`people`, `partnerships`,
`emotionalLines`, `pageNotes`, `triangles`, `fileName`, `isDirty`,
`autosaveDelayMs`). `triggerSaveAs` still reaches the ref (declared earlier now),
and `tsc --noEmit` under `noUnusedLocals` confirms no dangling reference from the
move. The `.catch(() => {})` swallow is intentional and correct — it keeps the
diagram dirty so the user still sees "unsaved" rather than silently dropping the
write (not a P2 drop).

The two DiagramEditor.autosave tests assert real effects (localStorage write and
file-handle write), not "was called"; they advance time in 500 ms steps so the
clock re-renders actually happen, which is what makes them reproduce the bug.

## Commit 2 — stop import fabrication (b2b220e)

**Gender.** New `resolveImportedGender(explicit, name) = explicit ||
inferGenderFromName(name)` (dataNormalization.ts:219) replaces every `||
'female'` / `syntheticIndex === 0 ? 'male' : 'female'` default across
dataImport.ts (transcript + facts) and DiagramEditor.tsx session capture. The
image-import metadata loop keeps its own explicit-sex branch (male/female → set,
`unknown` → `delete matchedPerson.gender`, else → leave), which correctly
precedes the name inference so explicit > name > unset. The unit test's
`resolveImportedGender(undefined, name) === inferGenderFromName(name)` loop is a
real agreement test between the two name-based paths.

**Death dates.** All three fabrication sites are gone: image import
`deceased && !deathYear` (was `'1900-01-01'`), transcript `deceasedNames` (was
`'1973-01-01'`), and homicide_suicide without a year (was `'1973-01-01'`). Each
now sets `deathDateKnown = true`. Verified the flag is live: `PersonNode.tsx:459`
renders the death-X from `deathDate || deathDateKnown`, and `deathDateKnown` is a
real persisted field (types/index.ts:50, PropertiesPanel save path,
PersonDatesSection checkbox). The `homicide_suicide` with a year and transcript
"died 1990" cases still write `${year}-01-01`, and the transcript test asserts
`deathDateKnown` is *undefined* when a real date is present — the two fields are
kept mutually exclusive.

Note: `deathDateKnown` is not read by `syntheticDateEvents.ts` (which synthesizes
from `deathDate` only), so a deceased-with-unknown-date import produces no Death
block on the Timeline/Events tab — only the node X. This is **consistent with the
repo's established deathDateKnown handling** (gate passes 9/10 resolved the same
question for the manual checkbox path: "the node marker keys off
`deathDate || deathDateKnown`; no fabricated event"), not a new gap.

## Findings (ranked)

### 1. P10 / P25 — med · DiagramEditor.tsx:2685, 2707, 2768 (session capture)

Three session-capture call sites changed behaviour — the `|| 'female'` default at
:2685/:2707 and the `syntheticIndex === 0 ? 'male' : 'female'` default at :2768
were removed — with **no direct test**. The new tests cover the helper
(dataNormalization.test.ts) and the transcript/facts paths (dataImport.test.ts),
but not the session-capture wiring, which is the only place the
partner1=male/partner2=female assumption lived. The code is correct (it delegates
to the unit-tested helper, and dropping the fabricated default is the point of the
commit), and `grep` shows no test file exercises the session-op → diagram person
path (`add_person_event`/`upsert_person` handling is inline in DiagramEditor, and
the only session-adjacent test files are voiceCommands.test.ts and
SessionNotesPanel.test.tsx). This is a coverage gap, not a shipped-behaviour
defect. Fix: add a DiagramEditor-level test that a session-capture partnership
with two name-unevidenced people yields `gender: undefined` for both (would have
gone red on the old code).

### 2. P19-corollary / P32 — low · dataNormalization.ts:219 (`resolveImportedGender`)

`explicit || inferGenderFromName(name)` returns any truthy `explicit` verbatim, so
`resolveImportedGender('unknown', name)` would store `'unknown'` as a gender
(`Person['gender']` is `string | undefined`, unvalidated — types/index.ts:53).
The image-import sibling path correctly treats `'unknown'` as "clear" (`delete
matchedPerson.gender`), so the two gender resolvers disagree on the `'unknown'`
sentinel. Unreachable today: every current caller passes `undefined`, `''`,
`'male'`, or `'female'` (the image path never calls the helper). The trap is that
`resolveImportedGender`'s docstring ("the source's explicit value") invites a
future caller to pass `importedPerson.sex` directly, which would silently convert
`'unknown'` into a stored gender. Fix: guard the explicit to male/female
(`explicit === 'male' || explicit === 'female' ? explicit : inferGenderFromName(name)`),
or document that 'unknown' is handled by the caller.

## Not covered

- Caller-excluded / not independently verified: `test import 1.json` (untracked
  scratch data), `.claude/worktrees/eloquent-liskov-52df2a` (worktree submodule
  pointer, pre-existing — see gate passes 10/11).
- learning-qa scope limits: logic/algorithmic correctness, concurrency/races,
  authn/authz, injection/security, performance, dependency/supply-chain,
  API-contract compatibility, general test quality.

## Verdict

**APPROVED** — both commits are real, behaviour-tested fixes and all three gates
are green. The autosave fix is proven by tests that reproduce the 500 ms re-render
(and assert real localStorage/file writes, not "was called"); the fabrication fix
removes every invented death date and default sex and replaces them with the
existing `deathDateKnown` flag, whose rendering path (PersonNode) was verified
live. No shipped-behaviour defect was found. One medium finding (session-capture
regression test gap) and one low finding (`resolveImportedGender`'s `'unknown'`
sentinel) are recorded above; neither is a shipped-behaviour defect. Clean against
P1–P36 and L1–L6; P10/P25 (untested session-capture call sites, med) and
P19-corollary/P32 (divergent gender sentinel handling, low) were the only patterns
applicable.
