export type HelpSection = {
  title: string;
  tips: string[];
};

export type RibbonHelpKey =
  | 'file-menu'
  | 'save'
  | 'timeline-controls'
  | 'zoom'
  | 'event-categories'
  | 'functional-indicators'
  | 'transcripts-menu'
  | 'timeline-menu'
  | 'event-creator'
  | 'notes-layer'
  | 'ideas'
  | 'session-notes'
  | 'help';

export type RibbonHelpEntry = {
  title: string;
  demoTitle: string;
  body: string;
  demoBody: string;
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Canvas & Navigation',
    tips: [
      'Drag on an empty canvas area (or hold space + drag) to pan the entire diagram; use the zoom slider (25–300%) to focus on different generations.',
      'Use the Timeline controls (slider, ±1 year buttons, and Play/Pause left of the Zoom slider) to replay births, deaths, PRL milestones, EPL start/end dates, and logged events. Only items on or before the chosen year remain visible so you can “grow” the diagram chronologically.',
      'The Save button turns red when edits are pending and blinks if changes are older than 10 minutes; adjust the Auto-Save interval beside it.',
      'Use File ▾ for New, Open, Save/Save As, Export PNG/SVG, Event Creator launch, or Quit. Use Transcripts ▾ for Process + Import Data, and Timeline ▾ for Export/Import Person Events.',
    ],
  },
  {
    title: 'People & Partnerships',
    tips: [
      'Right-click the canvas to Add Person; drag a person to move both their node and any attached notes.',
      'Select two partners and right-click to open the context-menu (“right-click options”) and create a Partner Relationship Line (PRL). Right-click that PRL to add child/twin/triplet/miscarriage/stillbirth symbols, or click the PRL then click any non-partner person to attach that person as a child. Parent-Child Lines (PCLs) stay attached as you move people or the PRL.',
      'Each person’s right-click menu always ends with Delete, plus “Add as Child”/“Remove as Child” when appropriate.',
      'Birth dates automatically render an “Age NN” label centered under the person (using death date if present, otherwise today), so you can scan generations without opening Properties.',
    ],
  },
  {
    title: 'Styling & Properties',
    tips: [
      'Click a single person to open the Functional Facts panel (Person tab) where you can edit names, adoption status, shading, and notes; shift-click to open the Multi-Select panel for bulk size/border/shading changes.',
      'Use the Notes Layer toggle in the toolbar to hide/show notes globally. Right-click a Person/PRL/EPL and choose Show Note to pin that note on even when the global layer is off.',
      'Hovering a person temporarily reveals that person’s note, regardless of Notes Layer state.',
      'Functional Indicators tab lets you configure definitions (Affair, Substance Use, etc.) and set Past/Current status plus 0–5 ratings for Frequency, Intensity, and Impact; indicators render tight to the left/right of the node and every change also logs (or updates) an event for that indicator once per hour.',
      'Events tab now shows compact two-line tiles (Category/Date then ratings + participants + actions) and its editor mirrors the layout with Frequency/Impact dropdowns, WWWWH, Observations, Prior Events, Reflections, and the Nodal Event checkbox.',
    ],
  },
  {
    title: 'Emotional Pattern Lines (EPLs)',
    tips: [
      'Use the right-click options (context menu) to add EPLs between two people; choose relationship type (fusion, distance, cutoff, conflict) with intensity-specific line styles.',
      'Each EPL supports custom colors (helpful for highlighting emotional triangles) plus arrow endings (single, double, perpendicular, fusion arrow). Thickness adjusts automatically for high-intensity options.',
      'Select three people, then right-click one of them and choose Add Triangle to draw a Bowen triangle between those three people.',
      'Fusion intensities render as double dotted (Low), double solid (Medium), or triple solid (High) lines while distance/conflict keep their dotted/dashed/sawtooth variants. Notes for EPLs float like person notes and can be enabled/disabled per line.',
    ],
  },
  {
    title: 'Session Notes & Timelines',
    tips: [
      'Click Session Notes to open a floating editor with coach/client names, presenting issue, and timestamped notes. Use New/Open/Save/Save As/Location to manage note files separately from diagram JSON.',
      'Highlight the last line (or rely on the last entered line) and press “Make Event” to populate a new Emotional Process Event draft for a person, partnership, or EPL.',
      'Use the Timeline popover (right-click → Timeline) to review nodal events, EPL milestones, and tracked events sorted ascending or descending; click any block to open that item in the right-side Events properties panel.',
    ],
  },
];

export const RIBBON_HELP: Record<RibbonHelpKey, RibbonHelpEntry> = {
  'file-menu': {
    title: 'File Menu',
    demoTitle: 'Ribbon · File Menu',
    body: 'Opens New, Open, Save/Save As, import, export, Event Creator launch, and Quit actions.',
    demoBody: 'Use the File menu to access New/Open/Save/Save As/import/export actions.',
  },
  save: {
    title: 'Save',
    demoTitle: 'Ribbon · Save + Auto-Save',
    body: 'Save writes the current diagram now. Auto-Save sets periodic persistence interval in minutes.',
    demoBody: 'Save commits the diagram now; Auto-Save sets periodic save cadence in minutes. Files are saved to our local computer.',
  },
  'timeline-controls': {
    title: 'Timeline Controls',
    demoTitle: 'Ribbon · Timeline Controls',
    body: 'Use the year slider, -1/+1 year nudges, and Play/Pause to filter visibility by timeline year.',
    demoBody: 'Timeline slider plus -1/+1 and Play/Pause filter visible items by year.',
  },
  zoom: {
    title: 'Zoom',
    demoTitle: 'Ribbon · Zoom',
    body: 'Changes canvas scale from 25% to 300% without modifying the underlying data coordinates.',
    demoBody: 'Zoom changes canvas scale from 25% to 300% without changing data positions.',
  },
  'event-categories': {
    title: 'Event Categories',
    demoTitle: 'Ribbon · Event Categories',
    body: 'Opens event category settings used for event creation and classification.',
    demoBody: 'Event Categories opens the list used for event classification and filtering.',
  },
  'functional-indicators': {
    title: 'Functional Indicators',
    demoTitle: 'Ribbon · Functional Indicators',
    body: 'Opens indicator definition settings (label/icon) used on person nodes and event logging.',
    demoBody: 'Functional Indicators configures definitions used beside people and in event logging.',
  },
  'transcripts-menu': {
    title: 'Transcripts Menu',
    demoTitle: 'Ribbon · Transcripts Menu',
    body: 'Contains transcript workflow actions: Process and Import Data.',
    demoBody: 'Transcripts menu contains Process and Import Data for transcript/facts workflows.',
  },
  'timeline-menu': {
    title: 'Timeline Menu',
    demoTitle: 'Ribbon · Timeline Menu',
    body: 'Contains timeline exchange actions: Export Person Events and Import Person Events.',
    demoBody: 'Timeline menu handles Export Person Events and Import Person Events bundles.',
  },
  'event-creator': {
    title: 'Event Creator',
    demoTitle: 'Ribbon · Event Creator',
    body: 'Opens standalone timeline event editor mode in a separate tab.',
    demoBody: 'Event Creator opens standalone timeline editing mode in a separate browser tab.',
  },
  'notes-layer': {
    title: 'Notes Layer',
    demoTitle: 'Ribbon · Notes Layer',
    body: 'Toggles global note visibility. Notes explicitly pinned on objects can remain visible.',
    demoBody: 'Notes Layer globally toggles note visibility. Pinned notes can still remain visible.',
  },
  ideas: {
    title: 'Ideas',
    demoTitle: 'Ribbon · Ideas',
    body: 'Opens the free-form ideas panel stored with the diagram file.',
    demoBody: 'Ideas opens the free-form notes workspace stored with the diagram data file.',
  },
  'session-notes': {
    title: 'Session Notes',
    demoTitle: 'Ribbon · Session Notes',
    body: 'Opens separate session-note files for coaching/case notes outside core diagram JSON.',
    demoBody: 'Session Notes opens separate coaching/session notes files outside diagram JSON.',
  },
  help: {
    title: 'Help',
    demoTitle: 'Ribbon · Help',
    body: 'Opens Quick Start help, training videos, and both demo walkthroughs.',
    demoBody: 'Help opens Quick Start, training videos, and the two demo walkthrough modes.',
  },
};
