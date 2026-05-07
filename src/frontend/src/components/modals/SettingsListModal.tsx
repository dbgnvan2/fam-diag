import { useState } from 'react';
import { moveItemUp, moveItemDown, reorderItem } from '../../utils/listReorder';

interface SettingsListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  zIndex: number;
  items: string[];
  draft: string;
  draftPlaceholder: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onDelete?: (item: string) => void;
  onReorder?: (items: string[]) => void;
  formatItem?: (item: string) => string;
}

const SettingsListModal = ({
  open,
  onClose,
  title,
  description,
  zIndex,
  items,
  draft,
  draftPlaceholder,
  onDraftChange,
  onAdd,
  onDelete,
  onReorder,
  formatItem,
}: SettingsListModalProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (!open) return null;

  const canReorder = !!onReorder;

  const handleMoveUp = (index: number) => {
    if (!onReorder) return;
    onReorder(moveItemUp(items, index));
  };
  const handleMoveDown = (index: number) => {
    if (!onReorder) return;
    onReorder(moveItemDown(items, index));
  };
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    if (!onReorder) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    if (!onReorder) return;
    e.preventDefault();
    setOverIndex(index);
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (index: number) => (e: React.DragEvent) => {
    if (!onReorder) return;
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(reorderItem(items, draggedIndex, index));
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 400, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', pointerEvents: 'auto' }}>
        <h4>{title}</h4>
        <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>{description}</p>
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder={draftPlaceholder}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
          />
          <button onClick={onAdd} style={{ marginLeft: 6 }}>
            Add
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item, index) => (
            <li
              key={item}
              draggable={canReorder}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                borderTop: overIndex === index && draggedIndex !== index ? '2px solid #4b68a6' : '2px solid transparent',
                opacity: draggedIndex === index ? 0.5 : 1,
                cursor: canReorder ? 'grab' : 'default',
                background: draggedIndex === index ? '#f5f5f5' : 'transparent',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                {canReorder && (
                  <span
                    aria-hidden="true"
                    title="Drag to reorder"
                    style={{ color: '#999', cursor: 'grab', userSelect: 'none', marginRight: 4 }}
                  >
                    ⋮⋮
                  </span>
                )}
                <span>{formatItem ? formatItem(item) : item}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {canReorder && (
                  <>
                    <button
                      type="button"
                      aria-label={`Move ${item} up`}
                      title="Move up"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={index === 0 ? arrowBtnDisabled : arrowBtn}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item} down`}
                      title="Move down"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1}
                      style={index === items.length - 1 ? arrowBtnDisabled : arrowBtn}
                    >
                      ▼
                    </button>
                  </>
                )}
                {onDelete && (
                  <button
                    type="button"
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => onDelete(item)}
                    style={{ color: '#b00020', border: 'none', background: 'none', cursor: 'pointer', padding: '0 4px' }}
                  >
                    🗑
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsListModal;
