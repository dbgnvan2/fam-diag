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
  PAPERO: ['Resourceful', 'Connectedness & Integration', 'Tension Management', 'Systems Thinking', 'Goal Structure'],
  SIR: ['Resource to Other', 'Managing Reactivity', 'Defining Self', 'Detriangulating', 'Emotional Contact', 'Systems Perspective'],
};

// ─── Subtype options per EventType+Category (only where subtypes exist) ──────
export const EVENT_SUBTYPES: Partial<Record<EventType, Record<string, string[]>>> = {
  FAMILY: {
    Triangles: ['Functioning', 'Flexibility', 'Stress Response'],
    Stress: ['Emotional Reactivity', 'Adaptability', 'Family Stressor', 'Chronic Stress'],
  },
  PAPERO: {
    Resourceful: ['Engagement with Issue', 'Problem Solving Activity', 'Family Awareness of Role', 'Locus of Control', 'Leadership'],
    'Connectedness & Integration': ['Extended Family Contact', 'Knowledge of Situations', 'Relationship Quality', 'Openness & Tolerance'],
    'Tension Management': ['Anxiety Containment', 'Perceptual Framework'],
    'Systems Thinking': ['Fundamental Questions', "Family's Focus", 'Locus of Change'],
    'Goal Structure': ['Achievement Goals', 'Process Goals'],
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

// ─── Papero Assessment scales ─────────────────────────────────────────────────

// Category: Resourceful
const PAPERO_ENGAGEMENT_SCALE: IntensityScale = {
  labels: ['Avoidant', 'Mostly Avoidant', 'Selective Engagement', 'Generally Engaged', 'Fully Engaged'],
  help: [
    'Avoidant – avoids addressing issues; passes endurance to others.',
    'Mostly Avoidant – tends to avoid most issues; limited willingness to engage.',
    'Selective Engagement – engages with some issues but avoids others.',
    'Generally Engaged – engages with most issues; active involvement.',
    'Fully Engaged – consistently engaged; takes ownership of issues.',
  ],
};
const PAPERO_PROBLEM_SOLVING_SCALE: IntensityScale = {
  labels: ['Passive Endurance', 'Minimal Effort', 'Some Problem Solving', 'Active Problem Solving', 'Consistent Problem Solving'],
  help: [
    'Passive Endurance – no active problem solving; endures rather than addresses.',
    'Minimal Effort – very limited problem solving activity.',
    'Some Problem Solving – engages in problem solving activity sometimes.',
    'Active Problem Solving – regularly applies problem solving activity.',
    'Consistent Problem Solving – persistent, effective problem solving activity.',
  ],
};
const PAPERO_FAMILY_AWARENESS_SCALE: IntensityScale = {
  labels: ["Individual's Problem", 'Limited Awareness', 'Partial Family Awareness', 'Broad Family Awareness', 'All Involved'],
  help: [
    "Individual's Problem – seen as one person's problem; no family role awareness.",
    'Limited Awareness – minimal recognition of family roles in the issue.',
    'Partial Family Awareness – some family members aware of their roles.',
    'Broad Family Awareness – most family members aware and acknowledging roles.',
    'All Involved – full family awareness of roles; collective engagement.',
  ],
};
const PAPERO_LOCUS_OF_CONTROL_SCALE: IntensityScale = {
  labels: ['Outsiders Should Handle', 'Mostly External', 'Mixed Internal/External', 'Mostly Internal', '"What Can I Do?"'],
  help: [
    'Outsiders Should Handle – belief that others or outsiders should fix the problem.',
    'Mostly External – primarily looks outside for solutions.',
    'Mixed Internal/External – some personal responsibility alongside external reliance.',
    'Mostly Internal – primarily takes personal responsibility.',
    '"What Can I Do?" – fully internalized locus of control; self-directed action.',
  ],
};
const PAPERO_LEADERSHIP_SCALE: IntensityScale = {
  labels: ['Absent/Inactive', 'Rarely Present', 'Intermittent', 'Generally Present', 'Present and Active'],
  help: [
    'Absent/Inactive – no leadership presence or activity.',
    'Rarely Present – leadership emerges only in crisis situations.',
    'Intermittent – leadership present sometimes but inconsistent.',
    'Generally Present – leadership present in most situations.',
    'Present and Active – consistent, active leadership in the family unit.',
  ],
};

// Category: Connectedness & Integration
const PAPERO_EXTENDED_FAMILY_SCALE: IntensityScale = {
  labels: ['No Contact', 'Rare Contact', 'Occasional Contact', 'Regular Contact', 'Active Contact'],
  help: [
    'No Contact – complete cutoff from extended family.',
    'Rare Contact – very infrequent contact with extended family.',
    'Occasional Contact – some contact with extended family members.',
    'Regular Contact – consistent contact with extended family.',
    'Active Contact – fully engaged, active relationships with extended family.',
  ],
};
const PAPERO_KNOWLEDGE_SCALE: IntensityScale = {
  labels: ['Limited Knowledge', 'Selective Knowledge', 'Moderate Knowledge', 'Broad Knowledge', 'Full Knowledge'],
  help: [
    'Limited Knowledge – very little knowledge of family situations and secrets.',
    'Selective Knowledge – knowledge limited to certain topics or members.',
    'Moderate Knowledge – reasonable awareness of family situations.',
    'Broad Knowledge – extensive awareness of family situations and dynamics.',
    'Full Knowledge – comprehensive knowledge of situations and secrets.',
  ],
};
const PAPERO_RELATIONSHIP_QUALITY_SCALE: IntensityScale = {
  labels: ['Superficial', 'Mostly Surface', 'Mixed Depth', 'Mostly Direct', 'Person to Person, Open'],
  help: [
    'Superficial – relationships are superficial; talk about, not to, others.',
    'Mostly Surface – relationships lack depth; limited direct communication.',
    'Mixed Depth – some relationships have depth while others remain surface-level.',
    'Mostly Direct – most relationships involve direct, honest communication.',
    'Person to Person, Open – genuine person-to-person, open communication.',
  ],
};
const PAPERO_OPENNESS_SCALE: IntensityScale = {
  labels: ['Intolerant to Differences', 'Low Tolerance', 'Moderate Tolerance', 'Generally Tolerant', 'Differences Developed & Tolerated'],
  help: [
    'Intolerant to Differences – no tolerance for differences among members.',
    'Low Tolerance – limited ability to accept differences.',
    'Moderate Tolerance – some acceptance of differences in the family.',
    'Generally Tolerant – most differences are accepted and managed well.',
    'Differences Developed & Tolerated – differentiation of self is developed and fully tolerated.',
  ],
};

// Category: Tension Management
const PAPERO_ANXIETY_CONTAINMENT_SCALE: IntensityScale = {
  labels: ['Unmanaged', 'Poorly Contained', 'Partially Contained', 'Mostly Contained', 'Effectively Managed'],
  help: [
    'Unmanaged – anxiety is completely unmanaged; reactive responses dominate.',
    'Poorly Contained – minimal ability to contain anxiety.',
    'Partially Contained – some ability to contain anxiety in low-stress situations.',
    'Mostly Contained – anxiety generally well contained; occasional breakthroughs.',
    'Effectively Managed – anxiety consistently well managed across situations.',
  ],
};
const PAPERO_PERCEPTUAL_FRAMEWORK_SCALE: IntensityScale = {
  labels: ['Catastrophic Thinking', 'Mostly Reactive', 'Mixed Perspective', 'Generally Balanced', 'Careful Thought & Analysis'],
  help: [
    'Catastrophic Thinking – dominated by worst-case thinking and emotional reactivity.',
    'Mostly Reactive – thinking is primarily reactive with limited perspective.',
    'Mixed Perspective – some balanced thinking mixed with reactive responses.',
    'Generally Balanced – mostly thoughtful and balanced perspective on situations.',
    'Careful Thought & Analysis – consistently employs careful thought and analysis.',
  ],
};

// Category: Systems Thinking
const PAPERO_FUNDAMENTAL_QUESTIONS_SCALE: IntensityScale = {
  labels: ['"Why? Who\'s Fault?"', 'Mostly Blame-Focused', 'Mixed Cause/Process', 'Mostly Process-Focused', '"How, When, Where, Who, How Much"'],
  help: [
    '"Why? Who\'s Fault?" – focus entirely on blame and fault-finding.',
    'Mostly Blame-Focused – primarily concerned with assigning responsibility.',
    'Mixed Cause/Process – some process thinking alongside cause-seeking.',
    'Mostly Process-Focused – primarily asks process-oriented questions.',
    '"How, When, Where, Who, How Much" – fully process-focused; systems-oriented inquiry.',
  ],
};
const PAPERO_FAMILY_FOCUS_SCALE: IntensityScale = {
  labels: ['Issue-Focused', 'Mostly Issue-Focused', 'Mixed Issue/Process', 'Mostly Process-Focused', 'Process-Focused'],
  help: [
    'Issue-Focused – family focus is entirely on specific issues and content.',
    'Mostly Issue-Focused – primarily focused on issues with occasional process awareness.',
    'Mixed Issue/Process – balance between issue-level and process-level focus.',
    'Mostly Process-Focused – primarily attends to process and patterns.',
    'Process-Focused – family consistently focuses on process over content.',
  ],
};
const PAPERO_LOCUS_OF_CHANGE_SCALE: IntensityScale = {
  labels: ['"Other Must Change"', 'Mostly External', 'Shared Responsibility', 'Mostly Self-Directed', '"I Must Change"'],
  help: [
    '"Other Must Change" – change is entirely expected from others.',
    'Mostly External – change is primarily expected from others with some self-awareness.',
    'Shared Responsibility – change seen as shared between self and others.',
    'Mostly Self-Directed – primarily focuses on self-change while acknowledging others.',
    '"I Must Change" – fully self-directed; takes personal responsibility for change.',
  ],
};

// Category: Goal Structure
const PAPERO_ACHIEVEMENT_GOALS_SCALE: IntensityScale = {
  labels: ['None', 'Vague Goals', 'Some Defined Goals', 'Mostly Clear Goals', 'Well-Developed SMART Goals'],
  help: [
    'None – no achievement goals identified.',
    'Vague Goals – goals exist but are unclear or poorly articulated.',
    'Some Defined Goals – some goals are defined but incomplete.',
    'Mostly Clear Goals – most goals are clear and actionable.',
    'Well-Developed SMART Goals – all goals are specific, measurable, achievable, relevant, and time-bound.',
  ],
};
const PAPERO_PROCESS_GOALS_SCALE: IntensityScale = {
  labels: ['Not Employed', 'Rarely Employed', 'Sometimes Employed', 'Regularly Employed', 'Employed Effectively'],
  help: [
    'Not Employed – no process goals in use.',
    'Rarely Employed – process goals are rarely used or referenced.',
    'Sometimes Employed – process goals are used inconsistently.',
    'Regularly Employed – process goals are regularly used and tracked.',
    'Employed Effectively – process goals are fully integrated and employed effectively.',
  ],
};

/** Maps a Papero subtype key to its IntensityScale. */
export const PAPERO_SCALES: Record<string, IntensityScale> = {
  'Engagement with Issue': PAPERO_ENGAGEMENT_SCALE,
  'Problem Solving Activity': PAPERO_PROBLEM_SOLVING_SCALE,
  'Family Awareness of Role': PAPERO_FAMILY_AWARENESS_SCALE,
  'Locus of Control': PAPERO_LOCUS_OF_CONTROL_SCALE,
  'Leadership': PAPERO_LEADERSHIP_SCALE,
  'Extended Family Contact': PAPERO_EXTENDED_FAMILY_SCALE,
  'Knowledge of Situations': PAPERO_KNOWLEDGE_SCALE,
  'Relationship Quality': PAPERO_RELATIONSHIP_QUALITY_SCALE,
  'Openness & Tolerance': PAPERO_OPENNESS_SCALE,
  'Anxiety Containment': PAPERO_ANXIETY_CONTAINMENT_SCALE,
  'Perceptual Framework': PAPERO_PERCEPTUAL_FRAMEWORK_SCALE,
  'Fundamental Questions': PAPERO_FUNDAMENTAL_QUESTIONS_SCALE,
  "Family's Focus": PAPERO_FAMILY_FOCUS_SCALE,
  'Locus of Change': PAPERO_LOCUS_OF_CHANGE_SCALE,
  'Achievement Goals': PAPERO_ACHIEVEMENT_GOALS_SCALE,
  'Process Goals': PAPERO_PROCESS_GOALS_SCALE,
};

/** Maps a Papero subtype to its PaperoScores key. */
export const PAPERO_SUBTYPE_TO_KEY: Record<string, string> = {
  'Engagement with Issue': 'resourceful_engagement',
  'Problem Solving Activity': 'resourceful_problemSolving',
  'Family Awareness of Role': 'resourceful_familyAwareness',
  'Locus of Control': 'resourceful_locusOfControl',
  'Leadership': 'resourceful_leadership',
  'Extended Family Contact': 'connectedness_extendedFamily',
  'Knowledge of Situations': 'connectedness_knowledge',
  'Relationship Quality': 'connectedness_relationshipQuality',
  'Openness & Tolerance': 'connectedness_openness',
  'Anxiety Containment': 'tension_anxietyContainment',
  'Perceptual Framework': 'tension_perceptualFramework',
  'Fundamental Questions': 'systems_fundamentalQuestions',
  "Family's Focus": 'systems_familyFocus',
  'Locus of Change': 'systems_locusOfChange',
  'Achievement Goals': 'goals_achievementGoals',
  'Process Goals': 'goals_processGoals',
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
  if (eventType === 'PAPERO') {
    if (subtype && PAPERO_SCALES[subtype]) return PAPERO_SCALES[subtype];
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
  PAPERO: 'Papero Assessment',
  SIR: 'Self in Relationship',
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
  PAPERO: true,
  SIR: true,
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
  PAPERO: true,
  SIR: false,
};
