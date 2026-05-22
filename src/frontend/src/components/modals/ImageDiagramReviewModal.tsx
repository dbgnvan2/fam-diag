/**
 * Modal for reviewing and correcting extracted person inventory before diagram creation.
 */

import { useState } from 'react';
import type { PersonInventoryItem } from '../../utils/personInventory';
import { getConfidenceColor, getConfidenceLabel } from '../../utils/personInventory';
import { downloadInventoryCSV } from '../../utils/inventoryExport';

interface ImageDiagramReviewModalProps {
  open: boolean;
  onClose: () => void;
  inventory: PersonInventoryItem[];
  onCreateDiagram: (updatedInventory: PersonInventoryItem[]) => Promise<void>;
  isLoading?: boolean;
}

export default function ImageDiagramReviewModal({
  open,
  onClose,
  inventory,
  onCreateDiagram,
  isLoading = false,
}: ImageDiagramReviewModalProps) {
  const [items, setItems] = useState(inventory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | 'unknown'>('unknown');

  if (!open) return null;

  const lowConfidenceCount = items.filter((i) => i.extractedConfidence < 0.7).length;
  const canProceed = lowConfidenceCount === 0;

  const handleEdit = (item: PersonInventoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditGender(item.gender);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      setItems(
        items.map((item) => (item.id === editingId ? { ...item, name: editName, gender: editGender } : item))
      );
    }
    setEditingId(null);
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleCreateDiagram = async () => {
    try {
      await onCreateDiagram(items);
    } catch (err) {
      // Error will be handled by parent
    }
  };

  const handleExportCSV = () => {
    downloadInventoryCSV(items);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review extracted diagram"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2460,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 'min(95vw, 900px)',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Review Extracted Family Members</h2>
            <div style={{ marginTop: 4, fontSize: 12, color: '#5f6b7a' }}>
              {items.length} people found • {lowConfidenceCount > 0 ? `${lowConfidenceCount} need attention` : 'All ready'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              lineHeight: 1,
            }}
            aria-label="Close review modal"
          >
            ×
          </button>
        </div>

        {lowConfidenceCount > 0 && (
          <div
            style={{
              background: '#fff3e0',
              color: '#e65100',
              padding: '10px 12px',
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            ⚠️ {lowConfidenceCount} person{lowConfidenceCount !== 1 ? 's' : ''} have low confidence. Please review and correct them.
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: 12 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Name</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Gender</th>
                <th style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>Relationships</th>
                <th style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>Children</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Confidence</th>
                <th style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    background: item.extractedConfidence < 0.7 ? '#fff3e0' : '#fff',
                  }}
                >
                  {editingId === item.id ? (
                    <>
                      <td style={{ padding: 8 }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '1px solid #1976d2',
                            borderRadius: 4,
                            fontSize: 13,
                          }}
                          autoFocus
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value as any)}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '1px solid #1976d2',
                            borderRadius: 4,
                            fontSize: 13,
                          }}
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      </td>
                      <td colSpan={4} style={{ padding: 8, textAlign: 'right' }}>
                        <button
                          onClick={handleSaveEdit}
                          style={{
                            padding: '4px 8px',
                            background: '#4caf50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                            marginRight: 4,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: '4px 8px',
                            background: '#999',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: 8, fontWeight: item.extractedConfidence < 0.7 ? 600 : 400 }}>
                        {item.name}
                      </td>
                      <td style={{ padding: 8 }}>
                        {item.gender === 'male' ? '♂ Male' : item.gender === 'female' ? '♀ Female' : '? Unknown'}
                      </td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{item.relationshipCount}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{item.childrenCount}</td>
                      <td style={{ padding: 8 }}>
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: getConfidenceColor(item.extractedConfidence),
                            color: '#fff',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {getConfidenceLabel(item.extractedConfidence)}
                        </div>
                      </td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: '2px 6px',
                            background: '#1976d2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 11,
                            marginRight: 4,
                          }}
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          style={{
                            padding: '2px 6px',
                            background: '#d32f2f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button
            onClick={handleExportCSV}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            📥 Export CSV
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                borderRadius: 6,
                background: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDiagram}
              disabled={!canProceed || isLoading}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: canProceed && !isLoading ? '#4caf50' : '#ccc',
                color: '#fff',
                cursor: canProceed && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isLoading ? 'Creating...' : 'Create Diagram'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
