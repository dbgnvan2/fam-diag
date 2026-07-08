# Family Diagram — Claude Code instructions

React 18 + TypeScript + Konva.js + Vite frontend at `src/frontend/`.

## Global standards

Read the relevant file from `~/.claude/standards/` before starting work:

| Standard | When |
|---|---|
| `ui-regression.md` | Any change to an existing screen, modal, or control |
| `file-maintainability.md` | Any new file or significant refactor |
| `learnings.md` | P3 (scope completeness — check all 5 EventCard call sites), P8 (dirty-state tests) |
| [`./LEARNINGS.md`](LEARNINGS.md) | Repo-specific fix log (L1–L5): subsystem pivots, generation/layout algorithms, mutation-during-sort, fixture pitfalls, the two typecheck gates |

## Pre-completion checklist (all 3 must pass before declaring done)

```bash
cd src/frontend && npx tsc --noEmit
cd src/frontend && npx vitest run
cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b
```

Never tell the user "done" with any of these failing.

## Common commands

```bash
cd src/frontend && npx vitest run src/path/to/Foo.test.tsx   # single test file
cd src/frontend && npm run lint
cd src/frontend && npm run dev                               # http://localhost:5173
```

Vercel build: `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` — run before pushing.

## Hard rules

1. **Never duplicate logic.** Search for existing implementations before writing helpers, lookups, transforms.
2. **Never hardcode event types, categories, or subtypes.** Use `eventConstants.ts` lookups (`EVENT_CATEGORIES`, `EVENT_SUBTYPES`, `EVENT_TYPE_HAS_PERSONS`, etc.).
3. **Never modify a modal or form without first reading its test file** and running those tests before AND after.
4. **Never add a new event type or category** without updating `eventConstants.ts` first, then all consumers.
5. **Never skip a regression test** when fixing a bug. The test must fail without the fix and pass with it.
6. **Never use `any`.** Use types from `src/frontend/src/types/index.ts` or `src/frontend/src/types/diagramEditor.ts`.
7. **Never mutate objects directly.** Spread/clone — the codebase is immutable throughout.
8. **Never put domain logic in components.** Components render; hooks and utils contain logic.
9. **Never leave unused imports.** `noUnusedLocals: true` is enforced.
10. **Never fix a pattern in one place without checking all similar places** (see [Consistency protocol](#consistency-protocol)).

## Critical invariants (cannot be discovered from the code)

### Save = create event

Every Save button creates an `EmotionalProcessEvent`. Every event MUST set `date` AND `startDate`, `anchorType` and `anchorId`, `eventClass`, `createdAt`, and a meaningful `subtype`. Partnership events get cloned to both partners. See [event-system.md](docs/event-system.md#save--create-event-every-save-button-creates-an-event) for the builder template and existing builders.

### Two unrelated "intensity" concepts

- `event.intensity` — user-facing 1-5 rating on `EmotionalProcessEvent` (0 = unset → shows "—")
- `intensityLevel` — graphic line thickness/style on emotional line drafts

Never conflate. Details in [event-system.md](docs/event-system.md#intensity--two-unrelated-concepts).

### EventCard has 5 call sites — any change touches all

`EventsSection.tsx`, `PropertiesPanel.tsx` (Symptoms, Patterns, Family `renderFamilyEventCard()`), and `SessionEventModal.tsx`. Every card MUST have `onEdit` AND `onDelete`. Date is `startDate || date || ''`. See [event-system.md](docs/event-system.md#eventcard--5-call-sites-any-change-touches-all).

### Modal positioning

Use `position: fixed` on the dialog itself, not `position: absolute` inside a flex backdrop — browsers render the latter inconsistently and the dialog can escape the viewport. Pattern in [ui-patterns.md](docs/ui-patterns.md#modal-viewport-safety).

### Date-field synthesis (Events tab ↔ Timeline must stay in sync)

`PropertiesPanel.getDisplayEvents()` and `TimelineBoardModal` both call `utils/syntheticDateEvents.ts` to surface raw date fields as virtual events. To add a new "date field that should appear as an event," update `syntheticDateEvents.ts` only — both consumers pick it up.

## Consistency protocol

The #1 source of bugs here is fixing something in one place and missing the other similar places. Before writing any code:

1. **Search first** — find all files using the same pattern.
2. **List them** — note every file that needs the same change.
3. **Read them all** — understand each variant before changing any.
4. **Apply everywhere** — change all locations, not just the one the user pointed to.
5. **Verify** — `tsc --noEmit` and `vitest run`.

### Cross-check lists

- **Save handlers** → all `build*Event()` functions (template in [event-system.md](docs/event-system.md))
- **EventCard rendering** → the 5 call sites above
- **Event modal/form** → `EventModal.tsx`, `SessionEventModal.tsx`, `EventsSection.tsx`, `PropertiesPanel.tsx` (openNewEvent/openEditEvent/saveEvent), `EventCard.tsx`
- **Event constants** → all consumers of `eventConstants.ts` (the above plus any new files)
- **Settings list reordering** → every list modal uses `utils/listReorder.ts` (see [ui-patterns.md](docs/ui-patterns.md#settings-list-reordering))

## Testing policy

Write tests when you touch UI logic or data transformation — do not wait to be asked.

Required for: new components with conditional rendering/filtering/field visibility, data normalization/migration functions, modal/form variants, bug fixes (regression test), every event builder (assert it sets `date`, `startDate`, `anchorType`, `anchorId`, `eventClass`, `createdAt`, `subtype`).

Conventions: co-locate (`Foo.tsx` → `Foo.test.tsx`), `@testing-library/react` + `vitest`, run `npx vitest run` before every commit.

## Where to look

- **Architecture, hook/component patterns, file ops:** [docs/architecture.md](docs/architecture.md)
- **Event system, builders, EventCard, modalTitle pipeline:** [docs/event-system.md](docs/event-system.md)
- **AI Agent, Papero, SIR, FF, Predictions, Notes, Properties panel field visibility:** [docs/features.md](docs/features.md)
- **Modal positioning, context menu, settings list reordering:** [docs/ui-patterns.md](docs/ui-patterns.md)
- **Image-to-diagram import (Claude Vision VLM — the active path):** [docs/VLM_Implementation_Summary.md](docs/VLM_Implementation_Summary.md). Active code: `src/frontend/src/utils/genogram/vlmImport.ts` + `genogramRules.ts` (R1–R17), wired through `DiagramEditor.handleImageDiagramAnalyze`. NOTE: `docs/genogram-import-status.md` describes the **retired** classical-CV pipeline and is kept only for historical context.
- **Implementation plans:** [docs/implementation_plan_2026-06-06.md](docs/implementation_plan_2026-06-06.md), [docs/implementation_plan_2026-06-07.md](docs/implementation_plan_2026-06-07.md), [docs/implementation_plan_2026-06-07b.md](docs/implementation_plan_2026-06-07b.md), [docs/implementation_plan_2026-06-07c.md](docs/implementation_plan_2026-06-07c.md)

## Running without approval prompts

```bash
claude --dangerously-skip-permissions
```
