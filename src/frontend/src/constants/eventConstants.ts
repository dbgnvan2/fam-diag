/**
 * Shared constants for event-related components (EventModal, EventsSection, PropertiesPanel).
 */
import type { EventClass, EventContinuationState, SymptomGroup } from '../types';

export const EVENT_CLASS_LABELS: Record<EventClass, string> = {
  individual: 'Individual',
  relationship: 'Relationship',
  'emotional-pattern': 'Emotional Pattern',
};

export const EMOTIONAL_AUTONOMY_INTENSITY_HELP = [
  'Low – Members exhibit virtually no ability to think for themselves when making decisions and lack principles they have defined for self; no ability to make choices and almost always succumb to pressures from the relationship system.',
  'Low-Moderate – Members exhibit some ability to think for themselves and some awareness of choice if anxiety is low; they often succumb to pressures from the relationship system.',
  'Moderate – Members exhibit a better ability to think for themselves and make choices if under no more than a low-moderate amount of stress; some ability to retain self under pressures from the relationship system.',
  'Moderate-High – Members exhibit more solid ability to think for self if stress is moderate; choices are less frequently molded by the group.',
  'High – Members exhibit unusual ability to think for self and make choices informed by principle, even under moderately high levels of stress; consistent ability to clearly define self under group pressure.',
];

export const EMOTIONAL_AUTONOMY_INTENSITY_LABELS = [
  'Low',
  'Low-Moderate',
  'Moderate',
  'Moderate-High',
  'High',
];

export const FOO_INTENSITY_LABELS = ['Low', 'Low-Moderate', 'Moderate', 'Moderate-High', 'High'];

export const FOO_TRIANGLE_CATEGORY_OPTIONS = [
  {
    value: 'triangle-functioning-flexibility',
    label: 'Degree of Flexibility in the Functioning of Triangles',
    levelLabels: FOO_INTENSITY_LABELS,
    helpLines: [
      'Low – Individual members or relationships in the family chronically absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension always returns to the same individuals or relationships.',
      'Low-moderate – Individual members or relationships in the family usually absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension regularly returns to the same individuals or relationships.',
      'Moderate – Individual members or relationships in the family sometimes absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension sometimes returns to the same individual or relationship.',
      'Moderate-high – No individual members or relationships in the family typically absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension may shift to different individuals or relationships.',
      'High – The family has unusual ability to manage tension without affecting any one member or one relationship in the triangles disproportionately.',
    ],
  },
  {
    value: 'triangle-stress-response-flexibility',
    label: 'Degree of Flexibility of Triangles in Response to Stress',
    levelLabels: FOO_INTENSITY_LABELS,
    helpLines: [
      'Low – Family members almost never shift their functioning positions to respond to the nature of the demands placed on the system.',
      'Low-moderate – Family members are rarely able to shift their functioning positions to respond to the nature of the demands placed on the system.',
      'Moderate – Family members are sometimes able to shift their functioning positions to respond to the nature of the demands placed on the system.',
      'Moderate-high – Family members are usually able to shift their functioning positions to respond to the nature of the demands placed on the system.',
      'High – Family members shift their functioning positions easily in relation to the nature of the demands placed on the system.',
    ],
  },
] as const;

const FAMILY_STABILITY_LABELS = ['Excellent', 'Good', 'Average', 'Semi-stable', 'Unstable'];
const FAMILY_STABILITY_HELP = [
  'Excellent – very high percentage (90%) of members represent good functioning across their lifetimes.',
  'Good – high percentage of family members (75-80%) represent good functioning across their lifetimes, few problems and existing problems are well managed.',
  'Average – majority of family members display stable adequate functioning across their lifetimes, some problems in family functioning but generally problems are either episodic or do not represent serious drops in overall family functioning.',
  'Semi-stable – majority of family members stable over their lifetimes but prolonged periods of drops in overall family functioning, perhaps including the present time.',
  'Unstable – majority of members have serious symptoms and major impairment of life functioning.',
];
const FAMILY_INTACTNESS_LABELS = ['Excellent', 'Good', 'Average', 'Semi-fragmented', 'Fragmented'];
const FAMILY_INTACTNESS_HELP = [
  'Excellent – very high percentage (90%) of family members across three generations are alive and available for contact.',
  'Good – a high percentage (75-80%) of family members across three generations are alive and available for contact.',
  'Average – a majority of family members across three generations are alive and available for contact.',
  'Semi-fragmented – relatively few members of the family across three generations are alive and available for contact.',
  'Fragmented – basic family unit is dissolved and whereabouts of living family members is unknown.',
];

export const FOO_EXTENDED_CATEGORY_OPTIONS = [
  {
    value: 'family-stability',
    label: 'Family Stability Scale',
    levelLabels: FAMILY_STABILITY_LABELS,
    helpLines: FAMILY_STABILITY_HELP,
  },
  {
    value: 'family-intactness',
    label: 'Family Intactness Scale',
    levelLabels: FAMILY_INTACTNESS_LABELS,
    helpLines: FAMILY_INTACTNESS_HELP,
  },
] as const;

export const SYMPTOM_INTENSITY_HELP = [
  'None – symptom absent or not currently present.',
  'Minimal – symptom is associated with some distress which is easily managed, with no limitation in functioning.',
  'Mild – more frequent, mild symptom that causes distress and occasionally interferes with functioning.',
  'Moderate – frequent or moderate symptom that reduces the ability to function but can be managed by the person relatively well without life disruption.',
  'Major – serious or chronic symptom that requires substantial alteration in the life of the person and/or the family.',
  'Severe – very serious symptom that essentially dictates all of life\u2019s choices and direction.',
];

export const SYMPTOM_INTENSITY_LABELS = ['None', 'Minimal', 'Mild', 'Moderate', 'Major', 'Severe'];

export const NODAL_SUBTYPE_OPTIONS = [
  'Birth',
  'Death',
  'Marriage',
  'Separation',
  'Divorce',
  'Move',
  'Job Change',
  'School Change',
  'Illness',
];

export const SYMPTOM_GROUP_OPTIONS: SymptomGroup[] = ['physical', 'emotional', 'social'];

export const isSymptomCategory = (value?: string): value is SymptomGroup =>
  value === 'physical' || value === 'emotional' || value === 'social';

export const normalizeSymptomCategory = (value?: string): SymptomGroup =>
  isSymptomCategory(value?.toLowerCase()) ? (value!.toLowerCase() as SymptomGroup) : 'physical';

export const clampSymptomType = (value?: string) => (value || '').trim().slice(0, 30);

export const isEmotionalAutonomyProcess = (value?: string) => value === 'emotional-autonomy';
export const isFooProcess = (value?: string) => value === 'foo';
export const isFooTriangleProcess = (value?: string) => value === 'foo-triangle';
export const TRIANGLE_PROPERTY_PROCESS_TYPES = ['triangle-functioning', 'triangle-flexibility', 'triangle-stress-response'] as const;
export type TrianglePropertyProcessType = typeof TRIANGLE_PROPERTY_PROCESS_TYPES[number];
export const isTrianglePropertyProcess = (value?: string): boolean => TRIANGLE_PROPERTY_PROCESS_TYPES.includes(value as TrianglePropertyProcessType);

export const getContinuationState = (event: { continuesFromPrevious?: boolean; continuesToNext?: boolean }): EventContinuationState => {
  const from = !!event.continuesFromPrevious;
  const to = !!event.continuesToNext;
  if (from && to) return 'middle';
  if (!from && to) return 'start';
  if (from && !to) return 'end';
  return 'discrete';
};

export const continuationToFlags = (
  state: EventContinuationState
): { continuesFromPrevious: boolean; continuesToNext: boolean } => {
  if (state === 'start') return { continuesFromPrevious: false, continuesToNext: true };
  if (state === 'middle') return { continuesFromPrevious: true, continuesToNext: true };
  if (state === 'end') return { continuesFromPrevious: true, continuesToNext: false };
  return { continuesFromPrevious: false, continuesToNext: false };
};
