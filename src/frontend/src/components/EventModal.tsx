/**
 * EventModal — Add / Edit event form dialog.
 * Renders as a positioned overlay (near-cursor) or centered modal depending on `position`.
 * Manages its own intensity help open/close state.
 */
import React, { useState } from 'react';
import type { EmotionalProcessEvent, EventClass, EventContinuationState, EventType } from '../types';
import {
  INTENSITY_OPTIONS,
  FREQUENCY_OPTIONS,
  IMPACT_OPTIONS,
} from '../constants/functionalIndicatorScales';
import {
  EVENT_CLASS_LABELS,
  EMOTIONAL_AUTONOMY_INTENSITY_HELP,
  EMOTIONAL_AUTONOMY_INTENSITY_LABELS,
  FOO_TRIANGLE_CATEGORY_OPTIONS,
  FOO_EXTENDED_CATEGORY_OPTIONS,
  SYMPTOM_INTENSITY_HELP,
  SYMPTOM_INTENSITY_LABELS,
  NODAL_SUBTYPE_OPTIONS,
  SYMPTOM_GROUP_OPTIONS,
  isEmotionalAutonomyProcess,
  isFooProcess,
  isFooTriangleProcess,
  isTrianglePropertyProcess,
  normalizeSymptomCategory,
  getContinuationState,
  continuationToFlags,
} from '../constants/eventConstants';
import DatePickerField from './DatePickerField';

const inferEventType = (event: EmotionalProcessEvent): EventType => {
  if (event.eventType) return event.eventType;
  if (event.isNodalEvent) return 'NODAL';
  if (event.eventClass === 'emotional-pattern') return 'EPE';
  return 'FF';
};

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
  eventCategories,
  symptomTypeOptions,
  resolvedAnchorType,
  resolvedAnchorId,
  resolvedEventClass,
  editEventTitle,
  newEventTitle,
  onChange,
  onSetDraft,
  onSave,
  onCancel,
}: EventModalProps) => {
  const [intensityHelpOpen, setIntensityHelpOpen] = useState<'symptom' | 'emotional-autonomy' | 'foo' | null>(null);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  };
  const labelStyle: React.CSSProperties = { width: 170, textAlign: 'right', fontWeight: 600 };
  const controlStyle: React.CSSProperties = { width: '60%' };

  const eventType = inferEventType(eventDraft);
  const isSymptomEvent = eventType === 'FF';
  const isAutonomyEvent = eventType === 'EPE' && isEmotionalAutonomyProcess(eventDraft.emotionalProcessType);
  const isFooLikeEvent =
    eventType === 'EPE' &&
    (isFooProcess(eventDraft.emotionalProcessType) || isFooTriangleProcess(eventDraft.emotionalProcessType));
  const isTrianglePropertyEvent = eventType === 'EPE' && isTrianglePropertyProcess(eventDraft.emotionalProcessType);
  const isCompactEvent = isSymptomEvent || isAutonomyEvent || isFooLikeEvent || isTrianglePropertyEvent;

  const fooCategoryOptions = isFooTriangleProcess(eventDraft.emotionalProcessType)
    ? FOO_TRIANGLE_CATEGORY_OPTIONS
    : FOO_EXTENDED_CATEGORY_OPTIONS;
  const fooCategoryMeta =
    fooCategoryOptions.find((option) => option.value === eventDraft.category) || fooCategoryOptions[0];

  const continuationState = getContinuationState(eventDraft);

  const modalTitle = (() => {
    if (eventType === 'EPE' && isTrianglePropertyEvent) {
      return isEditingExisting ? 'Edit Triangle Property' : 'Add Triangle Property';
    }
    if (eventType === 'EPE' && isFooTriangleProcess(eventDraft.emotionalProcessType)) {
      return isEditingExisting ? 'Edit FoO Triangle' : 'Add FoO Triangle';
    }
    if (eventType === 'EPE' && isFooProcess(eventDraft.emotionalProcessType)) {
      return isEditingExisting ? 'Edit FoO' : 'Add FoO';
    }
    if (eventType === 'EPE' && isAutonomyEvent) {
      return isEditingExisting ? 'Edit Emotional Autonomy' : 'Add Emotional Autonomy';
    }
    if (eventType === 'FF') return isEditingExisting ? 'Edit Symptom' : 'Add Symptom';
    return isEditingExisting ? editEventTitle : newEventTitle;
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
          maxHeight: popupMaxHeight ? `${popupMaxHeight}px` : 'calc(100vh - 24px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          position: position ? 'absolute' : 'relative',
          left: popupLeft,
          top: popupTop,
        }}
      >
        <h4 style={{ marginTop: 0 }}>{modalTitle}</h4>

        {!isCompactEvent && (
          <div style={rowStyle}>
            <label style={labelStyle}>Anchor:</label>
            <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
              {eventDraft.anchorType || resolvedAnchorType} · {eventDraft.anchorId || resolvedAnchorId}
            </div>
          </div>
        )}
        <div style={rowStyle}>
          <label htmlFor="eventType" style={labelStyle}>Event Type:</label>
          <select
            id="eventType"
            value={eventType}
            onChange={(e) => onChange('eventType', e.target.value)}
            style={{ ...controlStyle, width: '60%' }}
          >
            <option value="NODAL">Nodal</option>
            <option value="FF">Symptom</option>
            <option value="EPE">
              {isFooLikeEvent
                ? 'Family of Origin'
                : isAutonomyEvent
                ? 'Emotional Autonomy'
                : 'Emotional Pattern'}
            </option>
          </select>
        </div>
        {!isCompactEvent && (
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
        {!isCompactEvent && (
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
        {eventType === 'NODAL' && (
          <div style={rowStyle}>
            <label htmlFor="eventCategory" style={labelStyle}>Nodal Category:</label>
            <select
              id="eventCategory"
              value={eventDraft.category}
              onChange={(e) => onChange('category', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              {eventCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}
        {eventType === 'NODAL' && (
          <div style={rowStyle}>
            <label htmlFor="eventNodalSubtype" style={labelStyle}>Subtype:</label>
            <div style={controlStyle}>
              <input
                type="text"
                id="eventNodalSubtype"
                list="eventNodalSubtypeOptions"
                value={eventDraft.nodalEventSubtype || ''}
                onChange={(e) => onChange('nodalEventSubtype', e.target.value)}
                style={{ width: '100%' }}
              />
              <datalist id="eventNodalSubtypeOptions">
                {NODAL_SUBTYPE_OPTIONS.map((subtype) => (
                  <option key={subtype} value={subtype} />
                ))}
              </datalist>
            </div>
          </div>
        )}
        {eventType === 'EPE' && !isFooLikeEvent && !isTrianglePropertyEvent && (
          <div style={rowStyle}>
            <label htmlFor="eventEmotionalProcessType" style={labelStyle}>Process Type:</label>
            <input
              type="text"
              id="eventEmotionalProcessType"
              value={eventDraft.emotionalProcessType || ''}
              onChange={(e) => onChange('emotionalProcessType', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
              placeholder="fusion, conflict, distance..."
            />
          </div>
        )}
        {eventType === 'FF' && (
          <div style={rowStyle}>
            <label htmlFor="eventCategory" style={labelStyle}>Symptom Category:</label>
            <select
              id="eventCategory"
              value={normalizeSymptomCategory(eventDraft.category || eventDraft.symptomGroup)}
              onChange={(e) => onChange('category', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              {SYMPTOM_GROUP_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
        {eventType === 'FF' && (
          <div style={rowStyle}>
            <label htmlFor="eventSymptomType" style={labelStyle}>Symptom Type:</label>
            <div style={controlStyle}>
              <input
                type="text"
                id="eventSymptomType"
                list="eventSymptomTypeOptions"
                maxLength={30}
                value={eventDraft.symptomType || ''}
                onChange={(e) => onChange('symptomType', e.target.value)}
                style={{ width: '100%' }}
              />
              <datalist id="eventSymptomTypeOptions">
                {symptomTypeOptions.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>
          </div>
        )}
        {eventType === 'EPE' && !isTrianglePropertyEvent && (
          <div style={rowStyle}>
            <label htmlFor="eventCategory" style={labelStyle}>
              {isFooTriangleProcess(eventDraft.emotionalProcessType)
                ? 'Triangle Category:'
                : isFooProcess(eventDraft.emotionalProcessType)
                ? 'FoO Category:'
                : 'Category:'}
            </label>
            <select
              id="eventCategory"
              value={
                isFooLikeEvent
                  ? eventDraft.category || fooCategoryOptions[0].value
                  : eventDraft.category
              }
              onChange={(e) => onChange('category', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              {(isFooLikeEvent ? fooCategoryOptions : eventCategories).map((category) => (
                <option
                  key={typeof category === 'string' ? category : category.value}
                  value={typeof category === 'string' ? category : category.value}
                >
                  {typeof category === 'string' ? category : category.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {eventType === 'EPE' && !isFooLikeEvent && !isTrianglePropertyEvent && (
          <div style={rowStyle}>
            <label htmlFor="eventCategoryFallback" style={labelStyle}>Category:</label>
            <select
              id="eventCategoryFallback"
              value={eventDraft.category}
              onChange={(e) => onChange('category', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              {eventCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={rowStyle}>
          <label htmlFor="eventStatusLabel" style={labelStyle}>Status:</label>
          {isCompactEvent ? (
            <select
              id="eventStatusLabel"
              value={eventDraft.statusLabel || 'Ongoing'}
              onChange={(e) => onChange('statusLabel', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
            >
              <option value="Ongoing">Ongoing</option>
              <option value="Episodic">Episodic</option>
              <option value="Ended">Ended</option>
            </select>
          ) : (
            <input
              type="text"
              id="eventStatusLabel"
              value={eventDraft.statusLabel || ''}
              onChange={(e) => onChange('statusLabel', e.target.value)}
              style={{ ...controlStyle, width: '60%' }}
              placeholder="e.g., Start, Ended"
            />
          )}
        </div>
        {!isCompactEvent && (
          <div style={rowStyle}>
            <label style={labelStyle}>Event Class:</label>
            <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
              {EVENT_CLASS_LABELS[eventDraft.eventClass || resolvedEventClass]}
            </div>
          </div>
        )}
        {eventType !== 'NODAL' && (
          <>
            <div style={rowStyle}>
              <label htmlFor="eventIntensity" style={labelStyle}>Intensity:</label>
              <select
                id="eventIntensity"
                value={eventDraft.intensity ?? 0}
                onChange={(e) => onChange('intensity', e.target.value)}
                style={{ ...controlStyle, width: '60%' }}
              >
                {(isSymptomEvent
                  ? SYMPTOM_INTENSITY_LABELS.map((label, index) => ({ value: index, label: `${index}: ${label}` }))
                  : isAutonomyEvent
                  ? EMOTIONAL_AUTONOMY_INTENSITY_LABELS.map((label, index) => ({ value: index + 1, label: `${index + 1}: ${label}` }))
                  : isFooLikeEvent
                  ? fooCategoryMeta.levelLabels.map((label, index) => ({ value: index + 1, label: `${index + 1}: ${label}` }))
                  : INTENSITY_OPTIONS
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(isSymptomEvent || isAutonomyEvent || isFooLikeEvent) && (
                <button
                  type="button"
                  aria-label={
                    isSymptomEvent
                      ? 'Symptom event intensity help'
                      : isAutonomyEvent
                      ? 'Emotional autonomy intensity help'
                      : 'FoO intensity help'
                  }
                  onClick={() =>
                    setIntensityHelpOpen(
                      isSymptomEvent ? 'symptom' : isAutonomyEvent ? 'emotional-autonomy' : 'foo'
                    )
                  }
                  style={helpBadgeStyle}
                >
                  ?
                </button>
              )}
            </div>
            {(isSymptomEvent || isAutonomyEvent || isFooLikeEvent) && intensityHelpOpen && (
              <div
                role="dialog"
                aria-label={
                  isSymptomEvent
                    ? 'Symptom event intensity scale'
                    : isAutonomyEvent
                    ? 'Capacity for Emotional Autonomy Scale'
                    : fooCategoryMeta.label
                }
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
                  <strong>
                    {isSymptomEvent
                      ? 'Symptom Intensity Scale'
                      : isAutonomyEvent
                      ? 'Capacity for Emotional Autonomy Scale'
                      : fooCategoryMeta.label}
                  </strong>
                  <button type="button" onClick={() => setIntensityHelpOpen(null)} style={{ padding: '4px 10px' }}>
                    Cancel
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {(isSymptomEvent
                    ? SYMPTOM_INTENSITY_HELP
                    : isAutonomyEvent
                    ? EMOTIONAL_AUTONOMY_INTENSITY_HELP
                    : fooCategoryMeta.helpLines
                  ).map((line, index) => {
                    const levelValue = isSymptomEvent ? index : index + 1;
                    const levelLabel = isSymptomEvent
                      ? SYMPTOM_INTENSITY_LABELS[index]
                      : isAutonomyEvent
                      ? EMOTIONAL_AUTONOMY_INTENSITY_LABELS[index]
                      : fooCategoryMeta.levelLabels[index];
                    const isActive = (eventDraft.intensity ?? 0) === levelValue;
                    return (
                      <button
                        key={`event-intensity-${index}`}
                        type="button"
                        onClick={() => {
                          onChange('intensity', String(levelValue));
                          setIntensityHelpOpen(null);
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
          </>
        )}
        {!isCompactEvent && (
          <div style={rowStyle}>
            <label htmlFor="eventContinuationState" style={labelStyle}>Continuation:</label>
            <select
              id="eventContinuationState"
              value={continuationState}
              onChange={(e) => {
                const flags = continuationToFlags(e.target.value as EventContinuationState);
                onSetDraft({
                  ...eventDraft,
                  continuesFromPrevious: flags.continuesFromPrevious,
                  continuesToNext: flags.continuesToNext,
                });
              }}
              style={{ ...controlStyle, width: '60%' }}
            >
              <option value="discrete">Discrete</option>
              <option value="start">Start</option>
              <option value="middle">Middle</option>
              <option value="end">End</option>
            </select>
          </div>
        )}
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
        {!isCompactEvent && (
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
        )}
        {!isCompactEvent && (
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
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
