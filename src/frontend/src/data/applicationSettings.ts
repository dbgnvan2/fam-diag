import type { FunctionalIndicatorDefinition, SIRCategoryDefinition } from '../types';
import applicationSettingsJson from './applicationSettings.json';
import productDefaultDiagramJson from '../../../../PRODUCT_DEFAULT.diagram.json';

export type ApplicationSettings = {
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  sirCategories: SIRCategoryDefinition[];
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
    'engaged',
    'common-law',
    'living-together',
    'dating',
    'affair',
    'friendship',
  ],
  relationshipStatuses: ['married', 'separated', 'divorce', 'widowed', 'start', 'ended', 'ongoing'],
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
  sirCategories: [
    {
      id: 'sir-resource',
      name: 'Resource to Other',
      levels: [
        'Reactive, Unhelpful',
        'Little Help, Reactive',
        'Medium Reactivity, Some Help',
        'Some Reactivity, Helpful',
        'Neutral, Helpful',
      ],
    },
    {
      id: 'sir-reactivity',
      name: 'Managing Reactivity',
      levels: [
        'Fully Reactive, Escalated',
        'Mostly Reactive',
        'Mixed, Some Self-Regulation',
        'Mostly Regulated',
        'Calm, Self-Regulated',
      ],
    },
    {
      id: 'sir-defining-self',
      name: 'Defining Self',
      levels: [
        "Lost in Other's Position",
        'Mostly Accommodating',
        'Partially Defined',
        'Mostly Clear Position',
        'Clear, Non-Reactive Self-Definition',
      ],
    },
    {
      id: 'sir-detriangulating',
      name: 'Detriangulating',
      levels: [
        'Fully Triangulated',
        'Mostly Pulled In',
        'Aware but Struggling',
        'Mostly Staying Out',
        'Clean, Direct Relating',
      ],
    },
    {
      id: 'sir-emotional-contact',
      name: 'Emotional Contact',
      levels: [
        'Cutoff, Avoidant',
        'Minimal Contact',
        'Surface Contact',
        'Meaningful Contact',
        'Deep, Non-Anxious Presence',
      ],
    },
    {
      id: 'sir-systems',
      name: 'Systems Perspective',
      levels: [
        'Blame / Cause Thinking',
        'Mostly Linear',
        'Some Systems Awareness',
        'Mostly Systems View',
        'Full Process / Systems Lens',
      ],
    },
  ],
  autoSaveMinutes: 1,
};

const sanitizeSIRCategories = (
  value: unknown,
  fallback: SIRCategoryDefinition[]
): SIRCategoryDefinition[] => {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value as SIRCategoryDefinition[];
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
    sirCategories: sanitizeSIRCategories(
      typed?.sirCategories,
      FALLBACK_SETTINGS.sirCategories
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
    sirCategories: typed.sirCategories,
    autoSaveMinutes: typed.autoSaveMinutes,
  };
})();

export const APPLICATION_SETTINGS = normalizeApplicationSettings({
  ...applicationSettingsJson,
  ...productDefaultSettingsSource,
});
