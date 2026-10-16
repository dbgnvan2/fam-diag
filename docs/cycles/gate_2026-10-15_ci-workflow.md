# Learning-QA gate — 2026-10-15 (ci-workflow)

**Verdict: APPROVED** (0 high, 0 medium, 2 low)

Two-commit review, no fix loop. The range adds the first GitHub Actions
workflow: `.github/workflows/tests.yml` runs the CLAUDE.md pre-completion
checklist gates plus lint on a blank ubuntu-latest runner across Node 22 and 26,
and a guard test (`src/test/ciWorkflow.test.ts`) that fails if the workflow
drops or rewrites any gate. The second commit replaces the `rm -f
node_modules/.tmp/*.tsbuildinfo && npx tsc -b` build gate with `npx tsc -b
--force`, because the `rm` glob is a zsh-ism that fails on a fresh checkout.

The workflow is sound. Every gate exits non-zero on failure and GitHub Actions
fails the job on a non-zero step, so a broken gate really does fail CI. The
guard test is provable-failing (not a floor, not a source grep). Nothing in the
range is macOS-specific: no absolute paths, no secrets, the `README.md?raw`
import is allowed portably via `fileURLToPath(new URL('../..', import.meta.url))`,
and both native devDependencies install on ubuntu-latest (verified below). The
two findings are a parallel-copy drift risk in the guard test's hardcoded
command list, and the fact that CI never exercises `vite build`.

## Range

`git diff origin/main...HEAD` — 2 commits on `fix/main-event-audit`:

- `3ffdf8b` Add GitHub tests workflow running the checklist gates on Node 22 and 26
- `3dc27ef` Use tsc -b --force instead of deleting tsbuildinfo before the build check

4 files changed, +83 / −4: `.github/workflows/tests.yml` (new), `CLAUDE.md`
(checklist line + CI note), `src/frontend/src/data/version.ts` (version bump),
`src/frontend/src/test/ciWorkflow.test.ts` (new). No event builder, no modal, no
EventCard call site, no date-field synthesis slot — the CLAUDE.md invariants are
untouched.

## Build/test gates (CLAUDE.md)

Run from `src/frontend`, against the committed code, on Node 26.7.0 (this Mac):

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit -p tsconfig.test.json`) | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 128 files, 1266 tests (exit 0) |
| `./node_modules/.bin/tsc -b --force` | PASS (exit 0) |
| `npm run lint` (`eslint .`) | PASS — 0 errors, 6 pre-existing warnings (exit 0) |

Test count 1259 → 1266: the seven `ciWorkflow.test.ts` assertions (1 existence
+ 5 command-membership + 1 package-root check). The author's reported 1266-per-
Node count is reproduced.

## Sweep loop

Cold sweep only — no high/medium findings, so no fix commit and no re-sweep.
The review ran the workflow's exact step list and then audited the five
questions the author flagged.

### The workflow really fails on a broken gate

Each check is a separate `run` step under `defaults.run.working-directory:
src/frontend`, and GitHub Actions fails the job when any step exits non-zero.
No step swallows a failure or chains with `|| true`:

- `npm ci` — fails on lockfile drift; `cache-dependency-path:
  src/frontend/package-lock.json` is repo-root-relative and correct.
- `npm run typecheck` → `tsc --noEmit -p tsconfig.test.json`, exits non-zero on
  type errors (app + test files, per L5).
- `npx vitest run` — exits non-zero on any failing/errored test.
- `npx tsc -b --force` — project references (`tsconfig.json` → app/test/node),
  `--force` ignores cached build info so a fresh-checkout rebuild is forced; the
  `rm …*.tsbuildinfo` it replaces was both a zsh-ism and stale (it named only
  the app file while app+test now exist — `--force` is the correct fix).
- `npm run lint` → `eslint .` — exits non-zero on errors. Warnings do not fail:
  the 6 present warnings (DiagramEditor/PropertiesPanel exhaustive-deps,
  unused) pass. This matches local `npm run lint` and is the intended gate
  strength; noted, not a finding.

### The guard test is provable-failing

`ciWorkflow.test.ts` reads `.github/workflows/tests.yml` as text and asserts:
the file exists; each of the five commands (`npm ci`, `npm run typecheck`,
`npx vitest run`, `npx tsc -b --force`, `npm run lint`) appears in a `run:`/
`- run:` line (after `split(' && ')`, so a combined command still matches); and
`working-directory: src/frontend` + `cache-dependency-path:
src/frontend/package-lock.json` are present. The parse order (trim → filter
`run:`/`- run:` → strip prefix) is correct for the current YAML. Removing or
rewriting any gate, the package-root binding, or the file itself fails the test
— exact membership checks, no `>= N` floor, no grepping of prose. `__dirname`
is established in this vitest setup (used by six other test files), and
`repoRoot` (4 × `..` from `src/frontend/src/test`) resolves to the repo root on
CI too, where the workflow file is checked out. The test is not `skip`ped and
runs under `vitest run` (128 files, +7 tests).

### Action and Node versions

`actions/checkout@v4` + `actions/setup-node@v4` are the current stable majors.
Matrix `node: ['22', '26']` (LTS + current line), `fail-fast: false` so both run
independently. No `node-version-file`, no floating `latest`. Correct.

### Nothing in the range is macOS-only

- Paths are all repo-relative (`working-directory`, `cache-dependency-path`); no
  absolute `/Users/...` paths, no secrets, no tokens.
- `README.md?raw` (imported by `DiagramModals.tsx` from the repo root, outside
  the package) is allowed in vitest by `vitest.config.ts` →
  `server.fs.allow: [fileURLToPath(new URL('../..', import.meta.url))]` —
  portable, resolves to the repo root on any OS. Type-checking never needs the
  file itself (`src/types/raw.d.ts` declares `*.md?raw`), and the file is
  committed at the repo root.
- **canvas@3.2.1** (lockfile-pinned) install script is `prebuild-install -r napi
  || node-gyp rebuild`. Verified against the GitHub release: v3.2.1 publishes
  `canvas-v3.2.1-napi-v7-linux-x64.tar.gz` (and darwin/arm64/win32). N-API v7 is
  Node-version-agnostic, so the same binary serves Node 22 and 26 on
  ubuntu-latest (linux-x64 glibc); the `node-gyp rebuild` fallback (which would
  fail without cairo system libs) is never reached. Linux install is covered,
  so the author's macOS-only `npm ci` verification is not a coverage gap.
- **cypress@15.x** postinstall (`node dist/index.js --exec install`) is a no-op
  under `CYPRESS_INSTALL_BINARY: '0'` (the documented skip; env vars are
  strings, so `'0'` is the correct value), avoiding the ~large binary download.

### No check lives only in the workflow

Every gate is an npm script or a direct command already present in the repo
(`npm run typecheck`, `npx vitest run`, `npx tsc -b --force`, `npm run lint`);
`npm ci` is install, not a check. The guard test enforces exactly this — no
inline shell assertion in the workflow that could not fail before a push.

## Findings

**P19/P2 (LOW) — the guard test's command list is a hand-maintained parallel
copy; CLAUDE.md↔CI drift is unguarded.** `ciWorkflow.test.ts` hardcodes
`['npm ci', 'npm run typecheck', 'npx vitest run', 'npx tsc -b --force', 'npm
run lint']` and pins the workflow to that list, but it never reads CLAUDE.md.
The checklist therefore exists in three places — CLAUDE.md (3 gates + "plus
lint"), the workflow (5 steps), and the guard test (5 commands) — and the guard
only enforces that the workflow is a superset of its own copy. If a gate is
added to (or removed from) CLAUDE.md without touching the guard list, the test
stays green and reports nothing, so the "keeps it in step" comment overstates
what it protects (it keeps the workflow in step with the test, not with
CLAUDE.md). Not a defect in the current range — the three copies agree today —
but the stated purpose is drift detection and it covers only one of the two
directions. Cheap fix: have the guard also assert that the CLAUDE.md checklist
block contains the same commands, or co-locate the canonical command list in one
file both the test and the doc derive from.

**P13 (LOW) — CI never exercises `vite build`.** The "Vercel build type-check"
step runs `npx tsc -b --force`, but the production bundle is `npm run build` =
`tsc -b && vite build`. A failure that only manifests at bundle time — e.g. the
`README.md?raw` asset missing (tsc resolves it via the ambient `*.md?raw`
declaration, but Vite needs the real file), a Vite plugin/asset-resolution
error, or a `vite.config.ts` problem — passes all four gates and only surfaces
on the Vercel deploy. This matches CLAUDE.md's documented "Vercel build: npx
tsc -b --force" pre-push convention, so it is not a regression; but it is the
one failure class this gate cannot catch, and adding `npm run build` (or
`vite build` after the type-check) would close it.

## Verified clean

- **Single source of truth for the guard target.** The workflow's step list and
  the guard test's command list agree exactly with CLAUDE.md's checklist +
  `npm ci` + lint; the guard parses the real workflow file rather than a second
  YAML, so there is no copied-config drift between the artifact and the check.
- **No assertion weakened, no `any` introduced.** The guard test is fully typed
  (`fs`, `path`, `__dirname` via `@types/node`; vitest globals via
  `tsconfig.app.json`'s `types`). The only production-code change is the
  `version.ts` bump.
- **Invariants (CLAUDE.md).** Save=create-event, EventCard 5 call sites, modal
  `position: fixed`, date-field synthesis single-slot, `eventConstants.ts`
  lookups — none touched; the range adds no builder, no modal, no component.
- **`git status` clean after the gate runs** — the `tsc -b --force` output
  (`node_modules/.tmp/*.tsbuildinfo`) is gitignored, so no tracked file changed.

## Notes for the next loop

- `eslint` is a weaker gate than the other three (warnings pass). The 6
  pre-existing warnings are out of scope for this range, but a future pass that
  promotes `--max-warnings 0` would need to first clear them — worth doing
  deliberately, not silently in CI.
- No `timeout-minutes` on the job. The suite is fast (~42s locally) and the one
  behavioural test carries a 20s timeout, so a hang is unlikely, but a
  `timeout-minutes: 15` guard is cheap insurance against a silently-hung
  `vitest run` burning the default 6-hour job window.
- No `permissions:` block; harmless here (no secrets, no deploy step), but
  `permissions: contents: read` is the standard hardening for a read-only CI job.

## Not covered

- The reviewer does not run the workflow on ubuntu-latest; the Linux install
  claim rests on the published canvas napi-v7 linux-x64 release asset and the
  documented Cypress skip, not a live CI run. Recommend one push/PR to confirm
  the runner's `npm ci` in practice.
- Logic/algorithmic correctness, concurrency/races, auth, injection/security,
  performance, dependency/supply-chain, API-contract compatibility, test quality
  beyond the guard test itself, and architecture are out of scope for this
  family.
