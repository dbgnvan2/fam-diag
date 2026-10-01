/**
 * usePredictionHandlers — CRUD operations for diagram-level Prediction Sets.
 * Each set contains one or more predictions. All mutations are immutable.
 */
import { localDateString } from '../utils/dateFormatting';
import {
  predictionDeleteMessage,
  predictionSetDeleteMessage,
  renamedSetName,
  withConditionUpdate,
} from '../utils/predictionSets';
import type { Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import type {
  Prediction,
  PredictionCondition,
  PredictionConditionType,
  PredictionEvidence,
  PredictionOutcome,
  PredictionSet,
  PredictionStatus,
} from '../types';

interface UsePredictionHandlersDeps {
  predictionSets: PredictionSet[];
  setPredictionSets: Dispatch<SetStateAction<PredictionSet[]>>;
  /** Asked before a delete; there is no undo. Injectable for tests. */
  confirmFn?: (message: string) => boolean;
}

// ── internal helper: update a single prediction inside a set ────────────────

const updatePredInSet = (
  sets: PredictionSet[],
  setId: string,
  predId: string,
  fn: (p: Prediction) => Prediction,
): PredictionSet[] =>
  sets.map((s) =>
    s.id === setId
      ? { ...s, predictions: s.predictions.map((p) => (p.id === predId ? fn(p) : p)) }
      : s,
  );

export function usePredictionHandlers({
  predictionSets,
  setPredictionSets,
  confirmFn = (message) => window.confirm(message),
}: UsePredictionHandlersDeps) {
  // When the prediction was created / resolved in the app: a local date.
  const today = () => localDateString();

  // ── Set CRUD ─────────────────────────────────────────────────────────────

  const addSet = (name: string) => {
    const newSet: PredictionSet = {
      id: nanoid(),
      name: name || 'Untitled Set',
      createdDate: today(),
      predictions: [],
    };
    setPredictionSets((prev) => [...prev, newSet]);
    return newSet.id;
  };

  const renameSet = (setId: string, name: string) => {
    setPredictionSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, name: renamedSetName(s.name, name) } : s)),
    );
  };

  /** Deletes the set after the user confirms. Returns whether it was deleted. */
  const deleteSet = (setId: string): boolean => {
    const target = predictionSets.find((s) => s.id === setId);
    if (!target || !confirmFn(predictionSetDeleteMessage(target))) return false;
    setPredictionSets((prev) => prev.filter((s) => s.id !== setId));
    return true;
  };

  // ── Prediction CRUD (within a set) ───────────────────────────────────────

  const addPrediction = (setId: string) => {
    const newPrediction: Prediction = {
      id: nanoid(),
      title: '',
      status: 'active',
      createdDate: today(),
      conditions: [],
      outcomes: [],
      notes: '',
    };
    setPredictionSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, predictions: [...s.predictions, newPrediction] }
          : s,
      ),
    );
    return newPrediction.id;
  };

  const updatePrediction = (setId: string, predId: string, updates: Partial<Prediction>) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({ ...p, ...updates })),
    );
  };

  /** Deletes the prediction after the user confirms. Returns whether it was deleted. */
  const deletePrediction = (setId: string, predId: string): boolean => {
    const target = predictionSets.find((s) => s.id === setId)?.predictions.find((p) => p.id === predId);
    if (!target || !confirmFn(predictionDeleteMessage(target))) return false;
    setPredictionSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, predictions: s.predictions.filter((p) => p.id !== predId) }
          : s,
      ),
    );
    return true;
  };

  const resolvePrediction = (setId: string, predId: string, status: PredictionStatus) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        status,
        resolvedDate: status === 'active' ? undefined : today(),
      })),
    );
  };

  // ── Condition CRUD ───────────────────────────────────────────────────────

  const addCondition = (setId: string, predId: string, type: PredictionConditionType = 'custom') => {
    const newCondition: PredictionCondition = {
      id: nanoid(),
      type,
      description: '',
      evidence: [],
    };
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        conditions: [...p.conditions, newCondition],
      })),
    );
  };

  const updateCondition = (
    setId: string,
    predId: string,
    condId: string,
    updates: Partial<PredictionCondition>,
  ) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        conditions: p.conditions.map((c) => (c.id === condId ? withConditionUpdate(c, updates) : c)),
      })),
    );
  };

  const removeCondition = (setId: string, predId: string, condId: string) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        conditions: p.conditions.filter((c) => c.id !== condId),
      })),
    );
  };

  // ── Outcome CRUD ─────────────────────────────────────────────────────────

  const addOutcome = (setId: string, predId: string) => {
    const newOutcome: PredictionOutcome = {
      id: nanoid(),
      description: '',
      personIds: [],
      evidence: [],
    };
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        outcomes: [...p.outcomes, newOutcome],
      })),
    );
  };

  const updateOutcome = (
    setId: string,
    predId: string,
    outcomeId: string,
    updates: Partial<PredictionOutcome>,
  ) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        outcomes: p.outcomes.map((o) => (o.id === outcomeId ? { ...o, ...updates } : o)),
      })),
    );
  };

  const removeOutcome = (setId: string, predId: string, outcomeId: string) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => ({
        ...p,
        outcomes: p.outcomes.filter((o) => o.id !== outcomeId),
      })),
    );
  };

  // ── Evidence CRUD ────────────────────────────────────────────────────────

  const addEvidence = (
    setId: string,
    predId: string,
    target: 'condition' | 'outcome',
    targetId: string,
    evidence: Omit<PredictionEvidence, 'id'>,
  ) => {
    const newEvidence: PredictionEvidence = { ...evidence, id: nanoid() };
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => {
        if (target === 'condition') {
          return {
            ...p,
            conditions: p.conditions.map((c) =>
              c.id === targetId ? { ...c, evidence: [...c.evidence, newEvidence] } : c,
            ),
          };
        }
        return {
          ...p,
          outcomes: p.outcomes.map((o) =>
            o.id === targetId ? { ...o, evidence: [...o.evidence, newEvidence] } : o,
          ),
        };
      }),
    );
  };

  const removeEvidence = (
    setId: string,
    predId: string,
    target: 'condition' | 'outcome',
    targetId: string,
    evidenceId: string,
  ) => {
    setPredictionSets((prev) =>
      updatePredInSet(prev, setId, predId, (p) => {
        if (target === 'condition') {
          return {
            ...p,
            conditions: p.conditions.map((c) =>
              c.id === targetId ? { ...c, evidence: c.evidence.filter((e) => e.id !== evidenceId) } : c,
            ),
          };
        }
        return {
          ...p,
          outcomes: p.outcomes.map((o) =>
            o.id === targetId ? { ...o, evidence: o.evidence.filter((e) => e.id !== evidenceId) } : o,
          ),
        };
      }),
    );
  };

  return {
    predictionSets,
    addSet,
    renameSet,
    deleteSet,
    addPrediction,
    updatePrediction,
    deletePrediction,
    resolvePrediction,
    addCondition,
    updateCondition,
    removeCondition,
    addOutcome,
    updateOutcome,
    removeOutcome,
    addEvidence,
    removeEvidence,
  };
}
