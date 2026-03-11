import { describe, expect, it } from 'vitest';
import demoFamilyDiagramDataJson from './demofamilydiagram.json';
import {
  DEFAULT_DIAGRAM_STATE,
  FALLBACK_FILE_NAME,
  buildDefaultDiagramState,
} from './defaultDiagramState';

describe('defaultDiagramState', () => {
  it('hydrates from the bundled demo dataset', () => {
    expect(DEFAULT_DIAGRAM_STATE.people).toHaveLength(demoFamilyDiagramDataJson.people.length);
    expect(DEFAULT_DIAGRAM_STATE.partnerships).toHaveLength(
      demoFamilyDiagramDataJson.partnerships.length
    );
    expect(DEFAULT_DIAGRAM_STATE.emotionalLines).toHaveLength(
      demoFamilyDiagramDataJson.emotionalLines.length
    );
    expect(DEFAULT_DIAGRAM_STATE.triangles).toHaveLength(
      Array.isArray((demoFamilyDiagramDataJson as any).triangles)
        ? (demoFamilyDiagramDataJson as any).triangles.length
        : 0
    );
  });

  it('falls back to built-in sample data when no dataset exists', () => {
    const state = buildDefaultDiagramState(null);
    expect(state.people.length).toBeGreaterThan(0);
    expect(state.partnerships.length).toBeGreaterThan(0);
    expect(state.fileName).toBe(FALLBACK_FILE_NAME);
  });
});
