import { describe, expect, it } from 'vitest';
import defaultDiagramDataJson from './defaultDiagramData.json';
import {
  DEFAULT_DIAGRAM_STATE,
  FALLBACK_FILE_NAME,
  buildDefaultDiagramState,
} from './defaultDiagramState';

describe('defaultDiagramState', () => {
  it('hydrates from the bundled Myfamily1 dataset', () => {
    expect(DEFAULT_DIAGRAM_STATE.people).toHaveLength(defaultDiagramDataJson.people.length);
    expect(DEFAULT_DIAGRAM_STATE.partnerships).toHaveLength(
      defaultDiagramDataJson.partnerships.length
    );
    expect(DEFAULT_DIAGRAM_STATE.emotionalLines).toHaveLength(
      defaultDiagramDataJson.emotionalLines.length
    );
  });

  it('falls back to built-in sample data when no dataset exists', () => {
    const state = buildDefaultDiagramState(null);
    expect(state.people.length).toBeGreaterThan(0);
    expect(state.partnerships.length).toBeGreaterThan(0);
    expect(state.fileName).toBe(FALLBACK_FILE_NAME);
  });
});
