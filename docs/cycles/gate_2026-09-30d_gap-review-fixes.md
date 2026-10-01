# Learning-QA gate — 2026-09-30d (gap-review-fixes)

**Verdict: APPROVED** (0 high, 0 medium, 3 low)

## Range

`git diff ae41d45..HEAD` — 2 commits on `main`:

- `167dfff` Fix gap review 2026-09-30 findings F-1 to F-23
- `ae34c76` Gap review report, fix status, dialog pattern doc; version 2.54

77 files changed, +2065 / −343. Reviewed the full materialized diff
(`/tmp/sweep_gate.diff`, 4351 lines) plus targeted reads of the changed modules
(`useDialogFocus.ts`, `diagramPayload.ts`, `partnershipUtils.ts`,
`predictionSets.ts`, `testApiConnection.ts`, `vlmImport.ts`, `kinship.ts`,
`familyScope.ts`, `siblingPosition.ts`) and `vercel.json` / `vite.config.ts`.

The batch fixes `REVIEW-gap-areas-2026-09-30.md` findings F-1..F-23; that file's
"Fix status" table maps each finding to its code and tests and was treated as the
authoritative statement of intent (author decisions recorded in `TODO.md`).

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 92 files, 940 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

All three run from `src/frontend`, in that order, on the live tree at HEAD.

## Review scope

Reviewed against the generic catalogue P1–P36 (`~/.claude/standards/learnings.md`),
repo patterns L1–L10 (`LEARNINGS.md`), and the CLAUDE.md invariants: Save = create
event (date+startDate/anchorType/anchorId/eventClass/createdAt/subtype); no hardcoded
event types/categories; no `any`; immutability; one event per date field; no
fabricated dates/ratings; the two distinct "intensity" concepts; the 5 EventCard
call sites.

CHECKED: the dirty-snapshot refactor (F-1), File > New reset + storage clear (F-2),
delete confirmations (F-3), Timeline follow-focus (F-4), sibling-overlay memo key
(F-5), sibling-section writes (F-6), partnership type change (F-7), SIR/Papero write
tests (F-8), evidence form/linkers (F-9), dialog focus/Escape (F-10), storage-write
retry (F-11), family-scope generation (F-12), condition-link rules (F-13),
description placeholders (F-14), prediction normalisation (F-15), evidence-draft
survival (F-16), set rename (F-17), VLM console logging (F-18), CSP headers (F-19),
Test Connection timeout/retry (F-20), kinship step-relatives (F-21), small test gaps
(F-22), off-image coordinates (F-23).

NOT COVERED (failure-pattern family only, as always): algorithmic correctness of
Konva drag/click ordering at runtime, visual/UI-contract regression in a browser,
concurrency, security, performance. The browser checks claimed in the fix-status
table (F-4, F-19) were read as claims, not independently re-run.

## Findings (ranked)

### 1. LOW — the dirty-check and file-autosave dependency arrays are still two hand-maintained lists parallel to the payload

`src/frontend/src/components/DiagramEditor.tsx` — dirty effect deps (~1300) and
file-autosave effect deps (~2330); `utils/diagramPayload.ts` `serializeDiagramContent`

`serializeDiagramContent` now cuts its content from `buildDiagramPayload`, so a key
added to `DiagramPayloadState` is automatically part of the snapshot — the core of
the systemic fix. But the two effects that *consume* the snapshot are still keyed on
hand-written arrays of the 13 field names (`ideasText`, `predictionSets`,
`functionalFactCategories`, `nodalCategories`, plus the original nine). The review's
own systemic pattern #1 asked for "one `DIAGRAM_PAYLOAD_KEYS`-driven list used by
serialize, reset and autosave, with a test that each key is in all three"; the fix
delivered the single source only for serialize. A field added to the payload today
enters the snapshot but silently stops marking the diagram dirty and stops triggering
file autosave unless it is also hand-added to two effect dep arrays — and no test
cross-checks the effect deps against `DIAGRAM_PAYLOAD_KEYS`, so the drift would be
green. This is the P19 / systemic-pattern-#1 class the review set out to eliminate.
All 13 fields are present today, so there is no current defect — this is latent
fragility.

Fix (backlog): derive the two effect dep lists from a single `DIAGRAM_CONTENT_KEYS`
constant (or key the dirty effect on the serialized snapshot itself), and add a test
asserting the payload keys, the `diagramContent` construction, and the autosave deps
all enumerate the same set.

### 2. LOW — the CSP guard scans source text with floor assertions, so a host can drop out of the scan unnoticed

`src/frontend/src/securityHeaders.test.ts:46-56`

The guard greps all source for `fetch(?:WithRetry)?\('https://…'` and
`embedUrl: 'https://…'` literals and asserts each matched origin is in
`connect-src` / `frame-src` — reasonable "is this wired" coverage, and it currently
finds all three fetch sites (`api.anthropic.com` ×2, `api.deepseek.com`) and all
three YouTube-nocookie embeds. But the completeness checks are floors
(`fetched.length > 0`, `embeds.length > 0`), not exact sets: if a future refactor
turns a URL literal into a constant or variable — precisely the P19 corollary drift —
the regex silently stops matching that host while the `> 0` floor stays green, and a
host could fall out of `connect-src`/`frame-src` without the test noticing. The scan
also cannot see a host reached through a non-literal URL.

Fix (backlog): assert the *exact* origin set (or membership of the specific known
hosts `api.anthropic.com`, `api.deepseek.com`, `www.youtube-nocookie.com`), rather
than a cardinality floor; a host appearing in the CSP but absent from the scan would
then be flagged too.

### 3. LOW — Test Connection reports sub-second timeouts as "0s", and the test pins that degenerate value

`src/frontend/src/utils/testApiConnection.ts` (`fetchWithRetry` throw) and
`testApiConnection.test.ts` ("timed out after 0s")

`Math.round(timeoutMs / 1000)` yields `0` for any sub-second timeout, so the
message reads "Connection test timed out after 0s". Production default is 15 s
("15s"), so this never surfaces to a user; it only appears because the test uses a
20 ms timeout to keep the suite fast and asserts the resulting "0s". Cosmetic — the
test could pass a 1000 ms timeout (with the retry delay zeroed) to keep the asserted
string honest, or the message could round up to 1 s.

## Verified clean

- **Dirty snapshot now covers the whole payload.** `serializeDiagramContent` is cut
  from `buildDiagramPayload`, strips only `fileMeta` (metadata) and `autoSaveMinutes`
  (a preference), and is deterministic (no `new Date()` — `exportedAt` is passed as
  `''` and stripped anyway). `diagramPayload.test.ts` asserts the key set and that a
  change to each of predictionSets / ideasText / functionalFactCategories /
  nodalCategories changes the snapshot. `DiagramEditor.dirtyContent.test.tsx` asserts
  creating a prediction set turns Save red (was the F-1 regression).
- **F-2 File > New reset.** `resetDiagramToBlankState` clears `predictionSets` and
  `ideasText`, passes them explicitly into `markSnapshotClean` (state hasn't
  re-rendered yet), and `clearDiagramLocalStorage` now clears the `predictions` key
  and empties `ideas`. Settings-like lists (eventCategories, relationshipTypes,
  relationshipStatuses, functionalFactCategories, nodalCategories) correctly persist
  — they are app-level settings, not per-client data. `useFileOperations.test.ts` and
  `storage.test.ts` cover it.
- **F-3 / F-13 / F-17 rules live in `predictionSets.ts` and are unit-tested there and
  through `usePredictionHandlers`.** `withConditionUpdate` drops stale links on
  person/type/SIR-category change but preserves them on a description edit or an
  explicit link set. Delete confirmations name the item and counts and gate on
  `window.confirm` (injectable). No `any` introduced (the fix *removed* an
  `any[]` from `markSnapshotClean`).
- **F-5 memo key** now includes the manual father/mother/partner overrides, each
  person's partnerships, and each partnership's status; `siblingPosition.test.ts`
  adds a key-change test per field (exact `not.toBe`, not floors).
- **F-10 dialog focus.** `useDialogFocus` keeps a module-level stack and closes only
  the topmost dialog on Escape; `onCloseRef` updates every render (so
  ImageDiagramModal's loading-dependent `onCancel || onClose` is live); focus is
  restored on close and not stolen from a field the dialog already focused. The hook
  is called before every early `return null` in all touched dialogs. Stacked-dialog
  and per-dialog tests pass.
- **F-11 storage retry.** Refused writes are re-attempted every 5 s from a ref of the
  last requested value; the retry effect keys on `failedStorageKeys` + `writeStored`
  (both stable), not on per-render callbacks (L7 respected). `clearDiagramLocalStorage`
  now swallows a blocked write so File > New cannot be aborted by full storage.
- **F-18 / F-19 / F-20 security + resilience.** VLM logging is counts-only under
  `import.meta.env.DEV`; the CSP lists exactly the two fetched hosts and the two
  YouTube embed hosts (verified against the actual fetch/embed sites — no custom-model
  base URL exists); `RETRYABLE_STATUSES` is shared with `vlmImport` rather than
  copied (pitfall-2 correct); Test Connection gains timeout + one retry and does not
  retry a 401.
- **F-21 kinship.** `stepThroughPartnership` uses `partnershipEndDate` (same
  `relationshipEndingForStatus` classifier as `partnershipSeparationMarks`, no
  hand-copied status list) and only de-steps a partner's child born *after* the
  recorded end; unknown dates leave the step term unchanged. Blood children are
  pre-seeded and can't be re-routed.
- **F-22 source-text checks removed.** `familyScope.persistence.test.ts` no longer
  greps `DiagramEditor.tsx` source; it is replaced by the behavioural
  "what Save writes" test that saves through the real editor and reads the file
  (P19 corollary correctly applied).
- **F-23 coordinates.** `asImagePercent` drops (and counts) any x/y outside 0–100
  rather than clamping; a person with no position at all is not counted as malformed.

## Notes for the fix loop

- Findings 1–3 are all LOW and latent; none blocks the merge and none is reachable
  through a current code path. They can go to the backlog.
- I did **not** independently re-run the mutation checks (revert-each-fix-and-confirm-
  red). The fix-status table claims every regression test fails on `ae41d45`; the
  assertions I inspected assert exact values rather than floors, and the full suite
  is green, but "fails without its fix" was verified here only by reading the
  assertions, not by executing the reverts.
