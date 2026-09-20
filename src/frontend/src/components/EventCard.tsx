/**
 * EventCard — unified card used in every event/symptom/pattern listing.
 * Same 13px font throughout. Only Type is bold. Intensity in a badge box.
 * SVG pencil: vertical, yellow body, red eraser.
 */
import React from 'react';

export interface EventCardProps {
  date?: string;
  type: string;
  category: string;
  subtype?: string;
  status: string;
  intensity?: number | null;
  leftBorderColor?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * A system event belongs to a relative, not to the entity whose panel this
   * is. It is shown for context and cannot be edited or deleted from here —
   * the relation label says whose it is, and editing opens it on its owner.
   * Spec: docs/implementation_plan_2026-09-19.md#M7.F.2
   */
  relationLabel?: string;
  readOnly?: boolean;
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  current:  { color: '#2a7a4a', bg: '#edfbf2', border: '#a8e0c0' },
  start:    { color: '#2a7a4a', bg: '#edfbf2', border: '#a8e0c0' },
  ongoing:  { color: '#2a7a4a', bg: '#edfbf2', border: '#a8e0c0' },
  end:      { color: '#a08060', bg: '#fdf3e3', border: '#e0c090' },
  ended:    { color: '#a08060', bg: '#fdf3e3', border: '#e0c090' },
  discrete: { color: '#a08060', bg: '#fdf3e3', border: '#e0c090' },
  past:     { color: '#a08060', bg: '#fdf3e3', border: '#e0c090' },
  none:     { color: '#7a8aaa', bg: '#f5f5f5', border: '#d0d0d0' },
};
const DEFAULT_STATUS_STYLE = { color: '#5a6a88', bg: '#f3f5f9', border: '#c8d0e0' };

const PencilIcon = () => (
  <svg
    width="10"
    height="18"
    viewBox="0 0 10 18"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    {/* eraser — red */}
    <rect x="1" y="0" width="8" height="4" rx="1" fill="#e03030" />
    {/* metal band */}
    <rect x="1" y="4" width="8" height="1.5" fill="#bbb" />
    {/* body — yellow */}
    <rect x="1" y="5.5" width="8" height="8.5" fill="#f5c200" />
    {/* tip cone */}
    <polygon points="1,14 9,14 5,18" fill="#f5c200" />
    {/* graphite tip */}
    <polygon points="3.5,16 6.5,16 5,18" fill="#555" />
  </svg>
);

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
};

const EventCard = ({
  date,
  type,
  category,
  subtype,
  status,
  intensity,
  leftBorderColor = '#4b68a6',
  onEdit,
  onDelete,
  relationLabel,
  readOnly = false,
}: EventCardProps) => {
  const sc = STATUS_STYLE[(status || '').toLowerCase()] ?? DEFAULT_STATUS_STYLE;
  const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div
      style={{
        padding: '8px 10px',
        marginBottom: 6,
        border: '1px solid #d0d8ea',
        borderLeft: `4px solid ${leftBorderColor}`,
        borderRadius: 8,
        background: readOnly ? '#f2f4f8' : '#f7f9fd',
        opacity: readOnly ? 0.9 : 1,
        fontSize: 13,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        {date && (
          <span style={{ fontSize: 13, color: '#7a8aaa', fontFamily: 'monospace' }}>{date}</span>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#23324a' }}>{type}</span>
        <span style={{ fontSize: 13, color: '#23324a' }}>{category}</span>
        {subtype && (
          <span style={{ fontSize: 13, color: '#5a6a88' }}>{subtype}</span>
        )}
        {relationLabel && (
          <span
            data-testid="event-card-relation"
            style={{
              fontSize: 12,
              color: '#4b5a78',
              background: '#e8edf6',
              border: '1px dashed #9aa7b8',
              borderRadius: 4,
              padding: '1px 6px',
            }}
          >
            {relationLabel}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: intensity != null && intensity !== 0 ? '#23324a' : '#aab4c4',
              background: '#eef2f8',
              border: '1px solid #c8d4ea',
              borderRadius: 3,
              padding: '1px 6px',
              minWidth: 20,
              textAlign: 'center',
            }}
          >
            {intensity != null && intensity !== 0 ? intensity : '—'}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: sc.color,
              background: sc.bg,
              border: `1px solid ${sc.border}`,
              borderRadius: 4,
              padding: '2px 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {statusDisplay}
          </span>
          {!readOnly && onEdit && (
            <button
              type="button"
              aria-label="Edit"
              title="Edit"
              style={actionBtnStyle}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <PencilIcon />
            </button>
          )}
          {!readOnly && onDelete && (
            <button
              type="button"
              aria-label="Delete"
              title="Delete"
              style={{ ...actionBtnStyle, fontSize: 14, color: '#b04040' }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              🗑
            </button>
          )}
          {readOnly && onEdit && (
            <button
              type="button"
              aria-label="Open on owner"
              title="Open this event on the person or family it belongs to"
              style={{ ...actionBtnStyle, fontSize: 12, color: '#4b68a6' }}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              ↗
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;
