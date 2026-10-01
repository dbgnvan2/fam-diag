# Learning-QA gate — 2026-09-30e (gap-review-fixes, re-gate after LOW fixes)

**Verdict: APPROVED** (0 high, 0 medium, 2 low)

## Range

`git diff ae41d45..HEAD` — 3 commits on `main`:

- `167dfff` Fix gap review 2026-09-30 findings F-1 to F-23
- `ae34c76` Gap review report, fix status, dialog pattern doc; version 2.54
- `10aae63` Fix gate 2026-09-30d LOW findings (APPROVED, 3 low)

78 files changed, +2280 / −369. The previous gate
(`docs/cycles/gate_2026-09-30d_gap-review-fixes.md`) APPROVED `ae34c76..HEAD` with
3 LOW findings; `10aae63` is the fix commit for those three. This pass re-runs the
full range and concentrates on the fix commit, per the loop's rule that the fix
commit is the least-reviewed code.

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 92 files, 941 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

All three run from `src/frontend`, in that order, on the live tree at HEAD.
`npm run lint` additionally returns 0 errors (7 pre-existing warnings, none new
from this range).

## Verification of the three prior LOW findings

### Prior LOW #1 — hand-maintained dirty/autosave dependency lists → FIXED

`DIAGRAM_CONTENT_KEYS` (in `utils/diagramPayload.ts`) is now the single list. The
dirty effect (`DiagramEditor.tsx:1300`) and the file-autosave effect (`:2323`) both
take their dependencies from `DIAGRAM_CONTENT_KEYS.map((key) => diagramContent[key])`
spread into their dep arrays, replacing the two hand-written 13-field lists.
`diagramPayload.test.ts:36` pins the set with exact equality
(`[...DIAGRAM_CONTENT_KEYS].sort()` `toEqual` the payload keys minus
`fileMeta`/`autoSaveMinutes`), not a floor.

Verified the chain end-to-end: `DiagramContentState` is `Omit<DiagramPayloadState,
'autoSaveMinutes'>` and has no `fileMeta`, so its 13 keys match the list; the
`diagramContent` object literal in the editor has exactly those 13 fields (typed as
`DiagramContentState`, so TS forces any new payload key into it); `serializeDiagramContent`
cuts from `buildDiagramPayload`, so a new key reaches the snapshot. A field added to
the payload therefore (a) fails `tsc` until `diagramContent` carries it, (b) fails the
test until `DIAGRAM_CONTENT_KEYS` lists it, and (c) is then automatically in both
effect dep arrays without editing them. The drift the finding predicted is now red,
not silent.

Note (not a finding): `DIAGRAM_CONTENT_KEYS` is still a hand-written list pinned by a
test, rather than derived from `DIAGRAM_PAYLOAD_KEYS` by `filter`. That is exactly the
shape the prior gate's backlog fix recommended (single constant + pinning test), and
the `satisfies readonly (keyof DiagramContentState)[]` only checks the listed keys are
valid, not exhaustive — exhaustiveness is carried by the test. A future cleanup could
derive it programmatically at the cost of the `keyof` type precision; drift is already
caught either way.

### Prior LOW #2 — CSP guard floor assertions → FIXED (mutation-verified)

`securityHeaders.test.ts` now scans every `https://` literal in the source (all
`.ts`/`.tsx` under `src/frontend/src`, test files and `vercel.json` excluded) and
checks the set bidirectionally against the policy:

- `every https origin in the source is allowed … or is a plain link` — source → policy.
- `the policy allows no origin the app does not use` — policy → source.

Both assert exact sets (`toEqual([])`), not `> 0` floors. I independently verified the
guard can fail: removing `https://api.anthropic.com` from `connect-src` in
`vercel.json` turns the suite red (2 tests fail: the source-origin check flags the host
as `unlisted`, and the AI-provider reachability check fails), and restoring it returns
green. The source scan is also no longer fooled by a URL moved into a constant or
variable, since it matches every literal rather than only `fetch(`/`embedUrl:` call
sites.

### Prior LOW #3 — sub-second timeout reported as "0s" → FIXED

`testApiConnection.ts` now reports `Number((timeoutMs / 1000).toFixed(2))` ("0.02s"
for a 20 ms timeout) instead of `Math.round(...)` ("0s"). The test pins the honest
value. Production default (15 s) is unaffected.

## Findings (ranked)

### 1. LOW — the "policy allows no unused origin" check cannot distinguish framing from navigation, so `frame-src https://www.youtube.com` is unverified over-permissiveness

`src/frontend/src/securityHeaders.test.ts:64-67` and `vercel.json`

The new policy→source check treats any origin that appears *anywhere* in the source as
"used". The app only ever frames `https://www.youtube-nocookie.com` (all three
`embedUrl` literals use nocookie); `https://www.youtube.com` and `https://youtu.be`
appear only as `url:` navigation links (the share/watch URLs), which `frame-src` does
not govern. `frame-src https://www.youtube.com` therefore passes the "no unused
origin" test even though nothing is ever framed from it, and the test structurally
cannot catch a future frame-src entry for a host used only as a link. `https://youtu.be`
is correctly handled via the `NAVIGATION_ONLY` allowlist; `https://www.youtube.com`
rides through on `frame-src` instead. This is pre-existing (the `frame-src` value was
added by the F-19 fix, not by `10aae63`), defence-in-depth only, and harmless given
`frame-ancestors 'none'` + `script-src 'self'`.

Fix (backlog): distinguish "framed" from "linked" in the source scan — e.g. derive the
frame expectation from `embedUrl:` literals specifically — or drop
`https://www.youtube.com` from `frame-src` (nothing embeds it) and let the navigation
origins live only in `NAVIGATION_ONLY`.

### 2. LOW — the source scan matches any `https://` literal, including prose, and its escape hatch is a hand-maintained list

`src/frontend/src/securityHeaders.test.ts:50-51`

`/https:\/\/[a-zA-Z0-9.-]+/g` over all source will match a URL in a comment, a doc
string, or a non-network string (e.g. a sample URL in a fixture or an explanatory
comment), and then fail the "every origin is allowed" test until someone hand-adds it
to `NAVIGATION_ONLY`. That forces a human review of every new https literal, which is
arguably the desired behaviour — but `NAVIGATION_ONLY` is itself a parallel
hand-maintained list (the P19 corollary shape), and `new URL(m[0]).origin` will throw
at collection time on a malformed match (`https://foo..bar`) rather than fail
gracefully. No such literal exists today; the tests pass. Latent brittleness only.

Fix (backlog): wrap the `new URL(...)` in a try/catch (or use a stricter hostname
pattern) and document that `NAVIGATION_ONLY` is the single place a new navigation link
must be recorded.

## Verified clean

- The three LOW fixes are correct and future-proof, each backed by an exact-value
  regression (not a floor), and LOW #2's guard was mutation-proven to fail on host
  removal and re-pass on restore.
- The `writeStored` additions to the dirty-adjacent effects (`:1358`, `:1603`,
  `:1606`, `:1634`, `setSessionNotesLibrary`) are safe: `writeStored` is
  `useCallback(..., [])` (`DiagramEditor.tsx:349-359`), so its identity is stable and
  listing it cannot restart the autosave/dirty timers (L7 respected).
- The `eslint-disable` on the two spread-dep hooks is deliberate and narrow; the
  spread deps compare element-wise (stable state references), so the effects fire on
  the same transitions as the previous explicit lists.
- No `any` introduced (the fix only touches dep arrays, a constant, a test, and a
  timeout string); no event-constant, EventCard, or date-field invariant is touched.

## Notes for the fix loop

- Findings 1–2 are LOW and latent; neither is reachable through a current code path.
  Both go to the backlog.
- One mutation check (remove `api.anthropic.com` from `connect-src`) was executed and
  the guard failed as intended; the source file was restored byte-identical
  (`git diff --stat -- vercel.json` is empty). The other two LOW fixes were verified
  by reading the assertions and the green suite rather than by executing a revert, on
  the same basis as the prior gate.
- The workspace carries an unrelated untracked file (`test import 1.json`) and a
  modified `.claude/worktrees/…` pointer; neither is in the diff range and neither
  was touched.
