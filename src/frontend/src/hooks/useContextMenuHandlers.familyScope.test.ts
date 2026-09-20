/**
 * Spec: docs/implementation_plan_2026-09-19.md#M3.A.1
 *       docs/implementation_plan_2026-09-19.md#M4.A.2
 *
 * The Timeline can be opened from three places (person right-click, group
 * right-click, family right-click). CLAUDE.md's consistency protocol says all
 * three change together, so this asserts none of them can go back to setting
 * the lane ids directly and bypassing the scope derivation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const contextMenuSource = readFileSync(join(__dirname, './useContextMenuHandlers.ts'), 'utf8');
const diagramEditorSource = readFileSync(
  join(__dirname, '../components/DiagramEditor.tsx'),
  'utf8'
);

/** Every `setTimelineSelectionIds(...)` call that opens the board (not one that clears it). */
const openingCalls = (source: string): string[] =>
  [...source.matchAll(/setTimelineSelectionIds\(([^)]*)\)/g)]
    .map((match) => match[1].trim())
    .filter((arg) => arg !== '[]');

describe('family scope reaches every Timeline entry point', () => {
  it('test_m3a1_person_menu_has_focus_family_submenu', () => {
    expect(contextMenuSource).toContain("label: 'Focus Family'");
    ['2 up / 2 down', '1 up / 1 down', '3 up / 3 down', 'Whole family', 'Clear focus'].forEach(
      (label) => expect(contextMenuSource).toContain(label)
    );
    expect(contextMenuSource).toContain('focusFamilyOnPerson(');
    expect(contextMenuSource).toContain('clearFamilyFocus()');
  });

  it('test_m3a1_focus_family_offers_a_lineal_only_variant', () => {
    expect(contextMenuSource).toContain('includeCollaterals: false');
  });

  it('test_m4a2_all_three_timeline_entry_points_use_scope', () => {
    // Two entry points live in the context-menu hook (person + group).
    const hookCalls = openingCalls(contextMenuSource);
    expect(hookCalls.length).toBeGreaterThanOrEqual(3);
    hookCalls.forEach((arg) => expect(arg).toContain('derived.personIds'));

    // The third lives in DiagramEditor (family right-click).
    const editorCalls = openingCalls(diagramEditorSource).filter(
      (arg) => !arg.startsWith('focus.personIds')
    );
    expect(editorCalls.length).toBeGreaterThanOrEqual(1);
    editorCalls.forEach((arg) => expect(arg).toContain('derived.personIds'));
  });

  it('test_m4a2_family_lane_ids_also_come_from_the_derivation', () => {
    const hookFamilyCalls = [...contextMenuSource.matchAll(/setTimelineFamilySelectionIds\(([^)]*)\)/g)]
      .map((match) => match[1].trim())
      .filter((arg) => arg !== '[]');
    expect(hookFamilyCalls.length).toBeGreaterThanOrEqual(3);
    hookFamilyCalls.forEach((arg) => expect(arg).toContain('derived.familyIds'));
  });

  it('test_m4a2_editor_passes_the_derivation_into_the_context_menu_hook', () => {
    expect(diagramEditorSource).toContain('deriveTimelineIds,');
    expect(diagramEditorSource).toContain('deriveTimelineSelection(');
    expect(diagramEditorSource).toContain('focusFamilyOnPerson: familyScope.focusOnPerson');
    expect(diagramEditorSource).toContain('clearFamilyFocus: familyScope.clearFocus');
  });
});
