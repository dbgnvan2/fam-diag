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

## Settings list reordering

Every list modal supports drag-drop and ▲/▼ via `utils/listReorder.ts` (`moveItemUp`, `moveItemDown`, `reorderItem`).

Modals: `SettingsListModal`, `IndicatorSettingsModal`, `SIRSettingsModal`, `FunctionalFactSettingsModal`, `NodalCategorySettingsModal`.

The user's order is canonical — do not auto-sort. These lists feed dropdowns elsewhere in the order the user set.
