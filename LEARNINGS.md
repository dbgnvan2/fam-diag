# Family Diagram — repo-specific learnings (fix log)

Concrete failure patterns found and fixed in this repo. Generic catalogue (P1–P16) lives in
`~/.claude/standards/learnings.md`; entries here reference it where they map. When you fix a
bug, add an entry: issue → root cause → what would have caught it → rule.

---

## L1 — Retired subsystem left in place breaks the gates (image import pivot)

**Issue.** The genogram image import was pivoted from a classical-CV pipeline (opencv.js +
Tesseract) to a single Claude Vision (VLM) call, but the old code was never removed. It
drifted out of the build/test gates — 8 failing tests + 7 `tsc -b` errors — leaving `main`
undeployable, while `docs/genogram-import-status.md` still described the CV pipeline as the
current path (contradicting `docs/VLM_Implementation_Summary.md`).

**Root cause.** "Kept for reference" code still compiles and is still tested, so it rots
silently; stale docs were never retired when the approach changed.

**What would have caught it.** Running all three gates (`tsc --noEmit`, `vitest`, `tsc -b`)
after the pivot; treating a replaced subsystem as delete-or-gate work, not optional cleanup.

**Rule.** When you replace a subsystem, delete or explicitly exclude the old one **in the
same change**, and retire its docs (add a RETIRED banner + repoint the index). Don't leave a
parallel implementation compiling and under test. (Relates to P16 — verifying the wrong
layer / stale runtime.)

---

## L2 — First-arrival BFS used for a longest-path (generation) problem

**Issue.** Genogram generations were assigned by a first-arrival BFS. A married-in spouse
with no drawn parents (Rose) was a graph root at generation 0 and dragged her deep-ancestry
partner (Wayne, a great-grandchild) up to the top row; a child's generation was taken from
whichever parent was reached first, not the deeper one. The whole tree collapsed.

**Root cause.** The correct generation is a **max over paths** (longest path from any
ancestral root), but first-arrival BFS assigns the *first* depth it happens to reach —
order-dependent and wrong when a node has parents at different depths or a shallow married-in
partner.

**What would have caught it.** A fixture with a real multi-generation, married-in family
(the "Jennie's Boy" diagram) asserting a great-grandchild lands with its siblings, not the
top row. Toy two-generation fixtures never exercise it.

**Rule.** When the value you need is a maximum over paths (longest path / max depth), do
**not** use first-arrival BFS. Relax to a fixpoint: `gen(child) = max(gen(parents)) + 1`;
partners share `max(both)`. See `dataImport.ts` Step 1.

---

## L3 — Sorting by a key you mutate during the same pass

**Issue.** The X-layout sorted each family's children by the live `person.x` to preserve the
drawn left-to-right order — but the layout **mutates** `person.x` as it places people. Re-
sorting mid-layout scrambled sibling order (Died@7yrs/Helen/Eileen ended up interleaved with
other families).

**Root cause.** The ordering key (`person.x`) was the same field being written by the
algorithm, so the sort saw a moving target.

**What would have caught it.** A test with a sibling whose subtree is wide (so placement
moves x a lot) asserting siblings keep their drawn order — added as an R21 regression.

**Rule.** Never sort by a value the current algorithm mutates. Snapshot the ordering key
before the pass (`drawnX` map in `applyFamilyXLayout`) and sort by the snapshot.

---

## L4 — A fixture missing a field silently routed through a fallback path

**Issue.** While diagnosing the layout, a throwaway validation harness fed `people` with `x`
but no `y`. The `%→px` coordinate step only runs when **both** `x` and `y` are present, so it
was skipped and the layout fell back to a grid order — producing scrambled output that looked
like a layout bug but was a fixture bug. Time was nearly spent "fixing" correct code.

**Root cause.** An incomplete fixture didn't exercise the intended code path; the fallback
was invisible.

**What would have caught it.** Confirming the fixture actually reaches the intended branch
(here: that coordinates were applied) before concluding the code is wrong. (Relates to P11 —
trace the whole path before a verdict; P8/P9 — realistic fixtures.)

**Rule.** Before blaming code from a fixture's output, verify the fixture drives the path you
think it does. Prefer realistic fixtures that set every field the real input carries.

---

## L5 — The two typecheck gates disagree

**Issue.** A `string | undefined` nullability error was caught by `tsc -b` (the Vercel build,
stricter project config) but **not** by `tsc --noEmit`. A change that "passed typecheck" would
have failed the deploy.

**Root cause.** `tsc --noEmit` and `tsc -b` resolve different tsconfig settings; the quick
check is looser than the build gate.

**Rule.** Run **all three** pre-completion gates every time (`tsc --noEmit`, `vitest`,
`tsc -b`) — see CLAUDE.md. Never treat `tsc --noEmit` alone as "typechecks".
