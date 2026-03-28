/**
 * FunctionalFactSettingsModal — Create/Edit/Delete Functional Fact categories.
 * Each category is a simple name used to group functional fact events.
 */
import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { FunctionalFactCategoryDefinition } from '../../types';

interface FunctionalFactSettingsModalProps {
  open: boolean;
  onClose: () => void;
  categories: FunctionalFactCategoryDefinition[];
  onSave: (categories: FunctionalFactCategoryDefinition[]) => void;
}

const MODAL_Z = 12000;

const FunctionalFactSettingsModal = ({ open, onClose, categories, onSave }: FunctionalFactSettingsModalProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  if (!open) return null;

  const startAdd = () => {
    setEditingId('__new__');
    setDraftName('');
  };

  const startEdit = (cat: FunctionalFactCategoryDefinition) => {
    setEditingId(cat.id);
    setDraftName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName('');
  };

  const saveEdit = () => {
    if (!draftName.trim()) return;
    if (editingId === '__new__') {
      const newCat: FunctionalFactCategoryDefinition = {
        id: `ff-${nanoid(8)}`,
        name: draftName.trim(),
      };
      onSave([...categories, newCat]);
    } else {
      onSave(categories.map((c) => (c.id === editingId ? { ...c, name: draftName.trim() } : c)));
    }
    cancelEdit();
  };

  const deleteCategory = (id: string) => {
    onSave(categories.filter((c) => c.id !== id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: MODAL_Z,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: 16,
          borderRadius: 8,
          width: 420,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
      >
        <h4 style={{ margin: 0 }}>Functional Fact Categories</h4>
        <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
          Configure the categories available for Functional Fact events. These appear in the person right-click &quot;Add &gt; Functional Fact&quot; submenu.
        </p>

        {/* Existing categories */}
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              marginTop: 8,
              border: '1px solid #d4dae5',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {editingId === cat.id ? (
              renderEditForm()
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                    aria-label={`Edit ${cat.name}`}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#b00020' }}
                    aria-label={`Delete ${cat.name}`}
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add new / editing new */}
        {editingId === '__new__' && (
          <div
            style={{
              marginTop: 8,
              border: '1px solid #4b68a6',
              borderRadius: 8,
              padding: '8px 10px',
              background: '#f9fafb',
            }}
          >
            {renderEditForm()}
          </div>
        )}

        {categories.length === 0 && editingId === null && (
          <div style={{ marginTop: 12, color: '#888', fontSize: 13, fontStyle: 'italic' }}>
            No categories defined yet. Click &quot;+ Add Category&quot; to create one.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          {editingId === null ? (
            <button type="button" onClick={startAdd} style={{ padding: '4px 12px' }}>
              + Add Category
            </button>
          ) : (
            <div />
          )}
          <button type="button" onClick={onClose} style={{ padding: '4px 12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  function renderEditForm() {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, width: 50 }}>Name:</span>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Category name"
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
          <button type="button" onClick={cancelEdit} style={{ padding: '3px 10px', fontSize: 12 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={!draftName.trim()}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              background: '#4b68a6',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }
};

export default FunctionalFactSettingsModal;
