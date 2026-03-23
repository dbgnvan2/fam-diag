/**
 * PredictionsPanel — Diagram-level prediction/hypothesis tracker.
 * Manages named Prediction Sets, each containing If→Then predictions.
 * Rendered as a fixed overlay panel, toggled from AppRibbon Options menu.
 */
import { useState } from 'react';
import type {
  EmotionalProcessEvent,
  Person,
  Prediction,
  PredictionCondition,
  PredictionConditionType,
  PredictionEvidence,
  PredictionEvidenceDirection,
  PredictionOutcome,
  PredictionSet,
  PredictionStatus,
  SIRCategoryDefinition,
} from '../types';
import { PAPERO_SUBTYPE_TO_KEY } from '../constants/eventConstants';

// ─── Styles ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PredictionStatus, string> = {
  active: '#1976d2',
  supported: '#2e7d32',
  unsupported: '#c62828',
  revised: '#f57c00',
};

const DIRECTION_COLORS: Record<PredictionEvidenceDirection, string> = {
  supports: '#2e7d32',
  contradicts: '#c62828',
  neutral: '#757575',
};

const CONDITION_TYPE_LABELS: Record<PredictionConditionType, string> = {
  sir: 'SIR',
  papero: 'Papero',
  custom: 'Custom',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: '#5a6a85',
  marginBottom: 4,
};

const miniBtn: React.CSSProperties = {
  border: '1px solid #c6cfde',
  borderRadius: 5,
  background: '#fff',
  fontSize: 11,
  padding: '2px 8px',
  cursor: 'pointer',
  color: '#38557a',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #c6cfde',
  borderRadius: 5,
  padding: '4px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface PredictionsPanelProps {
  isOpen: boolean;
  predictionSets: PredictionSet[];
  people: Person[];
  sirCategories: SIRCategoryDefinition[];
  onClose: () => void;
  onAddSet: (name: string) => string;
  onRenameSet: (setId: string, name: string) => void;
  onDeleteSet: (setId: string) => void;
  onAddPrediction: (setId: string) => string;
  onUpdatePrediction: (setId: string, predId: string, updates: Partial<Prediction>) => void;
  onDeletePrediction: (setId: string, predId: string) => void;
  onResolvePrediction: (setId: string, predId: string, status: PredictionStatus) => void;
  onAddCondition: (setId: string, predId: string, type?: PredictionConditionType) => void;
  onUpdateCondition: (setId: string, predId: string, condId: string, updates: Partial<PredictionCondition>) => void;
  onRemoveCondition: (setId: string, predId: string, condId: string) => void;
  onAddOutcome: (setId: string, predId: string) => void;
  onUpdateOutcome: (setId: string, predId: string, outcomeId: string, updates: Partial<PredictionOutcome>) => void;
  onRemoveOutcome: (setId: string, predId: string, outcomeId: string) => void;
  onAddEvidence: (setId: string, predId: string, target: 'condition' | 'outcome', targetId: string, evidence: Omit<PredictionEvidence, 'id'>) => void;
  onRemoveEvidence: (setId: string, predId: string, target: 'condition' | 'outcome', targetId: string, evidenceId: string) => void;
}

// ─── Evidence Sub-components ─────────────────────────────────────────────────

const EvidenceRow = ({
  ev,
  setId,
  predId,
  target,
  targetId,
  onRemove,
}: {
  ev: PredictionEvidence;
  setId: string;
  predId: string;
  target: 'condition' | 'outcome';
  targetId: string;
  onRemove: PredictionsPanelProps['onRemoveEvidence'];
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: DIRECTION_COLORS[ev.direction], flexShrink: 0 }} title={ev.direction} />
    <span style={{ color: '#7a8aaa', flexShrink: 0 }}>{ev.date || '—'}</span>
    <span style={{ flex: 1, color: '#333' }}>{ev.notes || ev.measurement || '—'}</span>
    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#f0f2f5', color: '#5a6a85' }}>{ev.type.replace('_', ' ')}</span>
    <button type="button" aria-label="Remove evidence" onClick={() => onRemove(setId, predId, target, targetId, ev.id)} style={{ ...miniBtn, padding: '1px 5px', color: '#c62828', border: '1px solid #e0e0e0' }}>×</button>
  </div>
);

const AddEvidenceForm = ({
  setId,
  predId,
  target,
  targetId,
  onAdd,
}: {
  setId: string;
  predId: string;
  target: 'condition' | 'outcome';
  targetId: string;
  onAdd: PredictionsPanelProps['onAddEvidence'];
}) => {
  const [open, setOpen] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [direction, setDirection] = useState<PredictionEvidenceDirection>('supports');
  const [notes, setNotes] = useState('');

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ ...miniBtn, marginTop: 4 }}>+ Evidence</button>;
  }

  const save = () => {
    onAdd(setId, predId, target, targetId, { date, type: 'observation', direction, notes });
    setNotes('');
    setDate(todayStr);
    setDirection('supports');
    setOpen(false);
  };

  return (
    <div style={{ marginTop: 4, padding: 6, background: '#f9fafb', borderRadius: 6, border: '1px solid #e4e8ee' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 130 }} />
        <select value={direction} onChange={(e) => setDirection(e.target.value as PredictionEvidenceDirection)} style={{ ...inputStyle, width: 100 }}>
          <option value="supports">Supports</option>
          <option value="contradicts">Contradicts</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>
      <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observation..." style={{ ...inputStyle, marginTop: 4 }} />
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={() => setOpen(false)} style={miniBtn}>Cancel</button>
        <button type="button" onClick={save} disabled={!notes.trim()} style={{ ...miniBtn, background: '#4b68a6', color: '#fff', border: 'none', opacity: notes.trim() ? 1 : 0.5 }}>Add</button>
      </div>
    </div>
  );
};

// ─── SIR & Papero Condition Linkers ──────────────────────────────────────────

const PAPERO_TOPICS = Object.keys(PAPERO_SUBTYPE_TO_KEY);

const getSirEventsForPerson = (person: Person | undefined): EmotionalProcessEvent[] => {
  if (!person) return [];
  return (person.events || [])
    .filter((e) => e.eventType === 'SIR')
    .sort((a, b) => (b.startDate || b.date || '').localeCompare(a.startDate || a.date || ''));
};

const formatDateShort = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return d;
};

const getPaperoScoreForPerson = (person: Person | undefined, paperoKey: string): number => {
  if (!person || !person.paperoScores) return 0;
  return (person.paperoScores as Record<string, number | undefined>)[paperoKey] || 0;
};

const SIRConditionLinker = ({
  cond,
  setId,
  predId,
  person,
  sirCategories,
  onUpdateCondition,
}: {
  cond: PredictionCondition;
  setId: string;
  predId: string;
  person: Person | undefined;
  sirCategories: SIRCategoryDefinition[];
  onUpdateCondition: PredictionsPanelProps['onUpdateCondition'];
}) => {
  const sirEvents = getSirEventsForPerson(person);
  const linkedEvent = cond.linkedEventId ? sirEvents.find((e) => e.id === cond.linkedEventId) : undefined;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#5a6a85', fontWeight: 600, flexShrink: 0 }}>SIR Category:</span>
        <select
          value={cond.linkedSIRCategory || ''}
          onChange={(e) => {
            const cat = e.target.value;
            onUpdateCondition(setId, predId, cond.id, { linkedSIRCategory: cat || undefined, linkedEventId: undefined });
          }}
          style={{ ...inputStyle, flex: 1, fontSize: 11 }}
        >
          <option value="">— Select Category —</option>
          {sirCategories.map((cat) => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>
      {cond.linkedSIRCategory && sirEvents.filter((e) => e.category === cond.linkedSIRCategory).length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#7a8aaa', fontWeight: 600 }}>Link existing SIR entry:</span>
          <div style={{ marginTop: 2, maxHeight: 100, overflowY: 'auto' }}>
            {sirEvents.filter((e) => e.category === cond.linkedSIRCategory).map((ev) => {
              const isLinked = cond.linkedEventId === ev.id;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onUpdateCondition(setId, predId, cond.id, {
                    linkedEventId: isLinked ? undefined : ev.id,
                    description: isLinked ? cond.description : cond.description || `${cond.linkedSIRCategory}: ${ev.subtype || ev.otherPersonName || ''}`.trim(),
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                    padding: '3px 6px', borderRadius: 5, border: `1px solid ${isLinked ? '#4b68a6' : '#e4e8ee'}`,
                    background: isLinked ? '#eef3ff' : '#fff', cursor: 'pointer', fontSize: 11, marginBottom: 2,
                  }}
                >
                  <span style={{ color: '#7a8aaa' }}>{formatDateShort(ev.startDate || ev.date)}</span>
                  <span style={{ color: '#333', flex: 1 }}>{ev.subtype || '—'}</span>
                  {ev.howWell > 0 && <span style={{ fontSize: 10, color: '#4b68a6' }}>HWDID:{ev.howWell}</span>}
                  {ev.otherPersonName && <span style={{ fontSize: 10, color: '#888' }}>w/ {ev.otherPersonName}</span>}
                  {isLinked && <span style={{ color: '#4b68a6', fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {linkedEvent && (
        <div style={{ fontSize: 11, color: '#4b68a6', fontStyle: 'italic', marginBottom: 4 }}>
          Linked to SIR: {linkedEvent.category} — {linkedEvent.subtype || 'no behavior'} ({formatDateShort(linkedEvent.startDate || linkedEvent.date)})
        </div>
      )}
    </div>
  );
};

const PaperoConditionLinker = ({
  cond,
  setId,
  predId,
  person,
  onUpdateCondition,
}: {
  cond: PredictionCondition;
  setId: string;
  predId: string;
  person: Person | undefined;
  onUpdateCondition: PredictionsPanelProps['onUpdateCondition'];
}) => {
  const currentScore = cond.linkedPaperoKey ? getPaperoScoreForPerson(person, cond.linkedPaperoKey) : 0;
  const linkedTopicName = cond.linkedPaperoKey
    ? Object.entries(PAPERO_SUBTYPE_TO_KEY).find(([, v]) => v === cond.linkedPaperoKey)?.[0] || ''
    : '';

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#5a6a85', fontWeight: 600, flexShrink: 0 }}>Papero Topic:</span>
        <select
          value={cond.linkedPaperoKey || ''}
          onChange={(e) => {
            const key = e.target.value;
            const topicName = key ? Object.entries(PAPERO_SUBTYPE_TO_KEY).find(([, v]) => v === key)?.[0] || '' : '';
            onUpdateCondition(setId, predId, cond.id, {
              linkedPaperoKey: key || undefined,
              description: cond.description || (topicName ? `Improve ${topicName}` : ''),
            });
          }}
          style={{ ...inputStyle, flex: 1, fontSize: 11 }}
        >
          <option value="">— Select Topic —</option>
          {PAPERO_TOPICS.map((topic) => (
            <option key={PAPERO_SUBTYPE_TO_KEY[topic]} value={PAPERO_SUBTYPE_TO_KEY[topic]}>{topic}</option>
          ))}
        </select>
      </div>
      {cond.linkedPaperoKey && (
        <div style={{ fontSize: 11, color: '#4b68a6', fontStyle: 'italic', marginBottom: 4 }}>
          {linkedTopicName}: current score = {currentScore > 0 ? `${currentScore}/5` : 'unset'}
        </div>
      )}
    </div>
  );
};

// ─── Prediction Card ─────────────────────────────────────────────────────────

const PredictionCard = ({
  prediction,
  setId,
  people,
  sirCategories,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onResolve,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  onAddOutcome,
  onUpdateOutcome,
  onRemoveOutcome,
  onAddEvidence,
  onRemoveEvidence,
}: {
  prediction: Prediction;
  setId: string;
  people: Person[];
  sirCategories: SIRCategoryDefinition[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: PredictionsPanelProps['onUpdatePrediction'];
  onDelete: PredictionsPanelProps['onDeletePrediction'];
  onResolve: PredictionsPanelProps['onResolvePrediction'];
  onAddCondition: PredictionsPanelProps['onAddCondition'];
  onUpdateCondition: PredictionsPanelProps['onUpdateCondition'];
  onRemoveCondition: PredictionsPanelProps['onRemoveCondition'];
  onAddOutcome: PredictionsPanelProps['onAddOutcome'];
  onUpdateOutcome: PredictionsPanelProps['onUpdateOutcome'];
  onRemoveOutcome: PredictionsPanelProps['onRemoveOutcome'];
  onAddEvidence: PredictionsPanelProps['onAddEvidence'];
  onRemoveEvidence: PredictionsPanelProps['onRemoveEvidence'];
}) => {
  const p = prediction;
  const statusColor = STATUS_COLORS[p.status];

  return (
    <div style={{ border: '1px solid #d4dae5', borderRadius: 10, background: '#fff', marginBottom: 10, borderLeft: `3px solid ${statusColor}` }}>
      {/* Header */}
      <div
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      >
        <span style={{ fontSize: 12, color: '#7a8aaa', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#23324a' }}>{p.title || 'Untitled Prediction'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: statusColor, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.status}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          {/* Title */}
          <input type="text" value={p.title} onChange={(e) => onUpdate(setId, p.id, { title: e.target.value })} placeholder="Prediction title..." style={{ ...inputStyle, fontWeight: 600, fontSize: 14, marginBottom: 8 }} />

          {/* Status + Delete */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5a6a85' }}>Status:</span>
            <select value={p.status} onChange={(e) => onResolve(setId, p.id, e.target.value as PredictionStatus)} style={{ ...inputStyle, width: 130 }}>
              <option value="active">Active</option>
              <option value="supported">Supported</option>
              <option value="unsupported">Unsupported</option>
              <option value="revised">Revised</option>
            </select>
            <button type="button" aria-label="Delete prediction" onClick={() => onDelete(setId, p.id)} style={{ ...miniBtn, color: '#c62828', marginLeft: 'auto' }}>🗑 Delete</button>
          </div>

          {/* IF (Conditions) */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ ...sectionLabel, color: '#1976d2' }}>IF (Conditions)</div>
            {p.conditions.map((cond, idx) => (
              <div key={cond.id} style={{ padding: '8px 10px', background: '#f5f8ff', borderRadius: 8, border: '1px solid #dce4f0', marginBottom: 6 }}>
                {idx > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', marginBottom: 4 }}>AND</div>}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <select value={cond.type} onChange={(e) => onUpdateCondition(setId, p.id, cond.id, { type: e.target.value as PredictionConditionType })} style={{ ...inputStyle, width: 90, fontSize: 11 }}>
                    {Object.entries(CONDITION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {(cond.type === 'sir' || cond.type === 'papero') && (
                    <select value={cond.personId || ''} onChange={(e) => onUpdateCondition(setId, p.id, cond.id, { personId: e.target.value || undefined })} style={{ ...inputStyle, width: 130, fontSize: 11 }}>
                      <option value="">— Person —</option>
                      {people.map((person) => <option key={person.id} value={person.id}>{person.name || person.id}</option>)}
                    </select>
                  )}
                  <button type="button" aria-label="Remove condition" onClick={() => onRemoveCondition(setId, p.id, cond.id)} style={{ ...miniBtn, color: '#c62828', padding: '1px 6px' }}>×</button>
                </div>
                {cond.type === 'sir' && cond.personId && (
                  <SIRConditionLinker cond={cond} setId={setId} predId={p.id} person={people.find((pp) => pp.id === cond.personId)} sirCategories={sirCategories} onUpdateCondition={onUpdateCondition} />
                )}
                {cond.type === 'papero' && cond.personId && (
                  <PaperoConditionLinker cond={cond} setId={setId} predId={p.id} person={people.find((pp) => pp.id === cond.personId)} onUpdateCondition={onUpdateCondition} />
                )}
                <input type="text" value={cond.description} onChange={(e) => onUpdateCondition(setId, p.id, cond.id, { description: e.target.value })} placeholder={cond.type === 'sir' ? 'Goal or expected change...' : cond.type === 'papero' ? 'Expected improvement...' : 'Describe the condition...'} style={inputStyle} />
                {cond.evidence.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: '#7a8aaa', fontWeight: 600, marginBottom: 2 }}>Evidence:</div>
                    {cond.evidence.map((ev) => <EvidenceRow key={ev.id} ev={ev} setId={setId} predId={p.id} target="condition" targetId={cond.id} onRemove={onRemoveEvidence} />)}
                  </div>
                )}
                <AddEvidenceForm setId={setId} predId={p.id} target="condition" targetId={cond.id} onAdd={onAddEvidence} />
              </div>
            ))}
            <button type="button" onClick={() => onAddCondition(setId, p.id)} style={{ ...miniBtn, marginTop: 2 }}>+ Add Condition</button>
          </div>

          {/* THEN (Outcomes) */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ ...sectionLabel, color: '#2e7d32' }}>THEN (Outcomes)</div>
            {p.outcomes.map((out) => (
              <div key={out.id} style={{ padding: '8px 10px', background: '#f5fff5', borderRadius: 8, border: '1px solid #d0e8d0', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <input type="text" value={out.description} onChange={(e) => onUpdateOutcome(setId, p.id, out.id, { description: e.target.value })} placeholder="Expected outcome..." style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" aria-label="Remove outcome" onClick={() => onRemoveOutcome(setId, p.id, out.id)} style={{ ...miniBtn, color: '#c62828', padding: '1px 6px' }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !out.personIds.includes(e.target.value)) {
                        onUpdateOutcome(setId, p.id, out.id, { personIds: [...out.personIds, e.target.value] });
                      }
                    }}
                    style={{ ...inputStyle, width: 130, fontSize: 11 }}
                  >
                    <option value="">+ Person affected</option>
                    {people.filter((pp) => !out.personIds.includes(pp.id)).map((pp) => <option key={pp.id} value={pp.id}>{pp.name || pp.id}</option>)}
                  </select>
                  {out.personIds.map((pid) => {
                    const person = people.find((pp) => pp.id === pid);
                    return (
                      <span key={pid} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 10, background: '#e0f0e0', color: '#2e7d32', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {person?.name || pid}
                        <button type="button" onClick={() => onUpdateOutcome(setId, p.id, out.id, { personIds: out.personIds.filter((x) => x !== pid) })} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#666', padding: 0 }}>×</button>
                      </span>
                    );
                  })}
                </div>
                {out.evidence.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: '#7a8aaa', fontWeight: 600, marginBottom: 2 }}>Evidence:</div>
                    {out.evidence.map((ev) => <EvidenceRow key={ev.id} ev={ev} setId={setId} predId={p.id} target="outcome" targetId={out.id} onRemove={onRemoveEvidence} />)}
                  </div>
                )}
                <AddEvidenceForm setId={setId} predId={p.id} target="outcome" targetId={out.id} onAdd={onAddEvidence} />
              </div>
            ))}
            <button type="button" onClick={() => onAddOutcome(setId, p.id)} style={{ ...miniBtn, marginTop: 2 }}>+ Add Outcome</button>
          </div>

          {/* Notes */}
          <div>
            <div style={sectionLabel}>Notes</div>
            <textarea value={p.notes} onChange={(e) => onUpdate(setId, p.id, { notes: e.target.value })} placeholder="Additional notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Panel ──────────────────────────────────────────────────────────────

const PredictionsPanel = ({
  isOpen,
  predictionSets,
  people,
  sirCategories,
  onClose,
  onAddSet,
  onRenameSet,
  onDeleteSet,
  onAddPrediction,
  onUpdatePrediction,
  onDeletePrediction,
  onResolvePrediction,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  onAddOutcome,
  onUpdateOutcome,
  onRemoveOutcome,
  onAddEvidence,
  onRemoveEvidence,
}: PredictionsPanelProps) => {
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newSetName, setNewSetName] = useState('');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState('');

  if (!isOpen) return null;

  const activeSet = activeSetId ? predictionSets.find((s) => s.id === activeSetId) : null;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSet = () => {
    const name = newSetName.trim() || 'New Prediction Set';
    const id = onAddSet(name);
    setNewSetName('');
    setActiveSetId(id);
  };

  const handleAddPrediction = () => {
    if (!activeSetId) return;
    const predId = onAddPrediction(activeSetId);
    setExpandedIds((prev) => new Set(prev).add(predId));
  };

  // ── Set List View ─────────────────────────────────────────────────────────
  if (!activeSet) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2250 }}>
        <div style={{ width: 480, maxHeight: '85vh', background: '#fff', borderRadius: 12, boxShadow: '0 18px 45px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#23324a' }}>Prediction Sets</div>
              <div style={{ fontSize: 12, color: '#666' }}>Create and manage named prediction sets</div>
            </div>
            <button onClick={onClose} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }} aria-label="Close predictions panel">×</button>
          </div>

          {/* Create new set */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSet(); }}
              placeholder="New set name..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="button" onClick={handleCreateSet} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#4b68a6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Create</button>
          </div>

          {/* Set list */}
          <div style={{ padding: '12px 18px', flex: 1, overflowY: 'auto' }}>
            {predictionSets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#7a8aaa', fontSize: 13 }}>
                No prediction sets yet. Create one above.
              </div>
            )}
            {predictionSets.map((s) => (
              <div
                key={s.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: '1px solid #d4dae5', marginBottom: 8, background: '#fff' }}
              >
                {editingSetId === s.id ? (
                  <>
                    <input
                      type="text"
                      value={editingSetName}
                      onChange={(e) => setEditingSetName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { onRenameSet(s.id, editingSetName); setEditingSetId(null); } }}
                      style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                      autoFocus
                    />
                    <button type="button" onClick={() => { onRenameSet(s.id, editingSetName); setEditingSetId(null); }} style={{ ...miniBtn, background: '#4b68a6', color: '#fff', border: 'none' }}>Save</button>
                    <button type="button" onClick={() => setEditingSetId(null)} style={miniBtn}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveSetId(s.id)}
                      style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#23324a' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#7a8aaa' }}>
                        {s.predictions.length} prediction{s.predictions.length !== 1 ? 's' : ''} · Created {s.createdDate}
                      </div>
                    </button>
                    <button type="button" aria-label="Edit set name" onClick={() => { setEditingSetId(s.id); setEditingSetName(s.name); }} style={miniBtn}>✏️</button>
                    <button type="button" aria-label="Delete set" onClick={() => { if (activeSetId === s.id) setActiveSetId(null); onDeleteSet(s.id); }} style={{ ...miniBtn, color: '#c62828' }}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Active Set View (predictions list) ─────────────────────────────────────
  const activePredictions = activeSet.predictions.filter((p) => p.status === 'active');
  const resolvedPredictions = activeSet.predictions.filter((p) => p.status !== 'active');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2250 }}>
      <div style={{ width: 560, maxHeight: '90vh', background: '#fff', borderRadius: 12, boxShadow: '0 18px 45px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => setActiveSetId(null)} style={{ ...miniBtn, padding: '3px 8px' }} aria-label="Back to sets">← Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#23324a' }}>{activeSet.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{activeSet.predictions.length} prediction{activeSet.predictions.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={handleAddPrediction} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#4b68a6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New</button>
            <button onClick={onClose} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }} aria-label="Close predictions panel">×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 18px', flex: 1, overflowY: 'auto' }}>
          {activeSet.predictions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#7a8aaa', fontSize: 13 }}>
              No predictions in this set. Click + New to add one.
            </div>
          )}

          {activePredictions.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginBottom: 8 }}>Active ({activePredictions.length})</div>
              {activePredictions.map((pred) => (
                <PredictionCard
                  key={pred.id}
                  prediction={pred}
                  setId={activeSet.id}
                  people={people}
                  sirCategories={sirCategories}
                  expanded={expandedIds.has(pred.id)}
                  onToggle={() => toggleExpanded(pred.id)}
                  onUpdate={onUpdatePrediction}
                  onDelete={onDeletePrediction}
                  onResolve={onResolvePrediction}
                  onAddCondition={onAddCondition}
                  onUpdateCondition={onUpdateCondition}
                  onRemoveCondition={onRemoveCondition}
                  onAddOutcome={onAddOutcome}
                  onUpdateOutcome={onUpdateOutcome}
                  onRemoveOutcome={onRemoveOutcome}
                  onAddEvidence={onAddEvidence}
                  onRemoveEvidence={onRemoveEvidence}
                />
              ))}
            </>
          )}

          {resolvedPredictions.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginTop: 12, marginBottom: 8 }}>Resolved ({resolvedPredictions.length})</div>
              {resolvedPredictions.map((pred) => (
                <PredictionCard
                  key={pred.id}
                  prediction={pred}
                  setId={activeSet.id}
                  people={people}
                  sirCategories={sirCategories}
                  expanded={expandedIds.has(pred.id)}
                  onToggle={() => toggleExpanded(pred.id)}
                  onUpdate={onUpdatePrediction}
                  onDelete={onDeletePrediction}
                  onResolve={onResolvePrediction}
                  onAddCondition={onAddCondition}
                  onUpdateCondition={onUpdateCondition}
                  onRemoveCondition={onRemoveCondition}
                  onAddOutcome={onAddOutcome}
                  onUpdateOutcome={onUpdateOutcome}
                  onRemoveOutcome={onRemoveOutcome}
                  onAddEvidence={onAddEvidence}
                  onRemoveEvidence={onRemoveEvidence}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictionsPanel;
