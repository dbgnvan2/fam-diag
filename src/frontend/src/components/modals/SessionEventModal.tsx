import type { CSSProperties } from 'react';
import type { EmotionalProcessEvent, EventClass } from '../../types';
import { EVENT_STATUS_OPTIONS, EVENT_TYPE_LABELS } from '../../constants/eventConstants';
import DatePickerField from '../DatePickerField';

interface SessionEventModalProps {
  open: boolean;
  draft: EmotionalProcessEvent | null;
  eventClass: EventClass;
  primaryOptions: string[];
  otherOptions: string[];
  eventCategories: string[];
  onFieldChange: (field: keyof EmotionalProcessEvent, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 8,
};
const labelStyle: CSSProperties = { width: 170, textAlign: 'right', fontWeight: 600 };
const controlStyle: CSSProperties = { width: '60%' };

const SessionEventModal = ({
  open,
  draft,
  eventClass,
  primaryOptions,
  otherOptions,
  eventCategories,
  onFieldChange,
  onCancel,
  onSave,
}: SessionEventModalProps) => {
  if (!open || !draft) return null;
  const typeLabel = EVENT_TYPE_LABELS[draft.eventType] || draft.eventType;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2300,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: 420 }}>
        <h4 style={{ marginTop: 0 }}>Session Note Event</h4>
        <div style={rowStyle}>
          <label style={labelStyle}>Event Group:</label>
          <div style={{ ...controlStyle, textAlign: 'left' }}>{typeLabel}</div>
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Event Class:</label>
          <div style={{ ...controlStyle, textAlign: 'left' }}>{draft.eventClass || eventClass}</div>
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventPrimaryPerson" style={labelStyle}>Primary Person:</label>
          <div style={controlStyle}>
            <input
              type="text"
              id="sessionEventPrimaryPerson"
              value={draft.primaryPersonName || ''}
              onChange={(e) => onFieldChange('primaryPersonName', e.target.value)}
              list="session-event-primary-person"
              style={{ width: '100%' }}
            />
            <datalist id="session-event-primary-person">
              {primaryOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventDate" style={labelStyle}>Date:</label>
          <div style={controlStyle}>
            <DatePickerField
              id="sessionEventDate"
              name="sessionEventDate"
              value={draft.date}
              placeholder="YYYY-MM-DD"
              onChange={(e) => onFieldChange('date', e.target.value)}
              buttonLabel="Select session event date"
            />
          </div>
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventCategory" style={labelStyle}>Category:</label>
          <select
            id="sessionEventCategory"
            value={draft.category}
            onChange={(e) => onFieldChange('category', e.target.value)}
            style={controlStyle}
          >
            {eventCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventStatus" style={labelStyle}>Status:</label>
          <select
            id="sessionEventStatus"
            value={draft.status || 'discrete'}
            onChange={(e) => onFieldChange('status', e.target.value)}
            style={controlStyle}
          >
            {EVENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventIntensity" style={labelStyle}>Intensity (1-10):</label>
          <input
            type="number"
            id="sessionEventIntensity"
            min={1}
            max={10}
            value={draft.intensity}
            onChange={(e) => onFieldChange('intensity', e.target.value)}
            style={controlStyle}
          />
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventHowWell" style={labelStyle}>How well (1-9):</label>
          <input
            type="number"
            id="sessionEventHowWell"
            min={1}
            max={9}
            value={draft.howWell}
            onChange={(e) => onFieldChange('howWell', e.target.value)}
            style={controlStyle}
          />
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventOtherPerson" style={labelStyle}>Other Person:</label>
          <div style={controlStyle}>
            <input
              type="text"
              id="sessionEventOtherPerson"
              value={draft.otherPersonName}
              onChange={(e) => onFieldChange('otherPersonName', e.target.value)}
              list="session-event-other-person"
              style={{ width: '100%' }}
            />
            <datalist id="session-event-other-person">
              {otherOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventWwwwh" style={labelStyle}>WWWWH:</label>
          <textarea
            id="sessionEventWwwwh"
            value={draft.wwwwh}
            onChange={(e) => onFieldChange('wwwwh', e.target.value)}
            rows={3}
            style={{ ...controlStyle, resize: 'vertical' }}
          />
        </div>
        <div style={rowStyle}>
          <label htmlFor="sessionEventObservations" style={labelStyle}>Observations:</label>
          <textarea
            id="sessionEventObservations"
            value={draft.observations}
            onChange={(e) => onFieldChange('observations', e.target.value)}
            rows={3}
            style={{ ...controlStyle, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={onSave}
            style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionEventModal;
