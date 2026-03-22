/**
 * usePredictionHandlers — CRUD operations for diagram-level Predictions.
 * All mutations are immutable (spread/map/filter).
 */
import type { Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import type {
  Prediction,
  PredictionCondition,
  PredictionConditionType,
  PredictionEvidence,
  PredictionOutcome,
  PredictionStatus,
} from '../types';

interface UsePredictionHandlersDeps {
  predictions: Prediction[];
  setPredictions: Dispatch<SetStateAction<Prediction[]>>;
}

export function usePredictionHandlers({
  predictions,
  setPredictions,
}: UsePredictionHandlersDeps) {
  const today = () => new Date().toISOString().slice(0, 10);

  // ── Prediction CRUD ──────────────────────────────────────────────────────

  const addPrediction = () => {
    const newPrediction: Prediction = {
      id: nanoid(),
      title: '',
      status: 'active',
      createdDate: today(),
      conditions: [],
      outcomes: [],
      notes: '',
    };
    setPredictions((prev) => [...prev, newPrediction]);
    return newPrediction.id;
  };

  const updatePrediction = (id: string, updates: Partial<Prediction>) => {
    setPredictions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  };

  const deletePrediction = (id: string) => {
    setPredictions((prev) => prev.filter((p) => p.id !== id));
  };

  const resolvePrediction = (id: string, status: PredictionStatus) => {
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status, resolvedDate: status === 'active' ? undefined : today() }
          : p,
      ),
    );
  };

  // ── Condition CRUD ───────────────────────────────────────────────────────

  const addCondition = (predictionId: string, type: PredictionConditionType = 'custom') => {
    const newCondition: PredictionCondition = {
      id: nanoid(),
      type,
      description: '',
      evidence: [],
    };
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === predictionId
          ? { ...p, conditions: [...p.conditions, newCondition] }
          : p,
      ),
    );
  };

  const updateCondition = (
    predictionId: string,
    conditionId: string,
    updates: Partial<PredictionCondition>,
  ) => {
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === predictionId
          ? {
              ...p,
              conditions: p.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c,
              ),
            }
          : p,
      ),
    );
  };

  const removeCondition = (predictionId: string, conditionId: string) => {
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === predictionId
          ? { ...p, conditions: p.conditions.filter((c) => c.id !== conditionId) }
          : p,
      ),
    );
  };

  // ── Outcome CRUD ─────────────────────────────────────────────────────────

  const addOutcome = (predictionId: string) => {
    const newOutcome: PredictionOutcome = {
      id: nanoid(),
      description: '',
      personIds: [],
      evidence: [],
    };
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === predictionId
          ? { ...p, outcomes: [...p.outcomes, newOutcome] }
          : p,
      ),
    );
  };

  const updateOutcome = (
    predictionId: string,
    outcomeId: string,
    updates: Partial<PredictionOutcome>,
  ) => {
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === predictionId
          ? {
              ...p,
              outcomes: p.outcomes.map((o) =>
                o.id === outcomeId ? { ...o, ...updates } : o,
              ),
            }
          : p,
      ),
    );
  };

  const removeOutcome = (predictionId: string, outcomeId: string) => {
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === predictionId
          ? { ...p, outcomes: p.outcomes.filter((o) => o.id !== outcomeId) }
          : p,
      ),
    );
  };

  // ── Evidence CRUD ────────────────────────────────────────────────────────

  const addEvidence = (
    predictionId: string,
    target: 'condition' | 'outcome',
    targetId: string,
    evidence: Omit<PredictionEvidence, 'id'>,
  ) => {
    const newEvidence: PredictionEvidence = { ...evidence, id: nanoid() };
    setPredictions((prev) =>
      prev.map((p) => {
        if (p.id !== predictionId) return p;
        if (target === 'condition') {
          return {
            ...p,
            conditions: p.conditions.map((c) =>
              c.id === targetId
                ? { ...c, evidence: [...c.evidence, newEvidence] }
                : c,
            ),
          };
        }
        return {
          ...p,
          outcomes: p.outcomes.map((o) =>
            o.id === targetId
              ? { ...o, evidence: [...o.evidence, newEvidence] }
              : o,
          ),
        };
      }),
    );
  };

  const removeEvidence = (
    predictionId: string,
    target: 'condition' | 'outcome',
    targetId: string,
    evidenceId: string,
  ) => {
    setPredictions((prev) =>
      prev.map((p) => {
        if (p.id !== predictionId) return p;
        if (target === 'condition') {
          return {
            ...p,
            conditions: p.conditions.map((c) =>
              c.id === targetId
                ? { ...c, evidence: c.evidence.filter((e) => e.id !== evidenceId) }
                : c,
            ),
          };
        }
        return {
          ...p,
          outcomes: p.outcomes.map((o) =>
            o.id === targetId
              ? { ...o, evidence: o.evidence.filter((e) => e.id !== evidenceId) }
              : o,
          ),
        };
      }),
    );
  };

  return {
    predictions,
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
