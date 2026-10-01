# Learning-QA gate — 2026-09-30f (todo-items)

**Verdict: APPROVED** (0 high, 0 medium, 3 low)

## Range

`git diff 85fa00b..HEAD` — 1 commit on `main`:

- `22323a6` TODO items: half-siblings, birth parents, blank type on category change, CSP

11 files changed, +247 / −64. Three author decisions carried out (recorded in
`TODO.md` under "Done on 2026-09-30 — gap-review TODO items"):

1. Half-siblings labelled Half-brother / Half-sister, and an adopted person's
   birth parents Birth father / Birth mother (`utils/kinship.ts` +
   `systemEvents.ts` + `relationLabels.ts`).
2. Changing an event's category to one with a type list clears the type for the
   user to pick, and Save waits for one (`utils/eventDraft.ts`
   `applyEventCategoryChange` / `eventNeedsListedSubtype`; `EventModal.tsx`).
3. The two LOW notes from gate `2026-09-30e`: `frame-src` tightened to
   `www.youtube-nocookie.com` only, and the CSP guard ignores comments and
   derives framed / linked / fetched origins from the code
   (`securityHeaders.test.ts`, `vercel.json`).

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 92 files, 943 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

All three run from `src/frontend`, in order, on the live tree at HEAD. Test
count moved 941 → 943 (+2 net: +1 EventModal, +2 kinship, −1 securityHeaders
consolidation), matching the diff.

## Findings (ranked)

### 1. LOW — the CSP source-scan classifies every non-frame/non-link https literal as "fetched"

`src/frontend/src/securityHeaders.test.ts:61-67`

`fetched` is a catch-all: `everyOrigin − framed − linked`. A future `https://`
literal governed by a directive other than `connect-src` (an `img-src`,
`font-src`, `manifest-src`, or `form-action` host) is neither an `embedUrl:` nor
a `url:` literal, so it lands in `fetched` and the exact-equality assertion
fails with a message ("connect-src allows exactly the origins the app fetches
from") that mis-describes the real problem. This is the residual of prior gate
LOW #1: the fix distinguished framed from linked but left a third class ("host
used under some other directive") unmodelled. Not a current defect — every
literal today is genuinely fetch, frame, or navigation-link — and the exact
equality is a strict improvement over the old floor. Latent, mislabelled
failure mode only.

Fix (backlog): either drop the catch-all and enumerate the fetch call sites
(`fetch(`/`fetchWithRetry(`) the way `embedUrl:`/`url:` are enumerated, or keep
the catch-all but rename the assertion to "no https origin is used outside
connect-src / frame-src / navigation" so the failure message names the class it
actually checks.

### 2. LOW — `stripComments` can over-strip and silently hide an https literal

`src/frontend/src/securityHeaders.test.ts:36-37`

The block-comment stripper `\/\*[\s\S]*?\*\/` treats a `/*` inside a string
literal (a URL path, a glob) as a comment start and swallows source up to the
next `*/`; the line-comment stripper `(^|[^:])\/\/.*$` cuts a bare `//` not
preceded by `:`. Both run before the origin scan, so an over-stripped line drops
its https literal from `everyOrigin` — a false NEGATIVE (a host the app uses
that the scan no longer sees), the direction that is hardest to notice. The
prior gate's LOW #2 complained about over-matching (comments counted as used);
this fix corrects that but opens the mirror-image hole. Also still no try/catch
around `new URL()` (prior gate LOW #2's brittleness), so a malformed match
throws at collection time instead of failing gracefully. No such literal exists
today; latent.

Fix (backlog): wrap `new URL(...)` in a try/catch and skip malformed matches;
document that a `/*` in a string is not a comment (or accept the residual risk
as deliberately low).

### 3. LOW — the Save-disabled gate fires at open, not only after a category change

`src/frontend/src/components/EventModal.tsx:158`,
`src/frontend/src/utils/eventDraft.ts:77-78`

`eventNeedsListedSubtype` is "category has a fixed list AND subtype blank",
evaluated on every render. That correctly implements "Save waits for one" for a
category change, but it also hard-blocks editing a PRE-EXISTING event that has a
listed category and an empty subtype — an older FAMILY / TRIANGLE / PAPERO event
from a legacy file, or one whose subtype was deliberately cleared — until the
user picks a type. This is broader than the stated author decision ("a category
change clears the type"), though consistent with its "Save waits for it" half.
Every current seed path sets a subtype (triangle and family dialogs default to
'Functioning'; PAPERO score events derive subtype from the key; context-menu
seeds pass both category and subtype), so the gate is never dead-on-arrival, and
the user can always resolve it (the subtype dropdown offers "— select —"). The
two new tests cover the category-change and the direct empty-subtype cases, but
there is no test for "edit an existing listed-category event with empty
subtype" — the boundary the change actually widens (P10/P26).

Fix (backlog): add one regression asserting that an existing FAMILY 'Stress'
event with `subtype: ''` opens with Save disabled and enables once a subtype is
chosen — or record explicitly that blocking edits of legacy empty-subtype events
is intended and leave it untested by decision.

## Verified clean

- **Category-change path is centralized, not drifted (L9).** The inline
  `EVENT_SUBTYPES[eventType]?.[newCat]` → `listed[0]` logic is gone from
  EventModal; `applyEventCategoryChange` is the single implementation, called
  from EventModal's category dropdown, and its sibling
  `applyEventDraftFieldChange` (the Group/eventType change) already used the
  same "clear if not in list, else keep" rule. The one other category-change
  surface, `SessionEventModal`, only ever produces NODAL / EPE events
  (`utils/sessionNoteEvents.ts:70`), neither of which has a listed subtype, so
  its lack of the gate is correct.
- **Every EventModal render site still reaches Save.** Traced the seed shapes
  for PropertiesPanel (`buildNewEventDraft` with no default category except EPE
  pattern categories, which have no list), TimelineBoardModal (NODAL, no
  category), and the DiagramEditor triangle/family dialogs (`openTrianglePropertyModal`
  and `openFamilyPropertyModal` both default to category + subtype, and every
  context-menu seed supplies both). No seed produces a listed category with an
  empty subtype, so Save is never dead-on-arrival.
- **`EVENT_TYPE_HAS_SUBTYPE` is respected.** The gate keys on dropdown presence
  (`EVENT_SUBTYPES`), not on `EVENT_TYPE_HAS_SUBTYPE`, so SIR's optional Behavior
  (`EVENT_TYPE_HAS_SUBTYPE.SIR === false`) is unaffected — the TODO decision
  "a SIR entry may be saved with an empty Behavior" still holds.
- **Kinship labels are correct for the tested cases.** `isHalfSibling` (no
  shared parent partnership, gated on the 1-up/1-down blood path) and
  `isBirthParentOnly` (parent in the birth union, not the raising union) both
  assert exact labels; full siblings and adoptive parents fall through to the
  existing blood noun. The constants cover all three `RelationGender` values
  (male / female / unknown), enforced by `tsc`.
- **CSP exact-equality is a strict improvement (P29).** The old three tests
  (floor / `arrayContaining` / reverse-scan) folded into two exact-set
  assertions; re-adding `https://www.youtube.com` to `frame-src` would fail the
  exact match, and a new embed host would be caught. No coverage loss.
- **New tests can fail (P27).** The renamed category-change test would go red if
  the code reverted to `listed[0]` (asserting `subtype: ''`); the Save-waits
  test would go red if `disabled` were dropped (asserting `save.disabled === true`).
  Both assert real behaviour, not source text.
- No `any` introduced; no event-constant, EventCard, or date-field invariant
  touched beyond the listed subtype gate.

## Notes for the fix loop

- Findings 1–3 are all LOW and latent; none is reachable through a current code
  path. All three go to the backlog.
- Findings 1 and 2 are the residuals of the two prior gate LOW notes, now
  narrowed and mirror-imaged by the fix — the expected shape for a fix-commit
  re-sweep (P26).
- The workspace still carries an unrelated untracked `test import 1.json` and a
  modified `.claude/worktrees/…` pointer; neither is in the range and neither
  was touched.
