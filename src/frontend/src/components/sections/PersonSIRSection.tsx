/**
 * PersonSIRSection — Self in Relationship assessment tab.
 * Displays SIR event entries as cards and provides an inline form to add new entries.
 * Each entry records a person's self-management in a specific relationship interaction.
 * Rendered inside PropertiesPanel as the "Self in Rel." tab.
 */
import React, { useState } from 'react';
import type { Person, EmotionalProcessEvent, SIRCategoryDefinition } from '../../types';
const createEventId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEFAULT_OBSERVATION = '';

// ─── Styles ──────────────────────────────────────────────────────────────────

const sectionCardStyle: React.CSSProperties = {
  marginTop: 12,
  border: '1px solid #d4dae5',
  borderRadius: 8,
  background: '#fff',
  padding: '10px 12px 12px',
};

const helpBadgeStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: '1px solid #8ba1bd',
  background: '#fff',
  color: '#38557a',
  fontWeight: 700,
  fontSize: 12,
  lineHeight: '18px',
  padding: 0,
  cursor: 'pointer',
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#38557a',
  width: 70,
  flexShrink: 0,
};

const badgeStyle = (value: number, max: number): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  color: '#fff',
  background:
    value <= 1 ? '#c0392b' : value <= 2 ? '#e67e22' : value === 3 ? '#f1c40f' : value <= 4 ? '#27ae60' : '#2980b9',
  opacity: value > 0 && value <= max ? 1 : 0.3,
});

// ─── Component ────────────────────────────────────────────────────────────────

interface PersonSIRSectionProps {
  personDraft: Person;
  selectedPerson: Person;
  people: Person[];
  sirCategories: SIRCategoryDefinition[];
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  updatePersonDraftState: (updates: Partial<Person>) => void;
}

const PersonSIRSection = ({
  personDraft,
  selectedPerson,
  people,
  sirCategories,
  onUpdatePerson,
  updatePersonDraftState,
}: PersonSIRSectionProps) => {
  const [showForm, setShowForm] = useState(false);
  const [helpOpenCategory, setHelpOpenCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState(today);
  const [formOtherPerson, setFormOtherPerson] = useState('');
  const [formCategory, setFormCategory] = useState(sirCategories[0]?.name || '');
  const [formBehavior, setFormBehavior] = useState('');
  const [formIntensity, setFormIntensity] = useState(0);
  const [formStress, setFormStress] = useState(0);
  const [formHwdid, setFormHwdid] = useState(0);
  const [formNotes, setFormNotes] = useState('');

  const sirEvents = (personDraft.events || [])
    .filter((e) => e.eventType === 'SIR')
    .sort((a, b) => {
      const da = a.startDate || a.date || '';
      const db = b.startDate || b.date || '';
      return db.localeCompare(da);
    });

  const otherPersonOptions = people
    .filter((p) => p.id !== selectedPerson.id)
    .map((p) => p.name || p.id);

  const resetForm = () => {
    setFormDate(today);
    setFormOtherPerson('');
    setFormCategory(sirCategories[0]?.name || '');
    setFormBehavior('');
    setFormIntensity(0);
    setFormStress(0);
    setFormHwdid(0);
    setFormNotes('');
    setEditingId(null);
  };

  const categoryDef = sirCategories.find((c) => c.name === formCategory);

  const saveEntry = () => {
    const displayName = personDraft.name || '';
    const events = personDraft.events || [];
    const newEvent: EmotionalProcessEvent = {
      id: editingId || createEventId(),
      date: formDate,
      startDate: formDate,
      category: formCategory,
      eventType: 'SIR' as const,
      anchorType: 'PERSON' as const,
      anchorId: selectedPerson.id,
      status: 'discrete' as const,
      subtype: formBehavior,
      intensity: formIntensity,
      frequency: formStress,
      impact: 0,
      howWell: formHwdid,
      otherPersonName: formOtherPerson,
      primaryPersonName: displayName,
      wwwwh: DEFAULT_OBSERVATION,
      observations: formNotes,
      eventClass: 'individual' as const,
      createdAt: Date.now(),
    };

    const updatedEvents = editingId
      ? events.map((e) => (e.id === editingId ? newEvent : e))
      : [...events, newEvent];

    onUpdatePerson(selectedPerson.id, { events: updatedEvents });
    updatePersonDraftState({ events: updatedEvents });
    resetForm();
    setShowForm(false);
  };

  const editEntry = (event: EmotionalProcessEvent) => {
    setEditingId(event.id);
    setFormDate(event.startDate || event.date || today);
    setFormOtherPerson(event.otherPersonName || '');
    setFormCategory(event.category || sirCategories[0]?.name || '');
    setFormBehavior(event.subtype || '');
    setFormIntensity(event.intensity || 0);
    setFormStress(event.frequency || 0);
    setFormHwdid(event.howWell || 0);
    setFormNotes(event.observations || '');
    setShowForm(true);
  };

  const deleteEntry = (eventId: string) => {
    const events = (personDraft.events || []).filter((e) => e.id !== eventId);
    onUpdatePerson(selectedPerson.id, { events });
    updatePersonDraftState({ events });
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`;
    return d;
  };

  const getCategoryDef = (name: string) => sirCategories.find((c) => c.name === name);
  const getHwdidLabel = (catName: string, level: number) => {
    const def = getCategoryDef(catName);
    if (!def || level < 1 || level > 5) return '';
    return def.levels[level - 1] || '';
  };

  return (
    <div
      role="tabpanel"
      id="person-section-panel-sir"
      aria-labelledby="person-section-tab-sir"
      style={sectionCardStyle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#23324a', fontSize: 14 }}>Self in Relationship</div>
          <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 2 }}>
            Track how you manage yourself in relationships
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid #4b68a6',
            background: showForm ? '#f0f0f0' : '#4b68a6',
            color: showForm ? '#333' : '#fff',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* ── Add/Edit Form ─────────────────────────────────────────── */}
      {showForm && (
        <div
          style={{
            marginTop: 10,
            border: '1px solid #c6cfde',
            borderRadius: 8,
            background: '#f9fafb',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#23324a', fontSize: 13, marginBottom: 6 }}>
            {editingId ? 'Edit Entry' : 'New Entry'}
          </div>

          <div style={fieldRowStyle}>
            <span style={labelStyle}>Date:</span>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ flex: 1 }} />
          </div>

          <div style={fieldRowStyle}>
            <span style={labelStyle}>With:</span>
            <select
              value={formOtherPerson}
              onChange={(e) => setFormOtherPerson(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">— Select Person —</option>
              {otherPersonOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div style={fieldRowStyle}>
            <span style={labelStyle}>Category:</span>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              style={{ flex: 1 }}
            >
              {sirCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div style={fieldRowStyle}>
            <span style={labelStyle}>Behavior:</span>
            <input
              type="text"
              value={formBehavior}
              onChange={(e) => setFormBehavior(e.target.value)}
              placeholder="What happened..."
              style={{ flex: 1 }}
            />
          </div>

          <div style={fieldRowStyle}>
            <span style={labelStyle}>Intensity:</span>
            <select value={formIntensity} onChange={(e) => setFormIntensity(Number(e.target.value))} style={{ width: 50 }}>
              <option value={0}>—</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
            <span style={{ ...labelStyle, width: 50 }}>Stress:</span>
            <select value={formStress} onChange={(e) => setFormStress(Number(e.target.value))} style={{ width: 50 }}>
              <option value={0}>—</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>

          <div style={fieldRowStyle}>
            <span style={labelStyle}>HWDID:</span>
            <select value={formHwdid} onChange={(e) => setFormHwdid(Number(e.target.value))} style={{ width: 50 }}>
              <option value={0}>—</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
            <button
              type="button"
              aria-label={`${formCategory} HWDID help`}
              onClick={() => setHelpOpenCategory(helpOpenCategory === formCategory ? null : formCategory)}
              style={helpBadgeStyle}
            >
              ?
            </button>
            {formHwdid > 0 && categoryDef && (
              <span style={{ fontSize: 11, color: '#4b68a6', fontStyle: 'italic' }}>
                {categoryDef.levels[formHwdid - 1]}
              </span>
            )}
          </div>

          {/* HWDID help dialog */}
          {helpOpenCategory && categoryDef && (
            <div
              role="dialog"
              aria-label={`${formCategory} HWDID Scale`}
              style={{
                marginTop: 6,
                border: '1px solid #c6cfde',
                borderRadius: 10,
                background: '#fff',
                padding: '10px 12px',
                boxShadow: '0 10px 28px rgba(28, 41, 61, 0.16)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong style={{ fontSize: 13 }}>{formCategory} — HWDID Scale</strong>
                <button type="button" onClick={() => setHelpOpenCategory(null)} style={{ padding: '3px 8px', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {categoryDef.levels.map((levelLabel, index) => {
                  const level = index + 1;
                  const isActive = formHwdid === level;
                  return (
                    <button
                      key={levelLabel}
                      type="button"
                      onClick={() => {
                        setFormHwdid(level);
                        setHelpOpenCategory(null);
                      }}
                      style={{
                        textAlign: 'left',
                        border: `1px solid ${isActive ? '#4b68a6' : '#d4dae5'}`,
                        borderRadius: 8,
                        background: isActive ? '#eef3ff' : '#fff',
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#23324a', fontSize: 13 }}>
                        {level}. {levelLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={fieldRowStyle}>
            <span style={labelStyle}>Notes:</span>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              style={{ flex: 1, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false); }}
              style={{ padding: '4px 12px', borderRadius: 6 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEntry}
              disabled={!formCategory || !formOtherPerson}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                background: '#4b68a6',
                color: '#fff',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                opacity: !formCategory || !formOtherPerson ? 0.5 : 1,
              }}
            >
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Entry List ────────────────────────────────────────────── */}
      {sirEvents.length === 0 && !showForm && (
        <div style={{ marginTop: 16, color: '#7a8aaa', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          No entries yet. Click + Add to record a self-in-relationship observation.
        </div>
      )}

      {sirEvents.map((event) => {
        const hwdidLabel = getHwdidLabel(event.category, event.howWell);
        return (
          <div
            key={event.id}
            style={{
              marginTop: 8,
              border: '1px solid #d4dae5',
              borderRadius: 8,
              padding: '8px 10px',
              background: '#fff',
              borderLeft: '3px solid #4b68a6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#7a8aaa' }}>{formatDate(event.startDate || event.date)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#23324a' }}>{event.category}</span>
                <span style={{ fontSize: 12, color: '#555' }}>with {event.otherPersonName || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  aria-label="Edit"
                  onClick={() => editEntry(event)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => deleteEntry(event.id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                  🗑
                </button>
              </div>
            </div>

            {event.subtype && (
              <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{event.subtype}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
              {event.intensity > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#7a8aaa' }}>Int</span>
                  <span style={badgeStyle(event.intensity, 5)}>{event.intensity}</span>
                </div>
              )}
              {(event.frequency || 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#7a8aaa' }}>Str</span>
                  <span style={badgeStyle(event.frequency || 0, 5)}>{event.frequency}</span>
                </div>
              )}
              {event.howWell > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#7a8aaa' }}>HWDID</span>
                  <span style={badgeStyle(event.howWell, 5)}>{event.howWell}</span>
                  <span style={{ fontSize: 11, color: '#4b68a6', fontStyle: 'italic' }}>{hwdidLabel}</span>
                </div>
              )}
            </div>

            {event.observations && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
                {event.observations}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PersonSIRSection;
