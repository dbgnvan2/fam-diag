/**
 * EventsSection — events list with filter/sort controls.
 * Each event is rendered as a shared EventCard (uniform layout across the app).
 */
import { useMemo, useState } from 'react';
import type { EmotionalProcessEvent, EventAnchorType, EventType } from '../types';
import { EVENT_TYPE_LABELS, EVENT_CATEGORIES, inferEventType } from '../constants/eventConstants';

const toTitleCase = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

// Return the canonical (properly-cased) category for an event, or the raw value if unknown.
const normalizeCategory = (event: Parameters<typeof inferEventType>[0]): string => {
  const type = inferEventType(event);
  const raw = (event.category || '').trim();
  if (!raw) return '—';
  const cats = EVENT_CATEGORIES[type] || [];
  const match = cats.find((c) => c.toLowerCase() === raw.toLowerCase());
  return match || toTitleCase(raw);
};
import EventCard from './EventCard';
import type { SystemEvent } from '../utils/systemEvents';

// ── pure helpers ───────────────────────────────────────────────────

const normalizeEventDate = (event: EmotionalProcessEvent) => event.startDate || event.date || '';

// ── component ──────────────────────────────────────────────────────

interface EventsSectionProps {
  /**
   * The rows to list. The caller decides what belongs on this tab (a
   * person's tab includes its partnerships' and patterns' events); this
   * component only applies the user's own Group / Anchor filters. It used to
   * drop every row not anchored to the entity, which hid a person's own
   * marriage and family events that the Timeline lane shows.
   */
  allEvents: EmotionalProcessEvent[];
  addEventButtonLabel: string;
  onAddEvent: () => void;
  onEditEvent: (event: EmotionalProcessEvent) => void;
  onDeleteEvent: (id: string) => void;
  /** Row menu actions. The menu is shown only when both are supplied. */
  onLinkEvent?: (eventId: string, direction: 'prev' | 'next', attach: boolean) => void;
  onCreateAndAttach?: (eventId: string, direction: 'prev' | 'next') => void;
  /**
   * Events belonging to relatives in the same family system. Shown read-only
   * under the entity's own events; editing opens them on their owner.
   * Spec: docs/implementation_plan_2026-09-19.md#M7.F
   */
  systemEvents?: SystemEvent[];
  onOpenSystemEvent?: (entry: SystemEvent) => void;
  systemEventsNote?: string;
}

const EventsSection = ({
  allEvents,
  addEventButtonLabel,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onLinkEvent,
  onCreateAndAttach,
  systemEvents = [],
  onOpenSystemEvent,
  systemEventsNote,
}: EventsSectionProps) => {
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | EventType>('ALL');
  const [anchorTypeFilter, setAnchorTypeFilter] = useState<'ALL' | EventAnchorType>('ALL');
  const [eventRowMenu, setEventRowMenu] = useState<{ eventId: string; x: number; y: number } | null>(null);

  const filteredAndSortedEvents = useMemo(() => {
    const filtered = allEvents.filter((event) => {
      // The same type the card shows, so an older event with no stored
      // eventType is found under the group its card names.
      if (eventTypeFilter !== 'ALL' && inferEventType(event) !== eventTypeFilter) return false;
      if (anchorTypeFilter !== 'ALL' && event.anchorType !== anchorTypeFilter) return false;
      return true;
    });
    const direction = eventSortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const aTime = normalizeEventDate(a) ? new Date(normalizeEventDate(a)).getTime() : Number.POSITIVE_INFINITY;
      const bTime = normalizeEventDate(b) ? new Date(normalizeEventDate(b)).getTime() : Number.POSITIVE_INFINITY;
      if (aTime === bTime) return 0;
      return aTime > bTime ? direction : -direction;
    });
    return filtered;
  }, [allEvents, eventSortOrder, eventTypeFilter, anchorTypeFilter]);
  const rowMenuEnabled = !!onLinkEvent && !!onCreateAndAttach;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Events</strong>
        <button
          type="button"
          onClick={onAddEvent}
          style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: '1px solid #4b68a6', background: '#f0f4ff', color: '#23324a', cursor: 'pointer' }}
        >
          {addEventButtonLabel}
        </button>
      </div>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
        <label htmlFor="eventSortOrder">Sort: </label>
        <select
          id="eventSortOrder"
          value={eventSortOrder}
          onChange={(e) => setEventSortOrder(e.target.value as 'asc' | 'desc')}
          style={{ fontSize: 12 }}
        >
          <option value="asc">Date Asc</option>
          <option value="desc">Date Desc</option>
        </select>
        <label htmlFor="eventTypeFilter">Group:</label>
        <select
          id="eventTypeFilter"
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value as 'ALL' | EventType)}
          style={{ fontSize: 12 }}
        >
          <option value="ALL">All</option>
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
            <option key={type} value={type}>{EVENT_TYPE_LABELS[type]}</option>
          ))}
        </select>
        <label htmlFor="anchorTypeFilter">Anchor:</label>
        <select
          id="anchorTypeFilter"
          value={anchorTypeFilter}
          onChange={(e) => setAnchorTypeFilter(e.target.value as 'ALL' | EventAnchorType)}
          style={{ fontSize: 12 }}
        >
          <option value="ALL">All</option>
          <option value="PERSON">Person</option>
          <option value="RELATIONSHIP_PRL">Relationship</option>
          <option value="EMOTIONAL_PROCESS_EP">Emotional Pattern</option>
          <option value="FAMILY">Family</option>
          <option value="TRIANGLE">Triangle</option>
        </select>
      </div>
      {filteredAndSortedEvents.length === 0 ? (
        <div style={{ color: '#7a8aaa', fontSize: 13, padding: '8px 0' }}>No events recorded yet.</div>
      ) : (
        filteredAndSortedEvents.map((event) => (
          <div
            key={event.id}
            onContextMenu={(e) => {
              if (!rowMenuEnabled) return;
              e.preventDefault();
              setEventRowMenu({ eventId: event.id, x: e.clientX, y: e.clientY });
            }}
          >
            <EventCard
              date={event.startDate || event.date || ''}
              type={EVENT_TYPE_LABELS[inferEventType(event)]}
              category={normalizeCategory(event)}
              subtype={
                inferEventType(event) === 'SYMPTOM'
                  ? (event.symptomType || event.subtype || undefined)
                  : (event.subtype || undefined)
              }
              status={event.status || 'discrete'}
              intensity={typeof event.intensity === 'number' ? event.intensity : null}
              onEdit={() => onEditEvent(event)}
              onDelete={() => onDeleteEvent(event.id)}
            />
          </div>
        ))
      )}
      {systemEvents.length > 0 && (
        <div style={{ marginTop: 14 }} data-testid="system-events-section">
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#4b5a78',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>System events ({systemEvents.length})</span>
            <span style={{ fontWeight: 400, color: '#7a869c' }}>
              {systemEventsNote || 'read-only — belong to relatives in this family'}
            </span>
          </div>
          {[...systemEvents]
            .sort((a, b) => {
              const aTime = normalizeEventDate(a.event)
                ? new Date(normalizeEventDate(a.event)).getTime()
                : Number.POSITIVE_INFINITY;
              const bTime = normalizeEventDate(b.event)
                ? new Date(normalizeEventDate(b.event)).getTime()
                : Number.POSITIVE_INFINITY;
              if (aTime === bTime) return 0;
              const direction = eventSortOrder === 'asc' ? 1 : -1;
              return aTime > bTime ? direction : -direction;
            })
            .map((entry) => (
              <EventCard
                key={`system-${entry.ownerEntityType}-${entry.ownerEntityId}-${entry.event.id}`}
                date={entry.event.startDate || entry.event.date || ''}
                type={EVENT_TYPE_LABELS[inferEventType(entry.event)]}
                category={normalizeCategory(entry.event)}
                subtype={
                  inferEventType(entry.event) === 'SYMPTOM'
                    ? entry.event.symptomType || entry.event.subtype || undefined
                    : entry.event.subtype || undefined
                }
                status={entry.event.status || 'discrete'}
                intensity={typeof entry.event.intensity === 'number' ? entry.event.intensity : null}
                relationLabel={entry.relationLabel}
                readOnly
                leftBorderColor="#9aa7b8"
                onEdit={onOpenSystemEvent ? () => onOpenSystemEvent(entry) : undefined}
              />
            ))}
        </div>
      )}
      {eventRowMenu && onLinkEvent && onCreateAndAttach && (
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
