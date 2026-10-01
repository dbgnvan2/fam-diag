/**
 * SIRSettingsModal — Create/Edit/Delete Self in Relationship categories.
 * Each category has a name and 5-level HWDID scale descriptions.
 */
import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import type { SIRCategoryDefinition } from '../../types';
import { moveItemUp, moveItemDown, reorderItem } from '../../utils/listReorder';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Z_INDEX } from '../../constants/zIndex';
import { categoryNameError, confirmCategoryDelete, type CategoryUsage } from '../../utils/categoryRename';

interface SIRSettingsModalProps {
  open: boolean;
  onClose: () => void;
  categories: SIRCategoryDefinition[];
  /** Who still uses a category name — a used category cannot be deleted (settings-02). */
  categoryUsage: (name: string) => CategoryUsage;
  onSave: (categories: SIRCategoryDefinition[]) => void;
}


const SIRSettingsModal = ({ open, onClose, categories, categoryUsage, onSave }: SIRSettingsModalProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftLevels, setDraftLevels] = useState<[string, string, string, string, string]>(['', '', '', '', '']);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // settings-05: closing the dialog drops an unfinished edit. It used to
  // reopen with the old edit form and draft still showing.
  useEffect(() => {
    if (open) return;
    setEditingId(null);
    setDraftName('');
    setNameError(null);
    setDraftLevels(['', '', '', '', '']);
  }, [open]);

  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;

  const handleMoveUp = (index: number) => onSave(moveItemUp(categories, index));
  const handleMoveDown = (index: number) => onSave(moveItemDown(categories, index));
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setOverIndex(index);
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onSave(reorderItem(categories, draggedIndex, index));
    }
    setDraggedIndex(null);
    setOverIndex(null);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  const arrowBtn: React.CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '0 4px',
    fontSize: 14,
  };
  const arrowBtnDisabled: React.CSSProperties = { ...arrowBtn, opacity: 0.25, cursor: 'not-allowed' };

  const startAdd = () => {
    setEditingId('__new__');
    setDraftName('');
    setDraftLevels(['', '', '', '', '']);
  };

  const startEdit = (cat: SIRCategoryDefinition) => {
    setEditingId(cat.id);
    setDraftName(cat.name);
    setDraftLevels([...cat.levels]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNameError(null);
    setDraftName('');
    setDraftLevels(['', '', '', '', '']);
  };

  const saveEdit = () => {
    // settings-07 / settings-08: no empty or duplicate names, and no name
    // that is another event type's built-in category.
    const error = categoryNameError(
      draftName,
      [...categories.filter((c) => c.id !== editingId).map((c) => c.name)],
      'SIR',
    );
    if (error) {
      setNameError(error);
      return;
    }
    const trimmedLevels = draftLevels.map((l, index) => l.trim() || `Level ${index + 1}`) as [string, string, string, string, string];
    if (editingId === '__new__') {
      const newCat: SIRCategoryDefinition = {
        id: `sir-${nanoid(8)}`,
        name: draftName.trim(),
        levels: trimmedLevels,
      };
      onSave([...categories, newCat]);
    } else {
      onSave(categories.map((c) => (c.id === editingId ? { ...c, name: draftName.trim(), levels: trimmedLevels } : c)));
    }
    cancelEdit();
  };

  // settings-02: a category that events still use is not deleted (they
  // would be left on a name the list no longer has); otherwise ask first.
  const deleteCategory = (cat: { id: string; name: string }) => {
    if (!confirmCategoryDelete(cat.name, categoryUsage(cat.name))) return;
    onSave(categories.filter((c) => c.id !== cat.id));
  };

  const setLevelText = (index: number, value: string) => {
    const next = [...draftLevels] as [string, string, string, string, string];
    next[index] = value;
    setDraftLevels(next);
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="SIR settings"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.SETTINGS_CATEGORY_DIALOG,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: 16,
          borderRadius: 8,
          width: 480,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
      >
        <h4 style={{ margin: 0 }}>Self in Relationship Categories</h4>
        <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
          Configure the categories and their 5-level HWDID (How Well Did I Do) scales.
        </p>

        {/* Existing categories */}
        {categories.map((cat, index) => (
          <div
            key={cat.id}
            draggable={editingId === null}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            style={{
              marginTop: 8,
              border: overIndex === index && draggedIndex !== index ? '2px solid #4b68a6' : '1px solid #d4dae5',
              borderRadius: 8,
              padding: '8px 10px',
              opacity: draggedIndex === index ? 0.5 : 1,
              cursor: editingId === null ? 'grab' : 'default',
              background: draggedIndex === index ? '#f5f5f5' : 'transparent',
            }}
          >
            {editingId === cat.id ? (
              renderEditForm()
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span aria-hidden="true" title="Drag to reorder" style={{ color: '#999', userSelect: 'none', marginTop: 1 }}>⋮⋮</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</div>
                    <div style={{ fontSize: 11, color: '#7a8aaa', marginTop: 2 }}>
                      {cat.levels[0]} → {cat.levels[4]}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    type="button"
                    aria-label={`Move ${cat.name} up`}
                    title="Move up"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    style={index === 0 ? arrowBtnDisabled : arrowBtn}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${cat.name} down`}
                    title="Move down"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === categories.length - 1}
                    style={index === categories.length - 1 ? arrowBtnDisabled : arrowBtn}
                  >
                    ▼
                  </button>
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
                    onClick={() => deleteCategory(cat)}
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
            onChange={(e) => {
              setDraftName(e.target.value);
              setNameError(null);
            }}
            placeholder="Category name"
            aria-label="Category name"
            aria-invalid={nameError ? true : undefined}
            style={{ flex: 1 }}
          />
        </div>
        {nameError && (
          <div role="alert" style={{ color: '#b00020', fontSize: 12, marginBottom: 6 }}>
            {nameError}
          </div>
        )}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, width: 50, color: '#38557a' }}>Level {i + 1}:</span>
            <input
              type="text"
              value={draftLevels[i]}
              onChange={(e) => setLevelText(i, e.target.value)}
              placeholder={`Level ${i + 1} description`}
              style={{ flex: 1, fontSize: 12 }}
            />
          </div>
        ))}
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

export default SIRSettingsModal;
