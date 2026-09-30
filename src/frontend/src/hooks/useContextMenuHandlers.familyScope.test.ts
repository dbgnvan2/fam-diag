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

describe('family scope reaches every Timeline entry point', () => {
  // DiagramEditor has no seam for this wiring (the hooks receive these from
  // it), so it is the one place still checked by reading the source.
  it('test_m4a2_editor_passes_the_derivation_into_the_context_menu_hook', () => {
    expect(diagramEditorSource).toContain('deriveTimelineIds,');
    expect(diagramEditorSource).toContain('deriveTimelineSelection(');
    expect(diagramEditorSource).toContain('focusFamilyOnPerson: familyScope.focusOnPerson');
    expect(diagramEditorSource).toContain('clearFamilyFocus: familyScope.clearFocus');
  });
});
