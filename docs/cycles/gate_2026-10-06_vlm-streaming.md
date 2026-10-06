# Learning-QA gate — 2026-10-06 (vlm-streaming)

**Verdict: APPROVED** (0 high, 0 medium, 1 low carried, 2 info)

The change converts the image-import Claude Vision call from a single buffered
response (`stream: false`, fixed 180 s total timeout, 16,000 tokens) to a streamed
one (`stream: true`, 64,000 tokens, 90 s idle timeout, `effort: 'low'` on
supporting models, 2400 px image dimension). The streaming parser, the idle-timeout
retry semantics, and the `supportsEffort` gating are each covered by deterministic
regression tests, and all three external API contracts the code depends on
(`stop_details` on `message_delta`, `output_config.effort` validity + Haiku 4.5
rejection, Haiku 4.5's 64K output limit) are verified against current Anthropic
docs. No medium-or-higher defect found.

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `5da7915` Stream the image-import Vision call; raise its token limit to 64000

7 files changed, +506 / −53 (materialized at `/tmp/sweep.diff`, 801 lines):

- `docs/VLM_Implementation_Summary.md` — request-settings table, defaults updated
- `src/frontend/src/components/DiagramEditor.tsx` — call site: 2400 px, 64000 tokens, idle timeout, effort
- `src/frontend/src/data/aiModels.ts` + `aiModels.test.ts` — `supportsEffort` flag + guard test
- `src/frontend/src/data/version.ts` — APP_VERSION bump to 2.57
- `src/frontend/src/utils/genogram/vlmImport.ts` + `vlmImport.test.ts` — streaming parser, idle timer, 16 new tests

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 121 files, 1178 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Run from `src/frontend` with the local binaries (same toolchain as the prior gate).
Test count grew from 1162 to 1178: exactly the 16 new assertions this batch adds
(1 `supportsEffort` flag guard, 5 `readVisionStream`, 10 `callClaudeVision` streaming).

## External-contract verification (the load-bearing facts behind this diff)

The change is correct only if three claims about the Anthropic API hold. Each was
checked against the current docs rather than taken from the code's own comments
(P19 — the parser must read the format the producer actually emits; P32 — the
`supportsEffort` oracle must come from the API, not the implementer's belief):

1. **`stop_details` arrives on the streaming `message_delta` event, alongside
   `stop_reason`** — confirmed ("In the event stream, `stop_details` arrives on the
   `message_delta` event alongside `stop_reason`"; raw capture in
   anthropics/claude-code #47175 shows `message_delta.delta.stop_details`). The
   parser's `readVisionStream` reads `event.delta.stop_details`, and the refusal
   test fixture matches the real shape. Correct.
2. **`output_config.effort` is a valid top-level request field, `'low'` is a valid
   level, and Haiku 4.5 rejects the field with a 400** — confirmed (effort docs list
   the field and the `low` level; multiple reports of `"This model does not support
   the effort parameter."` for Haiku 4.5). The `supportsEffort` flag is set true for
   every built-in Claude model except Haiku 4.5 and omitted for custom/DeepSeek
   models, so effort is only ever sent where it is accepted. Correct.
3. **`max_tokens: 64000` is within every built-in model's output limit** — confirmed
   (Haiku 4.5's max output is 64K per Anthropic's model table and the Bedrock model
   card). The comment's "Haiku 4.5's is 64K" is accurate. Correct.

## Findings

### 1. LOW — P9/L-framing · vlmImport.ts:426 · the "idle" timer also bounds time-to-first-byte

`armIdleTimer()` is armed at the top of each attempt, before `fetch()` is called, so
the 90 s idle budget also covers connection establishment and the image upload, not
just the streaming phase. The doc and comment say "only a stalled stream fails," but
a slow connection or upload that takes > 90 s to produce the first byte would be
aborted and reported as "Claude Vision stopped sending data for 90s" — before any
data was ever sent. This also narrows the pre-first-byte budget from the old 180 s
fixed total to 90 s.

Realistic impact is negligible: a 2400 px image at 0.85 JPEG quality is a few hundred
KB, which uploads in seconds on any usable connection, and a genuinely stalled
connection *should* time out. This is a framing/maintainability note, not a
correctness bug.

Fix (backlog): arm the idle timer when the fetch resolves (headers received) rather
than before `fetch()`, so the "idle" budget genuinely measures stream silence only.
Leave a separate, larger connection/upload timeout if one is wanted.

### 2. INFO · aiModels.test.ts:41 · the `supportsEffort` guard's oracle is a string prefix

The test encodes "Haiku 4.5 rejects effort" as
`m.supportsEffort ?? false === !m.id.startsWith('claude-haiku-4-5')`. This is a
correct guard for the current allow-list and would catch a mis-flagged model today,
but the rule it protects is the API fact "Haiku 4.5 (and only Haiku 4.5) rejects
effort," and that fact is represented as a prefix match rather than cited. If a future
model id happened to begin `claude-haiku-4-5` while supporting effort (or a non-Haiku
model stopped supporting it), the test would silently encode the wrong rule. Mild
P32/P4 note only; no action required for this list.

### 3. INFO · vlmImport.ts:612 · the `stop_details` type drops the `type: 'refusal'` field

The real API's `stop_details` is `{ type: 'refusal', category, explanation }`; the
code's `ClaudeVisionResponse['stop_details']` models only `{ category, explanation }`
and `extractVisionText` reads only `.category`. The docs advise branching on
`stop_reason` or `stop_details.type`, and this code branches on `stop_reason`
(correct), so nothing is lost in practice. The `type` field is simply not captured.
No action.

## Verified clean

- Every new test asserts behaviour, not a constant: `readVisionStream` tests assert
  reassembled content / phase sequence / error classification; `callClaudeVision`
  tests assert the request body (`stream: true`, `max_tokens`, `output_config`
  present or absent) and the terminal error strings. No floor assertions (P29), no
  source-text grep (P19 corollary).
- The idle-timer restructure is sound: `cleanup()` (clear timer + remove abort
  listener) runs on every exit path — success, non-OK status, and the `catch` — and
  is idempotent, so the `extractVisionText` throw after `cleanup()` (refusal /
  max_tokens / empty text) does not leak the timer or the listener.
- Terminal-vs-retryable classification is correct: a stall and a user cancel both
  throw an `AbortError` and are distinguished by `timedOut` vs `externalSignal.aborted`;
  a mid-stream retryable `error` event (`overloaded_error`, `api_error`,
  `rate_limit_error`) retries with exponential backoff, while `invalid_request_error`
  and a drop-before-`message_stop` (thrown as `TypeError`) behave as documented and
  as tested.
- `supportsEffort` defaults to `undefined` (safe) everywhere except the seven built-in
  models that genuinely accept effort; custom and DeepSeek models therefore never get
  an `output_config`, and `checkVisionImportReadiness` already blocks non-Anthropic
  and non-vision models before the call.
- No new `any`; no new hardcoded event type/category; no direct mutation; no invariant
  break (Save=create-event, EventCard 5 call sites, modal `position: fixed` all
  untouched by this diff).
- The `message_delta` handler correctly leaves `stopReason`/`stopDetails` `null` when
  the fields are absent (normal `end_turn`), and `extractVisionText`'s pre-existing
  refusal/max_tokens/empty-text paths are unchanged and reachable.

## Notes for the next loop

- Finding 1 (LOW) is carried to the backlog; it is a framing note, not a correctness
  bug. No medium-or-higher finding remains, so the loop stops here per the prior
  gate's rule.
- The workspace still carries the unrelated untracked `test import 1.json` and a
  modified `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the
  diff range.
- `version.ts` bumped `APP_VERSION` to `v 2.57-1006-13-00` in the same change; no
  separate release step is needed unless the deploy process requires one.
