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
  formatItem,
}: SettingsListModalProps) => {
  if (!open) return null;
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
      }}
    >
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 360 }}>
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
          {items.map((item) => (
            <li key={item} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{formatItem ? formatItem(item) : item}</span>
              {onDelete && (
                <button
                  type="button"
                  aria-label="Delete"
                  title="Delete"
                  onClick={() => onDelete(item)}
                  style={{ color: '#b00020' }}
                >
                  🗑
                </button>
              )}
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
