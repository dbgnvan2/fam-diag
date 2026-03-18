/**
 * Demo tour utilities — extracted from DiagramEditor.tsx.
 * Builds the guided walkthrough steps from demo diagram notes and static spec data.
 */

import type { Person, Partnership, EmotionalLine } from '../types';
import type {
  DiagramImportData,
  DemoTourStep,
  BuildDemoStep,
  BuildDemoStepSpec,
} from '../types/diagramEditor';
import { RIBBON_HELP } from '../data/helpContent';
import productDefaultDiagramDataJson from '../../../../PRODUCT_DEFAULT.diagram.json';

// ---------------------------------------------------------------------------
// Demo diagram data
// ---------------------------------------------------------------------------

export const DEMO_DIAGRAM_DATA: DiagramImportData =
  productDefaultDiagramDataJson as DiagramImportData;
export const DEFAULT_DEMO_FILE_NAME = 'PRODUCT_DEFAULT.diagram.json';
const LEGACY_DEMO_FILE_NAMES = new Set([
  'demo family diagram',
  'demo family diagram.json',
  DEFAULT_DEMO_FILE_NAME,
]);

export const isDemoDiagramFileName = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  return LEGACY_DEMO_FILE_NAMES.has(normalized);
};

// ---------------------------------------------------------------------------
// Step number parsing (from node notes)
// ---------------------------------------------------------------------------

export const parseDemoStepNumber = (notes?: string): number | null => {
  if (!notes) return null;
  const match = notes.match(/\[(\d+)\]|\((\d+)\)/);
  if (!match) return null;
  const parsed = Number(match[1] || match[2]);
  return Number.isFinite(parsed) ? parsed : null;
};

export const stripLeadingStepNumber = (notes?: string): string => {
  if (!notes) return '';
  return notes.replace(/^\s*(?:\[\d+\]|\(\d+\))\s*/u, '').trim();
};

// ---------------------------------------------------------------------------
// Static base demo tour steps (toolbar-focused)
// ---------------------------------------------------------------------------

const BASE_DEMO_TOUR_STEPS: DemoTourStep[] = [
  {
    itemNumber: 1,
    title: 'Item 1 · Alex Carter',
    body: '[1] Alex Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Alex Carter to select the person and open properties.',
    rightClickOptions: ['Change sex', 'Show/Hide Note', 'Properties', 'Timeline', 'Add', 'Make Client', 'Remove/Delete'],
    focus: { kind: 'person', personId: 'demo-dad', tab: 'properties' },
  },
  {
    itemNumber: 2,
    title: 'Item 2 · Renee Carter',
    body: '[2] Renee Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Renee Carter to select the person and open properties.',
    rightClickOptions: ['Change sex', 'Show/Hide Note', 'Properties', 'Timeline', 'Add', 'Make Client', 'Remove/Delete'],
    focus: { kind: 'person', personId: 'demo-mom', tab: 'properties' },
  },
  {
    itemNumber: 3,
    title: 'Item 3 · Liam Carter',
    body: '[3] Liam Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Liam Carter to select the person and open properties.',
    focus: { kind: 'person', personId: 'demo-son', tab: 'properties' },
  },
  {
    itemNumber: 4,
    title: 'Item 4 · Emma Carter',
    body: '[4] Emma Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Emma Carter to select the person and open properties.',
    focus: { kind: 'person', personId: 'demo-daughter', tab: 'properties' },
  },
  {
    itemNumber: 5,
    title: 'Item 5 · Noah Reed',
    body: '[5] Noah Reed person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Noah Reed to select the person and open properties.',
    focus: { kind: 'person', personId: 'demo-emma-partner', tab: 'properties' },
  },
  {
    itemNumber: 6,
    title: 'Item 6 · Parent PRL',
    body: '[6] PRL means Partner Relationship Line. This parent PRL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the parent PRL line to open relationship properties.',
    rightClickOptions: ['Add Child', 'Add Twins', 'Add Triplets', 'Add Miscarriage', 'Add Stillbirth', 'Show/Hide Note', 'Properties', 'Delete Partnership'],
    focus: { kind: 'partnership', partnershipId: 'demo-prl-parents', tab: 'properties' },
  },
  {
    itemNumber: 7,
    title: 'Item 7 · Emma-Noah PRL',
    body: '[7] PRL means Partner Relationship Line. This second-generation PRL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the Emma-Noah PRL to open relationship properties.',
    rightClickOptions: ['Add Child', 'Add Twins', 'Add Triplets', 'Add Miscarriage', 'Add Stillbirth', 'Show/Hide Note', 'Properties', 'Delete Partnership'],
    focus: { kind: 'partnership', partnershipId: 'demo-prl-emma', tab: 'properties' },
  },
  {
    itemNumber: 8,
    title: 'Item 8 · Distance EPL',
    body: '[8] EPL means Emotional Process Line. This distance EPL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the distance EPL to open EPL properties.',
    rightClickOptions: ['Show/Hide Note', 'Properties', 'Delete Emotional Line (or Delete Triangle if EPL belongs to a triangle)'],
    focus: { kind: 'emotional', lineId: 'demo-epl-distance', tab: 'properties' },
  },
  {
    itemNumber: 9,
    title: 'Item 9 · Conflict EPL',
    body: '[9] EPL means Emotional Process Line. This conflict EPL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the conflict EPL to open EPL properties.',
    rightClickOptions: ['Show/Hide Note', 'Properties', 'Delete Emotional Line (or Delete Triangle if EPL belongs to a triangle)'],
    focus: { kind: 'emotional', lineId: 'demo-epl-conflict', tab: 'properties' },
  },
  {
    itemNumber: 10,
    title: RIBBON_HELP['file-menu'].demoTitle,
    body: RIBBON_HELP['file-menu'].demoBody,
    clickToSelectHint: 'Click File ▾ to open file-level operations.',
    focus: { kind: 'toolbar', target: 'file-menu' },
  },
  { itemNumber: 11, title: RIBBON_HELP.save.demoTitle, body: RIBBON_HELP.save.demoBody, focus: { kind: 'toolbar', target: 'save' } },
  { itemNumber: 12, title: RIBBON_HELP['timeline-controls'].demoTitle, body: RIBBON_HELP['timeline-controls'].demoBody, focus: { kind: 'toolbar', target: 'timeline-controls' } },
  { itemNumber: 13, title: RIBBON_HELP.zoom.demoTitle, body: RIBBON_HELP.zoom.demoBody, focus: { kind: 'toolbar', target: 'zoom' } },
  { itemNumber: 14, title: RIBBON_HELP['event-categories'].demoTitle, body: RIBBON_HELP['event-categories'].demoBody, focus: { kind: 'toolbar', target: 'event-categories' } },
  { itemNumber: 15, title: RIBBON_HELP['functional-indicators'].demoTitle, body: RIBBON_HELP['functional-indicators'].demoBody, focus: { kind: 'toolbar', target: 'functional-indicators' } },
  { itemNumber: 16, title: RIBBON_HELP['transcripts-menu'].demoTitle, body: RIBBON_HELP['transcripts-menu'].demoBody, focus: { kind: 'toolbar', target: 'transcripts-menu' } },
  { itemNumber: 17, title: RIBBON_HELP['timeline-menu'].demoTitle, body: RIBBON_HELP['timeline-menu'].demoBody, focus: { kind: 'toolbar', target: 'timeline-menu' } },
  { itemNumber: 18, title: RIBBON_HELP['event-creator'].demoTitle, body: RIBBON_HELP['event-creator'].demoBody, focus: { kind: 'toolbar', target: 'event-creator' } },
  { itemNumber: 19, title: RIBBON_HELP['notes-layer'].demoTitle, body: RIBBON_HELP['notes-layer'].demoBody, focus: { kind: 'toolbar', target: 'notes-layer' } },
  { itemNumber: 20, title: RIBBON_HELP.ideas.demoTitle, body: RIBBON_HELP.ideas.demoBody, focus: { kind: 'toolbar', target: 'ideas' } },
  { itemNumber: 21, title: RIBBON_HELP['session-notes'].demoTitle, body: RIBBON_HELP['session-notes'].demoBody, focus: { kind: 'toolbar', target: 'session-notes' } },
  { itemNumber: 22, title: RIBBON_HELP.help.demoTitle, body: RIBBON_HELP.help.demoBody, focus: { kind: 'toolbar', target: 'help' } },
];

// ---------------------------------------------------------------------------
// Dynamic demo tour step building (from diagram notes)
// ---------------------------------------------------------------------------

export const buildDemoTourStepsFromNotes = (base: DiagramImportData): DemoTourStep[] => {
  const people = Array.isArray(base.people) ? base.people : [];
  const partnerships = Array.isArray(base.partnerships) ? base.partnerships : [];
  const lines = Array.isArray(base.emotionalLines) ? base.emotionalLines : [];
  const personNameById = new Map(people.map((person) => [person.id, person.name || 'Person']));

  const noteSteps: DemoTourStep[] = [];
  people.forEach((person) => {
    const itemNumber = parseDemoStepNumber(person.notes);
    if (itemNumber == null) return;
    noteSteps.push({
      itemNumber,
      title: `Item ${itemNumber} · ${person.name || 'Person'}`,
      body: stripLeadingStepNumber(person.notes) || 'Person walkthrough step.',
      clickToSelectHint: 'Click this person to select and open properties.',
      focus: { kind: 'person', personId: person.id, tab: 'properties' },
    });
  });

  partnerships.forEach((partnership) => {
    const itemNumber = parseDemoStepNumber(partnership.notes);
    if (itemNumber == null) return;
    const p1 = personNameById.get(partnership.partner1_id) || 'Partner 1';
    const p2 = personNameById.get(partnership.partner2_id) || 'Partner 2';
    noteSteps.push({
      itemNumber,
      title: `Item ${itemNumber} · ${p1}-${p2} PRL`,
      body: stripLeadingStepNumber(partnership.notes) || 'PRL walkthrough step.',
      clickToSelectHint: 'Click the PRL line to select and open relationship properties.',
      focus: { kind: 'partnership', partnershipId: partnership.id, tab: 'properties' },
    });
  });

  lines.forEach((line) => {
    const itemNumber = parseDemoStepNumber(line.notes);
    if (itemNumber == null) return;
    const p1 = personNameById.get(line.person1_id) || 'Person 1';
    const p2 = personNameById.get(line.person2_id) || 'Person 2';
    noteSteps.push({
      itemNumber,
      title: `Item ${itemNumber} · ${p1}-${p2} EPL`,
      body: stripLeadingStepNumber(line.notes) || 'EPL walkthrough step.',
      clickToSelectHint: 'Click the EPL line to select and open emotional process properties.',
      focus: { kind: 'emotional', lineId: line.id, tab: 'properties' },
    });
  });

  noteSteps.sort((a, b) => a.itemNumber - b.itemNumber);
  const toolbarSteps = BASE_DEMO_TOUR_STEPS.filter((step) => step.focus.kind === 'toolbar').map(
    (step, index) => ({ ...step, itemNumber: noteSteps.length + index + 1 })
  );

  if (!noteSteps.length) return BASE_DEMO_TOUR_STEPS;
  return [...noteSteps, ...toolbarSteps];
};

export const DEFAULT_DEMO_TOUR_STEPS: DemoTourStep[] = buildDemoTourStepsFromNotes(DEMO_DIAGRAM_DATA);

// ---------------------------------------------------------------------------
// Deep clone helper
// ---------------------------------------------------------------------------

export const deepCloneDiagramImport = (data: DiagramImportData): DiagramImportData =>
  JSON.parse(JSON.stringify(data));

// ---------------------------------------------------------------------------
// Build demo snapshots (step-by-step construction walkthrough)
// ---------------------------------------------------------------------------

export const buildCreationDemoSnapshots = (base: DiagramImportData): DiagramImportData[] => {
  const basePeople = Array.isArray(base.people) ? base.people : [];
  const basePartnerships = Array.isArray(base.partnerships) ? base.partnerships : [];
  const baseLines = Array.isArray(base.emotionalLines) ? base.emotionalLines : [];
  const byPersonId = new Map(basePeople.map((person) => [person.id, person]));
  const byPartnershipId = new Map(basePartnerships.map((prl) => [prl.id, prl]));
  const byLineId = new Map(baseLines.map((line) => [line.id, line]));
  const clonePerson = (id: string) => deepCloneDiagramImport({ people: [byPersonId.get(id)!] }).people![0];
  const clonePartnership = (id: string) =>
    deepCloneDiagramImport({ partnerships: [byPartnershipId.get(id)!] }).partnerships![0];
  const cloneLine = (id: string) =>
    deepCloneDiagramImport({ emotionalLines: [byLineId.get(id)!] }).emotionalLines![0];

  const buildSnapshot = (
    people: Person[],
    partnerships: Partnership[],
    emotionalLines: EmotionalLine[],
    fileName: string
  ): DiagramImportData => ({
    fileMeta: { fileName },
    people,
    partnerships,
    emotionalLines,
    triangles: [],
    functionalIndicatorDefinitions: base.functionalIndicatorDefinitions || [],
    eventCategories: base.eventCategories || [],
    relationshipTypes: base.relationshipTypes || [],
    relationshipStatuses: base.relationshipStatuses || [],
    autoSaveMinutes: base.autoSaveMinutes || 1,
    ideasText: 'Build Demo mode: follow step instructions to construct the full diagram.',
  });

  const alexFinal = clonePerson('demo-dad');
  const reneeFinal = clonePerson('demo-mom');
  const liamFinal = clonePerson('demo-son');
  const emmaFinal = clonePerson('demo-daughter');
  const noahFinal = clonePerson('demo-emma-partner');
  const parentPrlFinal = clonePartnership('demo-prl-parents');
  const emmaPrlFinal = clonePartnership('demo-prl-emma');
  const distanceEplFinal = cloneLine('demo-epl-distance');
  const conflictEplFinal = cloneLine('demo-epl-conflict');

  const alexStart: Person = { ...alexFinal, x: 120, y: 140, partnerships: [], notesEnabled: false, notes: undefined, events: [] };
  const alexMoved: Person = { ...alexFinal, partnerships: [], notesEnabled: false, notes: undefined, events: [] };
  const reneeAdded: Person = { ...reneeFinal, partnerships: ['demo-prl-parents'], notesEnabled: false, notes: undefined, events: [] };
  const parentPrlDating: Partnership = { ...parentPrlFinal, relationshipType: 'dating', relationshipStatus: 'married', notesEnabled: false, notes: undefined, children: [] };
  const parentPrlMarriedNoKids: Partnership = { ...parentPrlFinal, notesEnabled: false, notes: undefined, children: [] };
  const liamNoNote: Person = { ...liamFinal, notesEnabled: false, notes: undefined };
  const emmaNoNote: Person = { ...emmaFinal, notesEnabled: false, notes: undefined, partnerships: [] };
  const noahNoNote: Person = { ...noahFinal, notesEnabled: false, notes: undefined };
  const emmaPrlInitial: Partnership = { ...emmaPrlFinal, relationshipType: 'dating', relationshipStatus: 'married', notesEnabled: false, notes: undefined };

  return [
    buildSnapshot([], [], [], 'Build Demo Step 1 - Blank'),
    buildSnapshot([alexStart], [], [], 'Build Demo Step 2 - Add Alex'),
    buildSnapshot([alexMoved], [], [], 'Build Demo Step 3 - Move Alex'),
    buildSnapshot([alexMoved, reneeAdded], [parentPrlDating], [], 'Build Demo Step 4 - Add Partner'),
    buildSnapshot([alexMoved, reneeAdded], [parentPrlMarriedNoKids], [], 'Build Demo Step 5 - Set Married'),
    buildSnapshot([alexMoved, reneeAdded, liamNoNote], [{ ...parentPrlMarriedNoKids, children: ['demo-son'] }], [], 'Build Demo Step 6 - Add Liam'),
    buildSnapshot([alexMoved, reneeAdded, liamNoNote, emmaNoNote], [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }], [], 'Build Demo Step 7 - Add Emma'),
    buildSnapshot([alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote], [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, emmaPrlInitial], [], 'Build Demo Step 8 - Add Noah + PRL'),
    buildSnapshot([alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote], [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, { ...emmaPrlFinal, notes: undefined, notesEnabled: false }], [], 'Build Demo Step 9 - Configure Emma/Noah PRL'),
    buildSnapshot([alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote], [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, { ...emmaPrlFinal, notes: undefined, notesEnabled: false }], [{ ...distanceEplFinal, notes: undefined, notesEnabled: false }], 'Build Demo Step 10 - Add Distance EPL'),
    buildSnapshot([alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote], [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, { ...emmaPrlFinal, notes: undefined, notesEnabled: false }], [{ ...distanceEplFinal, notes: undefined, notesEnabled: false }, { ...conflictEplFinal, notes: undefined, notesEnabled: false }], 'Build Demo Step 11 - Add Conflict EPL'),
    deepCloneDiagramImport(base),
  ];
};

// ---------------------------------------------------------------------------
// Build demo step specs
// ---------------------------------------------------------------------------

const BUILD_DEMO_STEP_SPECS: BuildDemoStepSpec[] = [
  { title: 'Step 1 - Blank Canvas', fallbackInstruction: 'Start on a blank screen. Right-click empty canvas and choose Add Person.', focus: { kind: 'none' } },
  { title: 'Step 2 - Add Alex Carter', fallbackInstruction: 'Rename New Person to Alex Carter in Person Properties.', focus: { kind: 'person', personId: 'demo-dad', tab: 'properties' } },
  { title: 'Step 3 - Move Alex', fallbackInstruction: 'Click and drag Alex Carter to the target top-left parent position.', focus: { kind: 'person', personId: 'demo-dad', tab: 'properties' } },
  { title: 'Step 4 - Add Partner', fallbackInstruction: 'Right-click Alex Carter and choose Add Partner (creates partner + PRL). Rename partner to Renee Carter.', focus: { kind: 'partnership', partnershipId: 'demo-prl-parents', tab: 'properties' } },
  { title: 'Step 5 - Set PRL Married', fallbackInstruction: 'Click the parent PRL, then set Relationship Type to married.', focus: { kind: 'partnership', partnershipId: 'demo-prl-parents', tab: 'properties' } },
  { title: 'Step 6 - Add Liam', fallbackInstruction: 'Right-click the parent PRL and Add Child, then edit child name to Liam Carter and position him.', focus: { kind: 'person', personId: 'demo-son', tab: 'properties' } },
  { title: 'Step 7 - Add Emma', fallbackInstruction: 'Add another child from the same parent PRL and rename to Emma Carter.', focus: { kind: 'person', personId: 'demo-daughter', tab: 'properties' } },
  { title: 'Step 8 - Add Noah + PRL', fallbackInstruction: 'Right-click Emma Carter and Add Partner. Rename to Noah Reed and place beside Emma.', focus: { kind: 'partnership', partnershipId: 'demo-prl-emma', tab: 'properties' } },
  { title: 'Step 9 - Configure Emma/Noah PRL', fallbackInstruction: 'Set Emma-Noah PRL fields (type/status/start date) to match the demo.', focus: { kind: 'partnership', partnershipId: 'demo-prl-emma', tab: 'properties' } },
  { title: 'Step 10 - Add Distance EPL', fallbackInstruction: 'Select Alex + Liam and add EPL. Set type distance and style dashed.', focus: { kind: 'emotional', lineId: 'demo-epl-distance', tab: 'properties' } },
  { title: 'Step 11 - Add Conflict EPL', fallbackInstruction: 'Select Renee + Emma and add EPL. Set type conflict and style dotted-saw-tooth.', focus: { kind: 'emotional', lineId: 'demo-epl-conflict', tab: 'properties' } },
  { title: 'Step 12 - Finalize Notes', fallbackInstruction: 'Add numbered notes [1]-[9] on people, PRLs, and EPLs to complete the same demo diagram.', focus: { kind: 'none' } },
];

export const buildBuildDemoStepsFromNotes = (base: DiagramImportData): BuildDemoStep[] => {
  const people = Array.isArray(base.people) ? base.people : [];
  const partnerships = Array.isArray(base.partnerships) ? base.partnerships : [];
  const lines = Array.isArray(base.emotionalLines) ? base.emotionalLines : [];

  const noteById = new Map<string, string>();
  const orderedNotes: string[] = [];
  const collectNote = (id: string, notes?: string) => {
    const normalized = stripLeadingStepNumber(notes);
    if (!normalized) return;
    noteById.set(id, normalized);
    orderedNotes.push(normalized);
  };
  people.forEach((person) => collectNote(person.id, person.notes));
  partnerships.forEach((partnership) => collectNote(partnership.id, partnership.notes));
  lines.forEach((line) => collectNote(line.id, line.notes));

  return BUILD_DEMO_STEP_SPECS.map((spec, index) => {
    let instruction = spec.fallbackInstruction;
    if (spec.focus.kind === 'person') {
      instruction = noteById.get(spec.focus.personId) || instruction;
    } else if (spec.focus.kind === 'partnership') {
      instruction = noteById.get(spec.focus.partnershipId) || instruction;
    } else if (spec.focus.kind === 'emotional') {
      instruction = noteById.get(spec.focus.lineId) || instruction;
    } else if (index === BUILD_DEMO_STEP_SPECS.length - 1 && orderedNotes.length) {
      instruction = `Finalize by confirming demo notes:\n- ${orderedNotes.join('\n- ')}`;
    }
    return { title: spec.title, instruction, focus: spec.focus };
  });
};
