import React, { useState, useCallback, useMemo } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  NodalCategoryDefinition,
  FunctionalFactCategoryDefinition,
} from '../../types';
import type { TimelineBoardSelection } from '../../types/diagramEditor';
import { nanoid } from 'nanoid';
import EventModal from '../EventModal';

interface TimelineBoardModalProps {
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines: EmotionalLine[];
  eventCategories: string[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  nodalCategories?: NodalCategoryDefinition[];
  functionalFactCategories?: FunctionalFactCategoryDefinition[];
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
  // For partnership entities: which array holds the event. Defaults to 'events'
  // (PRL relationship events). Family / Triangle events live on familyEvents[].
  partnershipTarget?: 'events' | 'familyEvents';
};

type TimelineLane = { id: string; label: string; items: TimelineBlockItem[] };

export default function TimelineBoardModal({
  people,
  partnerships,
  allEmotionalLines,
  eventCategories,
  functionalIndicatorDefinitions = [],
  nodalCategories = [],
  functionalFactCategories = [],
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
  // EventModal state — handles add and edit flows for any entity type
  // (person / partnership / EPL). Replaces the prior simplified inline editor.
  // Mirrors the same EventModal used in the Properties panel's Events tab.
  const [eventModalState, setEventModalState] = useState<{
    draft: EmotionalProcessEvent;
    entityType: 'person' | 'partnership' | 'emotional';
    entityId: string;
    isNew: boolean;
    // For partnership: which array on the partnership owns the event.
    partnershipTarget?: 'events' | 'familyEvents';
  } | null>(null);

  const startAddEventForPerson = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    const today = new Date().toISOString().slice(0, 10);
    const draft: EmotionalProcessEvent = {
      id: nanoid(),
      eventType: 'NODAL',
      eventClass: 'individual',
      anchorType: 'PERSON',
      anchorId: personId,
      category: '',
      subtype: '',
      status: 'discrete',
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: 0,
      date: today,
      startDate: today,
      wwwwh: '',
      observations: '',
      primaryPersonName: person.name || '',
      otherPersonName: 'None',
      createdAt: Date.now(),
    };
    setEventModalState({ draft, entityType: 'person', entityId: personId, isNew: true });
  };

  const startEditEvent = (
    entityType: 'person' | 'partnership' | 'emotional',
    entityId: string,
    event: EmotionalProcessEvent,
    partnershipTarget?: 'events' | 'familyEvents',
  ) => {
    // For synthesized events (id starts with "synth-"), they aren't in
    // events[] yet — saving will append them, effectively promoting them.
    setEventModalState({
      draft: { ...event },
      entityType,
      entityId,
      isNew: !event.id || event.id.startsWith('synth-'),
      partnershipTarget,
    });
  };

  const cancelEventModal = () => setEventModalState(null);

  const saveEventModal = () => {
    if (!eventModalState) return;
    const { draft, entityType, entityId, partnershipTarget } = eventModalState;
    if (entityType === 'person') {
      const person = people.find((p) => p.id === entityId);
      if (!person) { setEventModalState(null); return; }
      const events = person.events || [];
      const idx = events.findIndex((e) => e.id === draft.id);
      const nextEvents = idx === -1 ? [...events, draft] : events.map((e) => (e.id === draft.id ? draft : e));
      onUpdatePerson(entityId, { events: nextEvents });
    } else if (entityType === 'partnership') {
      const partnership = partnerships.find((p) => p.id === entityId);
      if (!partnership) { setEventModalState(null); return; }
      if (partnershipTarget === 'familyEvents') {
        const events = partnership.familyEvents || [];
        const idx = events.findIndex((e) => e.id === draft.id);
        const nextEvents = idx === -1 ? [...events, draft] : events.map((e) => (e.id === draft.id ? draft : e));
        onUpdatePartnership(entityId, { familyEvents: nextEvents });
      } else {
        const events = partnership.events || [];
        const idx = events.findIndex((e) => e.id === draft.id);
        const nextEvents = idx === -1 ? [...events, draft] : events.map((e) => (e.id === draft.id ? draft : e));
        onUpdatePartnership(entityId, { events: nextEvents });
      }
    } else {
      const line = allEmotionalLines.find((l) => l.id === entityId);
      if (!line) { setEventModalState(null); return; }
      const events = line.events || [];
      const idx = events.findIndex((e) => e.id === draft.id);
      const nextEvents = idx === -1 ? [...events, draft] : events.map((e) => (e.id === draft.id ? draft : e));
      onUpdateEmotionalLine(entityId, { events: nextEvents });
    }
    setEventModalState(null);
  };

  const onEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    setEventModalState((prev) =>
      prev ? { ...prev, draft: { ...prev.draft, [field]: value } as EmotionalProcessEvent } : prev,
    );
  };

  const onSetEventDraft = (draft: EmotionalProcessEvent) => {
    setEventModalState((prev) => (prev ? { ...prev, draft } : prev));
  };

  // Compute symptom-type options for the active event (matches PropertiesPanel pattern).
  const eventModalSymptomTypes = useMemo(() => {
    if (!eventModalState) return [] as string[];
    const cat = (eventModalState.draft.category || 'physical').toLowerCase().trim();
    return Array.from(
      new Set(
        functionalIndicatorDefinitions
          .filter((d) => (d.group || 'physical').toLowerCase() === cat)
          .map((d) => d.label?.trim())
          .filter((l): l is string => !!l),
      ),
    );
  }, [eventModalState, functionalIndicatorDefinitions]);

  // Compute primary/other person options for the EventModal based on entity type.
  const eventModalPrimaryPersonOptions = useMemo(() => {
    if (!eventModalState) return [] as string[];
    const { entityType, entityId } = eventModalState;
    if (entityType === 'person') {
      const name = people.find((p) => p.id === entityId)?.name || '';
      return name ? [name] : [];
    }
    if (entityType === 'partnership') {
      const pr = partnerships.find((p) => p.id === entityId);
      const a = people.find((p) => p.id === pr?.partner1_id)?.name || '';
      const b = people.find((p) => p.id === pr?.partner2_id)?.name || '';
      return [a, b].filter(Boolean);
    }
    const line = allEmotionalLines.find((l) => l.id === entityId);
    const a = people.find((p) => p.id === line?.person1_id)?.name || '';
    const b = people.find((p) => p.id === line?.person2_id)?.name || '';
    return [a, b].filter(Boolean);
  }, [eventModalState, people, partnerships, allEmotionalLines]);

  const eventModalOtherPersonOptions = useMemo(() => {
    if (!eventModalState) return ['None'];
    const excludeIds = new Set<string>();
    const { entityType, entityId } = eventModalState;
    if (entityType === 'person') excludeIds.add(entityId);
    else if (entityType === 'partnership') {
      const pr = partnerships.find((p) => p.id === entityId);
      if (pr) { excludeIds.add(pr.partner1_id); excludeIds.add(pr.partner2_id); }
    } else {
      const line = allEmotionalLines.find((l) => l.id === entityId);
      if (line) { excludeIds.add(line.person1_id); excludeIds.add(line.person2_id); }
    }
    return ['None', ...people.filter((p) => !excludeIds.has(p.id)).map((p) => p.name || '').filter(Boolean)];
  }, [eventModalState, people, partnerships, allEmotionalLines]);

  const eventModalResolvedClass: 'individual' | 'relationship' | 'emotional-pattern' =
    eventModalState?.entityType === 'partnership' ? 'relationship'
    : eventModalState?.entityType === 'emotional' ? 'emotional-pattern'
    : 'individual';

  const eventModalTitle = useMemo(() => {
    if (!eventModalState) return '';
    const { entityType, entityId, isNew } = eventModalState;
    const verb = isNew ? 'Add' : 'Edit';
    if (entityType === 'person') {
      const name = people.find((p) => p.id === entityId)?.name || '';
      return `Person ${verb} Event${name ? ` — ${name}` : ''}`;
    }
    if (entityType === 'partnership') {
      const pr = partnerships.find((p) => p.id === entityId);
      const a = people.find((p) => p.id === pr?.partner1_id)?.name || '';
      const b = people.find((p) => p.id === pr?.partner2_id)?.name || '';
      const pair = [a, b].filter(Boolean).join(' + ');
      return `Partnership ${verb} Event${pair ? ` — ${pair}` : ''}`;
    }
    const line = allEmotionalLines.find((l) => l.id === entityId);
    const p1 = people.find((p) => p.id === line?.person1_id)?.name || '';
    const p2 = people.find((p) => p.id === line?.person2_id)?.name || '';
    const pair = [p1, p2].filter(Boolean).join(' ↔ ');
    return `Emotional Pattern ${verb} Event${pair ? ` — ${pair}` : ''}`;
  }, [eventModalState, people, partnerships, allEmotionalLines]);

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

  // Color the timeline box by event intensity:
  //   0 / unset (e.g. birth, marriage) → green,  1 → blue,  2 → yellow,
  //   3 → orange,  4 → pink,  5 → red.
  const intensityToColor = (intensity?: number | null): string => {
    switch (intensity) {
      case 1: return '#cce5ff';
      case 2: return '#fff3cd';
      case 3: return '#ffe5cc';
      case 4: return '#ffd1dc';
      case 5: return '#ffcccc';
      default: return '#cdf5cd';
    }
  };
  const eventStart = (event: EmotionalProcessEvent): string | undefined =>
    event.startDate || event.date || undefined;

  const timelineLanes = (() => {
    if (!selectedTimelinePeople.length) return [] as TimelineLane[];
    const lanes: TimelineLane[] = [];
    const selectedIdSet = new Set(selectedTimelinePeople.map((person) => person.id));

    // FAMILY lane: partnership relationship spans + partnership-level events
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
          color: intensityToColor(0),
          entityType: 'partnership',
          entityId: partnership.id,
        });
      }
      (partnership.events || []).forEach((event) => {
        const start = eventStart(event);
        if (!start) return;
        familyItems.push({
          id: `family-prl-event-${event.id}`,
          label: event.category || 'Relationship Event',
          detail: event.observations || '',
          notes: event.observations || '',
          startDate: start,
          endDate: event.endDate,
          color: intensityToColor(event.intensity),
          entityType: 'partnership',
          entityId: partnership.id,
          eventId: event.id,
          partnershipTarget: 'events',
        });
      });
      // Family-level events (and Triangle events, which also live on
      // familyEvents per the data model) — surface them in the Family lane.
      (partnership.familyEvents || []).forEach((event) => {
        const start = eventStart(event);
        if (!start) return;
        const labelPrefix = event.eventType === 'TRIANGLE' ? 'Triangle' : 'Family';
        familyItems.push({
          id: `family-fam-event-${event.id}`,
          label: event.category || `${labelPrefix} Event`,
          detail: event.subtype || event.observations || '',
          notes: event.observations || '',
          startDate: start,
          endDate: event.endDate,
          color: intensityToColor(event.intensity),
          entityType: 'partnership',
          entityId: partnership.id,
          eventId: event.id,
          partnershipTarget: 'familyEvents',
        });
      });
    });
    if (familyItems.length) {
      lanes.push({ id: 'family', label: 'Family', items: familyItems });
    }

    // PERSON lanes: own events + events from partnerships/EPLs the person
    // is part of. The PRL itself is NOT repeated here — it lives in the
    // Family lane to avoid showing each partnership twice.
    selectedTimelinePeople.forEach((person) => {
      const items: TimelineBlockItem[] = [];
      const seenEventIds = new Set<string>();
      const personEventIds = new Set((person.events || []).map((e) => e.id));
      const personHasBirthEvent = (person.events || []).some(
        (ev) => /^birth$/i.test(ev.category || '') && eventStart(ev),
      );
      if (person.birthDate && !personHasBirthEvent) {
        items.push({
          id: `person-birth-${person.id}`,
          label: 'Birth',
          detail: person.birthDate,
          notes: person.notes,
          startDate: person.birthDate,
          color: intensityToColor(0),
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
          color: intensityToColor(0),
          entityType: 'person',
          entityId: person.id,
        });
      }
      (person.events || []).forEach((event) => {
        const start = eventStart(event);
        if (!start) return;
        if (seenEventIds.has(event.id)) return;
        seenEventIds.add(event.id);
        items.push({
          id: `person-event-${event.id}`,
          label: event.category || 'Event',
          detail: event.observations || event.otherPersonName || '',
          notes: event.observations || '',
          startDate: start,
          endDate: event.endDate,
          color: intensityToColor(event.intensity),
          entityType: 'person',
          entityId: person.id,
          eventId: event.id,
        });
      });
      // Events from partnerships the person is part of (skip if already on
      // person.events through the standard clone path)
      partnerships
        .filter((p) => p.partner1_id === person.id || p.partner2_id === person.id)
        .forEach((partnership) => {
          (partnership.events || []).forEach((event) => {
            const start = eventStart(event);
            if (!start) return;
            if (seenEventIds.has(event.id) || personEventIds.has(event.id)) return;
            seenEventIds.add(event.id);
            items.push({
              id: `person-prl-event-${event.id}-${person.id}`,
              label: event.category || 'Relationship Event',
              detail: event.observations || '',
              notes: event.observations || '',
              startDate: start,
              endDate: event.endDate,
              color: intensityToColor(event.intensity),
              entityType: 'partnership',
              entityId: partnership.id,
              eventId: event.id,
            });
          });
        });
      // Emotional pattern (EPL) span + EPL events
      allEmotionalLines
        .filter((line) => line.person1_id === person.id || line.person2_id === person.id)
        .forEach((line) => {
          const otherId = line.person1_id === person.id ? line.person2_id : line.person1_id;
          const otherName = people.find((p) => p.id === otherId)?.name || 'Other';
          if (line.startDate) {
            items.push({
              id: `person-epl-${line.id}-${person.id}`,
              label: `${line.relationshipType} · ${otherName}`,
              detail: line.lineStyle,
              notes: line.notes,
              startDate: line.startDate,
              endDate: line.endDate,
              color: intensityToColor(0),
              entityType: 'emotional',
              entityId: line.id,
            });
          }
          (line.events || []).forEach((event) => {
            const start = eventStart(event);
            if (!start) return;
            if (seenEventIds.has(event.id) || personEventIds.has(event.id)) return;
            seenEventIds.add(event.id);
            items.push({
              id: `person-epl-event-${event.id}-${person.id}`,
              label: event.category || `${line.relationshipType} Event`,
              detail: event.observations || `with ${otherName}`,
              notes: event.observations || '',
              startDate: start,
              endDate: event.endDate,
              color: intensityToColor(event.intensity),
              entityType: 'emotional',
              entityId: line.id,
              eventId: event.id,
            });
          });
        });
      lanes.push({ id: person.id, label: person.name || 'Unnamed', items });
    });
    return lanes;
  })();

  const handleTimelineItemClick = (laneLabel: string, item: TimelineBlockItem) => {
    setTimelineHoverNote(null);
    setTimelineBoardSelection({
      laneLabel,
      entityType: item.entityType,
      entityId: item.entityId,
      eventId: item.eventId,
      itemLabel: item.label,
      startDate: item.startDate,
      endDate: item.endDate,
    });
    if (!item.eventId) {
      // Span items (PRL, EPL line) — let the right-side panel show their
      // properties; no event editor opens.
      return;
    }
    // Find the existing event in the source entity's events[]. If it's a
    // synthesized id (no real event yet), build a draft from the timeline
    // item so the EventModal opens pre-populated and saving promotes it.
    let existingEvent: EmotionalProcessEvent | undefined;
    if (item.entityType === 'person') {
      existingEvent = people.find((p) => p.id === item.entityId)?.events?.find((e) => e.id === item.eventId);
    } else if (item.entityType === 'partnership') {
      const pr = partnerships.find((p) => p.id === item.entityId);
      const arr = item.partnershipTarget === 'familyEvents' ? pr?.familyEvents : pr?.events;
      existingEvent = arr?.find((e) => e.id === item.eventId);
    } else {
      existingEvent = allEmotionalLines.find((l) => l.id === item.entityId)?.events?.find((e) => e.id === item.eventId);
    }
    if (existingEvent) {
      startEditEvent(item.entityType, item.entityId, existingEvent, item.partnershipTarget);
      return;
    }
    // Synthesized event — fabricate a draft from the timeline item itself.
    const today = new Date().toISOString().slice(0, 10);
    const start = item.startDate || today;
    const draft: EmotionalProcessEvent = {
      id: item.eventId,
      eventType: item.entityType === 'emotional' ? 'EPE' : 'NODAL',
      eventClass:
        item.entityType === 'partnership' ? 'relationship'
        : item.entityType === 'emotional' ? 'emotional-pattern'
        : 'individual',
      anchorType:
        item.entityType === 'partnership' ? 'RELATIONSHIP_PRL'
        : item.entityType === 'emotional' ? 'EMOTIONAL_PROCESS_EP'
        : 'PERSON',
      anchorId: item.entityId,
      category: item.label || '',
      subtype: '',
      status: 'discrete',
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: 0,
      date: start,
      startDate: start,
      endDate: item.endDate,
      wwwwh: '',
      observations: '',
      primaryPersonName: '',
      otherPersonName: 'None',
      createdAt: Date.now(),
    };
    startEditEvent(item.entityType, item.entityId, draft);
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
                // Convert a duration in years to a percentage of the visible
                // timeline range — used to give point events a default width
                // of one year so a "Birth" or "Marriage" reads as a 1-yr block.
                const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
                const visibleSpanMs = Math.max(1, timelineDisplayRange.max - timelineDisplayRange.min);
                const oneYearPct = (ONE_YEAR_MS / visibleSpanMs) * 100;
                const place = sorted.map((item) => {
                  const startTs = parseTimelineDate(item.startDate) ?? timelineDisplayRange.min;
                  const endTsParsed = parseTimelineDate(item.endDate || item.startDate) ?? startTs;
                  const endTs = Math.max(startTs, endTsParsed);
                  const isPointEvent = !item.endDate || endTs === startTs;
                  const leftPct = ((startTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
                  const endPct = ((endTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
                  const spanPct = isPointEvent ? oneYearPct : Math.max(0, endPct - leftPct);
                  let rowIndex = rowRightEdges.findIndex((edge) => leftPct >= edge + 0.6);
                  if (rowIndex === -1) {
                    rowIndex = rowRightEdges.indexOf(Math.min(...rowRightEdges));
                  }
                  rowRightEdges[rowIndex] = Math.max(rowRightEdges[rowIndex], leftPct + spanPct);
                  return {
                    ...item,
                    leftPct,
                    spanPct,
                    isPointEvent,
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
                      style={{ background: '#f6f6f8', padding: '14px 10px', fontWeight: 700, cursor: lane.id === 'family' ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
                      onClick={() => {
                        if (lane.id === 'family') return;
                        setTimelineBoardSelection({
                          laneLabel: lane.label,
                          entityType: 'person',
                          entityId: lane.id,
                          itemLabel: lane.label,
                        });
                      }}
                    >
                      <span>{lane.label}</span>
                      {lane.id !== 'family' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startAddEventForPerson(lane.id); }}
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            border: '1px solid #4b68a6',
                            background: '#e6f0ff',
                            color: '#2f4f8a',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600,
                            alignSelf: 'flex-start',
                          }}
                          title={`Add event for ${lane.label}`}
                        >
                          + Add Event
                        </button>
                      )}
                    </div>
                    <div style={{ position: 'relative', minHeight: 112, borderLeft: '1px solid #ddd', background: '#fff' }}>
                      {place.map((item) => (
                        <React.Fragment key={item.id}>
                        <div
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
                            left: `${item.leftPct}%`,
                            top: 10 + item.rowOffset,
                            width: `${item.spanPct}%`,
                            height: 26,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border:
                              timelineBoardSelection?.entityId === item.entityId &&
                              timelineBoardSelection?.eventId === item.eventId
                                ? '2px solid #2f64b8'
                                : '1px solid #cad3e0',
                            background: item.color,
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                          }}
                        >
                          <strong>{stripSelfName(item.label, lane.label)}</strong>
                          {item.detail ? ` · ${stripSelfName(item.detail, lane.label)}` : ''}
                        </div>
                        </React.Fragment>
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
                      <button
                        onClick={() => {
                          if (timelineBoardSelection?.entityType === 'person' && timelineBoardSelection.entityId) {
                            startAddEventForPerson(timelineBoardSelection.entityId);
                          }
                        }}
                      >
                        Add Event
                      </button>
                      <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 6 }}>
                        Click any event block on the timeline to edit it.
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
      {eventModalState && (
        <EventModal
          eventDraft={eventModalState.draft}
          position={null}
          popupLeft={0}
          popupTop={0}
          popupMaxHeight={null}
          primaryPersonOptions={eventModalPrimaryPersonOptions}
          otherPersonOptions={eventModalOtherPersonOptions}
          eventCategories={eventCategories}
          functionalFactCategoryNames={functionalFactCategories.map((c) => c.name)}
          nodalCategoryNames={nodalCategories.map((c) => c.name)}
          symptomTypeOptions={eventModalSymptomTypes}
          resolvedEventClass={eventModalResolvedClass}
          modalTitle={eventModalTitle}
          onChange={onEventDraftChange}
          onSetDraft={onSetEventDraft}
          onSave={saveEventModal}
          onCancel={cancelEventModal}
        />
      )}
    </div>
  );
}
