import type { Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import type { Person, FunctionalIndicatorDefinition, SymptomGroup } from '../types';
import {
  sanitizePeopleIndicators,
  sanitizeSinglePersonIndicators,
} from '../utils/dataNormalization';

/**
 * Who still records a symptom type: an indicator entry, or a symptom event
 * linked to it.
 */
export const indicatorDefinitionUsage = (
  people: Person[],
  definitionId: string
): { peopleNames: string[]; entryCount: number } => {
  const peopleNames: string[] = [];
  let entryCount = 0;
  people.forEach((person) => {
    const entries =
      (person.functionalIndicators || []).filter((entry) => entry.definitionId === definitionId).length +
      (person.events || []).filter((event) => event.sourceIndicatorId === definitionId).length;
    if (entries > 0) {
      peopleNames.push(person.name || 'Unnamed');
      entryCount += entries;
    }
  });
  return { peopleNames, entryCount };
};

interface IndicatorHandlerDeps {
  people: Person[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  indicatorDraftLabel: string;
  defaultSymptomColorByGroup: Record<SymptomGroup, string>;
  setFunctionalIndicatorDefinitions: Dispatch<SetStateAction<FunctionalIndicatorDefinition[]>>;
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | import('../types').Partnership | import('../types').EmotionalLine | null>>;
  setIndicatorDraftLabel: Dispatch<SetStateAction<string>>;
}

export function useIndicatorHandlers({
  people,
  functionalIndicatorDefinitions,
  indicatorDraftLabel,
  defaultSymptomColorByGroup,
  setFunctionalIndicatorDefinitions,
  setPeople,
  setPropertiesPanelItem,
  setIndicatorDraftLabel,
}: IndicatorHandlerDeps) {
  const syncPropertiesPanelIndicators = (defs: FunctionalIndicatorDefinition[]) => {
    setPropertiesPanelItem((prev) => {
      if (prev && 'name' in prev) {
        return sanitizeSinglePersonIndicators(prev as Person, defs);
      }
      return prev;
    });
  };

  const applyIndicatorDefinitionArray = (nextDefs: FunctionalIndicatorDefinition[]) => {
    setFunctionalIndicatorDefinitions(nextDefs);
    setPeople((prev) => sanitizePeopleIndicators(prev, nextDefs));
    syncPropertiesPanelIndicators(nextDefs);
  };

  const updateIndicatorDefinitions = (
    updater: (prev: FunctionalIndicatorDefinition[]) => FunctionalIndicatorDefinition[]
  ) => {
    setFunctionalIndicatorDefinitions((prev) => {
      const next = updater(prev);
      setPeople((peoplePrev) => sanitizePeopleIndicators(peoplePrev, next));
      syncPropertiesPanelIndicators(next);
      return next;
    });
  };

  const resetIndicatorDraft = () => {
    setIndicatorDraftLabel('');
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const addFunctionalIndicatorDefinition = () => {
    const trimmed = indicatorDraftLabel.trim();
    if (!trimmed) return;
    updateIndicatorDefinitions((prev) => [
      ...prev,
      {
        id: nanoid(),
        label: trimmed,
        group: 'physical',
        useLetter: true,
        color: '#1f77b4',
      },
    ]);
    resetIndicatorDraft();
  };

  const addFunctionalIndicatorDefinitionForGroup = (group: SymptomGroup) => {
    updateIndicatorDefinitions((prev) => [
      ...prev,
      {
        id: nanoid(),
        label: 'New Symptom Type',
        group,
        useLetter: true,
        color: defaultSymptomColorByGroup[group],
      },
    ]);
  };

  const updateFunctionalIndicatorLabel = (id: string, label: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, label } : definition))
    );
  };

  const updateFunctionalIndicatorGroup = (
    id: string,
    group: 'physical' | 'emotional' | 'social'
  ) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, group } : definition))
    );
  };

  const updateFunctionalIndicatorUseLetter = (id: string, useLetter: boolean) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, useLetter } : definition))
    );
  };

  const updateFunctionalIndicatorColor = (id: string, color: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, color } : definition))
    );
  };

  const updateFunctionalIndicatorIcon = async (id: string, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      updateIndicatorDefinitions((prev) =>
        prev.map((definition) =>
          definition.id === id ? { ...definition, iconDataUrl: dataUrl, useLetter: false } : definition
        )
      );
    } catch (error) {
      console.error('Failed to read icon file', error);
    }
  };

  const clearFunctionalIndicatorIcon = (id: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) =>
        definition.id === id ? { ...definition, iconDataUrl: undefined, useLetter: true } : definition
      )
    );
  };

  /**
   * Removing a symptom type is refused while anyone still has it recorded —
   * removing it used to delete those entries from every person in the
   * diagram, with no warning. The user deletes each entry, or renames the
   * symptom on each person (which moves it to another type), first.
   * Returns true when the definition was removed.
   */
  const removeFunctionalIndicatorDefinition = (
    id: string,
    alertFn: (message: string) => void = (message) => window.alert(message)
  ): boolean => {
    const usage = indicatorDefinitionUsage(people, id);
    if (usage.entryCount > 0) {
      const label = functionalIndicatorDefinitions.find((definition) => definition.id === id)?.label || 'This symptom type';
      alertFn(
        `"${label}" is still recorded for ${usage.peopleNames.length} ${
          usage.peopleNames.length === 1 ? 'person' : 'people'
        } (${usage.entryCount} ${usage.entryCount === 1 ? 'entry' : 'entries'}): ${usage.peopleNames.join(', ')}.\n\n` +
          'Delete those entries, or change them to another symptom type on each person, before removing it.'
      );
      return false;
    }
    updateIndicatorDefinitions((prev) => prev.filter((definition) => definition.id !== id));
    return true;
  };

  const ensureSymptomDefinition = (label: string, group: SymptomGroup): string | null => {
    const trimmed = label.trim();
    const existingByLabel = trimmed
      ? functionalIndicatorDefinitions.find(
          (definition) => definition.label.trim().toLowerCase() === trimmed.toLowerCase()
        )
      : null;
    if (existingByLabel) {
      if (!existingByLabel.group || existingByLabel.group !== group) {
        updateIndicatorDefinitions((prev) =>
          prev.map((definition) =>
            definition.id === existingByLabel.id
              ? { ...definition, group: definition.group || group }
              : definition
          )
        );
      }
      return existingByLabel.id;
    }
    // A symptom with no name is not linked to any definition. Falling back
    // to the group's first definition linked it to an unrelated symptom and
    // overwrote that symptom's scores.
    if (!trimmed) return null;
    const created: FunctionalIndicatorDefinition = {
      id: nanoid(),
      label: trimmed,
      group,
      color: defaultSymptomColorByGroup[group],
      useLetter: true,
    };
    updateIndicatorDefinitions((prev) => [...prev, created]);
    return created.id;
  };

  return {
    applyIndicatorDefinitionArray,
    updateIndicatorDefinitions,
    addFunctionalIndicatorDefinition,
    addFunctionalIndicatorDefinitionForGroup,
    updateFunctionalIndicatorLabel,
    updateFunctionalIndicatorGroup,
    updateFunctionalIndicatorUseLetter,
    updateFunctionalIndicatorColor,
    updateFunctionalIndicatorIcon,
    clearFunctionalIndicatorIcon,
    removeFunctionalIndicatorDefinition,
    ensureSymptomDefinition,
  };
}
