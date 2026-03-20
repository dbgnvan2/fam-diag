import { useState, useCallback } from 'react';
import type { Person, Partnership, EmotionalLine, EmotionalProcessEvent } from '../../types';
import type { TimelineBoardSelection } from '../../types/diagramEditor';
import { nanoid } from 'nanoid';

interface TimelineBoardModalProps {
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines: EmotionalLine[];
  eventCategories: string[];
  timelineSelectionIds: string[];
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  onUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
  onClose: () => void;
}

type TimelineBlockItem = {
  id: string;
  label: string;
  detail?: string;
  notes?: string;
  startDate: string;
  endDate?: string;
  color: string;
  entityType: 'person' | 'partnership' | 'emotional';
  entityId: string;
  eventId?: string;
};

type TimelineLane = { id: string; label: string; items: TimelineBlockItem[] };

export default function TimelineBoardModal({
  people,
  partnerships,
  allEmotionalLines,
  eventCategories,
  timelineSelectionIds,
  onUpdatePerson,
  onUpdatePartnership,
  onUpdateEmotionalLine,
  onClose,
}: TimelineBoardModalProps) {
  const [timelineFilterStartYear, setTimelineFilterStartYear] = useState<number | null>(null);
  const [timelineFilterEndYear, setTimelineFilterEndYear] = useState<number | null>(null);
  const [timelineYearPickTarget, setTimelineYearPickTarget] = useState<'start' | 'end' | null>(null);
  const [timelineYearDrag, setTimelineYearDrag] = useState<{
    pointerId: number;
    startClientX: number;
    stripLeft: number;
    stripWidth: number;
    startYear: number;
    endYear: number;
    minYear: number;
    maxYear: number;
    moved: boolean;
  } | null>(null);
  const [timelineHoverNote, setTimelineHoverNote] = useState<{ text: string; x: number; y: number } | null>(null);
  const [timelineBoardSelection, setTimelineBoardSelection] = useState<TimelineBoardSelection | null>(null);
  const [timelineBoardEventDraft, setTimelineBoardEventDraft] = useState<{
    event: EmotionalProcessEvent;
    original: EmotionalProcessEvent | null;
    isNew: boolean;
  } | null>(null);

  const handleTimelineStripDragMove = useCallback(
    (clientX: number) => {
      if (!timelineYearDrag) return;
      const dx = clientX - timelineYearDrag.startClientX;
      const spanYears = timelineYearDrag.endYear - timelineYearDrag.startYear;
      const visibleYears = Math.max(1, spanYears + 1);
      const sensitivity = 2.5;
      let deltaYears = Math.trunc(
        (dx / Math.max(1, timelineYearDrag.stripWidth)) * visibleYears * sensitivity
      );
      if (deltaYears === 0 && Math.abs(dx) > 10) {
        deltaYears = dx > 0 ? 1 : -1;
      }
      const maxStart = timelineYearDrag.maxYear - spanYears;
      const nextStart = Math.max(
        timelineYearDrag.minYear,
        Math.min(timelineYearDrag.startYear + deltaYears, maxStart)
      );
      const nextEnd = nextStart + spanYears;
      setTimelineFilterStartYear(nextStart);
      setTimelineFilterEndYear(nextEnd);
      if (!timelineYearDrag.moved && Math.abs(dx) > 3) {
        setTimelineYearDrag((prev) => (prev ? { ...prev, moved: true } : prev));
      }
    },
    [timelineYearDrag]
  );

  const finishTimelineStripDrag = useCallback(
    (clientX: number) => {
      if (!timelineYearDrag) return;
      if (!timelineYearDrag.moved) {
        const relative = (clientX - timelineYearDrag.stripLeft) / Math.max(1, timelineYearDrag.stripWidth);
        const spanYears = timelineYearDrag.endYear - timelineYearDrag.startYear;
        const clickedYear = Math.max(
          timelineYearDrag.startYear,
          Math.min(
            timelineYearDrag.endYear,
            timelineYearDrag.startYear + Math.floor(relative * (spanYears + 1))
          )
        );
        if (timelineYearPickTarget === 'end') {
          const currentStart = timelineFilterStartYear ?? timelineYearDrag.startYear;
          setTimelineFilterEndYear(Math.max(clickedYear, currentStart));
        } else {
          const currentEnd = timelineFilterEndYear ?? timelineYearDrag.endYear;
          setTimelineFilterStartYear(Math.min(clickedYear, currentEnd));
        }
      }
      setTimelineYearDrag(null);
    },
    [timelineYearDrag, timelineYearPickTarget, timelineFilterEndYear, timelineFilterStartYear]
  );

  if (timelineSelectionIds.length === 0) return null;

  const parseTimelineDate = (value?: string) => {
    if (!value) return null;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  };

  const selectedTimelinePeople = people.filter((person) => timelineSelectionIds.includes(person.id));

  const timelineLanes = (() => {
    if (!selectedTimelinePeople.length) return [] as TimelineLane[];
    const lanes: TimelineLane[] = [];
    const selectedIdSet = new Set(selectedTimelinePeople.map((person) => person.id));
    const familyItems: TimelineBlockItem[] = [];
    partnerships.forEach((partnership) => {
      if (!selectedIdSet.has(partnership.partner1_id) && !selectedIdSet.has(partnership.partner2_id)) return;
      if (partnership.relationshipStartDate) {
        const partner1 = people.find((p) => p.id === partnership.partner1_id)?.name || 'Partner 1';
        const partner2 = people.find((p) => p.id === partnership.partner2_id)?.name || 'Partner 2';
        familyItems.push({
          id: `family-prl-${partnership.id}`,
          label: `${partner1} + ${partner2}`,
          detail: partnership.relationshipType,
          notes: partnership.notes,
          startDate: partnership.relationshipStartDate,
          endDate: partnership.divorceDate || partnership.separationDate,
          color: '#dce8ff',
          entityType: 'partnership',
          entityId: partnership.id,
        });
      }
      (partnership.events || []).forEach((event) => {
        if (!event.date) return;
        familyItems.push({
          id: `family-prl-event-${event.id}`,
          label: event.category || 'Relationship Event',
          detail: event.observations || '',
          notes: event.observations || '',
          startDate: event.date,
          color: '#dce8ff',
          entityType: 'partnership',
          entityId: partnership.id,
          eventId: event.id,
        });
      });
    });
    if (familyItems.length) {
      lanes.push({ id: 'family', label: 'Family', items: familyItems });
    }

    selectedTimelinePeople.forEach((person) => {
      const items: TimelineBlockItem[] = [];
      if (person.birthDate) {
        items.push({
          id: `person-birth-${person.id}`,
          label: 'Birth',
          detail: person.birthDate,
          notes: person.notes,
          startDate: person.birthDate,
          color: '#d5f0ff',
          entityType: 'person',
          entityId: person.id,
        });
      }
      if (person.deathDate) {
        items.push({
          id: `person-death-${person.id}`,
          label: 'Death',
          detail: person.deathDate,
          notes: person.notes,
          startDate: person.deathDate,
          color: '#ffd9d9',
          entityType: 'person',
          entityId: person.id,
        });
      }
      (person.events || []).forEach((event) => {
        if (!event.date) return;
        items.push({
          id: `person-event-${event.id}`,
          label: event.category || 'Event',
          detail: event.observations || event.otherPersonName || '',
          notes: event.observations || '',
          startDate: event.date,
          color: '#e8f3ff',
          entityType: 'person',
          entityId: person.id,
          eventId: event.id,
        });
      });
      partnerships
        .filter((p) => p.partner1_id === person.id || p.partner2_id === person.id)
        .forEach((partnership) => {
          if (partnership.relationshipStartDate) {
            const otherId = partnership.partner1_id === person.id ? partnership.partner2_id : partnership.partner1_id;
            const otherName = people.find((p) => p.id === otherId)?.name || 'Partner';
            items.push({
              id: `person-prl-${partnership.id}-${person.id}`,
              label: `${otherName}`,
              detail: partnership.relationshipType,
              notes: partnership.notes,
              startDate: partnership.relationshipStartDate,
              endDate: partnership.divorceDate || partnership.separationDate,
              color: '#f0efff',
              entityType: 'partnership',
              entityId: partnership.id,
            });
          }
        });
      allEmotionalLines
        .filter((line) => line.person1_id === person.id || line.person2_id === person.id)
        .forEach((line) => {
          if (!line.startDate) return;
          const otherId = line.person1_id === person.id ? line.person2_id : line.person1_id;
          const otherName = people.find((p) => p.id === otherId)?.name || 'Other';
          items.push({
            id: `person-epl-${line.id}-${person.id}`,
            label: `${line.relationshipType} · ${otherName}`,
            detail: line.lineStyle,
            notes: line.notes,
            startDate: line.startDate,
            color: '#ffe8f0',
            entityType: 'emotional',
            entityId: line.id,
          });
        });
      lanes.push({ id: person.id, label: person.name || 'Unnamed', items });
    });
    return lanes;
  })();

  const handleTimelineItemClick = (laneLabel: string, item: TimelineBlockItem) => {
    setTimelineHoverNote(null);
    const existingEvent =
      item.eventId && item.entityType === 'person'
        ? people
            .find((entry) => entry.id === item.entityId)
            ?.events?.find((entry) => entry.id === item.eventId)
        : item.eventId && item.entityType === 'partnership'
        ? partnerships
            .find((entry) => entry.id === item.entityId)
            ?.events?.find((entry) => entry.id === item.eventId)
        : item.eventId
        ? allEmotionalLines
            .find((entry) => entry.id === item.entityId)
            ?.events?.find((entry) => entry.id === item.eventId)
        : undefined;
    setTimelineBoardSelection({
      laneLabel,
      entityType: item.entityType,
      entityId: item.entityId,
      eventId: item.eventId,
      itemLabel: item.label,
      startDate: item.startDate,
      endDate: item.endDate,
    });
    if (existingEvent) {
      setTimelineBoardEventDraft({
        event: { ...existingEvent },
        original: { ...existingEvent },
        isNew: false,
      });
    } else {
      setTimelineBoardEventDraft(null);
    }
  };

  const setTimelineEventDraftField = (
    field: 'date' | 'category' | 'observations',
    value: string
  ) => {
    setTimelineBoardEventDraft((prev) =>
      prev
        ? {
            ...prev,
            event: {
              ...prev.event,
              date: field === 'date' ? value : prev.event.date,
              category: field === 'category' ? value : prev.event.category,
              observations: field === 'observations' ? value : prev.event.observations,
            },
          }
        : prev
    );
  };

  const saveTimelineEventDraft = () => {
    if (!timelineBoardSelection || !timelineBoardEventDraft) return;
    const draft: EmotionalProcessEvent = {
      ...timelineBoardEventDraft.event,
      date: timelineBoardEventDraft.event.date || new Date().toISOString().slice(0, 10),
    };
    if (timelineBoardSelection.entityType === 'person') {
      const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
      if (!person) return;
      const nextEvents = timelineBoardEventDraft.isNew
        ? [...(person.events || []), draft]
        : (person.events || []).map((event) => (event.id === draft.id ? draft : event));
      onUpdatePerson(person.id, { events: nextEvents });
    } else if (timelineBoardSelection.entityType === 'partnership') {
      const partnership = partnerships.find((entry) => entry.id === timelineBoardSelection.entityId);
      if (!partnership) return;
      const nextEvents = timelineBoardEventDraft.isNew
        ? [...(partnership.events || []), draft]
        : (partnership.events || []).map((event) => (event.id === draft.id ? draft : event));
      onUpdatePartnership(partnership.id, { events: nextEvents });
    } else {
      const line = allEmotionalLines.find((entry) => entry.id === timelineBoardSelection.entityId);
      if (!line) return;
      const nextEvents = timelineBoardEventDraft.isNew
        ? [...(line.events || []), draft]
        : (line.events || []).map((event) => (event.id === draft.id ? draft : event));
      onUpdateEmotionalLine(line.id, { events: nextEvents });
    }
    setTimelineBoardSelection((prev) =>
      prev
        ? {
            ...prev,
            eventId: draft.id,
            itemLabel: draft.category || prev.itemLabel,
            startDate: draft.date || prev.startDate,
          }
        : prev
    );
    setTimelineBoardEventDraft({
      event: { ...draft },
      original: { ...draft },
      isNew: false,
    });
    if (draft.date) {
      const savedYear = new Date(draft.date).getUTCFullYear();
      if (Number.isFinite(savedYear)) {
        if (selectedStartYear != null && savedYear < selectedStartYear) {
          setTimelineFilterStartYear(savedYear);
        }
        if (selectedEndYear != null && savedYear > selectedEndYear) {
          setTimelineFilterEndYear(savedYear);
        }
      }
    }
  };

  const cancelTimelineEventDraft = () => {
    if (!timelineBoardEventDraft) return;
    if (timelineBoardEventDraft.isNew) {
      setTimelineBoardSelection((prev) => (prev ? { ...prev, eventId: undefined } : prev));
      setTimelineBoardEventDraft(null);
      return;
    }
    if (timelineBoardEventDraft.original) {
      setTimelineBoardEventDraft({
        event: { ...timelineBoardEventDraft.original },
        original: { ...timelineBoardEventDraft.original },
        isNew: false,
      });
    }
  };

  const handleTimelinePersonPropertyChange = (
    field: 'name' | 'notes',
    value: string
  ) => {
    if (!timelineBoardSelection || timelineBoardSelection.entityType !== 'person') return;
    const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
    if (!person) return;
    if (field === 'name') {
      onUpdatePerson(person.id, { name: value });
    } else {
      onUpdatePerson(person.id, { notes: value });
    }
  };

  const addTimelineEventToSelectedPerson = () => {
    if (!timelineBoardSelection || timelineBoardSelection.entityType !== 'person') return;
    const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
    if (!person) return;
    const newEvent: EmotionalProcessEvent = {
      id: nanoid(),
      date: new Date().toISOString().slice(0, 10),
      category: eventCategories[0] || 'Event',
      eventType: 'NODAL',
      status: 'discrete',
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: 5,
      otherPersonName: '',
      primaryPersonName: person.name || '',
      wwwwh: '',
      observations: '',
      priorEventsNote: '',
      reflectionsNote: '',
      createdAt: Date.now(),
      eventClass: 'individual',
    };
    setTimelineBoardSelection({
      laneLabel: person.name || timelineBoardSelection.laneLabel,
      entityType: 'person',
      entityId: person.id,
      eventId: newEvent.id,
      itemLabel: newEvent.category,
      startDate: newEvent.date,
    });
    setTimelineBoardEventDraft({
      event: { ...newEvent },
      original: null,
      isNew: true,
    });
  };

  const timelineSelectionResolved: {
    person?: Person;
    partnership?: Partnership;
    line?: EmotionalLine;
    event?: EmotionalProcessEvent;
  } | null = (() => {
    if (!timelineBoardSelection) return null;
    if (timelineBoardSelection.entityType === 'person') {
      const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
      const event = timelineBoardSelection.eventId
        ? person?.events?.find((entry) => entry.id === timelineBoardSelection.eventId)
        : undefined;
      return { person, event };
    }
    if (timelineBoardSelection.entityType === 'partnership') {
      const partnership = partnerships.find((entry) => entry.id === timelineBoardSelection.entityId);
      const event = timelineBoardSelection.eventId
        ? partnership?.events?.find((entry) => entry.id === timelineBoardSelection.eventId)
        : undefined;
      return { partnership, event };
    }
    const line = allEmotionalLines.find((entry) => entry.id === timelineBoardSelection.entityId);
    const event = timelineBoardSelection.eventId
      ? line?.events?.find((entry) => entry.id === timelineBoardSelection.eventId)
      : undefined;
    return { line, event };
  })();

  const timelineRange = (() => {
    const points: number[] = [];
    timelineLanes.forEach((lane) => {
      lane.items.forEach((item) => {
        const start = parseTimelineDate(item.startDate);
        const end = parseTimelineDate(item.endDate || item.startDate);
        if (start != null) points.push(start);
        if (end != null) points.push(end);
      });
    });
    if (!points.length) return null;
    let min = Math.min(...points);
    let max = Math.max(...points);
    if (min === max) {
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      min -= oneYear;
      max += oneYear;
    }
    return { min, max };
  })();

  const timelineYearBoundsForFilter = (() => {
    if (!timelineRange) return null;
    return {
      min: new Date(timelineRange.min).getUTCFullYear(),
      max: new Date(timelineRange.max).getUTCFullYear(),
    };
  })();

  const selectedStartYear = timelineYearBoundsForFilter
    ? Math.min(
        Math.max(
          timelineFilterStartYear ?? timelineYearBoundsForFilter.min,
          timelineYearBoundsForFilter.min
        ),
        timelineYearBoundsForFilter.max
      )
    : null;

  const selectedEndYear = timelineYearBoundsForFilter
    ? Math.max(
        Math.min(
          timelineFilterEndYear ?? timelineYearBoundsForFilter.max,
          timelineYearBoundsForFilter.max
        ),
        selectedStartYear ?? timelineYearBoundsForFilter.min
      )
    : null;

  const timelineDisplayRange =
    selectedStartYear != null && selectedEndYear != null
      ? {
          min: Date.UTC(selectedStartYear, 0, 1),
          max: Date.UTC(selectedEndYear, 11, 31, 23, 59, 59, 999),
        }
      : timelineRange;

  const timelineYearSlices = (() => {
    if (!timelineDisplayRange || selectedStartYear == null || selectedEndYear == null) {
      return [] as Array<{ year: number; leftPct: number; widthPct: number }>;
    }
    const slices: Array<{ year: number; leftPct: number; widthPct: number }> = [];
    for (let year = selectedStartYear; year <= selectedEndYear; year += 1) {
      const startTs = Date.UTC(year, 0, 1);
      const endTs = Date.UTC(year + 1, 0, 1);
      const leftPct =
        ((startTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) *
        100;
      const widthPct =
        ((endTs - startTs) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
      slices.push({ year, leftPct, widthPct });
    }
    return slices;
  })();

  const timelineHasVisibleItems = (() => {
    if (!timelineDisplayRange) return false;
    return timelineLanes.some((lane) =>
      lane.items.some((item) => {
        const startTs = parseTimelineDate(item.startDate);
        const endTs = parseTimelineDate(item.endDate || item.startDate);
        if (startTs == null || endTs == null) return false;
        return endTs >= timelineDisplayRange.min && startTs <= timelineDisplayRange.max;
      })
    );
  })();

  const sparseYearLabels =
    selectedStartYear != null && selectedEndYear != null
      ? selectedEndYear - selectedStartYear + 1 > 25
      : false;

  const shouldShowYearLabel = (year: number) => {
    if (!sparseYearLabels) return true;
    if (year === selectedStartYear || year === selectedEndYear) return true;
    return year % 5 === 0;
  };

  const applyPickedYear = (year: number) => {
    if (selectedStartYear == null || selectedEndYear == null) return;
    if (timelineYearPickTarget === 'end') {
      setTimelineFilterEndYear(Math.max(year, selectedStartYear));
      return;
    }
    setTimelineFilterStartYear(Math.min(year, selectedEndYear));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
    >
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: '92vw', maxWidth: 1500, maxHeight: '86vh', overflow: 'auto' }}>
        <h4>Timeline Board</h4>
        <div style={{ marginBottom: 8, color: '#555', fontSize: 13 }}>
          People: {selectedTimelinePeople.map((person) => person.name).join(', ')}
        </div>
        {timelineYearBoundsForFilter && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong>Start Year</strong>
              <button
                onClick={() =>
                  setTimelineFilterStartYear((prev) =>
                    Math.min(
                      (prev ?? timelineYearBoundsForFilter.min) + 1,
                      selectedEndYear ?? timelineYearBoundsForFilter.max
                    )
                  )
                }
                aria-label="Increase start year"
              >
                ▲
              </button>
              <input
                type="number"
                value={selectedStartYear ?? ''}
                min={timelineYearBoundsForFilter.min}
                max={selectedEndYear ?? timelineYearBoundsForFilter.max}
                onFocus={() => setTimelineYearPickTarget('start')}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const next = Math.max(
                    timelineYearBoundsForFilter.min,
                    Math.min(parsed, selectedEndYear ?? timelineYearBoundsForFilter.max)
                  );
                  setTimelineFilterStartYear(next);
                }}
                style={{
                  width: 84,
                  border: timelineYearPickTarget === 'start' ? '2px solid #3f7ad6' : undefined,
                }}
              />
              <button
                onClick={() =>
                  setTimelineFilterStartYear((prev) =>
                    Math.max(
                      (prev ?? timelineYearBoundsForFilter.min) - 1,
                      timelineYearBoundsForFilter.min
                    )
                  )
                }
                aria-label="Decrease start year"
              >
                ▼
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong>End Year</strong>
              <button
                onClick={() =>
                  setTimelineFilterEndYear((prev) =>
                    Math.min(
                      (prev ?? timelineYearBoundsForFilter.max) + 1,
                      timelineYearBoundsForFilter.max
                    )
                  )
                }
                aria-label="Increase end year"
              >
                ▲
              </button>
              <input
                type="number"
                value={selectedEndYear ?? ''}
                min={selectedStartYear ?? timelineYearBoundsForFilter.min}
                max={timelineYearBoundsForFilter.max}
                onFocus={() => setTimelineYearPickTarget('end')}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const next = Math.min(
                    timelineYearBoundsForFilter.max,
                    Math.max(parsed, selectedStartYear ?? timelineYearBoundsForFilter.min)
                  );
                  setTimelineFilterEndYear(next);
                }}
                style={{
                  width: 84,
                  border: timelineYearPickTarget === 'end' ? '2px solid #3f7ad6' : undefined,
                }}
              />
              <button
                onClick={() =>
                  setTimelineFilterEndYear((prev) =>
                    Math.max(
                      (prev ?? timelineYearBoundsForFilter.max) - 1,
                      selectedStartYear ?? timelineYearBoundsForFilter.min
                    )
                  )
                }
                aria-label="Decrease end year"
              >
                ▼
              </button>
            </div>
          </div>
        )}
        {!timelineHasVisibleItems || !timelineDisplayRange ? (
          <div style={{ fontStyle: 'italic' }}>No timeline items.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
            <div style={{ border: '1px solid #d7d7d7', borderRadius: 8, overflow: 'hidden', minWidth: 960 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '1px solid #ddd' }}>
                <div style={{ background: '#f0f0f0', padding: '12px 10px', fontWeight: 700 }}>Lane</div>
                <div
                  style={{
                    position: 'relative',
                    minHeight: 30,
                    background: '#fafafa',
                    borderLeft: '1px solid #ddd',
                    cursor: timelineYearDrag ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => {
                    if (
                      selectedStartYear == null ||
                      selectedEndYear == null ||
                      !timelineYearBoundsForFilter
                    ) {
                      return;
                    }
                    e.preventDefault();
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTimelineYearDrag({
                      pointerId: e.pointerId,
                      startClientX: e.clientX,
                      stripLeft: rect.left,
                      stripWidth: rect.width,
                      startYear: selectedStartYear,
                      endYear: selectedEndYear,
                      minYear: timelineYearBoundsForFilter.min,
                      maxYear: timelineYearBoundsForFilter.max,
                      moved: false,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (!timelineYearDrag || timelineYearDrag.pointerId !== e.pointerId) return;
                    handleTimelineStripDragMove(e.clientX);
                  }}
                  onPointerUp={(e) => {
                    if (!timelineYearDrag || timelineYearDrag.pointerId !== e.pointerId) return;
                    finishTimelineStripDrag(e.clientX);
                    if ((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
                      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                    }
                  }}
                  onPointerCancel={(e) => {
                    if (!timelineYearDrag || timelineYearDrag.pointerId !== e.pointerId) return;
                    setTimelineYearDrag(null);
                    if ((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
                      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                    }
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 6,
                      fontSize: 10,
                      color: '#5d6b82',
                      background: 'rgba(255,255,255,0.7)',
                      padding: '1px 5px',
                      borderRadius: 10,
                      border: '1px solid #d5ddec',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    Drag strip to pan years
                  </div>
                  {timelineYearSlices.map((slice, index) => (
                    <div
                      key={`slice-${slice.year}`}
                      onClick={() => applyPickedYear(slice.year)}
                      style={{
                        position: 'absolute',
                        left: `${slice.leftPct}%`,
                        top: 0,
                        width: `${slice.widthPct}%`,
                        height: 30,
                        background: index % 2 === 0 ? '#edf2fc' : '#e4ebfa',
                        borderRight: '1px solid #d5ddec',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#37527a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {shouldShowYearLabel(slice.year) ? slice.year : ''}
                    </div>
                  ))}
                </div>
              </div>
              {timelineLanes.map((lane) => {
                const filteredItems = lane.items.filter((item) => {
                  const startTs = parseTimelineDate(item.startDate);
                  const endTs = parseTimelineDate(item.endDate || item.startDate);
                  if (startTs == null || endTs == null) return false;
                  return endTs >= timelineDisplayRange.min && startTs <= timelineDisplayRange.max;
                });
                const sorted = [...filteredItems].sort((a, b) => {
                  const aStart = parseTimelineDate(a.startDate) ?? Number.MAX_SAFE_INTEGER;
                  const bStart = parseTimelineDate(b.startDate) ?? Number.MAX_SAFE_INTEGER;
                  if (aStart === bStart) return 0;
                  return aStart < bStart ? -1 : 1;
                });
                const rowRightEdges = [-Infinity, -Infinity, -Infinity];
                const place = sorted.map((item) => {
                  const startTs = parseTimelineDate(item.startDate) ?? timelineDisplayRange.min;
                  const endTs = parseTimelineDate(item.endDate || item.startDate) ?? startTs;
                  const leftPct = ((startTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
                  const endPct = ((endTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
                  const spanPct = Math.max(7, endPct - leftPct);
                  const centeredLeftPct = leftPct - spanPct / 2;
                  const clampedLeftPct = Math.max(0, Math.min(centeredLeftPct, 100 - spanPct));
                  let rowIndex = rowRightEdges.findIndex((edge) => leftPct >= edge + 0.6);
                  if (rowIndex === -1) {
                    rowIndex = rowRightEdges.indexOf(Math.min(...rowRightEdges));
                  }
                  rowRightEdges[rowIndex] = Math.max(rowRightEdges[rowIndex], leftPct + spanPct);
                  return {
                    ...item,
                    leftPct,
                    clampedLeftPct,
                    spanPct,
                    rowOffset: rowIndex * 34,
                  };
                });
                const stripSelfName = (value: string, laneLabel: string) => {
                  if (!value) return value;
                  const escaped = laneLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const regex = new RegExp(`\\b${escaped}\\b`, 'ig');
                  return value
                    .replace(regex, '')
                    .replace(/\s*·\s*$/, '')
                    .replace(/^\s*·\s*/, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
                };
                return (
                  <div key={lane.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderTop: '1px dashed #d7d7d7' }}>
                    <div
                      style={{ background: '#f6f6f8', padding: '14px 10px', fontWeight: 700, cursor: lane.id === 'family' ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (lane.id === 'family') return;
                        setTimelineBoardSelection({
                          laneLabel: lane.label,
                          entityType: 'person',
                          entityId: lane.id,
                          itemLabel: lane.label,
                        });
                        setTimelineBoardEventDraft(null);
                      }}
                    >
                      {lane.label}
                    </div>
                    <div style={{ position: 'relative', minHeight: 112, borderLeft: '1px solid #ddd', background: '#fff' }}>
                      {place.map((item) => (
                        <div
                          key={item.id}
                          title={item.notes || ''}
                          onClick={() => handleTimelineItemClick(lane.label, item)}
                          onMouseEnter={(e) => {
                            if (!item.notes) return;
                            setTimelineHoverNote({
                              text: item.notes,
                              x: e.clientX + 10,
                              y: e.clientY + 12,
                            });
                          }}
                          onMouseMove={(e) => {
                            if (!item.notes) return;
                            setTimelineHoverNote({
                              text: item.notes,
                              x: e.clientX + 10,
                              y: e.clientY + 12,
                            });
                          }}
                          onMouseLeave={() => setTimelineHoverNote(null)}
                          style={{
                          position: 'absolute',
                            left: `${item.spanPct <= 8 ? item.clampedLeftPct : item.leftPct}%`,
                            top: 10 + item.rowOffset,
                            width: `${item.spanPct}%`,
                            minWidth: 130,
                            transform: 'none',
                            padding: '6px 10px',
                            borderRadius: 8,
                            border:
                              timelineBoardSelection?.entityId === item.entityId &&
                              timelineBoardSelection?.eventId === item.eventId
                                ? '2px solid #2f64b8'
                                : '1px solid #cad3e0',
                            background: item.color,
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}
                        >
                          <strong>{stripSelfName(item.label, lane.label)}</strong>
                          {item.detail ? ` · ${stripSelfName(item.detail, lane.label)}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ border: '1px solid #d7d7d7', borderRadius: 8, padding: 10, background: '#fcfdff' }}>
              <h5 style={{ margin: '2px 0 8px' }}>Timeline Properties</h5>
              {!timelineBoardSelection ? (
                <div style={{ fontStyle: 'italic', color: '#667' }}>
                  Click an event block or lane name to inspect properties.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div><strong>Lane:</strong> {timelineBoardSelection.laneLabel}</div>
                  <div><strong>Type:</strong> {timelineBoardSelection.entityType}</div>
                  <div><strong>Item:</strong> {timelineBoardSelection.itemLabel}</div>
                  {timelineBoardSelection.startDate && (
                    <div><strong>Start:</strong> {timelineBoardSelection.startDate}</div>
                  )}
                  {timelineBoardSelection.endDate && (
                    <div><strong>End:</strong> {timelineBoardSelection.endDate}</div>
                  )}
                  {timelineBoardSelection.entityType === 'person' && timelineSelectionResolved?.person && (
                    <>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        Person Name
                        <input
                          type="text"
                          value={timelineSelectionResolved.person.name || ''}
                          onChange={(e) =>
                            handleTimelinePersonPropertyChange('name', e.target.value)
                          }
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        Person Notes
                        <textarea
                          rows={4}
                          value={timelineSelectionResolved.person.notes || ''}
                          onChange={(e) =>
                            handleTimelinePersonPropertyChange('notes', e.target.value)
                          }
                          style={{ fontFamily: 'inherit' }}
                        />
                      </label>
                      <button onClick={addTimelineEventToSelectedPerson}>Add Event</button>
                    </>
                  )}
                  {timelineBoardEventDraft && (
                    <>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        Date
                        <input
                          type="date"
                          value={timelineBoardEventDraft.event.date || ''}
                          onChange={(e) => setTimelineEventDraftField('date', e.target.value)}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        Category
                        <input
                          type="text"
                          value={timelineBoardEventDraft.event.category || ''}
                          onChange={(e) => setTimelineEventDraftField('category', e.target.value)}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        Notes
                        <textarea
                          rows={7}
                          value={timelineBoardEventDraft.event.observations || ''}
                          onChange={(e) => setTimelineEventDraftField('observations', e.target.value)}
                          style={{ fontFamily: 'inherit' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={cancelTimelineEventDraft}>Cancel</button>
                        <button onClick={saveTimelineEventDraft}>Save</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {timelineHoverNote && (
          <div
            style={{
              position: 'fixed',
              left: timelineHoverNote.x,
              top: timelineHoverNote.y,
              maxWidth: 320,
              background: '#fff',
              border: '1px solid #b6bfd0',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: '#253044',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              zIndex: 2300,
              pointerEvents: 'none',
              whiteSpace: 'pre-wrap',
            }}
          >
            {timelineHoverNote.text}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
