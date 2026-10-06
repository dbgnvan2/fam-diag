# Learning-QA gate — 2026-10-06b (vlm-token-usage)

**Verdict: REJECTED** (0 high, 1 medium, 2 info)

The change removes the fixed image-import cost estimate (`GENOGRAM_IMPORT_COST_ESTIMATE`,
a stale ~$0.012/Sonnet-4 figure) and replaces it with the real token usage read from the
Claude Vision stream: `message_start` supplies input + cache tokens, the final
`message_delta` supplies the cumulative output count, and `vlmImport`'s new `onUsage`
reports each billed attempt (failed and retried included) to `DiagramEditor`, which logs
it with `formatVisionUsage()`. The streaming parser change, the cumulative-vs-sum
semantics, and the formatter are each covered by deterministic regression tests, and the
token-count contract is verified against the current Anthropic Messages streaming format.
One medium defect remains: the very doc this diff edits (`docs/VLM_Implementation_Summary.md`)
still asserts the removed fixed estimate in three other sections, one of which prints a
log line the code no longer emits.

Note: the request named commit `4b8f5d9`; that hash does not exist in this repo. The
actual HEAD of the reviewed range is `d8362dc` — same subject ("Log real Claude Vision
token usage instead of a fixed cost estimate").

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `d8362dc` Log real Claude Vision token usage instead of a fixed cost estimate

6 files changed, +273 / −73 (materialized at `/tmp/sweep_vlm.diff`, 556 lines):

- `TODO.md` — cost-estimate item marked done; done-notes updated
- `docs/VLM_Implementation_Summary.md` — "Cost Estimate Built-in" section replaced
- `src/frontend/src/components/DiagramEditor.tsx` — call site: `onUsage` logging, dropped fixed estimate
- `src/frontend/src/data/version.ts` — APP_VERSION bump to `v 2.57-1006-13-13`
- `src/frontend/src/utils/genogram/vlmImport.ts` + `vlmImport.test.ts` — `VisionUsage` type,
  `formatVisionUsage()`, stream-parser usage capture, 11 new tests

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 121 files, 1189 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Run from `src/frontend` with the local binaries (`npx tsc --noEmit` was blocked by the
package-threat scan, so the gate used the same local toolchain as the prior gate). Test
count grew from 1178 to 1189: exactly the 11 new assertions this batch adds (6
`readVisionStream` usage, 2 `callClaudeVision` usage, 3 `formatVisionUsage`).

## External-contract verification (the load-bearing facts behind this diff)

The change is correct only if the parser reads the token counts where the API actually
puts them (P19 — read the format the producer emits; P32 — the oracle is the API, not the
implementer's belief). Verified against current docs and a real streaming capture:

1. **`message_start.message.usage` carries the input count (plus cache fields)** — confirmed.
   The raw `message_start` event is
   `{"message": {..., "usage": {"input_tokens": 9, "output_tokens": 8, ...}}}`; cache
   fields (`cache_read_input_tokens`, `cache_creation_input_tokens`) also arrive here. The
   parser reads `event.message?.usage` and the fixture uses the same shape. Correct.
2. **`message_delta.usage` carries the cumulative output count** — confirmed ("The usage
   counts in message_delta are cumulative, not per-chunk"; the final `message_delta`
   carries `usage: {"output_tokens": 23, ...}`). The parser's "last one wins" overwrite is
   the right semantics, and the test `output counts are cumulative` pins it. Correct.
3. **No cache double-count** — confirmed, and this is the sharpest edge of the change.
   The `message_delta` event re-sends the *same cumulative* cache counts as
   `message_start` (langchain-ai/langchainjs#10249: summing the two produced exactly 2× the
   cache tokens). `mergeUsage()` here uses `??` **overwrite**, never addition, so a
   `message_delta` that re-sends cache/input fields replaces the identical value instead of
   doubling it. The `takes input counts from message_delta` test covers the overwrite path.
   Correct — and worth a comment in code, since the naive fix for "read from the stream"
   is to sum, which would be wrong here.

## Findings

### 1. MEDIUM — L1 / P16 · docs/VLM_Implementation_Summary.md:18,169-188,371-377 · the fixed estimate is retired in one section but asserted in three others

The diff replaces the "Cost Estimate Built-in" block (lines 55-59) and tells the reader
the fixed estimate "was removed". Three sibling sections in the *same file* still assert
the removed ~$0.012/Sonnet-4 figure as current:

- line 18 — "Key Statistics": `- **Cost per image:** ~$0.012 USD (Claude Sonnet 4)`
- lines 169-188 — the whole `## Cost Breakdown` section (per-image table `~$0.012`,
  `$0.008–0.030` range, and a "Total Cost of Ownership" derived from the dead Sonnet-4
  pricing)
- lines 371-377 — `## Cost Estimate Included in Code`, which shows the log line
  `Estimated cost per image: ~$0.012 USD` — a line the code **no longer emits** (it now
  logs `Claude Vision token usage (...): 4,812 input, ... output`).

This is the exact L1/P16 class the repo's fix log calls out ("retire its docs when the
approach changed") and a within-diff consistency miss: the doc was updated in one place
but not its three siblings (CLAUDE.md consistency protocol). The overview bullet and the
"included in code" section are false claims about current runtime behaviour, not just
stale pricing.

Fix: retire all three — either delete them or replace each with a one-line
"removed 2026-10-06; the import log now reports real token usage per attempt via
`formatVisionUsage()`" note, and repoint the Key Statistics bullet. Then re-sweep.

### 2. INFO · vlmImport.ts:597 · `complete` flips true on the first `message_delta`, not on `message_stop`

`if (usage) usage = { ...usage, complete: true }` runs on every `message_delta`. The doc
comment frames the output count as "cumulative, so the last one wins", which implies
multiple `message_delta`s are possible — yet `complete` is set by the first one, before any
later (final) one. Matches the real API (exactly one `message_delta` carries usage, the
final one with `stop_reason`), so there is no functional bug today; only the framing is
loose. If the API ever emitted an intermediate `message_delta` with a partial usage,
`complete` would be mis-set while the count itself stayed correct. Note only.

### 3. INFO · vlmImport.test.ts:540-552 · `formatVisionUsage` exact-string assertions depend on `toLocaleString('en-US')` grouping

The tests assert `'4,812 input'` and `'31,207 output'`, which rely on ICU comma grouping
for `en-US`. Deterministic under the current toolchain (Node full-icu), so it is green and
stable here; a future CI image with a different ICU build could change separators and fail
the test without a code change. Mild portability note; no action required for this
toolchain.

## Verified clean

- Every new test asserts behaviour with exact values, not floors (P29): `toEqual` over the
  full `VisionUsage` shape, `toBe(31207)`, `toHaveLength(1)`, `toHaveBeenCalledTimes(2)`,
  `toHaveBeenCalledWith` — no `>= N` guards, no source-text grep.
- The `readVisionStream` refactor is a faithful wrap: the read loop moved verbatim into
  `readEvents()`, and the only added control flow is `try { return await readEvents(); }
  finally { reportUsage(); }`, so `onUsage` fires on every exit path (success, mid-stream
  error, dropped stream) and is idempotent via `usageReported`. The pre-loop
  `!res.body` throw is before the try, but `usage` is still null there, so nothing is
  lost.
- Billing-vs-not is classified correctly: an attempt reports usage only once
  `message_start` arrived (reaching the model); an `invalid_request_error` before
  `message_start` reports nothing (`reports nothing when the stream never reached
  message_start`); a mid-stream error and a dropped stream report `complete: false` with
  the last seen output count; a `max_tokens`-cut-off reply reports `complete: true` (it was
  billed in full).
- Retry accounting is correct: each retried attempt gets its own `onUsage` call with a
  fresh `usage=null` per `readVisionStream` invocation (`reports every billed attempt`
  asserts 2 calls, first `complete:false`, second `complete:true`).
- No double-count of cache tokens: `mergeUsage` overwrites with `??`, never sums (verified
  against the langchain double-count bug — see External-contract #3).
- `GENOGRAM_IMPORT_COST_ESTIMATE` has no remaining consumers (grep across `src/` finds only
  the removed definition and the removed DiagramEditor import; `tsc -b` confirms).
- No new `any`; no hardcoded event type/category/subtype; no direct mutation (`usage` is
  reassigned via spread); no invariant break (Save=create-event, EventCard 5 call sites,
  modal `position: fixed` all untouched).

## Notes for the next loop

- Finding 1 (MEDIUM) blocks the verdict: retire the three stale cost sections in
  `docs/VLM_Implementation_Summary.md`, then re-sweep the fix commit as its own range.
  The fix is doc-only and small, but it is the exact consistency miss this loop exists to
  catch, so it should not be waved through.
- The workspace still carries the unrelated untracked `test import 1.json` and a modified
  `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the diff range.
- `version.ts` bumped `APP_VERSION` to `v 2.57-1006-13-13` in the same change; no separate
  release step is needed unless the deploy process requires one.
