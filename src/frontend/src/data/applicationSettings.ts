import type { FunctionalIndicatorDefinition } from '../types';
import applicationSettingsJson from './applicationSettings.json';
import productDefaultDiagramJson from '../../../../PRODUCT_DEFAULT.diagram.json';

export type ApplicationSettings = {
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  autoSaveMinutes: number;
};

const sanitizeStringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length);
  return next.length ? next : fallback;
};

const sanitizeFunctionalIndicators = (
  value: unknown,
  fallback: FunctionalIndicatorDefinition[]
) => {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value as FunctionalIndicatorDefinition[];
};

const toPositiveNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const FALLBACK_SETTINGS: ApplicationSettings = {
  eventCategories: [
    'Relationship',
    'Health',
    'Career',
    'Education',
    'Location',
    'Legal',
    'Finance',
    'Faith',
    'Achievement',
    'Social',
  ],
  relationshipTypes: [
    'married',
    'common-law',
    'living-together',
    'dating',
    'affair',
    'friendship',
  ],
  relationshipStatuses: ['married', 'separated', 'divorced', 'started', 'ended', 'ongoing'],
  functionalIndicatorDefinitions: [
    {
      id: 'symptom-physical-default',
      label: 'Physical Symptom',
      group: 'physical',
      color: '#1f77b4',
      useLetter: true,
    },
    {
      id: 'symptom-emotional-default',
      label: 'Emotional Symptom',
      group: 'emotional',
      color: '#d81b60',
      useLetter: true,
    },
    {
      id: 'symptom-social-default',
      label: 'Social Symptom',
      group: 'social',
      color: '#2e7d32',
      useLetter: true,
    },
  ],
  autoSaveMinutes: 1,
};

export const normalizeApplicationSettings = (value: unknown): ApplicationSettings => {
  const typed = value as Partial<ApplicationSettings> | undefined;
  return {
    eventCategories: sanitizeStringArray(typed?.eventCategories, FALLBACK_SETTINGS.eventCategories),
    relationshipTypes: sanitizeStringArray(
      typed?.relationshipTypes,
      FALLBACK_SETTINGS.relationshipTypes
    ),
    relationshipStatuses: sanitizeStringArray(
      typed?.relationshipStatuses,
      FALLBACK_SETTINGS.relationshipStatuses
    ),
    functionalIndicatorDefinitions: sanitizeFunctionalIndicators(
      typed?.functionalIndicatorDefinitions,
      FALLBACK_SETTINGS.functionalIndicatorDefinitions
    ),
    autoSaveMinutes: toPositiveNumber(
      typed?.autoSaveMinutes,
      FALLBACK_SETTINGS.autoSaveMinutes
    ),
  };
};

const productDefaultSettingsSource = (() => {
  const typed = productDefaultDiagramJson as Partial<ApplicationSettings> | undefined;
  if (!typed || typeof typed !== 'object') return {};
  return {
    eventCategories: typed.eventCategories,
    relationshipTypes: typed.relationshipTypes,
    relationshipStatuses: typed.relationshipStatuses,
    functionalIndicatorDefinitions: typed.functionalIndicatorDefinitions,
    autoSaveMinutes: typed.autoSaveMinutes,
  };
})();

export const APPLICATION_SETTINGS = normalizeApplicationSettings({
  ...applicationSettingsJson,
  ...productDefaultSettingsSource,
});
