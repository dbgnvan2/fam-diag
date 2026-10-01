/**
 * The dirty-check snapshot covers the same content as the saved file
 * (REVIEW-gap-areas-2026-09-30 F-1).
 */
import { describe, it, expect } from 'vitest';
import {
  DIAGRAM_PAYLOAD_KEYS,
  serializeDiagramContent,
  type DiagramContentState,
} from './diagramPayload';

const base: DiagramContentState = {
  people: [],
  partnerships: [],
  emotionalLines: [],
  pageNotes: [],
  triangles: [],
  functionalIndicatorDefinitions: [],
  eventCategories: [],
  relationshipTypes: [],
  relationshipStatuses: [],
  ideasText: '',
  predictionSets: [],
  functionalFactCategories: [],
  nodalCategories: [],
};

describe('serializeDiagramContent', () => {
  it('holds every file key except the file metadata and the autosave preference', () => {
    const keys = Object.keys(JSON.parse(serializeDiagramContent(base))).sort();
    const expected = DIAGRAM_PAYLOAD_KEYS.filter((k) => k !== 'fileMeta' && k !== 'autoSaveMinutes').sort();
    expect(keys).toEqual(expected);
  });

  it.each([
    ['predictionSets', { predictionSets: [{ id: 's', name: 'S', createdDate: '', predictions: [] }] }],
    ['ideasText', { ideasText: 'an idea' }],
    ['functionalFactCategories', { functionalFactCategories: [{ id: 'c', name: 'C', subtypes: [] }] }],
    ['nodalCategories', { nodalCategories: [{ id: 'n', name: 'N', subtypes: [] }] }],
  ])('a change to %s changes the snapshot (regression: not in the dirty check)', (_key, change) => {
    const changed = { ...base, ...change } as DiagramContentState;
    expect(serializeDiagramContent(changed)).not.toBe(serializeDiagramContent(base));
  });
});
