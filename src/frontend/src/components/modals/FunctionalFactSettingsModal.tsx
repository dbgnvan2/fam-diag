/**
 * FunctionalFactSettingsModal — Create/Edit/Delete Functional Fact categories.
 * Each category is a simple name used to group functional fact events.
 */
import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import type { FunctionalFactCategoryDefinition } from '../../types';
import { moveItemUp, moveItemDown, reorderItem } from '../../utils/listReorder';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Z_INDEX } from '../../constants/zIndex';
import { categoryNameError, confirmCategoryDelete, type CategoryUsage } from '../../utils/categoryRename';

interface FunctionalFactSettingsModalProps {
  open: boolean;
  onClose: () => void;
  categories: FunctionalFactCategoryDefinition[];
  /** Who still uses a category name — a used category cannot be deleted (settings-02). */
  categoryUsage: (name: string) => CategoryUsage;
  onSave: (categories: FunctionalFactCategoryDefinition[]) => void;
}


const FunctionalFactSettingsModal = ({ open, onClose, categories, categoryUsage, onSave }: FunctionalFactSettingsModalProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
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
  };

  const startEdit = (cat: FunctionalFactCategoryDefinition) => {
    setEditingId(cat.id);
    setDraftName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNameError(null);
    setDraftName('');
  };

  const saveEdit = () => {
    // settings-07 / settings-08: no empty or duplicate names, and no name
    // that is another event type's built-in category.
    const error = categoryNameError(
      draftName,
      [...categories.filter((c) => c.id !== editingId).map((c) => c.name)],
      'FF',
    );
    if (error) {
      setNameError(error);
      return;
    }
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

  // settings-02: a category that events still use is not deleted (they
  // would be left on a name the list no longer has); otherwise ask first.
  const deleteCategory = (cat: { id: string; name: string }) => {
    if (!confirmCategoryDelete(cat.name, categoryUsage(cat.name))) return;
    onSave(categories.filter((c) => c.id !== cat.id));
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Functional fact settings"
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                  <span aria-hidden="true" title="Drag to reorder" style={{ color: '#999', userSelect: 'none' }}>⋮⋮</span>
                  {cat.name}
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
            onChange={(e) => {
              setDraftName(e.target.value);
              setNameError(null);
            }}
            placeholder="Category name"
            aria-label="Category name"
            aria-invalid={nameError ? true : undefined}
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
          />
        </div>
        {nameError && (
          <div role="alert" style={{ color: '#b00020', fontSize: 12, marginBottom: 6 }}>
            {nameError}
          </div>
        )}
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
