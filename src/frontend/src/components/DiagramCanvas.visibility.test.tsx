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
import { readFileSync } from 'fs';
import { join } from 'path';
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

const renderCanvas = (visible: Record<string, boolean>) => {
  const stageRef = React.createRef<Konva.Stage>();
  const values: Record<string, unknown> = {
    contextMenu: null,
    personSectionPopup: null,
    personSectionPopupPerson: null,
    partnershipSectionPopup: null,
    partnershipSectionPopupPartnership: null,
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
    familyScope: null,
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
    sirCategories: [],
    functionalFactCategories: [],
    nodalCategories: [],
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
    eventCategories: [],
    relationshipTypes: [],
    relationshipStatuses: [],
    panelTriangleContext: null,
    propertiesPanelIntent: null,
  };
  // Every other prop is a handler; a spy is enough for a render. The prop
  // names are read from the component's own interface so a new prop cannot
  // silently go missing here.
  const source = readFileSync(join(__dirname, 'DiagramCanvas.tsx'), 'utf8');
  const block = source.slice(source.indexOf('interface DiagramCanvasProps'), source.indexOf('\n}\n', source.indexOf('interface DiagramCanvasProps')));
  const props: Record<string, unknown> = { ...values };
  [...block.matchAll(/^ {2}(\w+)\??:/gm)].forEach(([, key]) => {
    if (!(key in props)) props[key] = vi.fn();
  });
  render(<DiagramCanvas {...(props as unknown as React.ComponentProps<typeof DiagramCanvas>)} />);
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
