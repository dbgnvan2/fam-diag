# UI Patterns

## Modal viewport safety

Every modal/dialog MUST stay within the browser viewport.

### Fixed positioning (do not deviate)

Use `position: fixed` directly on the dialog element — never `position: absolute` inside a flex backdrop. Browsers render absolute-inside-fixed-with-flex inconsistently and the dialog can drop below the viewport.

**Centered modal** (no `position` prop):
```typescript
style={{
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxHeight: `calc(100vh - ${MODAL_MARGIN * 2}px)`,
  overflowY: 'auto',
}}
```

**Positioned modal** (opened near a canvas object):
```typescript
const dialogTop = Math.max(MARGIN, Math.min(rawTop, vh - MIN_HEIGHT - MARGIN));
const dialogLeft = Math.max(MARGIN, Math.min(rawLeft, vw - MODAL_WIDTH - MARGIN));
const dialogMaxHeight = Math.max(MIN_HEIGHT, vh - dialogTop - MARGIN);
style={{
  position: 'fixed',
  top: dialogTop,
  left: dialogLeft,
  maxHeight: dialogMaxHeight,
  overflowY: 'auto',
}}
```

Backdrop is a separate sibling div (`position: fixed; inset: 0; pointerEvents: none`) — never the parent.

### ContextMenu viewport safety

`ContextMenu.tsx` clamps root position with `useLayoutEffect` (not `useEffect` — avoids flash). `SubMenuContainer` also uses `useLayoutEffect` to shift up on bottom overflow.

The root menu uses `visibility: hidden` until position is computed.

**Do not add `overflowY: auto` or `maxHeight` to `SubMenuContainer`** — it clips absolutely-positioned grandchildren (third-level submenus).

## Non-blocking hints (and why they are not modals)

`RightClickHintModal` is a hint, not a dialog: the rest of the app must stay
usable while it is up. It therefore breaks with the modal pattern above in three
deliberate ways, and a new hint should copy all three:

- **No backdrop.** A `pointerEvents: 'none'` scrim is decoration, not a modal
  barrier — it dims and obscures everything below its z-index while doing nothing
  to block interaction. The hint uses a border plus shadow instead.
- **Below the overlay band.** Its z-index comes from
  `src/frontend/src/constants/zIndex.ts` (`HINT_Z_INDEX`), which is below
  `RIBBON_Z_INDEX`, the context menu (1000/1001) and every dialog (2400+). A hint
  that tells the user to open a menu must never paint over that menu.
- **No `aria-modal`, no focus trap.** Marking the page inert for screen-reader
  users while everyone else can still interact with it is worse than saying
  nothing.

### Stacking contexts make a declared z-index a lie

The ribbon is `position: sticky` with a z-index, which creates a **stacking
context**: its dropdowns declare `zIndex: 1000`, but they composite at the
*ribbon's* level, not at 1000. Comparing a fixed overlay's z-index against a
number read off a child element is therefore not a valid ordering argument —
compare it against the ancestor that owns the stacking context, which is why
`RIBBON_Z_INDEX` is a shared constant and the hint's test asserts against it.

## Settings list reordering

Every list modal supports drag-drop and ▲/▼ via `utils/listReorder.ts` (`moveItemUp`, `moveItemDown`, `reorderItem`).

Modals: `SettingsListModal`, `IndicatorSettingsModal`, `SIRSettingsModal`, `FunctionalFactSettingsModal`, `NodalCategorySettingsModal`.

The user's order is canonical — do not auto-sort. These lists feed dropdowns elsewhere in the order the user set.
