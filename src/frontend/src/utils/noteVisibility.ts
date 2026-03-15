import type { EmotionalLine, Partnership, Person } from '../types';

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
