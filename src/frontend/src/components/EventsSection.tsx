/**
 * EventsSection — events list, filter controls, and row context menu.
 * Manages its own filter/sort/focus/context-menu state.
 * Rendered inside PropertiesPanel when activeTab === 'events'.
 */
import React, { useMemo, useState } from 'react';
import type { EmotionalProcessEvent, EventAnchorType, EventType, Partnership } from '../types';
import {
  EVENT_CLASS_LABELS,
  getContinuationState,
  isSymptomCategory,
  normalizeSymptomCategory,
  clampSymptomType,
} from '../constants/eventConstants';

// ── pure helpers ───────────────────────────────────────────────────

const inferEventType = (event: EmotionalProcessEvent): EventType => {
  if (event.eventType) return event.eventType;
  if (event.isNodalEvent) return 'NODAL';
  if (event.eventClass === 'emotional-pattern') return 'EPE';
  return 'FF';
};

const normalizeEventDate = (event: EmotionalProcessEvent) => event.startDate || event.date || '';

const formatCategoryStatus = (category: string, status?: string) =>
  status ? `${category} – ${status}` : category;

const compactRelationshipStatusLabel = (event: EmotionalProcessEvent) =>
  (event.statusLabel || formatCategoryStatus(event.category || 'Event', event.statusLabel)).replace(/\s+Date$/i, '').trim();

const toTitleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

const eventTypeLabel = (eventType: EventType): string => {
  if (eventType === 'FF') return 'Symptom';
  if (eventType === 'EPE') return 'Emotional Pattern';
  return 'Nodal';
};

const descriptorForEvent = (event: EmotionalProcessEvent) => {
  const et = inferEventType(event);
  if (et === 'NODAL') return event.nodalEventSubtype || event.statusLabel || 'Nodal Event';
  if (et === 'EPE') {
    const process = event.emotionalProcessType || event.category || 'EPE';
    return `${process} · F${event.frequency ?? 0}/I${event.intensity ?? 0}/Imp${event.impact ?? 0}`;
  }
  const symptomCategory = toTitleCase(normalizeSymptomCategory(event.category || event.symptomGroup));
  const symptomType = clampSymptomType(event.symptomType || (!isSymptomCategory(event.category) ? event.category : ''));
  return symptomType ? `${symptomCategory} · ${symptomType}` : symptomCategory;
};

const continuationLabel = (event: EmotionalProcessEvent) => {
  const state = getContinuationState(event);
  if (state === 'start') return 'Continues to next';
  if (state === 'middle') return 'Continues from previous and to next';
  if (state === 'end') return 'Continues from previous';
  return 'Discrete';
};

const continuationBadge = (event: EmotionalProcessEvent) => {
  const state = getContinuationState(event);
  if (state === 'start') return 'S';
  if (state === 'middle') return 'M';
  if (state === 'end') return 'E';
  return 'D';
};

// ── component ──────────────────────────────────────────────────────

interface EventsSectionProps {
  allEvents: EmotionalProcessEvent[];
  currentAnchorType: EventAnchorType;
  currentAnchorId: string;
  isPartnership: boolean;
  selectedPartnership?: Partnership | null;
  addEventButtonLabel: string;
  formatOptionLabel: (value: string) => string;
  onAddEvent: () => void;
  onEditEvent: (event: EmotionalProcessEvent) => void;
  onDeleteEvent: (id: string) => void;
  onLinkEvent: (eventId: string, direction: 'prev' | 'next', attach: boolean) => void;
  onCreateAndAttach: (eventId: string, direction: 'prev' | 'next') => void;
}

const eventActionButtonStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '2px 8px',
  cursor: 'pointer',
};

const EventsSection = ({
  allEvents,
  currentAnchorType,
  currentAnchorId,
  isPartnership,
  selectedPartnership,
  addEventButtonLabel,
  formatOptionLabel,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onLinkEvent,
  onCreateAndAttach,
}: EventsSectionProps) => {
  const [eventListMode, setEventListMode] = useState<'compact' | 'expanded'>('compact');
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | EventType>('ALL');
  const [anchorTypeFilter, setAnchorTypeFilter] = useState<'ALL' | EventAnchorType>('ALL');
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [eventRowMenu, setEventRowMenu] = useState<{ eventId: string; x: number; y: number } | null>(null);

  const filteredAndSortedEvents = useMemo(() => {
    const filtered = allEvents.filter((event) => {
      const et = inferEventType(event);
      const anchorType = event.anchorType || currentAnchorType;
      if (eventTypeFilter !== 'ALL' && et !== eventTypeFilter) return false;
      if (anchorTypeFilter !== 'ALL' && anchorType !== anchorTypeFilter) return false;
      if (!event.anchorId) return true;
      return event.anchorId === currentAnchorId;
    });
    const direction = eventSortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const aTime = normalizeEventDate(a) ? new Date(normalizeEventDate(a)).getTime() : Number.POSITIVE_INFINITY;
      const bTime = normalizeEventDate(b) ? new Date(normalizeEventDate(b)).getTime() : Number.POSITIVE_INFINITY;
      if (aTime === bTime) return 0;
      return aTime > bTime ? direction : -direction;
    });
    return filtered;
  }, [allEvents, eventSortOrder, eventTypeFilter, anchorTypeFilter, currentAnchorId, currentAnchorType]);

  const handleDelete = (eventId: string) => {
    if (focusedEventId === eventId) setFocusedEventId(null);
    onDeleteEvent(eventId);
  };

  return (
    <div style={{ marginTop: 12, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <strong>Events</strong>
        <button onClick={onAddEvent}>{addEventButtonLabel}</button>
      </div>
      <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="eventListMode">View: </label>
        <select
          id="eventListMode"
          value={eventListMode}
          onChange={(e) => setEventListMode(e.target.value as 'compact' | 'expanded')}
        >
          <option value="compact">Compact</option>
          <option value="expanded">Expanded</option>
        </select>
        <label htmlFor="eventSortOrder">Sort: </label>
        <select
          id="eventSortOrder"
          value={eventSortOrder}
          onChange={(e) => setEventSortOrder(e.target.value as 'asc' | 'desc')}
        >
          <option value="asc">Date Asc</option>
          <option value="desc">Date Desc</option>
        </select>
        <label htmlFor="eventTypeFilter">Type:</label>
        <select
          id="eventTypeFilter"
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value as 'ALL' | EventType)}
        >
          <option value="ALL">All</option>
          <option value="NODAL">Nodal</option>
          <option value="FF">Symptom</option>
          <option value="EPE">Emotional Pattern</option>
        </select>
        <label htmlFor="anchorTypeFilter">Anchor:</label>
        <select
          id="anchorTypeFilter"
          value={anchorTypeFilter}
          onChange={(e) => setAnchorTypeFilter(e.target.value as 'ALL' | EventAnchorType)}
        >
          <option value="ALL">All</option>
          <option value="PERSON">Person</option>
          <option value="RELATIONSHIP_PRL">Relationship PRL</option>
          <option value="EMOTIONAL_PROCESS_EP">Emotional Pattern</option>
        </select>
      </div>
      {filteredAndSortedEvents.length === 0 ? (
        <div style={{ marginTop: 6, fontStyle: 'italic' }}>No events yet.</div>
      ) : (
        <>
          {eventListMode === 'compact' && isPartnership ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 120px auto',
                gap: 12,
                marginTop: 8,
                padding: '0 0 6px 3px',
                borderBottom: '1px solid #cfd7e5',
                fontSize: 12,
                fontWeight: 700,
                color: '#41546d',
              }}
            >
              <span>Type</span>
              <span>Status</span>
              <span>Date</span>
              <span>Actions</span>
            </div>
          ) : null}
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
            {filteredAndSortedEvents.map((event) => {
              const et = inferEventType(event);
              const dateText = normalizeEventDate(event) || 'No date';
              return (
                <li
                  key={event.id}
                  onClick={() => setFocusedEventId(event.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setEventRowMenu({ eventId: event.id, x: e.clientX, y: e.clientY });
                  }}
                  style={{
                    borderBottom: '1px solid #ddd',
                    borderLeft: focusedEventId === event.id ? '3px solid #3f51b5' : '3px solid transparent',
                    padding: '10px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  {eventListMode === 'compact' ? (
                    isPartnership ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 120px auto',
                          gap: 12,
                          alignItems: 'center',
                          paddingLeft: 3,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {formatOptionLabel(event.category || selectedPartnership?.relationshipType || 'relationship')}
                        </span>
                        <span>{compactRelationshipStatusLabel(event)}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{dateText}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={eventActionButtonStyle} onClick={() => onEditEvent(event)}>Edit</button>
                          <button
                            aria-label="Delete"
                            title="Delete"
                            style={eventActionButtonStyle}
                            onClick={() => handleDelete(event.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{dateText}</span>
                          <span style={{ fontWeight: 600 }}>{descriptorForEvent(event)}</span>
                          <span style={{ fontSize: 11, color: '#555' }}>{eventTypeLabel(et)}</span>
                          <span
                            title={continuationLabel(event)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid #9db0c8',
                              borderRadius: 4,
                              padding: '1px 4px',
                              background: '#eef5ff',
                            }}
                          >
                            {continuationBadge(event)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={eventActionButtonStyle} onClick={() => onEditEvent(event)}>Edit</button>
                          <button
                            aria-label="Delete"
                            title="Delete"
                            style={eventActionButtonStyle}
                            onClick={() => handleDelete(event.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>
                            {formatCategoryStatus(event.category || 'Event', event.statusLabel)}
                          </span>
                          <span style={{ fontSize: 11, color: '#555' }}>
                            {EVENT_CLASS_LABELS[event.eventClass] || 'Event'}
                          </span>
                          <span style={{ fontSize: 11, color: '#1f3b57', fontWeight: 700 }}>
                            {eventTypeLabel(et)}
                          </span>
                          <span
                            title={continuationLabel(event)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid #9db0c8',
                              borderRadius: 4,
                              padding: '1px 4px',
                              background: '#eef5ff',
                            }}
                          >
                            {continuationBadge(event)}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{dateText}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          fontSize: 12,
                          color: '#333',
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          <span>Primary: {event.primaryPersonName || '—'}</span>
                          <span>Other: {event.otherPersonName || '—'}</span>
                          <span>Status: {event.statusLabel || '—'}</span>
                          <span>Subtype: {event.nodalEventSubtype || '—'}</span>
                          <span>
                            Symptom Category:{' '}
                            {et === 'FF'
                              ? toTitleCase(normalizeSymptomCategory(event.category || event.symptomGroup))
                              : '—'}
                          </span>
                          <span>
                            Symptom Type:{' '}
                            {et === 'FF'
                              ? clampSymptomType(
                                  event.symptomType ||
                                    (!isSymptomCategory(event.category) ? event.category : '')
                                ) || '—'
                              : '—'}
                          </span>
                          <span>Intensity: {event.intensity ?? '—'}</span>
                          <span>Frequency: {event.frequency ?? '—'}</span>
                          <span>Impact: {event.impact ?? '—'}</span>
                          <span>{continuationLabel(event)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={eventActionButtonStyle} onClick={() => onEditEvent(event)}>Edit</button>
                          <button
                            aria-label="Delete"
                            title="Delete"
                            style={eventActionButtonStyle}
                            onClick={() => handleDelete(event.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                      {event.observations && (
                        <div style={{ fontSize: 12, color: '#4f5b6b', textAlign: 'left' }}>
                          Notes: {event.observations.slice(0, 140)}
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {eventRowMenu && (
        <div
          style={{
            position: 'fixed',
            left: eventRowMenu.x,
            top: eventRowMenu.y,
            zIndex: 2050,
            background: '#fff',
            border: '1px solid #c8d3e4',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
            minWidth: 230,
          }}
          onMouseLeave={() => setEventRowMenu(null)}
        >
          {[
            { label: 'Attach to Previous', fn: () => onLinkEvent(eventRowMenu.eventId, 'prev', true) },
            { label: 'Attach to Next', fn: () => onLinkEvent(eventRowMenu.eventId, 'next', true) },
            { label: 'Detach Previous', fn: () => onLinkEvent(eventRowMenu.eventId, 'prev', false) },
            { label: 'Detach Next', fn: () => onLinkEvent(eventRowMenu.eventId, 'next', false) },
            { label: 'Create and Attach Previous', fn: () => onCreateAndAttach(eventRowMenu.eventId, 'prev') },
            { label: 'Create and Attach Next', fn: () => onCreateAndAttach(eventRowMenu.eventId, 'next') },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.fn();
                setEventRowMenu(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsSection;
