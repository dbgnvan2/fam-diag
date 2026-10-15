# Learning-QA gate — 2026-10-14b (test-typecheck)

**Verdict: APPROVED** (0 high, 0 medium, 0 low)

Single-commit review, no fix loop required. The commit closes the second half of
L5: test files were type-checked by no gate (`tsconfig.app.json` excludes
`*.test.ts(x)`, vitest strips types), so 203 errors had accumulated across 16
test files — some hiding real mistakes (an `eventClass: 'event'` that is not an
`EventClass`, `createRef<any>()` stages, `as Person` fixtures with invalid gender
symbols or missing required fields, calls missing newly-required arguments). It
adds `tsconfig.test.json` (extends the app config, includes `src`, excludes
nothing), references it from `tsconfig.json`, adds an `npm run typecheck` script,
a typed react-konva test-tree helper (`src/test/konvaStage.ts`), a
`requireLists` helper that makes the diagram converters' optional lists explicit
in tests, and a guard test (`src/test/typecheckCoverage.test.ts`) that fails if
the wiring is undone.

All three CLAUDE.md gates pass on the committed code. The test edits were
reviewed specifically for meaning preservation (find-vs-direct-children,
getClassName-vs-instanceof) and for weakened assertions — none found.

## Range

`git diff origin/main...HEAD` — 1 commit on `fix/main-event-audit`:

- `80776c9` Type-check test files: wire tsconfig.test.json into tsc -b, fix 203 errors

28 files changed, +433 / −277 (materialized at `/tmp/sweep.diff`, 2216 lines).
Non-test files: `tsconfig.json` (+1 reference), `tsconfig.test.json` (new),
`package.json` (+`typecheck` script), `src/test/konvaStage.ts` (new),
`src/test/importedDiagram.ts` (new), `src/test/typecheckCoverage.test.ts` (new),
`data/version.ts` (version bump), `CLAUDE.md`, `LEARNINGS.md`. The remaining 19
files are test files whose type errors were fixed.

## Build/test gates (CLAUDE.md)

Run from `src/frontend`, against the committed code:

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit -p tsconfig.test.json`) | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 127 files, 1259 tests (exit 0) |
| `rm -f node_modules/.tmp/*.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count went 1256 → 1259: the three `typecheckCoverage.test.ts` assertions.
`vitest run` completed in 45.5s with no timeouts, including
`DiagramEditor.familyTimeline.test.tsx` (its 20s timeout is the only behavioural
test change — see below).

## Sweep loop

Cold sweep only — no findings, so no fix commit and no re-sweep. The review
focused on the two questions the author flagged, then broadened to the failure
patterns that apply to a test-infrastructure change.

### Meaning preservation of the test edits (find vs direct-children, getClassName vs instanceof)

- **`childrenNamed` = direct children, `getClassName`, exact match** — identical
  to the `group.getChildren().filter(n => n.getClassName() === 'X')` the tests
  always used. Used for every former direct-children-by-class filter
  (PersonNode `triangles`/`circles`, NoteNode `Text`/`Rect`, EmotionalLineNode
  `Line`, SiblingConflictOverlay `Line`, TriangleNode `Line`, ChildConnection
  `Shape`). No direct-children → recursive `find` conversion and no reverse;
  each site keeps its original scope. The helper's doc comment preserves the
  one distinction that matters: it matches `getClassName()` (exact), not
  `instanceof`, which would also count subclasses (an Arrow is a Line).
- **`find<T>('X')` = recursive, unchanged** — the former `group.find('Text')` /
  `.find('Line')` / `.find('Rect')` sites keep the recursive Konva `find`, only
  gaining a type argument. No behavioural change.
- **`childGroup` / `childShape` = index access + a guard** — these replace the
  old untyped `getChildren()[n] as any` / `.current!` reaches with the same
  index plus an `instanceof Konva.Group`/`Konva.Shape` check that turns a silent
  `undefined.attrs` TypeError into a clear message. The indices are unchanged
  (`childGroup(layer, 1)` = `layer.getChildren()[1]`, `childShape(group, 0)` =
  `group.getChildren()[0]`).
- **`mounted` / `mountedStage` = non-null ref, checked** — replace `.current!`
  and `React.createRef<any>()` with `RefObject<Konva.Stage | null>` plus a
  "did not mount" throw. No test reads a null stage.

### Enum and fixture corrections are fixes, not behavioural changes

- `eventClass: 'event'` → `'individual'` (EventModal baseProps + makeDraft):
  `'event'` is not an `EventClass` (`'individual' | 'relationship' |
  'emotional-pattern' | 'family' | 'triangle'`). EventModal only declares
  `resolvedEventClass` as a prop and does not branch on it, so the correction
  changes nothing the test asserts.
- `genderIdentity: 'female'/'male'` → `'feminine'/'masculine'` and
  `genderSymbol: 'female'/'male'` → `'female_cis'/'male_cis'`
  (PersonSIRSection.test.tsx): both old values were invalid
  (`GenderIdentity` is `'feminine' | 'masculine' | 'nonbinary' | 'agender'`;
  `GenderSymbol` starts at `'female_cis'`). `PersonSIRSection.tsx` never reads
  `genderIdentity`/`genderSymbol`, so the fixtures are made valid with zero
  effect on the section under test.
- `lineStyle: 'one-line'` → `'fusion-dotted-wide'` + `lineEnding: 'none'`
  (syntheticDateEvents.test.tsx `makeEPL`): `'one-line'` is not a `lineStyle`;
  `'fusion-dotted-wide'` is the correct style for `relationshipType: 'fusion'`,
  and `lineEnding` is a required (non-optional) field that the fixture omitted.

### Required-field fills across sibling fixtures (P5/P22 class)

The additions `sirCategories={[]}` (PropertiesPanel.test.tsx ×12),
`eventType: 'NODAL'` + `status: 'discrete'` (PropertiesPanel, personEventBundle),
`relationshipStatus: 'married'` (syntheticDateEvents makePartnership),
`partnerships: []` (PersonSIRSection makePerson), and the `partnership({...})`
replacement of `{...} as Partnership` (partnershipUtils.test.ts) are all
required-field fills on fixtures, not loosened assertions. `sirCategories` is
declared `sirCategories: SIRCategoryDefinition[]` (required) in
PropertiesPanel.tsx. No straggler call sites: `npm run typecheck` and `tsc -b`
both exit 0, which they could not if any fixture were still missing a required
field or carrying an invalid enum.

### Guard test is provable-failing, not a floor, not a source grep (P27/P29/P19)

`typecheckCoverage.test.ts` reads the three config files it guards
(`tsconfig.json`, `tsconfig.test.json`, `package.json`) as JSON and asserts
exact values: the reference `'./tsconfig.test.json'` is present; `extends` is
`'./tsconfig.app.json'`; `include` is exactly `['src']`; `exclude` has no
`.test.` pattern; `scripts.typecheck` is exactly `'tsc --noEmit -p
tsconfig.test.json'`. Each assertion goes red if that wiring is undone (the
reference removed, `include` narrowed, a `.test.` exclusion reintroduced, the
script re-pointed). Assertions are `toBe`/`toEqual`/`toContain` — exact, no
`>= N` floor. It parses structured JSON rather than grepping source text, so the
P19-corollary needle-in-prose failure does not apply; the artifact it checks IS
the wiring, and there is no parallel hand-maintained copy to drift.

## Verified clean

- **Single source of truth.** `childrenNamed`/`childGroup`/`childShape`/
  `mounted`/`mountedStage` centralise the react-konva tree access in one file
  (`src/test/konvaStage.ts`), replacing ~60 inlined `getChildren().filter(...)`
  and `.current!` sites — the opposite of the drift-prone parallel-copy shape.
  `requireLists` likewise centralises the "converters always return these
  lists" contract in `src/test/importedDiagram.ts`.
- **No assertion weakened.** Diffed every changed `expect`: all exact-value or
  exact-length assertions (`toBe`, `toEqual`, `toHaveLength`, `toBeLessThan`)
  are unchanged; the only `<`/`>=` assertions present were already there
  (`toBeGreaterThan(0)`, `toBeGreaterThanOrEqual(2)`) and were not relaxed.
  `requireLists` adds a throw, strictly strengthening the converter assertions.
- **No `any` introduced.** The new helpers are fully typed; the diff removes
  `: any` / `as any` / `createRef<any>` from every hunk it touches. Remaining
  `!`/`as Konva.Group` instances in NoteNode.test.tsx:163 and other untouched
  files are pre-existing, type-check-clean, and outside this commit's scope.
- **Invariants (CLAUDE.md).** Save=create-event, EventCard 5 call sites, modal
  `position: fixed`, date-field synthesis single-slot — none touched; this range
  adds no event builder and no modal.

## Notes for the next loop

- The single behavioural test change is `DiagramEditor.familyTimeline.test.tsx`
  gaining a 20s timeout. The comment justifies it as parallel-suite load, not
  logic. It is the one place a masking risk could hide (a slow test is not a
  hanging one) — worth watching if a future edit makes that test genuinely
  slow, but not a finding against this range.
- Minor doc nit (not a finding): CLAUDE.md's third gate still says
  `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b`, but there
  are now two buildinfo files (app + test). The `rm -f` glob used in this gate
  (`*.tsbuildinfo`) is the safer form; consider updating the checklist line to
  remove both so a local "clean rebuild" re-checks the test project too.
- `APP_VERSION` bumped to `v 2.59-1014-23-09` in this commit.

## Not covered

- The Scope-limits families the reviewer does not assess: logic/algorithmic
  correctness, concurrency/races, auth, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, test quality beyond
  P27/P29, architecture.
- The meaning-preservation review is a close read of the diff plus the two
  helper files and the enum/type definitions, not a per-test mutation run; the
  1259-test green run is the executable evidence the conversions are
  behaviour-preserving.
