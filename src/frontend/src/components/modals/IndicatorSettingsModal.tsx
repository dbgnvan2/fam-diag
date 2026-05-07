import { useState } from 'react';
import type { FunctionalIndicatorDefinition, SymptomGroup } from '../../types';

interface IndicatorSettingsModalProps {
  open: boolean;
  onClose: () => void;
  definitions: FunctionalIndicatorDefinition[];
  draftLabel: string;
  onDraftLabelChange: (label: string) => void;
  onAdd: () => void;
  onAddForGroup: (group: SymptomGroup) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateGroup: (id: string, group: SymptomGroup) => void;
  onUpdateColor: (id: string, color: string) => void;
  onUpdateIcon: (id: string, file: File) => void;
  onUpdateUseLetter: (id: string, useLetter: boolean) => void;
  onClearIcon: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (definitions: FunctionalIndicatorDefinition[]) => void;
  onSaveAsDefault: (definitions: FunctionalIndicatorDefinition[]) => void;
}

const GROUPS: { key: SymptomGroup; label: string; color: string; bg: string }[] = [
  { key: 'physical',  label: 'Physical',  color: '#1f77b4', bg: '#e8f2fc' },
  { key: 'emotional', label: 'Emotional', color: '#d81b60', bg: '#fce8f1' },
  { key: 'social',    label: 'Social',    color: '#2e7d32', bg: '#e8f5e9' },
];

const IndicatorSettingsModal = ({
  open,
  onClose,
  definitions,
  onAddForGroup,
  onUpdateLabel,
  onUpdateColor,
  onUpdateIcon,
  onUpdateUseLetter,
  onClearIcon,
  onRemove,
  onReorder,
  onSaveAsDefault,
}: IndicatorSettingsModalProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!open) return null;

  const swapByIds = (idA: string, idB: string) => {
    const indexA = definitions.findIndex((d) => d.id === idA);
    const indexB = definitions.findIndex((d) => d.id === idB);
    if (indexA === -1 || indexB === -1) return;
    const next = [...definitions];
    [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
    onReorder(next);
  };

  const moveDefUp = (def: FunctionalIndicatorDefinition, groupKey: SymptomGroup) => {
    const fullIndex = definitions.findIndex((d) => d.id === def.id);
    let prevId: string | null = null;
    for (let i = fullIndex - 1; i >= 0; i--) {
      if ((definitions[i].group || 'physical') === groupKey) {
        prevId = definitions[i].id;
        break;
      }
    }
    if (prevId) swapByIds(def.id, prevId);
  };
  const moveDefDown = (def: FunctionalIndicatorDefinition, groupKey: SymptomGroup) => {
    const fullIndex = definitions.findIndex((d) => d.id === def.id);
    let nextId: string | null = null;
    for (let i = fullIndex + 1; i < definitions.length; i++) {
      if ((definitions[i].group || 'physical') === groupKey) {
        nextId = definitions[i].id;
        break;
      }
    }
    if (nextId) swapByIds(def.id, nextId);
  };
  const dropOn = (targetId: string, groupKey: SymptomGroup) => {
    if (!draggedId || draggedId === targetId) return;
    const dragged = definitions.find((d) => d.id === draggedId);
    if (!dragged) return;
    if ((dragged.group || 'physical') !== groupKey) return; // only reorder within same group
    const fromIndex = definitions.findIndex((d) => d.id === draggedId);
    const toIndex = definitions.findIndex((d) => d.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...definitions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
  };

  const arrowBtn: React.CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '0 4px',
    fontSize: 14,
  };
  const arrowBtnDisabled: React.CSSProperties = { ...arrowBtn, opacity: 0.25, cursor: 'not-allowed' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2050,
        pointerEvents: 'none',
      }}
    >
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 560, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)', overflow: 'auto', pointerEvents: 'auto' }}>
        <h4 style={{ margin: '0 0 4px' }}>Symptom Categories &amp; Types</h4>
        <p style={{ marginTop: 4, marginBottom: 12, color: '#555', fontSize: 13 }}>
          Physical, Emotional, and Social are the fixed categories. Add named types within each category — types appear in the person properties panel.
        </p>

        {GROUPS.map((group) => {
          const groupDefs = definitions.filter((d) => (d.group || 'physical') === group.key);
          return (
            <div
              key={group.key}
              style={{ marginBottom: 16, border: `1px solid ${group.color}44`, borderRadius: 8, overflow: 'hidden' }}
            >
              {/* Section header */}
              <div
                style={{
                  background: group.bg,
                  borderBottom: `1px solid ${group.color}44`,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700, color: group.color, fontSize: 14 }}>{group.label}</span>
                <button
                  type="button"
                  onClick={() => onAddForGroup(group.key)}
                  style={{
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 4,
                    border: `1px solid ${group.color}`,
                    background: 'white',
                    color: group.color,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  + Add {group.label} Type
                </button>
              </div>

              {/* Type rows */}
              {groupDefs.length === 0 ? (
                <div style={{ padding: '8px 12px', fontStyle: 'italic', color: '#888', fontSize: 13 }}>
                  No types defined yet.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: '8px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupDefs.map((def, groupIndex) => (
                    <li
                      key={def.id}
                      draggable
                      onDragStart={(e) => { setDraggedId(def.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => { e.preventDefault(); setOverId(def.id); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => { e.preventDefault(); dropOn(def.id, group.key); setDraggedId(null); setOverId(null); }}
                      onDragEnd={() => { setDraggedId(null); setOverId(null); }}
                      style={{
                        border: overId === def.id && draggedId !== def.id ? '2px solid #4b68a6' : '1px solid #e0e0e0',
                        borderRadius: 6,
                        padding: 8,
                        background: draggedId === def.id ? '#f5f5f5' : '#fdfdfd',
                        opacity: draggedId === def.id ? 0.5 : 1,
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span aria-hidden="true" title="Drag to reorder" style={{ color: '#999', userSelect: 'none' }}>⋮⋮</span>
                        <button
                          type="button"
                          aria-label={`Move ${def.label} up`}
                          title="Move up"
                          onClick={() => moveDefUp(def, group.key)}
                          disabled={groupIndex === 0}
                          style={groupIndex === 0 ? arrowBtnDisabled : arrowBtn}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${def.label} down`}
                          title="Move down"
                          onClick={() => moveDefDown(def, group.key)}
                          disabled={groupIndex === groupDefs.length - 1}
                          style={groupIndex === groupDefs.length - 1 ? arrowBtnDisabled : arrowBtn}
                        >
                          ▼
                        </button>
                        {/* Icon preview */}
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: def.color ? `${def.color}22` : '#fff',
                            flexShrink: 0,
                            fontSize: 15,
                            fontWeight: 700,
                            color: def.color || '#444',
                          }}
                        >
                          {def.iconDataUrl && !def.useLetter ? (
                            <img src={def.iconDataUrl} alt={`${def.label} icon`} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                          ) : (
                            (def.label.trim().charAt(0) || '?').toUpperCase()
                          )}
                        </div>

                        {/* Label */}
                        <input
                          type="text"
                          value={def.label}
                          onChange={(e) => onUpdateLabel(def.id, e.target.value)}
                          style={{ flex: 1, fontSize: 13 }}
                        />

                        {/* Color */}
                        <input
                          type="color"
                          aria-label={`Color for ${def.label}`}
                          value={def.color || '#666666'}
                          onChange={(e) => onUpdateColor(def.id, e.target.value)}
                          style={{ width: 34, height: 28, padding: 2, borderRadius: 4, border: '1px solid #ccc' }}
                        />

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => onRemove(def.id)}
                          style={{ color: '#b00020', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                          aria-label={`Remove ${def.label}`}
                        >
                          ×
                        </button>
                      </div>

                      {/* Icon row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12 }}>
                        <label>Image:</label>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ fontSize: 11 }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void onUpdateIcon(def.id, file);
                          }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <input
                            type="checkbox"
                            checked={def.useLetter ?? !def.iconDataUrl}
                            onChange={(e) => onUpdateUseLetter(def.id, e.target.checked)}
                          />
                          Use Letter
                        </label>
                        {def.iconDataUrl && (
                          <button type="button" onClick={() => onClearIcon(def.id)} style={{ fontSize: 11 }}>
                            Clear Image
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <button
            type="button"
            onClick={() => onSaveAsDefault(definitions)}
            style={{
              fontSize: 12,
              padding: '5px 12px',
              borderRadius: 4,
              border: '1px solid #7b6a1e',
              background: '#fffde7',
              color: '#5a4a0a',
              cursor: 'pointer',
            }}
            title="Download an updated PRODUCT_DEFAULT.diagram.json with these symptom types"
          >
            Save as App Default ↓
          </button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default IndicatorSettingsModal;
