/**
 * Event type hierarchy: EventType → Category → Subtype
 * Intensity scales per EventType/Category/Subtype
 */
import type { EventType, EventStatus, EmotionalProcessEvent } from '../types';

// ─── Status ──────────────────────────────────────────────────────────────────
export const EVENT_STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'end', label: 'End' },
  { value: 'discrete', label: 'Discrete' },
];

// ─── Category options per EventType ─────────────────────────────────────────
export const EVENT_CATEGORIES: Record<EventType, string[]> = {
  SYMPTOM: ['Physical', 'Emotional', 'Social'],
  EPE: ['Fusion', 'Distance', 'Conflict', 'Projection', 'Cutoff'],
  NODAL: ['Birth', 'Death', 'Marriage', 'Separation', 'Divorce', 'Affair', 'Engagement', 'Friendship'],
  EA: ['Emotional Autonomy'],
  FAMILY: ['Triangles', 'Stress'],
  FOO: ['Family Stability', 'Family Intactness', 'Triangle Flexibility', 'Triangle Stress Response'],
  TRIANGLE: ['Primary', 'Secondary'],
};

// ─── Subtype options per EventType+Category (only where subtypes exist) ──────
export const EVENT_SUBTYPES: Partial<Record<EventType, Record<string, string[]>>> = {
  FAMILY: {
    Triangles: ['Functioning', 'Flexibility', 'Stress Response'],
    Stress: ['Emotional Reactivity', 'Adaptability', 'Family Stressor', 'Chronic Stress'],
  },
};

// ─── Intensity scales ─────────────────────────────────────────────────────────

export type IntensityScale = { labels: string[]; help: string[] };

// Generic 5-level scale (fallback)
const GENERIC_SCALE: IntensityScale = {
  labels: ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'],
  help: [
    'Minimal – least significant.',
    'Mild – minor significance.',
    'Moderate – moderate significance.',
    'Major – major significance.',
    'Severe – most significant.',
  ],
};

const SYMPTOM_SCALE: IntensityScale = {
  labels: ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'],
  help: [
    'Minimal – symptom is associated with some distress which is easily managed, with no limitation in functioning.',
    'Mild – more frequent, mild symptom that causes distress and occasionally interferes with functioning.',
    'Moderate – frequent or moderate symptom that reduces the ability to function but can be managed by the person relatively well without life disruption.',
    'Major – serious or chronic symptom that requires substantial alteration in the life of the person and/or the family.',
    "Severe – very serious symptom that essentially dictates all of life's choices and direction.",
  ],
};

const EA_SCALE: IntensityScale = {
  labels: ['Low', 'Low-Moderate', 'Moderate', 'Moderate-High', 'High'],
  help: [
    'Low – Members exhibit virtually no ability to think for themselves when making decisions and lack principles they have defined for self; no ability to make choices and almost always succumb to pressures from the relationship system.',
    'Low-Moderate – Members exhibit some ability to think for themselves and some awareness of choice if anxiety is low; they often succumb to pressures from the relationship system.',
    'Moderate – Members exhibit a better ability to think for themselves and make choices if under no more than a low-moderate amount of stress; some ability to retain self under pressures from the relationship system.',
    'Moderate-High – Members exhibit more solid ability to think for self if stress is moderate; choices are less frequently molded by the group.',
    'High – Members exhibit unusual ability to think for self and make choices informed by principle, even under moderately high levels of stress; consistent ability to clearly define self under group pressure.',
  ],
};

const TRIANGLE_FUNCTIONING_SCALE: IntensityScale = {
  labels: ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80'],
  help: [
    'Triangles at this level are fixed and always return to the same position. Members are so cut off and isolated, genuine person-to-person communication is virtually non-existent; the effort to obtain a modicum of comfort determines behavior.',
    'Triangles at this level have a bit more flexibility so long as the amount of stress on the system is very low; small increases in tension lock triangles in the usual pattern; members have very little ability to tolerate discomfort and quickly resort to typical triangling moves in an effort to decrease discomfort.',
    'An intense process of triangling is much in evidence whenever the system is subjected to more than low levels of stress; person-to-person relationships are fleeting but can occur when tension is low.',
    'Triangles at this level retain flexibility as long as stressful events remain at below moderate levels; at higher levels of stress a more intense process of triangling takes over and erases the ability to communicate person-to-person.',
    'Members at this level are better able to override the dictates of triangles so long as the stress placed on the system does not go much above moderate levels; people are better able to evaluate the reality of threats and take appropriate action; they are also better able to utilize people outside an intense triangle to gain perspective on the process.',
    'Triangles at this level are more able to function without impairing anyone in the system so long as the stress placed on the system does not become moderately high; triangular emotional process is still in evidence but at lower levels of tension it can be a more playful process in which humorous exchange helps to defuse the tension that is present.',
    'Families at this level are able to maintain reasonably flexible triangles even under relatively high levels of stress; well-developed principles enable family members to maintain respectful boundaries under most circumstances.',
    'Person-to-person relationships are the rule rather than the exception at this level of functioning; third parties are used to gain perspective but members take the responsibility for working out their own problems and problems with other members of the family without blaming self or other. Triangles are unusually flexible in these families even under high levels of stress.',
  ],
};

const TRIANGLE_FLEXIBILITY_SCALE: IntensityScale = {
  labels: ['Low', 'Low-Moderate', 'Moderate', 'Moderate-High', 'High'],
  help: [
    'Low – Individual members or relationships in the family chronically absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension always returns to the same individuals or relationships.',
    'Low-Moderate – Individual members or relationships in the family usually absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension regularly returns to the same individuals or relationships.',
    'Moderate – Individual members or relationships in the family sometimes absorb a disproportionate amount of tension; when short term shifts in the triangles settle down, tension sometimes returns to the same individual or relationship.',
    'Moderate-High – No individual members or relationships in the family typically absorbs a disproportionate amount of tension; when short term shifts in the triangles settle down, tension may shift to different individuals or relationships.',
    'High – Family has unusual ability to manage tension without affecting any one member or any one relationship in the triangles disproportionately.',
  ],
};

const TRIANGLE_STRESS_RESPONSE_SCALE: IntensityScale = {
  labels: ['Low', 'Low-Moderate', 'Moderate', 'Moderate-High', 'High'],
  help: [
    'Low – Family members almost never shift their functioning positions to respond to the nature of the demands placed on the system.',
    'Low-Moderate – Family members are rarely able to shift their functioning positions to respond to the nature of the demands placed on the system.',
    'Moderate – Family members are sometimes able to shift their functioning positions to respond to the nature of the demands placed on the system.',
    'Moderate-High – Family members are usually able to shift their functioning positions to respond to the nature of the demands placed on the system.',
    'High – Family members shift their functioning positions easily in relation to the nature of the demands placed on the system.',
  ],
};

const EMOTIONAL_REACTIVITY_SCALE: IntensityScale = {
  labels: ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'],
  help: [
    'Minimal – Minimal reactivity to stressors; little or no change in the number or severity of symptoms.',
    'Mild – Mild reactivity to stressors; some worsening of an existing symptom (one level) or the development of a new mild symptom.',
    'Moderate – Moderate reactivity to stressors; moderate worsening of existing symptom(s) up to a total of two levels or the development of a new symptom up to a moderate level of intensity.',
    'Major – Major reactivity to stressors; worsening of existing symptom(s) up to a total of three levels or the development of a new symptom up to a major level of intensity.',
    'Severe – Severe reactivity to stressors; worsening of existing symptom(s) by up to a total of four levels and/or the emergence of one or more new symptoms up to a severe level of intensity.',
  ],
};

const ADAPTABILITY_SCALE: IntensityScale = {
  labels: ['Low', 'Low-Moderate', 'Moderate', 'Moderate-High', 'High'],
  help: [
    'Low – Low adaptability to stress—the family exhibits severe levels of reactivity to even minimal amounts of stress.',
    'Low-Moderate – Low-moderate adaptability to stress—the family exhibits major levels of reactivity to mild levels of stress.',
    'Moderate – Moderate adaptability to stress—the family demonstrates moderate levels of reactivity to moderate amounts of stress.',
    'Moderate-High – Moderate-high adaptability to stress—the family exhibits mild levels of reactivity to major levels of stress.',
    'High – High adaptability to stress—the family exhibits minimal reactivity to even severe levels of stress.',
  ],
};

const FAMILY_STRESSOR_SCALE: IntensityScale = {
  labels: ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'],
  help: [
    'Minimal – Stressors that place little or no demand on a family to adapt.',
    'Mild – Stressors that place some demand on the family to adjust but the amount of adaptation required is relatively modest and easily accommodated.',
    "Moderate – Stressors that represent a significant life adjustment for a family but well within what can be expected during the normal course of a family's life cycle.",
    'Major – A stressor or combinations of stressors that require considerable ability on the part of the family to adjust to the requirements of the stressor(s) beyond what can ordinarily be expected during the normal course of family life.',
    'Severe – An event or series of events that place an extraordinary requirement on a family to adapt to the demands of the stressor(s).',
  ],
};

const CHRONIC_STRESS_SCALE: IntensityScale = {
  labels: ['Low', 'Moderately Low', 'Moderate', 'Moderately High', 'High'],
  help: [
    'Low – Low level of chronic anxiety—the family exhibits a high level of family adaptability to stress.',
    'Moderately Low – Moderately low level of chronic anxiety—the family exhibits a moderately high level of family adaptability to stress.',
    'Moderate – Moderate level of chronic anxiety—the family demonstrates a moderate level of family adaptability to stress.',
    'Moderately High – Moderately high level of chronic anxiety—the family exhibits a moderately low ability of the family to adapt to stress.',
    'High – High level of chronic anxiety—the family exhibits a low ability to adapt to stress.',
  ],
};

const FAMILY_STABILITY_SCALE: IntensityScale = {
  labels: ['Excellent', 'Good', 'Average', 'Semi-stable', 'Unstable'],
  help: [
    'Excellent – very high percentage (90%) of members represent good functioning across their lifetimes.',
    'Good – high percentage of family members (75-80%) represent good functioning across their lifetimes, few problems and existing problems are well managed.',
    'Average – majority of family members display stable adequate functioning across their lifetimes, some problems in family functioning but generally problems are either episodic or do not represent serious drops in overall family functioning.',
    'Semi-stable – majority of family members stable over their lifetimes but prolonged periods of drops in overall family functioning, perhaps including the present time.',
    'Unstable – majority of members have serious symptoms and major impairment of life functioning.',
  ],
};

const FAMILY_INTACTNESS_SCALE: IntensityScale = {
  labels: ['Excellent', 'Good', 'Average', 'Semi-fragmented', 'Fragmented'],
  help: [
    'Excellent – very high percentage (90%) of family members across three generations are alive and available for contact.',
    'Good – a high percentage (75-80%) of family members across three generations are alive and available for contact.',
    'Average – a majority of family members across three generations are alive and available for contact.',
    'Semi-fragmented – relatively few members of the family across three generations are alive and available for contact.',
    'Fragmented – basic family unit is dissolved and whereabouts of living family members is unknown.',
  ],
};

// Maps EventType + optional category + optional subtype → IntensityScale
export function getIntensityScale(eventType: EventType, category?: string, subtype?: string): IntensityScale {
  if (eventType === 'SYMPTOM') return SYMPTOM_SCALE;
  if (eventType === 'EA') return EA_SCALE;
  if (eventType === 'FAMILY') {
    if (category === 'Triangles') {
      if (subtype === 'Functioning') return TRIANGLE_FUNCTIONING_SCALE;
      if (subtype === 'Flexibility') return TRIANGLE_FLEXIBILITY_SCALE;
      if (subtype === 'Stress Response') return TRIANGLE_STRESS_RESPONSE_SCALE;
    }
    if (category === 'Stress') {
      if (subtype === 'Emotional Reactivity') return EMOTIONAL_REACTIVITY_SCALE;
      if (subtype === 'Adaptability') return ADAPTABILITY_SCALE;
      if (subtype === 'Family Stressor') return FAMILY_STRESSOR_SCALE;
      if (subtype === 'Chronic Stress') return CHRONIC_STRESS_SCALE;
    }
  }
  if (eventType === 'FOO') {
    if (category === 'Family Stability') return FAMILY_STABILITY_SCALE;
    if (category === 'Family Intactness') return FAMILY_INTACTNESS_SCALE;
    if (category === 'Triangle Flexibility') return TRIANGLE_FLEXIBILITY_SCALE;
    if (category === 'Triangle Stress Response') return TRIANGLE_STRESS_RESPONSE_SCALE;
  }
  return GENERIC_SCALE;
}

// Maps intensity value (1-N) to graphic level (1-5)
export function intensityToGraphicLevel(intensity: number, scale: IntensityScale): number {
  const n = scale.labels.length;
  if (n <= 5) return intensity;
  // For 8-level scale, map proportionally to 1-5
  return Math.round(1 + ((intensity - 1) / (n - 1)) * 4);
}

// ─── Event type display labels ────────────────────────────────────────────────
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  SYMPTOM: 'Symptom',
  EPE: 'Emotional Pattern',
  NODAL: 'Nodal',
  EA: 'Emotional Autonomy',
  FAMILY: 'Family',
  FOO: 'Family of Origin',
  TRIANGLE: 'Triangle Property',
};

// ─── Infer EventType from legacy event data ───────────────────────────────────
// Category-to-type reverse lookup (built once)
const CATEGORY_TO_EVENT_TYPE: Record<string, EventType> = (() => {
  const map: Record<string, EventType> = {};
  for (const [type, cats] of Object.entries(EVENT_CATEGORIES) as [EventType, string[]][]) {
    cats.forEach((cat) => { map[cat.toLowerCase()] = type; });
  }
  return map;
})();

export const inferEventType = (event: EmotionalProcessEvent): EventType => {
  // If stored type is valid, verify its category also matches. If not, infer from category.
  const stored = event.eventType;
  const catKey = (event.category || '').toLowerCase();
  if (stored && stored in EVENT_TYPE_LABELS) {
    const validCats = EVENT_CATEGORIES[stored];
    // EA and TRIANGLE have single or small categories — trust stored type for these
    if (!validCats || validCats.length === 0) return stored;
    // If category is empty or matches the stored type's category list, trust stored type
    if (!catKey || validCats.some((c) => c.toLowerCase() === catKey)) return stored;
    // Category belongs to a different type — infer from category
    const inferred = CATEGORY_TO_EVENT_TYPE[catKey];
    if (inferred) return inferred;
    return stored; // category unknown, keep stored type
  }
  if (event.eventClass === 'emotional-pattern') return 'EPE';
  // Try to infer from category alone
  if (catKey && CATEGORY_TO_EVENT_TYPE[catKey]) return CATEGORY_TO_EVENT_TYPE[catKey];
  return 'NODAL';
};

// ─── Which event types show Primary/Other Person fields ───────────────────────
export const EVENT_TYPE_HAS_PERSONS: Record<EventType, boolean> = {
  SYMPTOM: true,
  EPE: true,
  NODAL: true,
  EA: true,
  FAMILY: false,
  FOO: true,
  TRIANGLE: false,
};

// ─── Which event types have a subtype field ───────────────────────────────────
export const EVENT_TYPE_HAS_SUBTYPE: Record<EventType, boolean> = {
  SYMPTOM: true,
  EPE: false,
  NODAL: false,
  EA: false,
  FAMILY: true,
  FOO: false,
  TRIANGLE: true,
};
