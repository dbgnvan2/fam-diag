import type { EmotionalLine, Partnership, Person, Triangle } from '../types';

export const shouldShowPersonNote = (
  person: Person,
  notesLayerEnabled: boolean,
  hoveredPersonId: string | null
) =>
  Boolean(
    person.notes &&
      (person.notesEnabled === false
        ? false
        : hoveredPersonId === person.id || notesLayerEnabled || person.notesEnabled === true)
  );

export const shouldShowPartnershipNote = (
  partnership: Partnership,
  notesLayerEnabled: boolean
) =>
  Boolean(
    partnership.notes &&
      (partnership.notesEnabled === false
        ? false
        : notesLayerEnabled || partnership.notesEnabled === true)
  );

export const shouldShowEmotionalNote = (
  line: EmotionalLine,
  notesLayerEnabled: boolean
) =>
  Boolean(
    line.notes &&
      (line.notesEnabled === false ? false : notesLayerEnabled || line.notesEnabled === true)
  );

export const shouldShowFamilyNote = (
  partnership: Partnership,
  notesLayerEnabled: boolean
) =>
  Boolean(
    partnership.familyNotes &&
      (partnership.familyNotesEnabled === false
        ? false
        : notesLayerEnabled || partnership.familyNotesEnabled === true)
  );

export const shouldShowTriangleNote = (
  triangle: Triangle,
  notesLayerEnabled: boolean
) =>
  Boolean(
    triangle.notes &&
      (triangle.notesEnabled === false ? false : notesLayerEnabled || triangle.notesEnabled === true)
  );

/**
 * A triangle — its fill and its note — is drawn only while all three of its
 * people are visible under family focus and the timeline. The note used to
 * skip this check and float over the canvas pointing at a hidden person.
 */
export const isTriangleVisible = (
  triangle: { person1_id: string; person2_id: string; person3_id: string },
  personVisibility: Map<string, boolean>
): boolean =>
  !!personVisibility.get(triangle.person1_id) &&
  !!personVisibility.get(triangle.person2_id) &&
  !!personVisibility.get(triangle.person3_id);
