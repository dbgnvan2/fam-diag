/**
 * Spec: docs/implementation_plan_2026-09-19.md#M5
 *
 * The family scope is view state. The worst failure this feature can have is
 * silently writing it into the user's diagram file, so these guards are
 * written before any UI exists (P10).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildDiagramPayload, DIAGRAM_PAYLOAD_KEYS } from './diagramPayload';
import {
  computeFamilyScope,
  computeScopeExclusions,
  deriveTimelineSelection,
} from './familyScope';
import type { Partnership, Person } from '../types';

const diagramEditorSource = readFileSync(
  join(__dirname, '../components/DiagramEditor.tsx'),
  'utf8'
);

const people: Person[] = [
  { id: 'root', name: 'Root', x: 0, y: 0, partnerships: ['pr1'], birthDate: '1970-01-01' },
  { id: 'spouse', name: 'Spouse', x: 0, y: 0, partnerships: ['pr1'] },
  { id: 'kid', name: 'Kid', x: 0, y: 0, partnerships: [], parentPartnership: 'pr1' },
  { id: 'stranger', name: 'Stranger', x: 0, y: 0, partnerships: [] },
];
const partnerships: Partnership[] = [
  {
    id: 'pr1',
    partner1_id: 'root',
    partner2_id: 'spouse',
    horizontalConnectorY: 0,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children: ['kid'],
    marriedStartDate: '1992-06-01',
  },
];

describe('family scope never reaches persisted state', () => {
  it('test_m5a1_focus_absent_from_saved_json', () => {
    // Asserted against the real payload object, not against source text: a
    // nested key such as `familyScopeFocus: { ... }` escapes a line-based
    // regex, so the guard could not catch the regression it exists for.
    const payload = buildDiagramPayload(
      {
        people,
        partnerships,
        emotionalLines: [],
        pageNotes: [],
        triangles: [],
        functionalIndicatorDefinitions: [],
        eventCategories: [],
        relationshipTypes: [],
        relationshipStatuses: [],
        autoSaveMinutes: 5,
        ideasText: '',
        predictionSets: [],
        functionalFactCategories: [],
        nodalCategories: [],
      },
      'test.diagram.json',
      '2026-09-19T00:00:00.000Z'
    );

    expect(Object.keys(payload).sort()).toEqual([...DIAGRAM_PAYLOAD_KEYS].sort());
    // Nothing anywhere in the serialized file mentions the view state.
    const serialized = JSON.stringify(payload);
    expect(serialized.toLowerCase()).not.toContain('familyscope');
    expect(serialized.toLowerCase()).not.toContain('"focus"');
    expect(serialized.toLowerCase()).not.toContain('scoperoot');
  });

  it('test_m5a1_editor_saves_through_the_shared_payload_builder', () => {
    // If DiagramEditor ever builds its own object literal again, the guard
    // above stops describing what is written.
    expect(diagramEditorSource).toContain('buildDiagramPayloadPure(');
    expect(diagramEditorSource).not.toMatch(/const buildDiagramPayload = \(targetFileName = fileName\) => \(\{/);
  });

  it('test_m5a1_a_focus_key_added_to_the_payload_type_would_fail_the_guard', () => {
    // Adversarial (P7): the guard must reject a payload that carries the
    // focus, including nested — the shape a source-line regex missed.
    const contaminated = {
      ...buildDiagramPayload(
        {
          people,
          partnerships,
          emotionalLines: [],
          pageNotes: [],
          triangles: [],
          functionalIndicatorDefinitions: [],
          eventCategories: [],
          relationshipTypes: [],
          relationshipStatuses: [],
          autoSaveMinutes: 5,
          ideasText: '',
          predictionSets: [],
          functionalFactCategories: [],
          nodalCategories: [],
        },
        'test.diagram.json',
        '2026-09-19T00:00:00.000Z'
      ),
      familyScopeFocus: { rootId: 'root', up: 2, down: 2 },
    };
    expect(Object.keys(contaminated).sort()).not.toEqual([...DIAGRAM_PAYLOAD_KEYS].sort());
    expect(JSON.stringify(contaminated).toLowerCase()).toContain('familyscope');
  });

  it('test_m5a2_autosave_payload_unchanged_under_focus', () => {
    // Autosave persists the raw state arrays (DiagramEditor useAutosave calls),
    // so the guarantee that matters is that scoping never mutates them.
    const peopleBefore = structuredClone(people);
    const partnershipsBefore = structuredClone(partnerships);

    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    computeScopeExclusions(scope, people, partnerships, [], []);
    deriveTimelineSelection(scope, [], people, partnerships);

    expect(people).toEqual(peopleBefore);
    expect(partnerships).toEqual(partnershipsBefore);
  });

  it('test_m5a2_scope_returns_ids_not_entity_references', () => {
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    scope.personIds.forEach((id) => expect(typeof id).toBe('string'));
    scope.partnershipIds.forEach((id) => expect(typeof id).toBe('string'));
  });

  it('test_m2a7_focus_never_moves_a_person', () => {
    const coordsBefore = people.map((person) => `${person.id}:${person.x},${person.y}`);
    computeFamilyScope(people, partnerships, 'kid', { up: 1, down: 0 });
    computeFamilyScope(people, partnerships, 'root', { up: 0, down: 2 });
    const coordsAfter = people.map((person) => `${person.id}:${person.x},${person.y}`);
    expect(coordsAfter).toEqual(coordsBefore);
  });
});
