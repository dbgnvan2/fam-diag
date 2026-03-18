import type { Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import type { Person, FunctionalIndicatorDefinition, SymptomGroup } from '../types';
import {
  sanitizePeopleIndicators,
  sanitizeSinglePersonIndicators,
} from '../utils/dataNormalization';

interface IndicatorHandlerDeps {
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  indicatorDraftLabel: string;
  defaultSymptomColorByGroup: Record<SymptomGroup, string>;
  setFunctionalIndicatorDefinitions: Dispatch<SetStateAction<FunctionalIndicatorDefinition[]>>;
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | import('../types').Partnership | import('../types').EmotionalLine | null>>;
  setIndicatorDraftLabel: Dispatch<SetStateAction<string>>;
}

export function useIndicatorHandlers({
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

  const removeFunctionalIndicatorDefinition = (id: string) => {
    updateIndicatorDefinitions((prev) => prev.filter((definition) => definition.id !== id));
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
    const existingByGroup = functionalIndicatorDefinitions.find((definition) => definition.group === group);
    if (!trimmed) {
      return existingByGroup?.id || null;
    }
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
