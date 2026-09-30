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
  it('test_m4a2_family_right_click_timeline_uses_scope', () => {
    // The person and group entry points are behaviour-tested in
    // useContextMenuHandlers.test.ts; the family right-click lives in
    // DiagramEditor, which has no hook seam, so its call is checked here.
    const editorCalls = openingCalls(diagramEditorSource).filter(
      (arg) => !arg.startsWith('focus.personIds')
    );
    expect(editorCalls.length).toBeGreaterThanOrEqual(1);
    editorCalls.forEach((arg) => expect(arg).toContain('derived.personIds'));
  });

  it('test_m4a2_editor_passes_the_derivation_into_the_context_menu_hook', () => {
    expect(diagramEditorSource).toContain('deriveTimelineIds,');
    expect(diagramEditorSource).toContain('deriveTimelineSelection(');
    expect(diagramEditorSource).toContain('focusFamilyOnPerson: familyScope.focusOnPerson');
    expect(diagramEditorSource).toContain('clearFamilyFocus: familyScope.clearFocus');
  });
});
