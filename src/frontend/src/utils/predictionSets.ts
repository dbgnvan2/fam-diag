/**
 * Purpose: read prediction sets from storage or a diagram file into the
 *          current shape, so an old or partial record cannot crash the
 *          Predictions panel.
 * Spec:    n/a — REVIEW-unread-areas-2026-09-30.md (predictionSets not checked on load)
 * Tests:   src/frontend/src/utils/predictionSets.test.ts
 *
 * The flat Prediction[] migration only ran on the localStorage path; a file
 * holding the old shape, or a set missing `predictions` / a prediction
 * missing `conditions`, crashed PredictionsPanel on `.length` / `.map`.
 */
import { nanoid } from 'nanoid';
import type { Prediction, PredictionSet } from '../types';
import { localDateString } from './dateFormatting';

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => !!value && typeof value === 'object' && !Array.isArray(value);
const arrayOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const normalizePrediction = (value: Loose): Prediction =>
  ({
    ...value,
    id: typeof value.id === 'string' ? value.id : nanoid(),
    title: typeof value.title === 'string' ? value.title : '',
    status: typeof value.status === 'string' ? value.status : 'active',
    createdDate: typeof value.createdDate === 'string' ? value.createdDate : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
    conditions: arrayOf<Loose>(value.conditions)
      .filter(isObject)
      .map((condition) => ({ ...condition, evidence: arrayOf(condition.evidence) })),
    outcomes: arrayOf<Loose>(value.outcomes)
      .filter(isObject)
      .map((outcome) => ({ ...outcome, personIds: arrayOf(outcome.personIds), evidence: arrayOf(outcome.evidence) })),
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
