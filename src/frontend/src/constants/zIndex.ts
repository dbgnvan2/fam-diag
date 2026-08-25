/**
 * Stacking order for the app's fixed/sticky layers.
 *
 * Only the layers whose relative order is load-bearing live here — the rest are
 * still inline literals. The ordering that matters today:
 *
 *   HINT (900) < RIBBON (950) < context menu (1000/1001) < dialogs (2400+)
 *
 * RIBBON must exceed HINT because the ribbon is `position: sticky` with a
 * z-index, so it forms a stacking context: its dropdowns declare 1000 but
 * composite at the ribbon's own level, not at 1000. Without this the startup
 * hint paints over the File/Settings/Options/Help menus and eats their clicks.
 */
export const HINT_Z_INDEX = 900;
export const RIBBON_Z_INDEX = 950;
