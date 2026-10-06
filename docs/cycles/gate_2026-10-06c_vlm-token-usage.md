# Learning-QA gate — 2026-10-06c (vlm-token-usage, re-sweep)

**Verdict: APPROVED** (0 high, 0 medium, 3 info)

The one MEDIUM finding that rejected the 2026-10-06b gate is fixed: all three
stale cost sections in `docs/VLM_Implementation_Summary.md` are retired, and the
`~$0.012` mentions that remain are explicitly framed as the retired first version
("no longer applies", "was removed on 2026-10-06"), not as current behaviour. This
re-sweep covers the whole range `origin/main..HEAD` — the original change
(`d8362dc`) plus the fix commit (`5b27908`) — with the fix commit reviewed as its
own diff (P26 corollary: the fix is the least-reviewed code). The three CLAUDE.md
gates pass with the local binaries. Two info findings carried from the prior gate
and one trivial doc-wording info introduced by the fix; none blocks.

## Range

`git diff origin/main..HEAD` — 2 commits on `main`:

- `d8362dc` Log real Claude Vision token usage instead of a fixed cost estimate
- `5b27908` Fix gate 2026-10-06b finding: retire the stale cost sections in the VLM doc

7 files changed, +446 / −98 (materialized at `/tmp/sweep.diff`, 786 lines):

- `TODO.md` — cost-estimate item marked done; done-note updated
- `docs/VLM_Implementation_Summary.md` — "Cost Estimate Built-in" replaced; then
  the three stale sibling sections retired in the fix commit
- `docs/cycles/gate_2026-10-06b_vlm-token-usage.md` — the rejected gate record (added
  with the fix)
- `src/frontend/src/components/DiagramEditor.tsx` — call site: `onUsage` logging,
  dropped fixed estimate
- `src/frontend/src/data/version.ts` — APP_VERSION bump to `v 2.57-1006-13-13`
- `src/frontend/src/utils/genogram/vlmImport.ts` + `vlmImport.test.ts` — `VisionUsage`
  type, `formatVisionUsage()`, stream-parser usage capture, 11 new tests

The fix commit touches only the two doc files above; `vlmImport.ts` is byte-for-byte
unchanged by it, so the external-contract verification from 2026-10-06b still applies
to the code as reviewed.

## Build/test gates (CLAUDE.md)

Run from `src/frontend` with the local binaries (`npx` is blocked by the
package-threat scan, so the gate uses the same local toolchain as the prior gates):

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 121 files, 1189 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count is unchanged from the prior gate (121 files / 1189 tests): the fix is
doc-only, so the 11 assertions added in `d8362dc` (6 `readVisionStream` usage,
2 `callClaudeVision` usage, 3 `formatVisionUsage`) are still the whole delta from
the pre-change baseline of 1178.

## External-contract verification (unchanged by the fix)

`vlmImport.ts` is untouched in `5b27908`, so the three load-bearing facts verified in
2026-10-06b stand: `message_start.message.usage` carries input + cache counts; the
final `message_delta.usage` carries the cumulative output count ("last one wins");
and `mergeUsage` overwrites with `??` rather than summing, so a `message_delta` that
re-sends the same cumulative cache counts cannot double them (the langchain
double-count bug). No re-verification of the API format is needed for a doc-only fix.

## Findings

### 1. FIXED — the MEDIUM from 2026-10-06b (L1 / P16) · docs/VLM_Implementation_Summary.md

The three stale sections are retired as instructed:

- Key Statistics bullet (line 18) no longer asserts `~$0.012 USD (Claude Sonnet 4)`;
  it now reads "depends on the model and the drawing … The first version's ~$0.012
  figure no longer applies."
- `## Cost Breakdown` is gone; replaced by `## Cost` (lines 169–181) stating there is
  no built-in figure and that the first version's table "was removed on 2026-10-06".
- `## Cost Estimate Included in Code` is gone; replaced by `## Token Usage in the
  Import Log` (lines 364–373) quoting the new log line, not the dead
  `Estimated cost per image` line.

A repo-wide grep for the dead figures confirms no remaining consumer-facing assertion:
every `~$0.012` / `Cost Estimate` / `Estimated cost per image` hit now lives in
historical context ("first version", "removed"), in the done-note in `TODO.md`, or in
the gate record itself. The "16,000 output tokens" figure the new `## Cost` section
cites is grounded in `docs/VLM_Implementation_Summary.md` ("hit the later
16,000-token limit") and `TODO.md` ("failed at the 16000 max_tokens limit"), not
invented.

### 2. CARRIED — INFO · vlmImport.ts:597 · `complete` flips on the first `message_delta`, not `message_stop`

Unchanged from 2026-10-06b. `if (usage) usage = { ...usage, complete: true }` runs on
every `message_delta`. Matches the real API (exactly one `message_delta` carries
usage, the final one with `stop_reason`), so no functional bug today; only the framing
is loose. Still note-only.

### 3. CARRIED — INFO · vlmImport.test.ts · `formatVisionUsage` exact-string assertions depend on `toLocaleString('en-US')` grouping

Unchanged. The `'4,812 input'` / `'31,207 output'` assertions rely on ICU comma
grouping for `en-US`. Green and stable under this toolchain (Node full-icu); a future
CI image with a different ICU build could change separators. No action required.

### 4. NEW — INFO · docs/VLM_Implementation_Summary.md:372 · "a line ending 'stream ended early'" is a wording slip

The fix commit's `## Token Usage in the Import Log` section writes "A line ending
\"stream ended early\" means the attempt failed…". The emitted line does not *end*
with "stream ended early" — `formatVisionUsage()` appends
`' — stream ended early; output count is the last one reported'`, so the line ends
with "output count is the last one reported" and only *contains* "stream ended early"
mid-sentence. The substance is right; only the position word is loose. Trivial,
non-blocking, not worth another loop.

## Verified clean

- The MEDIUM finding is retired in all three named places, not one (CLAUDE.md
  consistency protocol), and the remaining figures are honest history rather than
  false runtime claims.
- The fix commit adds no code, so it cannot regress the parser, the formatter, the
  call site, or the version bump; the three gates green on the same 1189 tests confirm
  this.
- No new `any`; no hardcoded event type/category/subtype; no direct mutation; no
  invariant break (Save=create-event, EventCard 5 call sites, modal `position: fixed`
  all untouched — none are in this diff).
- Test assertions remain exact-value (`toEqual`, `toBe(31207)`, `toHaveBeenCalledTimes(2)`,
  `toHaveBeenCalledWith`), not floors (P29), and none grep source text (P19 corollary).

## Notes for the next loop

- Nothing blocks. The three info findings are genuinely below the fix bar; per P26,
  below-medium findings go to the backlog rather than into the loop, and another pass
  would trade a doc-wording polish for new unreviewed surface.
- The workspace still carries the unrelated untracked `test import 1.json` and a
  modified `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the range.
- `version.ts` bumped `APP_VERSION` to `v 2.57-1006-13-13`; no separate release step
  is needed unless the deploy process requires one.
- The first real import of the dense six-generation genogram is still the live check
  for the streaming path itself (TODO.md, unchanged).
