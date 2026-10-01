/**
 * Stacking order for the app's fixed/sticky layers.
 *
 * Every layer's z-index lives here (TODO 2026-08-24: ~50 inline literals).
 * The ordering that matters most:
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

/**
 * Every other layer, lowest first. Bands:
 *   1-30      inside a positioned container (canvas overlays, timeline labels)
 *   1000-1200 menus and the voice dialog
 *   2000-2485 dialogs; a dialog opened from another sits above it
 *   3000      canvas popovers that must clear the properties panel
 *   12500+    settings and import logs, above everything
 * Values are unchanged from the literals they replaced.
 */
export const Z_INDEX = {
  TIMELINE_BLOCK_LABEL: 1,
  CANVAS_SCROLLBAR: 2,
  TIMELINE_YEAR_LABEL: 2,
  CANVAS_OVERLAY: 5,
  CANVAS_DEMO_FRAME: 20,
  PANEL_POPOVER: 20,
  CANVAS_PAGE_NOTE_EDITOR: 25,
  CANVAS_SCROLL_HINT: 30,
  CONTEXT_MENU: 1000,
  RIBBON_DROPDOWN: 1000,
  CONTEXT_SUBMENU: 1001,
  VOICE_DIALOG: 1200,
  EVENT_MODAL_BACKDROP: 2000,
  EVENT_MODAL: 2001,
  // The three Settings list dialogs (found when the bare-number check moved
  // from a line regex to the parser: `zIndex={2000}` was a JSX prop).
  SETTINGS_LIST_EVENT_CATEGORIES: 2000,
  SETTINGS_LIST_RELATIONSHIP_TYPES: 2020,
  SETTINGS_LIST_RELATIONSHIP_STATUSES: 2030,
  EVENT_ROW_MENU: 2050,
  CLIENT_DIALOG: 2070,
  PERSON_DIALOG: 2072,
  ENTITY_DIALOG: 2075,
  TIMELINE_BOARD: 2100,
  SESSION_CAPTURE_DIALOG: 2105,
  SECTION_POPUP: 2200,
  PREDICTION_DIALOG: 2250,
  SIDE_PANEL: 2250,
  NESTED_EVENT_DIALOG: 2300,
  HELP_DIALOG: 2400,
  FILE_DIALOG: 2420,
  README_VIEWER: 2450,
  TRAINING_VIDEOS: 2460,
  DEMO_TOUR: 2480,
  BUILD_DEMO: 2485,
  SIBLING_POPOVER: 3000,
  // The SIR, Nodal and Functional Fact category dialogs (each had a local
  // `MODAL_Z = 12000` the bare-number check could not see).
  SETTINGS_CATEGORY_DIALOG: 12000,
  SETTINGS_OVERLAY: 12500,
  IMPORT_LOG: 12600,
} as const;
