/**
 * Purpose: read prediction sets from storage or a diagram file into the
 *          current shape, so an old or partial record cannot crash the
 *          Predictions panel.
 * Spec:    n/a — REVIEW-unread-areas-2026-09-30.md (predictionSets not checked on load)
 * Tests:   src/frontend/src/utils/predictionSets.test.ts
 *
 * Also the rules the Predictions handlers apply (REVIEW-gap-areas-2026-09-30
 * F-3, F-13, F-15, F-17): delete confirmations, stale links, set names.
 *
 * The flat Prediction[] migration only ran on the localStorage path; a file
 * holding the old shape, or a set missing `predictions` / a prediction
 * missing `conditions`, crashed PredictionsPanel on `.length` / `.map`.
 */
import { nanoid } from 'nanoid';
import type {
  Prediction,
  PredictionCondition,
  PredictionEvidence,
  PredictionEvidenceDirection,
  PredictionEvidenceType,
  PredictionSet,
} from '../types';
import { localDateString } from './dateFormatting';
import { PAPERO_SUBTYPE_TO_KEY } from '../constants/eventConstants';

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => !!value && typeof value === 'object' && !Array.isArray(value);
const arrayOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const EVIDENCE_TYPES: readonly PredictionEvidenceType[] = ['event', 'sir_entry', 'papero_change', 'observation'];
const EVIDENCE_DIRECTIONS: readonly PredictionEvidenceDirection[] = ['supports', 'contradicts', 'neutral'];
const CONDITION_TYPES: readonly PredictionCondition['type'][] = ['sir', 'papero', 'custom'];

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

// A partial evidence record renders instead of crashing the panel. A missing
// direction is 'neutral' — it neither supports nor contradicts.
const normalizeEvidence = (value: Loose): PredictionEvidence =>
  ({
    ...value,
    id: typeof value.id === 'string' ? value.id : nanoid(),
    date: typeof value.date === 'string' ? value.date : '',
    type: oneOf(EVIDENCE_TYPES, value.type, 'observation'),
    direction: oneOf(EVIDENCE_DIRECTIONS, value.direction, 'neutral'),
    notes: typeof value.notes === 'string' ? value.notes : '',
  }) as PredictionEvidence;

const evidenceList = (value: unknown): PredictionEvidence[] =>
  arrayOf<unknown>(value).filter(isObject).map(normalizeEvidence);

// Every condition and outcome gets an id: two without one were both matched
// by an edit to either (`c.id === undefined`).
const normalizePrediction = (value: Loose): Prediction =>
  ({
    ...value,
    id: typeof value.id === 'string' ? value.id : nanoid(),
    title: typeof value.title === 'string' ? value.title : '',
    status: typeof value.status === 'string' ? value.status : 'active',
    createdDate: typeof value.createdDate === 'string' ? value.createdDate : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
    conditions: arrayOf<unknown>(value.conditions)
      .filter(isObject)
      .map((condition) => ({
        ...condition,
        id: typeof condition.id === 'string' ? condition.id : nanoid(),
        type: oneOf(CONDITION_TYPES, condition.type, 'custom'),
        description: typeof condition.description === 'string' ? condition.description : '',
        evidence: evidenceList(condition.evidence),
      })),
    outcomes: arrayOf<unknown>(value.outcomes)
      .filter(isObject)
      .map((outcome) => ({
        ...outcome,
        id: typeof outcome.id === 'string' ? outcome.id : nanoid(),
        description: typeof outcome.description === 'string' ? outcome.description : '',
        personIds: arrayOf<unknown>(outcome.personIds).filter((id): id is string => typeof id === 'string'),
        evidence: evidenceList(outcome.evidence),
      })),
  }) as Prediction;

/**
 * Prediction sets in the current shape. An old flat list of predictions is
 * wrapped in one "Migrated Predictions" set; anything that is not a list, or
 * an entry that is not an object, is dropped.
 */
export const normalizePredictionSets = (value: unknown, today: string = localDateString()): PredictionSet[] => {
  const entries = arrayOf<unknown>(value).filter(isObject);
  if (entries.length === 0) return [];
  const isFlatPredictionList = !('predictions' in entries[0]) && 'conditions' in entries[0];
  if (isFlatPredictionList) {
    return [{ id: nanoid(), name: 'Migrated Predictions', createdDate: today, predictions: entries.map(normalizePrediction) }];
  }
  return entries.map((set) => ({
    ...set,
    id: typeof set.id === 'string' ? set.id : nanoid(),
    name: typeof set.name === 'string' ? set.name : 'Predictions',
    createdDate: typeof set.createdDate === 'string' ? set.createdDate : '',
    predictions: arrayOf<unknown>(set.predictions).filter(isObject).map(normalizePrediction),
  })) as PredictionSet[];
};

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** The confirm shown before a prediction set is deleted (there is no undo). */
export const predictionSetDeleteMessage = (set: PredictionSet): string => {
  const evidenceCount = set.predictions.reduce(
    (sum, p) =>
      sum +
      p.conditions.reduce((n, c) => n + c.evidence.length, 0) +
      p.outcomes.reduce((n, o) => n + o.evidence.length, 0),
    0
  );
  return (
    `Delete the prediction set "${set.name}"? ` +
    `This removes ${plural(set.predictions.length, 'prediction')} and ` +
    `${plural(evidenceCount, 'evidence entry', 'evidence entries')}. It cannot be undone.`
  );
};

/** The confirm shown before one prediction is deleted. */
export const predictionDeleteMessage = (prediction: Prediction): string =>
  `Delete the prediction "${prediction.title.trim() || 'Untitled'}" with ` +
  `${plural(prediction.conditions.length, 'condition')} and ${plural(prediction.outcomes.length, 'outcome')}? ` +
  'It cannot be undone.';

/** A rename to an empty name keeps the old one: a set with no name cannot be told apart. */
export const renamedSetName = (previous: string, next: string): string => next.trim() || previous;

/**
 * Apply an edit to a condition. Changing who or what it is about drops links
 * that pointed at the old person's or type's entries, unless the edit sets
 * them itself.
 */
export const withConditionUpdate = (
  condition: PredictionCondition,
  updates: Partial<PredictionCondition>
): PredictionCondition => {
  const next = { ...condition, ...updates };
  const personChanged = 'personId' in updates && updates.personId !== condition.personId;
  const typeChanged = 'type' in updates && updates.type !== condition.type;
  const sirCategoryChanged =
    'linkedSIRCategory' in updates && updates.linkedSIRCategory !== condition.linkedSIRCategory;
  if ((personChanged || typeChanged || sirCategoryChanged) && !('linkedEventId' in updates)) {
    next.linkedEventId = undefined;
  }
  if (typeChanged) {
    if (!('linkedSIRCategory' in updates)) next.linkedSIRCategory = undefined;
    if (!('linkedPaperoKey' in updates)) next.linkedPaperoKey = undefined;
  }
  return next;
};

/** The Papero topic name for a stored score key ('' when unknown). */
export const paperoTopicForKey = (key: string | undefined): string =>
  key ? Object.entries(PAPERO_SUBTYPE_TO_KEY).find(([, value]) => value === key)?.[0] || '' : '';

/**
 * The hint shown in an empty condition description. It is only a placeholder:
 * text the user did not type is never written into the description (it went
 * stale when the topic changed, and it filled in a value nobody gave).
 */
export const conditionDescriptionPlaceholder = (condition: PredictionCondition): string => {
  if (condition.type === 'papero') {
    const topic = paperoTopicForKey(condition.linkedPaperoKey);
    return topic ? `e.g. Improve ${topic}` : 'Expected improvement...';
  }
  if (condition.type === 'sir') {
    return condition.linkedSIRCategory
      ? `e.g. ${condition.linkedSIRCategory}: goal or expected change`
      : 'Goal or expected change...';
  }
  return 'Describe the condition...';
};
