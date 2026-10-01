import { describe, expect, it } from 'vitest';
import { explicitList, explicitStringList, normalizeApplicationSettings } from './applicationSettings';

describe('settings-09 — application settings keep an explicit empty list', () => {
  it('an empty SIR / relationship type / status list is kept, not replaced by the defaults', () => {
    const settings = normalizeApplicationSettings({ sirCategories: [], relationshipTypes: [], relationshipStatuses: [] });
    expect(settings.sirCategories).toEqual([]);
    expect(settings.relationshipTypes).toEqual([]);
    expect(settings.relationshipStatuses).toEqual([]);
  });

  it('an absent key falls back to the defaults', () => {
    const settings = normalizeApplicationSettings({});
    expect(settings.sirCategories.length).toBeGreaterThan(0);
    expect(settings.relationshipTypes.length).toBeGreaterThan(0);
    expect(settings.relationshipStatuses.length).toBeGreaterThan(0);
  });

  it('explicitList / explicitStringList: array (even empty) or null', () => {
    expect(explicitList([])).toEqual([]);
    expect(explicitList(undefined)).toBeNull();
    expect(explicitStringList([' a ', '', 3])).toEqual(['a']);
    expect(explicitStringList('x')).toBeNull();
  });
});
