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
export const TRIANGLE_PROPERTY_TYPE_LABELS: Record<string, string> = {
  'triangle-functioning': 'Triangle Functioning',
  'triangle-flexibility': 'Triangle Flexibility',
  'triangle-stress-response': 'Triangle Stress Response',
};

export const isTriangleFunctioningProcess = (value?: string) => value === 'triangle-functioning';
export const isTriangleFlexibilityProcess = (value?: string) => value === 'triangle-flexibility';
export const isTriangleStressResponseProcess = (value?: string) => value === 'triangle-stress-response';
export const TRIANGLE_PROPERTY_PROCESS_TYPES = ['triangle-functioning', 'triangle-flexibility', 'triangle-stress-response'] as const;

export const TRIANGLE_FUNCTIONING_INTENSITY_LABELS = [
  '0-10',
  '10-20',
  '20-30',
  '30-40',
  '40-50',
  '50-60',
  '60-70',
  '70-80',
];

export const TRIANGLE_FUNCTIONING_INTENSITY_HELP = [
  'Triangles at this level are fixed and always return to the same position. Members are so cut off and isolated, genuine person-to-person communication is virtually non-existent; the effort to obtain a modicum of comfort determines behavior.',
  'Triangles at this level have a bit more flexibility so long as the amount of stress on the system is very low; small increases in tension lock triangles in the usual pattern; members have very little ability to tolerate discomfort and quickly resort to typical triangling moves in an effort to decrease discomfort.',
  'An intense process of triangling is much in evidence whenever the system is subjected to more than low levels of stress; person-to-person relationships are fleeting but can occur when tension is low.',
  'Triangles at this level retain flexibility as long as stressful events remain at below moderate levels; at higher levels of stress a more intense process of triangling takes over and erases the ability to communicate person-to-person.',
  'Members at this level are better able to override the dictates of triangles so long as the stress placed on the system does not go much above moderate levels; people are better able to evaluate the reality of threats and take appropriate action; they are also better able to utilize people outside an intense triangle to gain perspective on the process.',
  'Triangles at this level are more able to function without impairing anyone in the system so long as the stress placed on the system does not become moderately high; triangular emotional process is still in evidence but at lower levels of tension it can be a more playful process in which humorous exchange helps to defuse the tension that is present.',
  'Families at this level are able to maintain reasonably flexible triangles even under relatively high levels of stress; well-developed principles enable family members to maintain respectful boundaries under most circumstances.',
  'Person-to-person relationships are the rule rather than the exception at this level of functioning; third parties are used to gain perspective but members take the responsibility for working out their own problems and problems with other members of the family without blaming self or other. Triangles are unusually flexible in these families even under high levels of stress.',
];
export const TRIANGLE_FLEXIBILITY_INTENSITY_LABELS = [
  'Low',
  'Low-Moderate',
  'Moderate',
  'Moderate-High',
  'High',
];

export const TRIANGLE_FLEXIBILITY_INTENSITY_HELP = [
  'Low – Individual members or relationships in the family chronically absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension always returns to the same individuals or relationships.',
  'Low-Moderate – Individual members or relationships in the family usually absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension regularly returns to the same individuals or relationships.',
  'Moderate – Individual members or relationships in the family sometimes absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension sometimes returns to the same individual or relationship.',
  'Moderate-High – No individual members or relationships in the family typically absorbs a disproportionate amount of tension; when short term shifts in the triangles settle down, tension may shift to different individuals or relationships.',
  'High – Family has unusual ability to manage tension without affecting any one member or any one relationship in the triangles disproportionately.',
];

export const TRIANGLE_STRESS_RESPONSE_INTENSITY_LABELS = [
  'Low',
  'Low-Moderate',
  'Moderate',
  'Moderate-High',
  'High',
];

export const TRIANGLE_STRESS_RESPONSE_INTENSITY_HELP = [
  'Low – Family members almost never shift their functioning positions to respond to the nature of the demands placed on the system.',
  'Low-Moderate – Family members are rarely able to shift their functioning positions to respond to the nature of the demands placed on the system.',
  'Moderate – Family members are sometimes able to shift their functioning positions to respond to the nature of the demands placed on the system.',
  'Moderate-High – Family members are usually able to shift their functioning positions to respond to the nature of the demands placed on the system.',
  'High – Family members shift their functioning positions easily in relation to the nature of the demands placed on the system.',
];

export type TrianglePropertyProcessType = typeof TRIANGLE_PROPERTY_PROCESS_TYPES[number];
export const isTrianglePropertyProcess = (value?: string): boolean => TRIANGLE_PROPERTY_PROCESS_TYPES.includes(value as TrianglePropertyProcessType);

export const STRESSOR_PROCESS_TYPES = [
  'stress-emotional-reactivity',
  'stress-family-adaptability',
  'stress-family-stressor',
  'stress-chronic-stress',
] as const;
export type StressorProcessType = typeof STRESSOR_PROCESS_TYPES[number];
export const isStressorProcess = (value?: string): boolean =>
  STRESSOR_PROCESS_TYPES.includes(value as StressorProcessType);

export const STRESS_EMOTIONAL_REACTIVITY_INTENSITY_LABELS = [
  'Minimal',
  'Mild',
  'Moderate',
  'Major',
  'Severe',
];

export const STRESS_EMOTIONAL_REACTIVITY_INTENSITY_HELP = [
  'Minimal – Minimal reactivity to stressors; little or no change in the number or severity of symptoms.',
  'Mild – Mild reactivity to stressors; some worsening of an existing symptom (one level) or the development of a new mild symptom.',
  'Moderate – Moderate reactivity to stressors; moderate worsening of existing symptom(s) up to a total of two levels or the development of a new symptom up to a moderate level of intensity.',
  'Major – Major reactivity to stressors; worsening of existing symptom(s) up to a total of three levels or the development of a new symptom up to a major level of intensity.',
  'Severe – Severe reactivity to stressors; worsening of existing symptom(s) by up to a total of four levels and/or the emergence of one or more new symptoms up to a severe level of intensity.',
];

export const STRESS_FAMILY_ADAPTABILITY_INTENSITY_LABELS = [
  'Low',
  'Low-Moderate',
  'Moderate',
  'Moderate-High',
  'High',
];

export const STRESS_FAMILY_ADAPTABILITY_INTENSITY_HELP = [
  'Low – Low adaptability to stress—the family exhibits severe levels of reactivity to even minimal amounts of stress.',
  'Low-Moderate – Low-moderate adaptability to stress—the family exhibits major levels of reactivity to mild levels of stress.',
  'Moderate – Moderate adaptability to stress—the family demonstrates moderate levels of reactivity to moderate amounts of stress.',
  'Moderate-High – Moderate-high adaptability to stress—the family exhibits mild levels of reactivity to major levels of stress.',
  'High – High adaptability to stress—the family exhibits minimal reactivity to even severe levels of stress.',
];

export const STRESS_FAMILY_STRESSOR_INTENSITY_LABELS = [
  'Minimal',
  'Mild',
  'Moderate',
  'Major',
  'Severe',
];

export const STRESS_FAMILY_STRESSOR_INTENSITY_HELP = [
  'Minimal – Stressors that place little or no demand on a family to adapt.',
  'Mild – Stressors that place some demand on the family to adjust but the amount of adaptation required is relatively modest and easily accommodated.',
  'Moderate – Stressors that represent a significant life adjustment for a family but well within what can be expected during the normal course of a family\'s life cycle.',
  'Major – A stressor or combinations of stressors that require considerable ability on the part of the family to adjust to the requirements of the stressor(s) beyond what can ordinarily be expected during the normal course of family life.',
  'Severe – An event or series of events that place an extraordinary requirement on a family to adapt to the demands of the stressor(s).',
];

export const STRESS_CHRONIC_STRESS_INTENSITY_LABELS = [
  'Low',
  'Moderately Low',
  'Moderate',
  'Moderately High',
  'High',
];

export const STRESS_CHRONIC_STRESS_INTENSITY_HELP = [
  'Low – Low level of chronic anxiety—the family exhibits a high level of family adaptability to stress.',
  'Moderately Low – Moderately low level of chronic anxiety—the family exhibits a moderately high level of family adaptability to stress.',
  'Moderate – Moderate level of chronic anxiety—the family demonstrates a moderate level of family adaptability to stress.',
  'Moderately High – Moderately high level of chronic anxiety—the family exhibits a moderately low ability of the family to adapt to stress.',
  'High – High level of chronic anxiety—the family exhibits a low ability to adapt to stress.',
];

export const STRESSOR_TYPE_LABELS: Record<string, string> = {
  'stress-emotional-reactivity': 'Emotional Reactivity',
  'stress-family-adaptability': 'Family Adaptability',
  'stress-family-stressor': 'Family Stressor',
  'stress-chronic-stress': 'Chronic Stress',
};

export const STRESSOR_DEFS = [
  { processType: 'stress-emotional-reactivity', label: 'Emotional Reactivity' },
  { processType: 'stress-family-adaptability', label: 'Family Adaptability' },
  { processType: 'stress-family-stressor', label: 'Family Stressor' },
  { processType: 'stress-chronic-stress', label: 'Chronic Stress' },
] as const;

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
