import { describe, expect, it } from 'vitest';
import productDefaultDiagramJson from '../../../../PRODUCT_DEFAULT.diagram.json';
import { APPLICATION_SETTINGS } from './applicationSettings';
import {
  DEFAULT_DIAGRAM_STATE,
  FALLBACK_FILE_NAME,
  buildDefaultDiagramState,
} from './defaultDiagramState';

describe('defaultDiagramState', () => {
  it('hydrates from the bundled demo dataset', () => {
    expect(DEFAULT_DIAGRAM_STATE.people).toHaveLength(productDefaultDiagramJson.people.length);
    expect(DEFAULT_DIAGRAM_STATE.partnerships).toHaveLength(
      productDefaultDiagramJson.partnerships.length
    );
    expect(DEFAULT_DIAGRAM_STATE.emotionalLines).toHaveLength(
      productDefaultDiagramJson.emotionalLines.length
    );
    expect(DEFAULT_DIAGRAM_STATE.triangles).toHaveLength(
      Array.isArray((productDefaultDiagramJson as any).triangles)
        ? (productDefaultDiagramJson as any).triangles.length
        : 0
    );
    expect(DEFAULT_DIAGRAM_STATE.eventCategories).toEqual(APPLICATION_SETTINGS.eventCategories);
    expect(DEFAULT_DIAGRAM_STATE.relationshipTypes).toEqual(APPLICATION_SETTINGS.relationshipTypes);
    expect(DEFAULT_DIAGRAM_STATE.relationshipStatuses).toEqual(
      APPLICATION_SETTINGS.relationshipStatuses
    );
  });

  it('falls back to built-in sample data when no dataset exists', () => {
    const state = buildDefaultDiagramState(null);
    expect(state.people.length).toBeGreaterThan(0);
    expect(state.partnerships.length).toBeGreaterThan(0);
    expect(state.fileName).toBe(FALLBACK_FILE_NAME);
  });

  it('initializes functionalFactCategories from application settings', () => {
    expect(DEFAULT_DIAGRAM_STATE.functionalFactCategories).toEqual(
      APPLICATION_SETTINGS.functionalFactCategories
    );
  });

  it('loads functionalFactCategories from diagram file data', () => {
    const ffCats = [{ id: 'ff-test', name: 'Coping' }];
    const state = buildDefaultDiagramState({
      people: [{ id: 'p1', name: 'Test', x: 0, y: 0, gender: 'male', partnerships: [] }],
      partnerships: [],
      emotionalLines: [],
      functionalFactCategories: ffCats,
    });
    expect(state.functionalFactCategories).toEqual(ffCats);
  });

  it('falls back to empty functionalFactCategories when not in file data', () => {
    const state = buildDefaultDiagramState({
      people: [{ id: 'p1', name: 'Test', x: 0, y: 0, gender: 'male', partnerships: [] }],
      partnerships: [],
      emotionalLines: [],
    });
    expect(Array.isArray(state.functionalFactCategories)).toBe(true);
  });
});
