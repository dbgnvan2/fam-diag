/**
 * EventModal — Add / Edit event form dialog.
 * Renders as a positioned overlay (near-cursor) or centered modal depending on `position`.
 * Manages its own intensity help open/close state.
 */
import React, { useState } from 'react';
import type { EmotionalProcessEvent, EventClass, EventType } from '../types';
import {
  INTENSITY_OPTIONS,
  FREQUENCY_OPTIONS,
  IMPACT_OPTIONS,
} from '../constants/functionalIndicatorScales';
import {
  EVENT_STATUS_OPTIONS,
  EVENT_CATEGORIES,
  EVENT_SUBTYPES,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_HAS_PERSONS,
  EVENT_TYPE_HAS_SUBTYPE,
  getIntensityScale,
} from '../constants/eventConstants';
import DatePickerField from './DatePickerField';

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

export interface EventModalProps {
  eventDraft: EmotionalProcessEvent;
  position: { x: number; y: number } | null;
  popupLeft: number | string;
  popupTop: number | string;
  popupMaxHeight: number | null;
  isPartnership: boolean;
  isEditingExisting: boolean;
  primaryPersonOptions: string[];
  otherPersonOptions: string[];
  eventCategories: string[];
  symptomTypeOptions: string[];
  resolvedAnchorType: string;
  resolvedAnchorId: string;
  resolvedEventClass: EventClass;
  editEventTitle: string;
  newEventTitle: string;
  onChange: (field: keyof EmotionalProcessEvent, value: string) => void;
  onSetDraft: (draft: EmotionalProcessEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

const EventModal = ({
  eventDraft,
  position,
  popupLeft,
  popupTop,
  popupMaxHeight,
  isEditingExisting,
  primaryPersonOptions,
  otherPersonOptions,
  symptomTypeOptions,
  resolvedAnchorType,
  resolvedAnchorId,
  onChange,
  onSave,
  onCancel,
}: EventModalProps) => {
  const [intensityHelpOpen, setIntensityHelpOpen] = useState(false);

  const MODAL_MARGIN = 12;
  const MODAL_MIN_HEIGHT = 260;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const rawTop = typeof popupTop === 'number' ? popupTop : parseFloat(String(popupTop)) || 0;
  const clampedTop = position
    ? Math.max(MODAL_MARGIN, Math.min(rawTop, vh - MODAL_MIN_HEIGHT - MODAL_MARGIN))
    : rawTop;
  const computedMaxHeight = position
    ? popupMaxHeight
      ? popupMaxHeight
      : Math.max(MODAL_MIN_HEIGHT, vh - clampedTop - MODAL_MARGIN)
    : null;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  };
  const labelStyle: React.CSSProperties = { width: 170, textAlign: 'right', fontWeight: 600 };
  const controlStyle: React.CSSProperties = { width: '60%' };

  const eventType: EventType = eventDraft.eventType;
  const showPersons = EVENT_TYPE_HAS_PERSONS[eventType];
  const showSubtype = EVENT_TYPE_HAS_SUBTYPE[eventType];
  const isNoPersonEvent = !showPersons; // FAMILY or TRIANGLE
  const isSymptomEvent = eventType === 'SYMPTOM';

  const categoryOptions = EVENT_CATEGORIES[eventType] || [];
  const subtypeOptions =
    showSubtype && eventType !== 'SYMPTOM' && eventType !== 'TRIANGLE'
      ? (EVENT_SUBTYPES[eventType]?.[eventDraft.category] || [])
      : [];

  const intensityScale = getIntensityScale(eventType, eventDraft.category, eventDraft.subtype);

  const modalTitle = (() => {
    const typeLabel = EVENT_TYPE_LABELS[eventType] || eventType;
    return isEditingExisting ? `Edit ${typeLabel}` : `Add ${typeLabel}`;
  })();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: position ? 'stretch' : 'center',
        justifyContent: position ? 'stretch' : 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: 20,
          borderRadius: 10,
          width: 520,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: computedMaxHeight ? `${computedMaxHeight}px` : 'calc(100vh - 24px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          position: position ? 'absolute' : 'relative',
          left: popupLeft,
          top: position ? clampedTop : popupTop,
        }}
      >
        <h4 style={{ marginTop: 0 }}>{modalTitle}</h4>

        {/* Event Type — read-only label */}
        <div style={rowStyle}>
          <label style={labelStyle}>Event Type:</label>
          <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
            {EVENT_TYPE_LABELS[eventType] || eventType}
          </div>
        </div>

        {/* Anchor — shown when persons field is hidden */}
        {isNoPersonEvent && (
          <div style={rowStyle}>
            <label style={labelStyle}>Anchor:</label>
            <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
              {eventDraft.anchorType || resolvedAnchorType} · {eventDraft.anchorId || resolvedAnchorId}
            </div>
          </div>
        )}

        {/* Primary Person */}
        {showPersons && (
          <div style={rowStyle}>
            <label htmlFor="eventPrimaryPerson" style={labelStyle}>Primary Person:</label>
            <div style={controlStyle}>
              <input
                type="text"
                id="eventPrimaryPerson"
                list="eventPrimaryPersonOptions"
                value={eventDraft.primaryPersonName || ''}
                onChange={(e) => onChange('primaryPersonName', e.target.value)}
                style={{ width: '100%' }}
              />
              <datalist id="eventPrimaryPersonOptions">
                {primaryPersonOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {/* Other Person */}
        {showPersons && (
          <div style={rowStyle}>
            <label htmlFor="eventOtherPerson" style={labelStyle}>Other Person:</label>
            <div style={controlStyle}>
              <input
                type="text"
                id="eventOtherPerson"
                list="eventOtherPersonOptions"
                value={eventDraft.otherPersonName}
                onChange={(e) => onChange('otherPersonName', e.target.value)}
                style={{ width: '100%' }}
              />
              <datalist id="eventOtherPersonOptions">
                <option value="None" />
                {otherPersonOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {/* Start / End dates */}
        <div style={rowStyle}>
          <label style={labelStyle}>Start / End:</label>
          <div style={{ ...controlStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <DatePickerField
                id="eventStartDate"
                name="eventStartDate"
                value={eventDraft.startDate || eventDraft.date}
                placeholder="YYYY-MM-DD"
                onChange={(e) => {
                  onChange('startDate', e.target.value);
                  onChange('date', e.target.value);
                }}
                buttonLabel="Select start"
              />
            </div>
            <div>
              <DatePickerField
                id="eventEndDate"
                name="eventEndDate"
                value={eventDraft.endDate || ''}
                placeholder="YYYY-MM-DD"
                onChange={(e) => onChange('endDate', e.target.value)}
                buttonLabel="Select end"
              />
            </div>
          </div>
        </div>

        {/* Category */}
        {categoryOptions.length > 0 && !(eventType === 'EA') && (
          <div style={rowStyle}>
            <label htmlFor="eventCategory" style={labelStyle}>Category:</label>
            <select
              id="eventCategory"
              value={eventDraft.category}
              onChange={(e) => onChange('category', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* EA: category is fixed */}
        {eventType === 'EA' && (
          <div style={rowStyle}>
            <label style={labelStyle}>Category:</label>
            <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>Emotional Autonomy</div>
          </div>
        )}

        {/* Subtype — dropdown for FAMILY, free text for SYMPTOM/TRIANGLE */}
        {showSubtype && isSymptomEvent && (
          <div style={rowStyle}>
            <label htmlFor="eventSubtype" style={labelStyle}>Symptom Type:</label>
            <div style={controlStyle}>
              <input
                type="text"
                id="eventSubtype"
                list="eventSubtypeOptions"
                maxLength={30}
                value={eventDraft.subtype || ''}
                onChange={(e) => onChange('subtype', e.target.value)}
                style={{ width: '100%' }}
              />
              <datalist id="eventSubtypeOptions">
                {symptomTypeOptions.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>
          </div>
        )}
        {showSubtype && eventType === 'TRIANGLE' && (
          <div style={rowStyle}>
            <label htmlFor="eventSubtype" style={labelStyle}>Subtype:</label>
            <input
              type="text"
              id="eventSubtype"
              value={eventDraft.subtype || ''}
              onChange={(e) => onChange('subtype', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            />
          </div>
        )}
        {showSubtype && subtypeOptions.length > 0 && (
          <div style={rowStyle}>
            <label htmlFor="eventSubtype" style={labelStyle}>Type:</label>
            <select
              id="eventSubtype"
              value={eventDraft.subtype || ''}
              onChange={(e) => onChange('subtype', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              <option value="">— select —</option>
              {subtypeOptions.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status */}
        <div style={rowStyle}>
          <label htmlFor="eventStatus" style={labelStyle}>Status:</label>
          <select
            id="eventStatus"
            value={eventDraft.status || 'discrete'}
            onChange={(e) => onChange('status', e.target.value)}
            style={{ ...controlStyle, width: '60%' }}
          >
            {EVENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Intensity */}
        <div style={rowStyle}>
          <label htmlFor="eventIntensity" style={labelStyle}>Intensity:</label>
          <select
            id="eventIntensity"
            value={eventDraft.intensity ?? 0}
            onChange={(e) => onChange('intensity', e.target.value)}
            style={{ ...controlStyle, width: '60%' }}
          >
            {intensityScale.labels.length > 0
              ? intensityScale.labels.map((label, index) => {
                  const val = index + 1;
                  return (
                    <option key={val} value={val}>{val}: {label}</option>
                  );
                })
              : INTENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
          </select>
          {intensityScale.help.length > 0 && (
            <button
              type="button"
              aria-label="Intensity scale help"
              onClick={() => setIntensityHelpOpen((prev) => !prev)}
              style={helpBadgeStyle}
            >
              ?
            </button>
          )}
        </div>

        {intensityHelpOpen && intensityScale.help.length > 0 && (
          <div
            role="dialog"
            aria-label="Intensity scale"
            style={{
              marginTop: 8,
              width: '100%',
              maxWidth: '100%',
              border: '1px solid #c6cfde',
              borderRadius: 10,
              background: '#fff',
              padding: '12px 14px',
              boxSizing: 'border-box',
              boxShadow: '0 10px 28px rgba(28, 41, 61, 0.16)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <strong>{EVENT_TYPE_LABELS[eventType]} Intensity Scale</strong>
              <button type="button" onClick={() => setIntensityHelpOpen(false)} style={{ padding: '4px 10px' }}>
                Cancel
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {intensityScale.help.map((line, index) => {
                const levelValue = index + 1;
                const levelLabel = intensityScale.labels[index];
                const isActive = (eventDraft.intensity ?? 0) === levelValue;
                return (
                  <button
                    key={`event-intensity-${index}`}
                    type="button"
                    onClick={() => {
                      onChange('intensity', String(levelValue));
                      setIntensityHelpOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${isActive ? '#4b68a6' : '#d4dae5'}`,
                      borderRadius: 8,
                      background: isActive ? '#eef3ff' : '#fff',
                      padding: '8px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#23324a' }}>{levelLabel}</div>
                    <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>{line}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Frequency */}
        <div style={rowStyle}>
          <label htmlFor="eventFrequency" style={labelStyle}>Frequency:</label>
          <select
            id="eventFrequency"
            value={eventDraft.frequency ?? 0}
            onChange={(e) => onChange('frequency', e.target.value)}
            style={{ ...controlStyle, width: '60%' }}
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Impact */}
        <div style={rowStyle}>
          <label htmlFor="eventImpact" style={labelStyle}>Impact:</label>
          <select
            id="eventImpact"
            value={eventDraft.impact ?? 0}
            onChange={(e) => onChange('impact', e.target.value)}
            style={{ ...controlStyle, width: '60%' }}
          >
            {IMPACT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* How Well */}
        <div style={rowStyle}>
          <label htmlFor="eventHowWell" style={labelStyle}>How well (1-9):</label>
          <input
            type="number"
            id="eventHowWell"
            min={1}
            max={9}
            value={eventDraft.howWell}
            onChange={(e) => onChange('howWell', e.target.value)}
            style={{ ...controlStyle, width: '60%' }}
          />
        </div>

        {/* WWWWH */}
        <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
          <label htmlFor="eventWwwwh" style={{ ...labelStyle, marginTop: 6 }}>WWWWH:</label>
          <textarea
            id="eventWwwwh"
            value={eventDraft.wwwwh}
            onChange={(e) => onChange('wwwwh', e.target.value)}
            rows={2}
            style={{ ...controlStyle, resize: 'vertical' }}
          />
        </div>

        {/* Observations / Notes */}
        <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
          <label htmlFor="eventObservations" style={{ ...labelStyle, marginTop: 6 }}>
            {isSymptomEvent ? 'Notes:' : 'Observations:'}
          </label>
          <textarea
            id="eventObservations"
            value={eventDraft.observations}
            onChange={(e) => onChange('observations', e.target.value)}
            rows={isSymptomEvent ? 6 : 2}
            style={{ ...controlStyle, resize: 'vertical' }}
          />
        </div>

        {/* Prior Events */}
        <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
          <label htmlFor="eventPriorNote" style={{ ...labelStyle, marginTop: 6 }}>Prior Events:</label>
          <textarea
            id="eventPriorNote"
            value={eventDraft.priorEventsNote || ''}
            onChange={(e) => onChange('priorEventsNote', e.target.value)}
            rows={2}
            style={{ ...controlStyle, resize: 'vertical' }}
          />
        </div>

        {/* Client Reflections */}
        <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
          <label htmlFor="eventReflections" style={{ ...labelStyle, marginTop: 6 }}>Reflections:</label>
          <textarea
            id="eventReflections"
            value={eventDraft.reflectionsNote || ''}
            onChange={(e) => onChange('reflectionsNote', e.target.value)}
            rows={2}
            style={{ ...controlStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
