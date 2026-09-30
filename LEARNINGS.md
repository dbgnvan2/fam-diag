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

---

## L6 — A z-index compared against a child of a stacking context

**Issue.** The startup right-click hint was placed at `zIndex: 900` on the argument that
"context menus and ribbon dropdowns are at 1000, so 900 is below them". True for the context
menu; false for all four ribbon menus. The hint painted over the File/Settings/Options/Help
dropdowns and swallowed their clicks — a hint that covered the very menus it points at.

**Root cause.** `AppRibbon`'s root is `position: sticky` with a z-index, so it creates a
**stacking context**. Its dropdowns declare `zIndex: 1000`, but that 1000 is scoped to the
ribbon — the whole ribbon subtree composites at the ribbon's own level (then 40). Reading
`1000` off the child said nothing about where it lands relative to a root-level overlay.

**What would have caught it.** Comparing against the ancestor that owns the stacking context,
not the element whose style you happened to read. A guard test asserting `HINT < 1000` passed
throughout — it compared two constants, neither of which described the real order.

**Rule.** Before claiming one fixed/absolute layer sits below another, find the nearest
ancestor of each with `position != static` and `z-index != auto`; that ancestor's value is the
one that competes. Keep load-bearing z-indexes in `constants/zIndex.ts` and assert the ordering
between those constants, so the claim is checkable rather than remembered. Verify the ordering
in the browser with elements that actually overlap — an on-screen check where the two never
intersect proves nothing.

---

## L7 — A debounce timer keyed on a callback that changes every render

**Issue.** Autosave never ran while the diagram had unsaved changes. Both timers — the
localStorage `useAutosave` calls and the linked-file autosave effect — listed a callback in
their effect dependencies. DiagramEditor passes inline arrows (new identity every render), and
`saveDiagramToCurrentTarget` was rebuilt every render because `buildDiagramPayload` is a plain
function. While dirty, the editor re-renders every 500 ms for the "unsaved for Ns" clock, so
each timer was cleared and restarted twice a second and never reached its 1-minute delay.

**Root cause.** A debounce keyed on something other than the data it debounces. The callback's
identity changes for reasons unrelated to what should be saved.

**What would have caught it.** A test that advances fake time in the same steps the app
re-renders (500 ms), not in one jump. The bug is invisible when time is advanced in a single
call, because no re-render happens in between.

**Rule.** Key a timer effect only on the values that should restart it (the data, the delay).
Read callbacks through a ref updated every render. When a component has an interval that
forces re-renders, test every timer in it by stepping time at that interval.

---

## L8 — A render test that counted a node type the subject itself draws

**Issue.** Two PersonNode tests checked the sibling-maturity badge by counting `Circle`
children. The badge is a square; the circle they found was the person's own body (people with
no sex set drew as circles). When unknown sex started drawing as a triangle, the "badge is
shown" test failed — it had never looked at the badge.

**Root cause.** The assertion matched a property (node class) shared by the thing under test
and its surroundings, so it passed whether or not the badge existed.

**What would have caught it.** Deleting the badge and running the test. It would have stayed
green.

**Rule.** Identify the rendered element by something only it has (its fill, a name, a test id),
and confirm the test goes red when that element is removed.

---

## L9 — One operation copied into several components drifts apart

**Issue.** Editing and saving an event was written four times: in the
Properties panel, the Timeline, the canvas triangle/family dialogs and the
session notes. Only the panel turned the dialog's string values into numbers
and kept `date` equal to `startDate`; only the Timeline sent an edit to the
entity that owned the event; none sent a date field's event back to the
field. Each copy had been "fixed" on its own, so every copy had a different
subset of the fixes.

**Root cause.** The same domain operation living in components rather than
one util (CLAUDE.md hard rule 8), so the consistency protocol had no single
place to apply a fix.

**What would have caught it.** A test per surface asserting the same saved
shape (numbers are numbers, date = startDate, anchor set) — the Timeline copy
would have failed on the first.

**Rule.** When a second surface needs an existing operation, move the
operation into a util and call it from both. Every event now goes through
`utils/eventDraft.ts`.

---

## L10 — A form that "corrects" values it does not recognise corrupts them

**Issue.** EventModal reset any category not in its option list to the first
option on open, and cleared the subtype. The app itself wrote categories the
list did not contain (identity events, pattern measurements, several menu
items), so opening one of those events and pressing Save turned it into a
"Birth" event with no subtype. The dialog title still named what the user
clicked, so nothing looked wrong. Filling an empty category with the first
option had the same effect in reverse: a new person event defaulted to
"Birth", which writes the birth date.

**Root cause.** Validation that repairs silently instead of preserving the
stored value and letting the user choose.

**What would have caught it.** A test that opens the dialog on every event
shape the app itself writes and asserts the dialog changes nothing.

**Rule.** A form never rewrites stored data on open. Offer an unknown value as
an option; leave an empty field empty for the user; only normalise what is
provably the same value (letter case). Every seed and builder category must
exist in `eventConstants.ts`.

