/**
 * The canvas hides what family focus / the timeline hide: a triangle, its
 * note and a pattern note go when one of their people is hidden. Nodes are
 * found by something only they carry (the triangle's colour, the note text),
 * never by counting node types (LEARNINGS L8).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type Konva from 'konva';
import DiagramCanvas from './DiagramCanvas';
import type { EmotionalLine, Person, Triangle } from '../types';

const people: Person[] = [
  { id: 'a', name: 'A', x: 100, y: 100, partnerships: [], birthSex: 'male' },
  { id: 'b', name: 'B', x: 300, y: 100, partnerships: [], birthSex: 'female' },
  { id: 'c', name: 'C', x: 200, y: 300, partnerships: [], birthSex: 'female' },
];
const triangle: Triangle = {
  id: 't1',
  person1_id: 'a',
  person2_id: 'b',
  person3_id: 'c',
  color: '#123456',
  notes: 'TRIANGLE NOTE',
  notesEnabled: true,
};
const line: EmotionalLine = {
  id: 'l1',
  person1_id: 'a',
  person2_id: 'c',
  relationshipType: 'conflict',
  lineStyle: 'conflict-solid-wide',
  lineEnding: 'none',
  notes: 'PATTERN NOTE',
  notesEnabled: true,
};

const renderCanvas = (visible: Record<string, boolean>, overrides: Record<string, unknown> = {}) => {
  const stageRef = React.createRef<Konva.Stage>();
  const values = {
    contextMenu: null,
    isDemoFocusedCanvas: false,
    demoBlinkVisible: true,
    fileName: null,
    canvasWidth: 800,
    canvasHeight: 600,
    stageOffset: { x: 0, y: 0 },
    zoom: 1,
    stageRef,
    spacePanActive: false,
    isPanning: false,
    panStartRef: { current: null },
    marqueeSelection: null,
    marqueeDidDragRef: { current: false },
    suppressStageClickRef: { current: false },
    triangles: [triangle],
    people,
    partnerships: [],
    allEmotionalLines: [line],
    personVisibility: new Map(Object.entries(visible)),
    emotionalVisibility: new Map([['l1', true]]),
    partnershipVisibility: new Map(),
    emotionalSiblingMeta: new Map(),
    selectedEmotionalLineId: null,
    selectedChildId: null,
    selectedPartnershipId: null,
    selectedPeopleIds: [],
    selectedFamilyId: null,
    selectedFamilyIds: [],
    dragGroupRef: { current: null },
    functionalIndicatorDefinitions: [],
    selectedGroupBounds: null,
    notesLayerEnabled: true,
    showSiblingConflicts: false,
    hoveredPersonId: null,
    pageNotes: [],
    selectedPageNoteId: null,
    selectedPageNote: null,
    pageNoteDraft: null,
    canvasScrollHintOpen: false,
    panelRef: { current: null },
    panelWidth: 300,
    resizeStateRef: { current: null },
    showMultiPersonPanel: false,
    multiSelectedPeople: [],
    propertiesPanelItem: null,
    propertiesPanel: null,
    ...overrides,
  };
  // Every other prop is a handler. A first, throw-away pass renders the
  // component through a recording Proxy to learn which props it reads (no
  // list of prop names to keep in step with the component, and no reading of
  // its source — gate 2026-09-30b #3). The render the assertions use is then
  // a real <DiagramCanvas /> element with a plain props object, so it goes
  // through React exactly as in the app (gate 2026-09-30c LOW).
  const readKeys = new Set<string>();
  const recorder = new Proxy(values as Record<string, unknown>, {
    get: (target, key) => {
      if (typeof key === 'string') readKeys.add(key);
      return typeof key === 'string' && !(key in target) ? vi.fn() : target[key as string];
    },
  });
  const renderComponent = DiagramCanvas as unknown as (componentProps: object) => React.ReactElement;
  const Discover = () => renderComponent(recorder);
  render(<Discover />).unmount();
  const props: Record<string, unknown> = { ...values };
  readKeys.forEach((key) => {
    if (!(key in props)) props[key] = vi.fn();
  });
  const Canvas = DiagramCanvas as unknown as React.ComponentType<Record<string, unknown>>;
  render(<Canvas {...props} />);
  const stage = stageRef.current!;
  const texts = stage.find('Text').map((node) => (node as Konva.Text).text());
  const hasTriangleFill = stage
    .find('Line')
    .some((node) => String((node as Konva.Line).fill() || '').startsWith('rgba(18, 52, 86'));
  return { texts, hasTriangleFill };
};

describe('DiagramCanvas — hidden people take their triangle, notes and lines with them', () => {
  it('draws the triangle, its note and the pattern note when everyone is visible', () => {
    const { texts, hasTriangleFill } = renderCanvas({ a: true, b: true, c: true });
    expect(hasTriangleFill).toBe(true);
    expect(texts.some((text) => text.includes('TRIANGLE NOTE'))).toBe(true);
    expect(texts.some((text) => text.includes('PATTERN NOTE'))).toBe(true);
  });

  it('hides all three when one of their people is hidden (regression: the triangle note stayed)', () => {
    const { texts, hasTriangleFill } = renderCanvas({ a: true, b: true, c: false });
    expect(hasTriangleFill).toBe(false);
    expect(texts.some((text) => text.includes('TRIANGLE NOTE'))).toBe(false);
    expect(texts.some((text) => text.includes('PATTERN NOTE'))).toBe(false);
  });
});

describe('DiagramCanvas — pan hint', () => {
  it('uses the shared copy and passes a ticked "don\'t show this again" to its close handler', async () => {
    const { fireEvent, screen } = await import('@testing-library/react');
    const { CANVAS_SCROLL_HINT } = await import('../data/helpContent');
    const closeCanvasScrollHint = vi.fn();
    renderCanvas({ a: true, b: true, c: true }, { canvasScrollHintOpen: true, closeCanvasScrollHint });
    expect(screen.getByText(CANVAS_SCROLL_HINT.text)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(CANVAS_SCROLL_HINT.dontShowAgainLabel));
    fireEvent.click(screen.getByLabelText('Close canvas scroll hint'));
    expect(closeCanvasScrollHint).toHaveBeenCalledWith(true);
  });
});
