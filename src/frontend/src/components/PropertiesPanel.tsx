import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  PersonFunctionalIndicator,
  EventClass,
  EventType,
  EventAnchorType,
  EventContinuationState,
} from '../types';
import {
  FREQUENCY_OPTIONS,
  INTENSITY_OPTIONS,
  IMPACT_OPTIONS,
  clampIndicatorDimension,
} from '../constants/functionalIndicatorScales';
import DatePickerField from './DatePickerField';

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';
const EVENT_CLASS_LABELS: Record<EventClass, string> = {
  individual: 'Individual',
  relationship: 'Relationship',
  'emotional-pattern': 'Emotional Pattern',
};
const formatCategoryStatus = (category: string, status?: string) =>
  status ? `${category} – ${status}` : category;
const createEventId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PARTNERSHIP_DATE_LABELS: Record<
  'relationshipStartDate' | 'marriedStartDate' | 'separationDate' | 'divorceDate',
  string
> = {
  relationshipStartDate: 'Relationship Start',
  marriedStartDate: 'Marriage Start',
  separationDate: 'Separation Date',
  divorceDate: 'Divorce Date',
};
const PERSON_DATE_LABELS: Record<'birthDate' | 'deathDate', string> = {
  birthDate: 'Birth Date',
  deathDate: 'Death Date',
};
const DEFAULT_OBSERVATION = 'Not recorded - ask client';
const DEFAULT_HOW_WELL = 1;
const NODAL_SUBTYPE_OPTIONS = [
  'Birth',
  'Death',
  'Marriage',
  'Separation',
  'Divorce',
  'Move',
  'Job Change',
  'School Change',
  'Illness',
];
const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());
const cloneEventForPerson = (
  base: EmotionalProcessEvent,
  personName: string,
  otherName: string,
  suffix: string
): EmotionalProcessEvent => ({
  ...base,
  id: `${base.id}-${suffix}`,
  primaryPersonName: personName,
  otherPersonName: otherName,
});

const RELATIONSHIP_STATUS_INTENSITY: Record<NonNullable<Partnership['relationshipStatus']>, number> = {
  married: 3,
  separated: 4,
  divorced: 5,
  started: 2,
  ended: 4,
  ongoing: 3,
};
const PERSON_DEFERRED_DATE_FIELDS: (keyof Pick<Person, 'birthDate' | 'deathDate'>)[] = [
  'birthDate',
  'deathDate',
];
const PARTNERSHIP_STRING_FIELDS: (keyof Pick<Partnership, 'relationshipType' | 'relationshipStatus' | 'relationshipStartDate' | 'marriedStartDate' | 'separationDate' | 'divorceDate' | 'notes'>)[] = [
  'relationshipType',
  'relationshipStatus',
  'relationshipStartDate',
  'marriedStartDate',
  'separationDate',
  'divorceDate',
  'notes',
];
const EMOTIONAL_STRING_FIELDS: (keyof Pick<EmotionalLine, 'startDate' | 'endDate' | 'relationshipType' | 'lineStyle' | 'lineEnding' | 'color' | 'notes' | 'status'>)[] = [
  'startDate',
  'endDate',
  'relationshipType',
  'lineStyle',
  'lineEnding',
  'color',
  'notes',
  'status',
];
const getContinuationState = (event: EmotionalProcessEvent): EventContinuationState => {
  const from = !!event.continuesFromPrevious;
  const to = !!event.continuesToNext;
  if (from && to) return 'middle';
  if (!from && to) return 'start';
  if (from && !to) return 'end';
  return 'discrete';
};
const continuationToFlags = (
  state: EventContinuationState
): { continuesFromPrevious: boolean; continuesToNext: boolean } => {
  if (state === 'start') return { continuesFromPrevious: false, continuesToNext: true };
  if (state === 'middle') return { continuesFromPrevious: true, continuesToNext: true };
  if (state === 'end') return { continuesFromPrevious: true, continuesToNext: false };
  return { continuesFromPrevious: false, continuesToNext: false };
};

interface PropertiesPanelProps {
  selectedItem: Person | Partnership | EmotionalLine;
  people: Person[];
  eventCategories: string[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  onUpdatePartnership: (partnershipId: string, updatedProps: Partial<Partnership>) => void;
  onUpdateEmotionalLine: (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => void;
  triangleId?: string;
  triangleColor?: string;
  triangleIntensity?: 'low' | 'medium' | 'high';
  onUpdateTriangleColor?: (triangleId: string, color: string) => void;
  onUpdateTriangleIntensity?: (
    triangleId: string,
    intensity: 'low' | 'medium' | 'high'
  ) => void;
  initialActiveTab?: 'properties' | 'functional' | 'events';
  focusEventId?: string;
  openNewEventRequestId?: string;
  newEventSeed?: Partial<EmotionalProcessEvent> | null;
  onClose: () => void;
}

const PropertiesPanel = ({
  selectedItem,
  people,
  eventCategories,
  functionalIndicatorDefinitions,
  onUpdatePerson,
  onUpdatePartnership,
  onUpdateEmotionalLine,
  triangleId,
  triangleColor,
  triangleIntensity,
  onUpdateTriangleColor,
  onUpdateTriangleIntensity,
  initialActiveTab,
  focusEventId,
  openNewEventRequestId,
  newEventSeed,
  onClose,
}: PropertiesPanelProps) => {
  const isPerson = 'name' in selectedItem;
  const isPartnership = 'partner1_id' in selectedItem && 'children' in selectedItem;
  const isEmotionalLine = 'lineStyle' in selectedItem;
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [eventListMode, setEventListMode] = useState<'compact' | 'expanded'>('compact');
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | EventType>('ALL');
  const [anchorTypeFilter, setAnchorTypeFilter] = useState<'ALL' | EventAnchorType>('ALL');
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<EmotionalProcessEvent | null>(null);
  const [eventRowMenu, setEventRowMenu] = useState<{
    eventId: string;
    x: number;
    y: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'properties' | 'functional' | 'events'>('properties');
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [personPristine, setPersonPristine] = useState(true);
  const [partnershipPristine, setPartnershipPristine] = useState(true);
  const [emotionalPristine, setEmotionalPristine] = useState(true);
  const selectedPerson = isPerson ? (selectedItem as Person) : null;
  const selectedPartnership = isPartnership ? (selectedItem as Partnership) : null;
  const selectedEmotionalLine = isEmotionalLine ? (selectedItem as EmotionalLine) : null;
  const [personDraft, setPersonDraft] = useState<Person | null>(
    selectedPerson ? { ...selectedPerson } : null
  );
  const [partnershipDraft, setPartnershipDraft] = useState<Partnership | null>(
    selectedPartnership ? { ...selectedPartnership } : null
  );
  const [emotionalDraft, setEmotionalDraft] = useState<EmotionalLine | null>(
    selectedEmotionalLine ? { ...selectedEmotionalLine } : null
  );
  const [triangleColorDraft, setTriangleColorDraft] = useState(triangleColor || '#8a5a00');
  const [triangleIntensityDraft, setTriangleIntensityDraft] = useState<'low' | 'medium' | 'high'>(
    triangleIntensity || 'medium'
  );
  const selectedPersonIdRef = useRef<string | null>(selectedPerson?.id ?? null);
  const lastNewEventRequestIdRef = useRef<string | null>(null);
  const deriveFallbackParts = (person: Person | null) => {
    if (!person) {
      return { first: '', last: '' };
    }
    const base = (person.name || '').trim();
    if (!base) return { first: '', last: '' };
    const segments = base.split(/\s+/).filter(Boolean);
    const first = segments.shift() || '';
    const last = segments.join(' ');
    return { first, last };
  };
  const nameFallbackParts = useMemo(
    () => deriveFallbackParts(selectedPerson),
    [selectedPerson]
  );
  const stringDiffers = (a?: string | null, b?: string | null) => (a ?? '') !== (b ?? '');
  const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };

  useEffect(() => {
    setEventModalOpen(false);
    setEventDraft(null);
    setFocusedEventId(focusEventId || null);
    setActiveTab(initialActiveTab || 'properties');
  }, [selectedItem.id, initialActiveTab, focusEventId]);

  useEffect(() => {
    if (!focusEventId) return;
    setFocusedEventId(focusEventId);
    setActiveTab(initialActiveTab || 'events');
  }, [focusEventId, initialActiveTab]);

  useEffect(() => {
    const nextId = selectedPerson?.id ?? null;
    if (selectedPersonIdRef.current === nextId) return;
    selectedPersonIdRef.current = nextId;
    setPersonPristine(true);
    setPersonDraft(selectedPerson ? { ...selectedPerson } : null);
  }, [selectedPerson]);

  useEffect(() => {
    if (!personPristine) return;
    setPersonDraft(selectedPerson ? { ...selectedPerson } : null);
  }, [selectedPerson, personPristine]);

  useEffect(() => {
    setPartnershipPristine(true);
    setPartnershipDraft(selectedPartnership ? { ...selectedPartnership } : null);
  }, [selectedPartnership?.id, selectedPartnership]);

  useEffect(() => {
    if (!partnershipPristine) return;
    setPartnershipDraft(selectedPartnership ? { ...selectedPartnership } : null);
  }, [selectedPartnership, partnershipPristine]);

  useEffect(() => {
    setEmotionalPristine(true);
    setEmotionalDraft(selectedEmotionalLine ? { ...selectedEmotionalLine } : null);
  }, [selectedEmotionalLine?.id, selectedEmotionalLine]);

  useEffect(() => {
    if (!emotionalPristine) return;
    setEmotionalDraft(selectedEmotionalLine ? { ...selectedEmotionalLine } : null);
  }, [selectedEmotionalLine, emotionalPristine]);

  useEffect(() => {
    setTriangleColorDraft(triangleColor || '#8a5a00');
  }, [triangleId, triangleColor]);
  useEffect(() => {
    setTriangleIntensityDraft(triangleIntensity || 'medium');
  }, [triangleId, triangleIntensity]);

  const composeDisplayName = (
    overrides: Partial<Person> = {},
    basePerson: Person | null = selectedPerson
  ) => {
    if (!basePerson) return '';
    const fallbackParts = deriveFallbackParts(basePerson);
    const first =
      overrides.firstName !== undefined
        ? overrides.firstName
        : basePerson.firstName ?? fallbackParts.first;
    const last =
      overrides.lastName !== undefined
        ? overrides.lastName
        : basePerson.lastName ?? fallbackParts.last;
    const fallback =
      overrides.name !== undefined ? overrides.name : basePerson.name || '';
    const combined = [first?.trim(), last?.trim()].filter(Boolean).join(' ').trim();
    return combined || fallback;
  };

  const sanitizePersonIndicators = (
    indicators: PersonFunctionalIndicator[] | undefined,
    definitionId: string,
    next: PersonFunctionalIndicator | null
  ) => {
    const existing = indicators || [];
    const remaining = existing.filter((entry) => entry.definitionId !== definitionId);
    if (!next) {
      return remaining.length ? remaining : undefined;
    }
    return [...remaining, next];
  };

  const buildIndicatorEvent = (
    person: Person,
    definition: FunctionalIndicatorDefinition,
    entry: PersonFunctionalIndicator
  ): EmotionalProcessEvent => {
    const timestamp = entry.lastUpdatedAt ?? Date.now();
    const isoDate =
      entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        ? entry.date
        : new Date(timestamp).toISOString().slice(0, 10);
    return {
      id: createEventId(),
      date: isoDate,
      category: definition.label,
      statusLabel: entry.status === 'none' ? '' : entry.status,
      intensity: entry.intensity ?? 0,
      frequency: entry.frequency ?? 0,
      impact: entry.impact ?? 0,
      howWell: entry.handledWell ?? 5,
      otherPersonName: '',
      primaryPersonName: person.name || '',
      wwwwh: '',
      observations: `Indicator ${definition.label} updated (${entry.status}).`,
      isNodalEvent: false,
      priorEventsNote: '',
      reflectionsNote: '',
      createdAt: timestamp,
      sourceIndicatorId: definition.id,
      eventClass: 'individual',
    };
  };

  const normalizeIndicatorEntry = (
    definitionId: string,
    entry?: PersonFunctionalIndicator
  ): PersonFunctionalIndicator => ({
    definitionId,
    status: entry?.status ?? 'current',
    impact: clampIndicatorDimension(entry?.impact),
    frequency: clampIndicatorDimension(entry?.frequency),
    intensity: clampIndicatorDimension(entry?.intensity),
    handledWell: entry?.handledWell,
    lastUpdatedAt: entry?.lastUpdatedAt,
    date: entry?.date,
  });

  const updateIndicatorEntry = (
    definitionId: string,
    transform: (entry: PersonFunctionalIndicator) => PersonFunctionalIndicator
  ) => {
    const person = selectedItem as Person;
    const existing = person.functionalIndicators?.find((entry) => entry.definitionId === definitionId);
    const normalized = normalizeIndicatorEntry(definitionId, existing);
    const definition = functionalIndicatorDefinitions.find((def) => def.id === definitionId);
    const nextEntry = transform(normalized);
    const now = Date.now();
    const isoDate = new Date(now).toISOString().slice(0, 10);
    const timestampedEntry: PersonFunctionalIndicator = {
      ...nextEntry,
      date: isoDate,
      lastUpdatedAt: now,
    };
    const nextIndicators = sanitizePersonIndicators(person.functionalIndicators, definitionId, timestampedEntry);
    const updates: Partial<Person> = { functionalIndicators: nextIndicators };
    if (definition) {
      const existingEvents = person.events || [];
      const cutoff = now - ONE_HOUR_MS;
      const recentIndex = existingEvents.findIndex(
        (evt) =>
          evt.sourceIndicatorId === definition.id &&
          typeof evt.createdAt === 'number' &&
          evt.createdAt >= cutoff
      );
      const indicatorEvent = buildIndicatorEvent(person, definition, timestampedEntry);
      if (recentIndex !== -1) {
        const prior = existingEvents[recentIndex];
        const mergedEvent: EmotionalProcessEvent = {
          ...prior,
          ...indicatorEvent,
          id: prior.id,
          createdAt: prior.createdAt,
        };
        updates.events = existingEvents.map((evt, idx) => (idx === recentIndex ? mergedEvent : evt));
      } else {
        updates.events = [...existingEvents, indicatorEvent];
      }
    }
    onUpdatePerson(person.id, updates);
  };

  const handleIndicatorStatusChange = (
    definitionId: string,
    status: 'past' | 'current' | 'none'
  ) => {
    const person = selectedItem as Person;
    if (status === 'none') {
      const nextIndicators = sanitizePersonIndicators(person.functionalIndicators, definitionId, null);
      onUpdatePerson(person.id, { functionalIndicators: nextIndicators });
      return;
    }
    updateIndicatorEntry(definitionId, (entry) => ({ ...entry, status }));
  };

  const handleIndicatorImpactChange = (definitionId: string, impactValue: number) => {
    if (Number.isNaN(impactValue)) return;
    const clamped = clampIndicatorDimension(impactValue);
    updateIndicatorEntry(definitionId, (entry) => ({ ...entry, impact: clamped }));
  };

  const handleIndicatorFrequencyChange = (definitionId: string, frequencyValue: number) => {
    if (Number.isNaN(frequencyValue)) return;
    const clamped = clampIndicatorDimension(frequencyValue);
    updateIndicatorEntry(definitionId, (entry) => ({ ...entry, frequency: clamped }));
  };

  const handleIndicatorIntensityChange = (definitionId: string, intensityValue: number) => {
    if (Number.isNaN(intensityValue)) return;
    const clamped = clampIndicatorDimension(intensityValue);
    updateIndicatorEntry(definitionId, (entry) => ({ ...entry, intensity: clamped }));
  };

  const updatePersonDraftState = (updates: Partial<Person>) => {
    setPersonDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handlePersonChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!personDraft) return;
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    let nextValue: any = value;
    if (isCheckbox) {
      nextValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'size') {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) {
        return;
      }
      nextValue = Math.max(20, Math.min(400, numericValue));
    }
    let updates: Partial<Person> = { [name]: nextValue };
    const nextDraft = { ...personDraft, ...updates };
    if (name === 'firstName' || name === 'lastName') {
      updates = { ...updates, name: composeDisplayName({}, nextDraft) };
    }
    updatePersonDraftState(updates);
    const isDeferredDateField = name === 'birthDate' || name === 'deathDate';
    if (!selectedPerson) return;
    if (isDeferredDateField) {
      setPersonPristine(false);
      return;
    }
    // All non-date person properties auto-save and update live.
    onUpdatePerson(selectedPerson.id, updates);
    setPersonPristine(true);
  };

  const adjustPersonSize = (delta: number) => {
    if (!personDraft || !selectedPerson) return;
    const next = Math.max(20, Math.min(400, (personDraft.size ?? 60) + delta));
    // Apply size changes immediately so node size updates live without Save.
    onUpdatePerson(selectedPerson.id, { size: next });
    updatePersonDraftState({ size: next });
    setPersonPristine(true);
  };

  const updatePartnershipDraftState = (updates: Partial<Partnership>) => {
    setPartnershipDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handlePartnershipChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!partnershipDraft) return;
    const { name, value } = e.target;
    updatePartnershipDraftState({ [name]: value } as Partial<Partnership>);
    setPartnershipPristine(false);
  };

  const lineStyleValues: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle'][]> = {
    fusion: ['low', 'medium', 'high'],
    distance: ['dotted', 'dashed', 'long-dash'],
    cutoff: ['cutoff'],
    conflict: ['dotted-saw-tooth', 'solid-saw-tooth', 'double-saw-tooth'],
    projection: ['low', 'medium', 'high'],
  };

  const updateEmotionalDraftState = (updates: Partial<EmotionalLine>) => {
    setEmotionalDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const styleOptionMeta = (relationshipType: EmotionalLine['relationshipType']) => {
    switch (relationshipType) {
      case 'fusion':
        return [
          { value: 'low', label: 'Low (double dotted lines)' },
          { value: 'medium', label: 'Medium (double solid lines)' },
          { value: 'high', label: 'High (triple solid lines)' },
        ];
      case 'distance':
        return [
          { value: 'dotted', label: 'Low (dotted)' },
          { value: 'dashed', label: 'Medium (short dash)' },
          { value: 'long-dash', label: 'High (long dash)' },
        ];
      case 'conflict':
        return [
          { value: 'dotted-saw-tooth', label: 'Low (dotted sawtooth)' },
          { value: 'solid-saw-tooth', label: 'Medium (solid sawtooth)' },
          { value: 'double-saw-tooth', label: 'High (double sawtooth)' },
        ];
      case 'projection':
        return [
          { value: 'low', label: 'Low (>...>)' },
          { value: 'medium', label: 'Medium (>.>)' },
          { value: 'high', label: 'High (>>>>)' },
        ];
      default:
        return [{ value: 'cutoff', label: 'Cutoff' }];
    }
  };

  const handleEmotionalLineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!emotionalDraft) return;
    const { name, value } = e.target;

    if (name === 'relationshipType') {
      const newRelationshipType = value as EmotionalLine['relationshipType'];
      const availableStyles = lineStyleValues[newRelationshipType] || ['low'];
      const currentStyle = emotionalDraft.lineStyle;
      const nextStyle = availableStyles.includes(currentStyle)
        ? currentStyle
        : availableStyles[0];
      updateEmotionalDraftState({
        relationshipType: newRelationshipType,
        lineStyle: nextStyle,
      });
    } else if (name === 'lineStyle') {
      updateEmotionalDraftState({ [name]: value as EmotionalLine['lineStyle'] });
    } else if (name === 'lineEnding') {
      updateEmotionalDraftState({ [name]: value as EmotionalLine['lineEnding'] });
    } else if (name === 'status') {
      updateEmotionalDraftState({ status: value as EmotionalLine['status'] });
    }
    setEmotionalPristine(false);
  };

  const handleEmotionalLineInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!emotionalDraft) return;
    updateEmotionalDraftState({ [e.target.name]: e.target.value } as Partial<EmotionalLine>);
    setEmotionalPristine(false);
  };

  const buildPersonDateEvent = (
    person: Person,
    field: keyof typeof PERSON_DATE_LABELS,
    dateValue: string
  ): EmotionalProcessEvent => {
    const displayName = composeDisplayName({}, person) || person.name || '';
    return {
      id: createEventId(),
      date: dateValue,
      category: 'Individual',
      statusLabel: PERSON_DATE_LABELS[field],
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: '',
      primaryPersonName: displayName,
      wwwwh: DEFAULT_OBSERVATION,
      observations: person.notes || DEFAULT_OBSERVATION,
      isNodalEvent: true,
      eventClass: 'individual',
      createdAt: Date.now(),
    };
  };

  type PartnershipDateField = keyof typeof PARTNERSHIP_DATE_LABELS;

  const buildPartnershipEvent = (
    partnership: Partnership,
    field: PartnershipDateField,
    dateValue: string
  ): EmotionalProcessEvent | null => {
    if (!DATE_PATTERN.test(dateValue)) return null;
    const partner1 = people.find((person) => person.id === partnership.partner1_id);
    const partner2 = people.find((person) => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return null;
    const label = PARTNERSHIP_DATE_LABELS[field];
    return {
      id: createEventId(),
      date: dateValue,
      category: toTitleCase(partnership.relationshipType),
      statusLabel: `${toTitleCase(partnership.relationshipStatus)} – ${label}`,
      intensity: RELATIONSHIP_STATUS_INTENSITY[partnership.relationshipStatus] ?? 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: partner2.name || '',
      primaryPersonName: partner1.name || '',
      wwwwh: DEFAULT_OBSERVATION,
      observations: partnership.notes || DEFAULT_OBSERVATION,
      isNodalEvent: true,
      eventClass: 'relationship',
      createdAt: Date.now(),
    };
  };

  type EmotionalDateField = 'startDate' | 'endDate';

  const buildEmotionalLineEvent = (
    line: EmotionalLine,
    field: EmotionalDateField,
    dateValue: string
  ): EmotionalProcessEvent | null => {
    if (!DATE_PATTERN.test(dateValue)) return null;
    const person1 = people.find((person) => person.id === line.person1_id);
    const person2 = people.find((person) => person.id === line.person2_id);
    if (!person1 || !person2) return null;
    const stageLabel = field === 'startDate' ? 'Pattern Start' : 'Pattern End';
    const statusText = toTitleCase(line.status || 'ongoing');
    return {
      id: createEventId(),
      date: dateValue,
      category: toTitleCase(line.relationshipType),
      statusLabel: `${statusText} – ${stageLabel}`,
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: person2.name || '',
      primaryPersonName: person1.name || '',
      wwwwh: DEFAULT_OBSERVATION,
      observations: line.notes || DEFAULT_OBSERVATION,
      isNodalEvent: true,
      eventClass: 'emotional-pattern',
      createdAt: Date.now(),
    };
  };

  const appendEventsToPerson = (personId: string, events: EmotionalProcessEvent[]) => {
    if (!events.length) return;
    const target = people.find((person) => person.id === personId);
    if (!target) return;
    const existing = target.events || [];
    onUpdatePerson(personId, { events: [...existing, ...events] });
  };

  const personDirty = useMemo(() => {
    if (!selectedPerson || !personDraft) return false;
    return PERSON_DEFERRED_DATE_FIELDS.some((field) =>
      stringDiffers(personDraft[field], selectedPerson[field])
    );
  }, [selectedPerson, personDraft]);

  const savePersonProperties = () => {
    if (!selectedPerson || !personDraft || !personDirty) return;
    const updates: Partial<Person> = {};
    const newEvents: EmotionalProcessEvent[] = [];
    PERSON_DEFERRED_DATE_FIELDS.forEach((field) => {
      const prev = selectedPerson[field] ?? '';
      const next = personDraft[field] ?? '';
      if (prev !== next) {
        updates[field] = next || undefined;
        if (next && DATE_PATTERN.test(next)) {
          const event = buildPersonDateEvent(personDraft, field, next);
          if (event) newEvents.push(event);
        }
      }
    });
    if (newEvents.length) {
      updates.events = [...(selectedPerson.events || []), ...newEvents];
    }
    if (!Object.keys(updates).length) {
      setPersonPristine(true);
      setPersonDraft({ ...selectedPerson });
      return;
    }
    onUpdatePerson(selectedPerson.id, updates);
    setPersonDraft((prev) => (prev ? { ...prev, ...updates } : prev));
    setPersonPristine(true);
  };

  const cancelPersonChanges = () => {
    if (!selectedPerson) return;
    setPersonDraft({ ...selectedPerson });
    setPersonPristine(true);
  };

  const partnershipDirty = useMemo(() => {
    if (!selectedPartnership || !partnershipDraft) return false;
    return PARTNERSHIP_STRING_FIELDS.some((field) =>
      stringDiffers(partnershipDraft[field], selectedPartnership[field])
    );
  }, [selectedPartnership, partnershipDraft]);

  const savePartnershipProperties = () => {
    if (!selectedPartnership || !partnershipDraft || !partnershipDirty) return;
    const partner1 = people.find((person) => person.id === selectedPartnership.partner1_id);
    const partner2 = people.find((person) => person.id === selectedPartnership.partner2_id);
    const updates: Partial<Partnership> = {};
    PARTNERSHIP_STRING_FIELDS.forEach((field) => {
      if (stringDiffers(partnershipDraft[field], selectedPartnership[field])) {
        const value = partnershipDraft[field];
        (updates as any)[field] = value && value !== '' ? value : undefined;
      }
    });
    const newEvents: EmotionalProcessEvent[] = [];
    (Object.keys(PARTNERSHIP_DATE_LABELS) as PartnershipDateField[]).forEach((field) => {
      const prev = selectedPartnership[field] ?? '';
      const next = partnershipDraft[field] ?? '';
      if (prev !== next) {
        updates[field] = next || undefined;
        if (next) {
          const event = buildPartnershipEvent(partnershipDraft, field, next);
          if (event) newEvents.push(event);
        }
      }
    });
    if (newEvents.length) {
      updates.events = [...(selectedPartnership.events || []), ...newEvents];
      if (partner1 && partner2) {
        appendEventsToPerson(
          partner1.id,
          newEvents.map((event) =>
            cloneEventForPerson(event, partner1.name || '', partner2.name || '', 'p1')
          )
        );
        appendEventsToPerson(
          partner2.id,
          newEvents.map((event) =>
            cloneEventForPerson(event, partner2.name || '', partner1.name || '', 'p2')
          )
        );
      }
    }
    if (!Object.keys(updates).length) {
      setPartnershipPristine(true);
      setPartnershipDraft({ ...selectedPartnership });
      return;
    }
    onUpdatePartnership(selectedPartnership.id, updates);
    setPartnershipDraft((prev) => (prev ? { ...prev, ...updates } : prev));
    setPartnershipPristine(true);
  };

  const cancelPartnershipChanges = () => {
    if (!selectedPartnership) return;
    setPartnershipDraft({ ...selectedPartnership });
    setPartnershipPristine(true);
  };

  const emotionalDirty = useMemo(() => {
    if (!selectedEmotionalLine || !emotionalDraft) return false;
    return EMOTIONAL_STRING_FIELDS.some((field) =>
      stringDiffers(emotionalDraft[field], selectedEmotionalLine[field])
    );
  }, [selectedEmotionalLine, emotionalDraft]);
  const triangleColorDirty = useMemo(() => {
    if (!triangleId) return false;
    return triangleColorDraft !== (triangleColor || '#8a5a00');
  }, [triangleId, triangleColor, triangleColorDraft]);
  const triangleIntensityDirty = useMemo(() => {
    if (!triangleId) return false;
    return triangleIntensityDraft !== (triangleIntensity || 'medium');
  }, [triangleId, triangleIntensity, triangleIntensityDraft]);

  const saveEmotionalLineProperties = () => {
    if (
      !selectedEmotionalLine ||
      !emotionalDraft ||
      (!emotionalDirty && !triangleColorDirty && !triangleIntensityDirty)
    ) {
      return;
    }
    const updates: Partial<EmotionalLine> = {};
    EMOTIONAL_STRING_FIELDS.forEach((field) => {
      if (stringDiffers(emotionalDraft[field], selectedEmotionalLine[field])) {
        const value = emotionalDraft[field];
        (updates as any)[field] = value && value !== '' ? value : undefined;
      }
    });
    const newEvents: EmotionalProcessEvent[] = [];
    (['startDate', 'endDate'] as EmotionalDateField[]).forEach((field) => {
      const prev = selectedEmotionalLine[field] ?? '';
      const next = emotionalDraft[field] ?? '';
      if (prev !== next) {
        updates[field] = next || undefined;
        if (next) {
          const event = buildEmotionalLineEvent(emotionalDraft, field, next);
          if (event) newEvents.push(event);
        }
      }
    });
    if (newEvents.length) {
      updates.events = [...(selectedEmotionalLine.events || []), ...newEvents];
    }
    if (triangleId && onUpdateTriangleColor && triangleColorDirty) {
      onUpdateTriangleColor(triangleId, triangleColorDraft);
    }
    if (triangleId && onUpdateTriangleIntensity && triangleIntensityDirty) {
      onUpdateTriangleIntensity(triangleId, triangleIntensityDraft);
    }
    if (!Object.keys(updates).length) {
      setEmotionalPristine(true);
      setEmotionalDraft({ ...selectedEmotionalLine });
      return;
    }
    onUpdateEmotionalLine(selectedEmotionalLine.id, updates);
    setEmotionalDraft((prev) => (prev ? { ...prev, ...updates } : prev));
    setEmotionalPristine(true);
  };

  const cancelEmotionalChanges = () => {
    if (!selectedEmotionalLine) return;
    setEmotionalDraft({ ...selectedEmotionalLine });
    setTriangleColorDraft(triangleColor || '#8a5a00');
    setTriangleIntensityDraft(triangleIntensity || 'medium');
    setEmotionalPristine(true);
  };

  const termLabel = () => {
    if (isPerson) return 'Person (Person Node)';
    if (isPartnership) return 'Partner Relationship Line (PRL)';
    if (isEmotionalLine) return 'Emotional Pattern Line (EPL)';
    return '';
  };

  const getEvents = useCallback(() => {
    if (isPerson) return (selectedItem as Person).events || [];
    if (isPartnership) return (selectedItem as Partnership).events || [];
    return (selectedItem as EmotionalLine).events || [];
  }, [isPerson, isPartnership, selectedItem]);
  const resolveEventClass = useCallback(
    (): EventClass => (isEmotionalLine ? 'emotional-pattern' : isPartnership ? 'relationship' : 'individual'),
    [isEmotionalLine, isPartnership]
  );
  const resolveAnchorType = useCallback(
    (): EventAnchorType =>
      isEmotionalLine ? 'EMOTIONAL_PROCESS_EP' : isPartnership ? 'RELATIONSHIP_PRL' : 'PERSON',
    [isEmotionalLine, isPartnership]
  );
  const resolveDefaultEventType = useCallback(
    (): EventType => (isEmotionalLine ? 'EPE' : 'FF'),
    [isEmotionalLine]
  );
  const inferEventType = (event: EmotionalProcessEvent): EventType => {
    if (event.eventType) return event.eventType;
    if (event.isNodalEvent) return 'NODAL';
    if (event.eventClass === 'emotional-pattern') return 'EPE';
    return 'FF';
  };
  const normalizeEventDate = (event: EmotionalProcessEvent): string =>
    event.startDate || event.date || '';
  const eventSeriesKey = (event: EmotionalProcessEvent) => {
    const eventType = inferEventType(event);
    const anchorType = event.anchorType || resolveAnchorType();
    const anchorId = event.anchorId || selectedItem.id;
    const process =
      eventType === 'EPE' ? event.emotionalProcessType || event.category || '' : '';
    return `${anchorType}|${anchorId}|${eventType}|${process}`;
  };
  const descriptorForEvent = (event: EmotionalProcessEvent) => {
    const eventType = inferEventType(event);
    if (eventType === 'NODAL') return event.nodalEventSubtype || event.statusLabel || 'Nodal Event';
    if (eventType === 'EPE') {
      const process = event.emotionalProcessType || event.category || 'EPE';
      return `${process} · F${event.frequency ?? 0}/I${event.intensity ?? 0}/Imp${event.impact ?? 0}`;
    }
    return event.category || 'Functional Fact';
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
  const emotionalLinePeople = useMemo(() => {
    if (!isEmotionalLine) return { person1Name: '', person2Name: '' };
    const line = selectedItem as EmotionalLine;
    const person1 = people.find((person) => person.id === line.person1_id);
    const person2 = people.find((person) => person.id === line.person2_id);
    return { person1Name: person1?.name || '', person2Name: person2?.name || '' };
  }, [isEmotionalLine, selectedItem, people]);
  const otherPersonOptions = useMemo(() => {
    if (isEmotionalLine) {
      return [emotionalLinePeople.person1Name, emotionalLinePeople.person2Name].filter(Boolean);
    }
    if (isPartnership) {
      const partnership = selectedItem as Partnership;
      const partner1 = people.find((person) => person.id === partnership.partner1_id);
      const partner2 = people.find((person) => person.id === partnership.partner2_id);
      return [partner1?.name || '', partner2?.name || ''].filter(Boolean);
    }
    if (isPerson) {
      const person = selectedItem as Person;
      return people.filter((p) => p.id !== person.id).map((p) => p.name).filter(Boolean);
    }
    return people.map((person) => person.name).filter(Boolean);
  }, [isEmotionalLine, isPartnership, isPerson, selectedItem, people, emotionalLinePeople]);
  const primaryPersonOptions = useMemo(() => {
    if (isPerson) {
      const person = selectedItem as Person;
      return [person.name || ''].filter(Boolean);
    }
    if (isPartnership) {
      const partnership = selectedItem as Partnership;
      const partner1 = people.find((person) => person.id === partnership.partner1_id);
      const partner2 = people.find((person) => person.id === partnership.partner2_id);
      return [partner1?.name || '', partner2?.name || ''].filter(Boolean);
    }
    if (isEmotionalLine) {
      return [emotionalLinePeople.person1Name, emotionalLinePeople.person2Name].filter(Boolean);
    }
    return [];
  }, [isPerson, isPartnership, isEmotionalLine, selectedItem, people, emotionalLinePeople]);
  const currentAnchorType: EventAnchorType = isEmotionalLine
    ? 'EMOTIONAL_PROCESS_EP'
    : isPartnership
    ? 'RELATIONSHIP_PRL'
    : 'PERSON';
  const filteredAndSortedEvents = useMemo(() => {
    const events = [...getEvents()];
    const currentAnchorId = selectedItem.id;
    const filtered = events.filter((event) => {
      const eventType = inferEventType(event);
      const anchorType = event.anchorType || currentAnchorType;
      if (eventTypeFilter !== 'ALL' && eventType !== eventTypeFilter) return false;
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
  }, [getEvents, eventSortOrder, eventTypeFilter, anchorTypeFilter, selectedItem.id, currentAnchorType]);

  const buildEventDraft = useCallback((
    eventType: EventType,
    seed?: Partial<EmotionalProcessEvent> | null
  ): EmotionalProcessEvent => {
    const anchorType = resolveAnchorType();
    const anchorId = selectedItem.id;
    const anchorEvents = getEvents();
    const processType =
      seed?.emotionalProcessType ||
      (eventType === 'EPE' && isEmotionalLine
        ? (selectedItem as EmotionalLine).relationshipType
        : '');
    const similarEvents = anchorEvents
      .filter((event) => {
        const eType = inferEventType(event);
        if (eType !== eventType) return false;
        if ((event.anchorType || anchorType) !== anchorType) return false;
        if ((event.anchorId || anchorId) !== anchorId) return false;
        if (eventType === 'EPE') {
          return (event.emotionalProcessType || event.category || '') === processType;
        }
        return true;
      })
      .sort((a, b) => {
        const aTs = normalizeEventDate(a) ? new Date(normalizeEventDate(a)).getTime() : 0;
        const bTs = normalizeEventDate(b) ? new Date(normalizeEventDate(b)).getTime() : 0;
        return bTs - aTs;
      });
    const latest = similarEvents[0];
    const baseDate = seed?.startDate || seed?.date || latest?.startDate || latest?.date || new Date().toISOString().slice(0, 10);
    const baseEndDate = seed?.endDate || latest?.endDate || '';
    return {
      id: createEventId(),
      date: baseDate,
      startDate: baseDate,
      endDate: baseEndDate,
      category: seed?.category || latest?.category || eventCategories[0] || (eventType === 'EPE' ? 'Emotional Process' : 'Functional Fact'),
      eventType,
      nodalEventSubtype: seed?.nodalEventSubtype || latest?.nodalEventSubtype || '',
      emotionalProcessType: processType || latest?.emotionalProcessType || '',
      anchorType,
      anchorId,
      statusLabel: seed?.statusLabel || latest?.statusLabel || '',
      intensity: typeof (seed?.intensity ?? latest?.intensity) === 'number' ? Number(seed?.intensity ?? latest?.intensity) : 0,
      frequency: typeof (seed?.frequency ?? latest?.frequency) === 'number' ? Number(seed?.frequency ?? latest?.frequency) : 0,
      impact: typeof (seed?.impact ?? latest?.impact) === 'number' ? Number(seed?.impact ?? latest?.impact) : 0,
      howWell: typeof (seed?.howWell ?? latest?.howWell) === 'number' ? Number(seed?.howWell ?? latest?.howWell) : 5,
      otherPersonName: seed?.otherPersonName || latest?.otherPersonName || otherPersonOptions[0] || '',
      primaryPersonName: seed?.primaryPersonName || latest?.primaryPersonName || primaryPersonOptions[0] || '',
      wwwwh: seed?.wwwwh || latest?.wwwwh || '',
      observations: seed?.observations || latest?.observations || '',
      priorEventsNote: seed?.priorEventsNote || latest?.priorEventsNote || '',
      reflectionsNote: seed?.reflectionsNote || latest?.reflectionsNote || '',
      isNodalEvent: eventType === 'NODAL',
      continuesFromPrevious: seed?.continuesFromPrevious ?? false,
      continuesToNext: seed?.continuesToNext ?? false,
      createdAt: Date.now(),
      eventClass: (seed?.eventClass as EventClass) || latest?.eventClass || resolveEventClass(),
    };
  }, [
    eventCategories,
    getEvents,
    isEmotionalLine,
    otherPersonOptions,
    primaryPersonOptions,
    resolveAnchorType,
    resolveEventClass,
    selectedItem,
  ]);

  const openNewEvent = (seed?: Partial<EmotionalProcessEvent> | null) => {
    const eventType = (seed?.eventType as EventType) || resolveDefaultEventType();
    setEventDraft(buildEventDraft(eventType, seed));
    setEventModalOpen(true);
  };

  const openEditEvent = (event: EmotionalProcessEvent) => {
    setFocusedEventId(event.id);
    setEventDraft({
      ...event,
      category: event.category || eventCategories[0] || '',
      eventType: inferEventType(event),
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || '',
      nodalEventSubtype: event.nodalEventSubtype || '',
      emotionalProcessType: event.emotionalProcessType || '',
      anchorType: event.anchorType || resolveAnchorType(),
      anchorId: event.anchorId || selectedItem.id,
      otherPersonName: event.otherPersonName || otherPersonOptions[0] || '',
      primaryPersonName: event.primaryPersonName || primaryPersonOptions[0] || '',
      frequency: typeof event.frequency === 'number' ? event.frequency : 0,
      impact: typeof event.impact === 'number' ? event.impact : 0,
      intensity: typeof event.intensity === 'number' ? event.intensity : 0,
      priorEventsNote: event.priorEventsNote || '',
      reflectionsNote: event.reflectionsNote || '',
      statusLabel: event.statusLabel || '',
      continuesFromPrevious: !!event.continuesFromPrevious,
      continuesToNext: !!event.continuesToNext,
      createdAt: event.createdAt ?? Date.now(),
      eventClass: event.eventClass || resolveEventClass(),
    });
    setEventModalOpen(true);
  };

  useEffect(() => {
    if (!openNewEventRequestId || openNewEventRequestId === lastNewEventRequestIdRef.current) return;
    lastNewEventRequestIdRef.current = openNewEventRequestId;
    setActiveTab('events');
    const eventType = (newEventSeed?.eventType as EventType) || resolveDefaultEventType();
    setEventDraft(buildEventDraft(eventType, newEventSeed || null));
    setEventModalOpen(true);
  }, [openNewEventRequestId, newEventSeed, resolveDefaultEventType, buildEventDraft]);

  const handleEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    if (!eventDraft) return;
    if (field === 'intensity' || field === 'howWell' || field === 'frequency' || field === 'impact') {
      const numeric = Number(value);
      setEventDraft({ ...eventDraft, [field]: Number.isNaN(numeric) ? 0 : numeric });
      return;
    }
    if (field === 'isNodalEvent') {
      const isNodal = value === 'true';
      setEventDraft({
        ...eventDraft,
        isNodalEvent: isNodal,
        eventType: isNodal ? 'NODAL' : eventDraft.eventType || resolveDefaultEventType(),
      });
      return;
    }
    setEventDraft({ ...eventDraft, [field]: value });
  };

  const saveEvent = () => {
    if (!eventDraft) return;
    const normalizedType = eventDraft.eventType || inferEventType(eventDraft);
    const normalizedStart = eventDraft.startDate || eventDraft.date || '';
    const cleanedDraft = {
      ...eventDraft,
      eventType: normalizedType,
      anchorType: eventDraft.anchorType || resolveAnchorType(),
      anchorId: eventDraft.anchorId || selectedItem.id,
      startDate: normalizedStart,
      date: normalizedStart,
      otherPersonName: eventDraft.otherPersonName || otherPersonOptions[0] || '',
      primaryPersonName: eventDraft.primaryPersonName || primaryPersonOptions[0] || '',
      intensity: typeof eventDraft.intensity === 'number' ? eventDraft.intensity : 0,
      frequency: typeof eventDraft.frequency === 'number' ? eventDraft.frequency : 0,
      impact: typeof eventDraft.impact === 'number' ? eventDraft.impact : 0,
      priorEventsNote: eventDraft.priorEventsNote || '',
      reflectionsNote: eventDraft.reflectionsNote || '',
      statusLabel: eventDraft.statusLabel || '',
      createdAt: eventDraft.createdAt ?? Date.now(),
      sourceIndicatorId: eventDraft.sourceIndicatorId,
      eventClass: eventDraft.eventClass || resolveEventClass(),
      isNodalEvent: normalizedType === 'NODAL',
    };
    const events = getEvents();
    const existingIndex = events.findIndex((evt) => evt.id === eventDraft.id);
    const nextEvents = existingIndex === -1
      ? [...events, cleanedDraft]
      : events.map((evt) => (evt.id === eventDraft.id ? cleanedDraft : evt));
    if (isPerson) {
      onUpdatePerson(selectedItem.id, { events: nextEvents });
    } else if (isPartnership) {
      onUpdatePartnership(selectedItem.id, { events: nextEvents });
    } else {
      onUpdateEmotionalLine(selectedItem.id, { events: nextEvents });
    }
    setEventModalOpen(false);
    setEventDraft(null);
  };

  const saveEvents = (nextEvents: EmotionalProcessEvent[]) => {
    if (isPerson) {
      onUpdatePerson(selectedItem.id, { events: nextEvents });
      return;
    }
    if (isPartnership) {
      onUpdatePartnership(selectedItem.id, { events: nextEvents });
      return;
    }
    onUpdateEmotionalLine(selectedItem.id, { events: nextEvents });
  };

  const getSeriesOrderedIndexes = (events: EmotionalProcessEvent[], eventId: string) => {
    const index = events.findIndex((event) => event.id === eventId);
    if (index === -1) return { index: -1, prevIndex: -1, nextIndex: -1 };
    const key = eventSeriesKey(events[index]);
    const series = events
      .map((event, idx) => ({ event, idx }))
      .filter((entry) => eventSeriesKey(entry.event) === key)
      .sort((a, b) => {
        const aTs = normalizeEventDate(a.event) ? new Date(normalizeEventDate(a.event)).getTime() : Number.MAX_SAFE_INTEGER;
        const bTs = normalizeEventDate(b.event) ? new Date(normalizeEventDate(b.event)).getTime() : Number.MAX_SAFE_INTEGER;
        return aTs - bTs;
      });
    const seriesPos = series.findIndex((entry) => entry.idx === index);
    return {
      index,
      prevIndex: seriesPos > 0 ? series[seriesPos - 1].idx : -1,
      nextIndex: seriesPos >= 0 && seriesPos < series.length - 1 ? series[seriesPos + 1].idx : -1,
    };
  };

  const linkEventToAdjacent = (eventId: string, direction: 'prev' | 'next', attach: boolean) => {
    const events = [...getEvents()];
    const { index, prevIndex, nextIndex } = getSeriesOrderedIndexes(events, eventId);
    if (index === -1) return;
    const adjacentIndex = direction === 'prev' ? prevIndex : nextIndex;
    if (adjacentIndex === -1) return;
    if (direction === 'prev') {
      events[index] = { ...events[index], continuesFromPrevious: attach };
      events[adjacentIndex] = { ...events[adjacentIndex], continuesToNext: attach };
    } else {
      events[index] = { ...events[index], continuesToNext: attach };
      events[adjacentIndex] = { ...events[adjacentIndex], continuesFromPrevious: attach };
    }
    saveEvents(events);
  };

  const createAndAttachAdjacent = (eventId: string, direction: 'prev' | 'next') => {
    const events = [...getEvents()];
    const sourceIndex = events.findIndex((event) => event.id === eventId);
    if (sourceIndex === -1) return;
    const source = events[sourceIndex];
    const created: EmotionalProcessEvent = {
      ...source,
      id: createEventId(),
      createdAt: Date.now(),
      continuesFromPrevious: direction === 'next' ? true : false,
      continuesToNext: direction === 'prev' ? true : false,
    };
    const nextEvents = [...events, created];
    const updatedSource = { ...source };
    if (direction === 'prev') {
      updatedSource.continuesFromPrevious = true;
    } else {
      updatedSource.continuesToNext = true;
    }
    nextEvents[sourceIndex] = updatedSource;
    saveEvents(nextEvents);
  };

  const deleteEvent = (eventId: string) => {
    if (focusedEventId === eventId) {
      setFocusedEventId(null);
    }
    const events = [...getEvents()];
    const { prevIndex, nextIndex } = getSeriesOrderedIndexes(events, eventId);
    const nextEvents = events.filter((evt) => evt.id !== eventId);
    if (prevIndex !== -1) {
      const prevId = events[prevIndex].id;
      const idx = nextEvents.findIndex((evt) => evt.id === prevId);
      if (idx !== -1) {
        nextEvents[idx] = { ...nextEvents[idx], continuesToNext: false };
      }
    }
    if (nextIndex !== -1) {
      const nextId = events[nextIndex].id;
      const idx = nextEvents.findIndex((evt) => evt.id === nextId);
      if (idx !== -1) {
        nextEvents[idx] = { ...nextEvents[idx], continuesFromPrevious: false };
      }
    }
    saveEvents(nextEvents);
  };

  const panelTitle = triangleId
    ? 'Triangle Properties'
    : isEmotionalLine
    ? 'Emotional Pattern Functional Facts'
    : isPartnership
    ? 'Relationship Functional Facts'
    : 'Individual Functional Facts';

  return (
    <div
      style={{
        background: '#f0f0f0',
        padding: '10px 20px 12px 12px',
        border: '1px solid #ccc',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>X</button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{panelTitle}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{termLabel()}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {(['properties', 'functional', 'events'] as const).map((tab) => {
          const disabled = tab === 'functional' && (!isPerson || functionalIndicatorDefinitions.length === 0);
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              disabled={disabled}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 6,
                border: isActive ? '2px solid #3f51b5' : '1px solid #bdbdbd',
                background: isActive ? '#e8eaf6' : '#fff',
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {tab === 'properties' && 'Person'}
              {tab === 'functional' && 'Indicators'}
              {tab === 'events' && 'Events'}
            </button>
          );
        })}
      </div>
      {activeTab === 'properties' && (
        <>
        {isPerson && selectedPerson && personDraft && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={rowStyle}>
              <label htmlFor="firstName" style={labelStyle}>First Name:</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={personDraft.firstName ?? nameFallbackParts.first}
                onChange={handlePersonChange}
                style={{ width: '25ch', textAlign: 'left' }}
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="lastName" style={labelStyle}>Last Name:</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={personDraft.lastName ?? nameFallbackParts.last}
                onChange={handlePersonChange}
                style={{ width: '25ch', textAlign: 'left' }}
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="maidenName" style={labelStyle}>Maiden Name:</label>
              <input
                type="text"
                id="maidenName"
                name="maidenName"
                value={personDraft.maidenName ?? ''}
                onChange={handlePersonChange}
                style={{ width: '25ch', textAlign: 'left' }}
              />
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="adoptionStatus" style={labelStyle}>Adoption Status:</label>
            <select
              id="adoptionStatus"
              name="adoptionStatus"
              value={personDraft.adoptionStatus || 'biological'}
              onChange={handlePersonChange}
              style={{ width: 160 }}
            >
              <option value="biological">Biological</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <label htmlFor="notes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
              <textarea
                id="notes"
                name="notes"
                value={personDraft.notes || ''}
                onChange={handlePersonChange}
                rows={6}
                style={{ width: '100%', minHeight: '8rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
              />
            </div>
          <div style={rowStyle}>
            <label htmlFor="notesEnabled" style={labelStyle}>Notes Enabled:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="notesEnabled"
                name="notesEnabled"
                checked={personDraft.notesEnabled ?? false}
                onChange={handlePersonChange}
              />
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="birthDate" style={labelStyle}>Birth Date:</label>
            <DatePickerField
              id="birthDate"
              name="birthDate"
              value={personDraft.birthDate}
              placeholder="YYYY-MM-DD"
              onChange={handlePersonChange}
              pickerLabel="Select birth date"
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="deathDate" style={labelStyle}>Death Date:</label>
            <DatePickerField
              id="deathDate"
              name="deathDate"
              value={personDraft.deathDate}
              placeholder="YYYY-MM-DD"
              onChange={handlePersonChange}
              pickerLabel="Select death date"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={cancelPersonChanges} disabled={!personDirty}>Cancel</button>
            <button type="button" onClick={savePersonProperties} disabled={!personDirty}>Save</button>
          </div>
          <div style={rowStyle}>
            <label htmlFor="size" style={labelStyle}>Size:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => adjustPersonSize(-1)}
                style={{ padding: '0 6px' }}
              >
                −
              </button>
              <input
                type="number"
                id="size"
                name="size"
                min={20}
                max={200}
                value={personDraft.size ?? 60}
                onChange={handlePersonChange}
                style={{ width: 60, textAlign: 'center' }}
              />
              <button
                type="button"
                onClick={() => adjustPersonSize(1)}
                style={{ padding: '0 6px' }}
              >
                +
              </button>
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="borderColor" style={labelStyle}>Border Color:</label>
            <input
              type="color"
              id="borderColor"
              name="borderColor"
              value={personDraft.borderColor ?? DEFAULT_BORDER_COLOR}
              onChange={handlePersonChange}
              style={{ width: 80 }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="backgroundEnabled" style={labelStyle}>Shaded Background:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="backgroundEnabled"
                name="backgroundEnabled"
                checked={personDraft.backgroundEnabled ?? false}
                onChange={handlePersonChange}
              />
              <span>Enabled</span>
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="backgroundColor" style={labelStyle}>Background Color:</label>
            <input
              type="color"
              id="backgroundColor"
              name="backgroundColor"
              value={personDraft.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
              onChange={handlePersonChange}
              disabled={!(personDraft.backgroundEnabled ?? false)}
              style={{ width: 80 }}
            />
          </div>
        </div>
        )}
        {isPartnership && selectedPartnership && partnershipDraft && (
        <div>
          <div style={rowStyle}>
            <label htmlFor="relationshipType" style={labelStyle}>Relationship Type:</label>
            <select
              id="relationshipType" 
              name="relationshipType" 
              value={partnershipDraft.relationshipType} 
              onChange={handlePartnershipChange}
              style={{ width: 180 }}
            >
              <option value="married">Married</option>
              <option value="common-law">Common-law</option>
              <option value="living-together">Living Together</option>
              <option value="dating">Dating</option>
              <option value="affair">Affair</option>
              <option value="friendship">Friendship</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="relationshipStatus" style={labelStyle}>Relationship Status:</label>
            <select
              id="relationshipStatus" 
              name="relationshipStatus" 
              value={partnershipDraft.relationshipStatus} 
              onChange={handlePartnershipChange}
              style={{ width: 180 }}
            >
              <option value="married">Married</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
              <option value="started">Started</option>
              <option value="ended">Ended</option>
              <option value="ongoing">Ongoing</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="relationshipStartDate" style={labelStyle}>Relationship Start:</label>
            <DatePickerField
              id="relationshipStartDate"
              name="relationshipStartDate"
              value={partnershipDraft.relationshipStartDate}
              placeholder="YYYY-MM-DD"
              onChange={handlePartnershipChange}
              pickerLabel="Select relationship start date"
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="marriedStartDate" style={labelStyle}>Married Start:</label>
            <DatePickerField
              id="marriedStartDate"
              name="marriedStartDate"
              value={partnershipDraft.marriedStartDate}
              placeholder="YYYY-MM-DD"
              onChange={handlePartnershipChange}
              pickerLabel="Select married start date"
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="separationDate" style={labelStyle}>Separation Date:</label>
            <DatePickerField
              id="separationDate"
              name="separationDate"
              value={partnershipDraft.separationDate}
              placeholder="YYYY-MM-DD"
              onChange={handlePartnershipChange}
              pickerLabel="Select separation date"
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="divorceDate" style={labelStyle}>Divorce Date:</label>
            <DatePickerField
              id="divorceDate"
              name="divorceDate"
              value={partnershipDraft.divorceDate}
              placeholder="YYYY-MM-DD"
              onChange={handlePartnershipChange}
              pickerLabel="Select divorce date"
            />
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <label htmlFor="partnershipNotes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
              <textarea
                id="partnershipNotes"
                name="notes"
                value={partnershipDraft.notes || ''}
                onChange={handlePartnershipChange}
                rows={5}
                style={{ width: '100%', minHeight: '6rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
              />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={cancelPartnershipChanges} disabled={!partnershipDirty}>Cancel</button>
            <button type="button" onClick={savePartnershipProperties} disabled={!partnershipDirty}>Save</button>
          </div>
        </div>
        )}
        {isEmotionalLine && selectedEmotionalLine && emotionalDraft && (() => {
        const relationshipType = emotionalDraft.relationshipType;
        const styleOptions = styleOptionMeta(relationshipType);
        const intensityTypes: EmotionalLine['relationshipType'][] = ['fusion', 'distance', 'conflict', 'projection'];
        const lineStyleLabel = intensityTypes.includes(relationshipType) ? 'Intensity' : 'Line Style';

        const presetColors = ['#444444', '#FF1744', '#2979FF', '#00C853', '#FF9100', '#E040FB'];

        return (
          <div>
            <div style={rowStyle}>
              <label htmlFor="startDate" style={labelStyle}>Start Date:</label>
              <DatePickerField
                id="startDate"
                name="startDate"
                value={emotionalDraft.startDate}
                placeholder="YYYY-MM-DD"
                onChange={handleEmotionalLineInputChange}
                pickerLabel="Select emotional line start date"
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="endDate" style={labelStyle}>End Date:</label>
              <DatePickerField
                id="endDate"
                name="endDate"
                value={emotionalDraft.endDate}
                placeholder="YYYY-MM-DD"
                onChange={handleEmotionalLineInputChange}
                pickerLabel="Select emotional line end date"
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="status" style={labelStyle}>Status:</label>
              <select
                id="status"
                name="status"
                value={emotionalDraft.status || 'ongoing'}
                onChange={handleEmotionalLineChange}
                style={{ width: 160 }}
              >
                <option value="ongoing">Ongoing</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label htmlFor="relationshipType" style={labelStyle}>Relationship Type:</label>
              <select
                id="relationshipType"
                name="relationshipType"
                value={emotionalDraft.relationshipType}
                onChange={handleEmotionalLineChange}
                style={{ width: 180 }}
              >
                <option value="fusion">Fusion</option>
                <option value="distance">Distance</option>
                <option value="cutoff">Cutoff</option>
                <option value="conflict">Conflict</option>
                <option value="projection">Projection</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label htmlFor="lineStyle" style={labelStyle}>{lineStyleLabel}:</label>
              <select
                id="lineStyle"
                name="lineStyle"
                value={emotionalDraft.lineStyle}
                onChange={handleEmotionalLineChange}
                style={{ width: 180 }}
              >
                {styleOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div style={rowStyle}>
              <label htmlFor="lineEnding" style={labelStyle}>Line Ending:</label>
              <select
                id="lineEnding"
                name="lineEnding"
                value={emotionalDraft.lineEnding}
                onChange={handleEmotionalLineChange}
                style={{ width: 220 }}
              >
                <option value="none">None</option>
                <option value="arrow-p1-to-p2">Arrow (Person 1 to 2)</option>
                <option value="arrow-p2-to-p1">Arrow (Person 2 to 1)</option>
                <option value="arrow-bidirectional">Arrow (Bidirectional)</option>
                <option value="perpendicular-p1">Perpendicular (Person 1)</option>
                <option value="perpendicular-p2">Perpendicular (Person 2)</option>
                <option value="double-perpendicular-p1">Double Perpendicular (Person 1)</option>
                <option value="double-perpendicular-p2">Double Perpendicular (Person 2)</option>
              </select>
            </div>
            <div style={{ ...rowStyle, alignItems: 'center' }}>
              <label htmlFor="lineColor" style={labelStyle}>Color:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  id="lineColor"
                  name="color"
                  value={emotionalDraft.color || '#444444'}
                  onChange={handleEmotionalLineInputChange}
                  style={{ width: 60 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  {presetColors.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        updateEmotionalDraftState({ color: hex });
                        setEmotionalPristine(false);
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '1px solid #ccc',
                        background: hex,
                        cursor: 'pointer',
                      }}
                      aria-label={`Set color ${hex}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            {triangleId && (
              <>
                <div style={rowStyle}>
                  <label htmlFor="triangleIntensity" style={labelStyle}>Triangle Intensity:</label>
                  <select
                    id="triangleIntensity"
                    value={triangleIntensityDraft}
                    onChange={(e) => {
                      setTriangleIntensityDraft(e.target.value as 'low' | 'medium' | 'high');
                      setEmotionalPristine(false);
                    }}
                    style={{ width: 180 }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div style={{ ...rowStyle, alignItems: 'center' }}>
                  <label htmlFor="triangleColor" style={labelStyle}>Triangle Color:</label>
                  <input
                    type="color"
                    id="triangleColor"
                    value={triangleColorDraft}
                    onChange={(e) => {
                      setTriangleColorDraft(e.target.value);
                      setEmotionalPristine(false);
                    }}
                    style={{ width: 60 }}
                  />
                </div>
              </>
            )}
            <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <label htmlFor="emotionalNotes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
              <textarea
                id="emotionalNotes"
                name="notes"
                value={emotionalDraft.notes || ''}
                onChange={handleEmotionalLineInputChange}
                rows={5}
                style={{ width: '100%', minHeight: '6rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={cancelEmotionalChanges}
                disabled={!emotionalDirty && !triangleColorDirty && !triangleIntensityDirty}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEmotionalLineProperties}
                disabled={!emotionalDirty && !triangleColorDirty && !triangleIntensityDirty}
              >
                Save
              </button>
            </div>
          </div>
        );
        })()}
        </>
      )}
      {activeTab === 'functional' && (
        isPerson && selectedPerson ? (
          functionalIndicatorDefinitions.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <strong>Functional Indicators</strong>
              {functionalIndicatorDefinitions.map((definition) => {
                const entry = selectedPerson.functionalIndicators?.find((fi) => fi.definitionId === definition.id);
                const statusValue = entry?.status ?? 'none';
                const impactValue = clampIndicatorDimension(entry?.impact);
                const frequencyValue = clampIndicatorDimension(entry?.frequency);
                const intensityValue = clampIndicatorDimension(entry?.intensity);
                return (
                <div
                  key={definition.id}
                  style={{
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    padding: 8,
                    marginTop: 6,
                    background: '#fff',
                  }}
                >
                  <div style={{ textAlign: 'center', fontWeight: 700 }}>{definition.label}</div>
                  <div
                    style={{
                      marginTop: 6,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      rowGap: 6,
                      columnGap: 5,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                      <label
                        htmlFor={`indicator-status-${definition.id}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Status:
                      </label>
                      <select
                        id={`indicator-status-${definition.id}`}
                        value={statusValue}
                        onChange={(e) =>
                          handleIndicatorStatusChange(
                            definition.id,
                            e.target.value as 'past' | 'current' | 'none'
                          )
                        }
                        style={{ width: '20ch' }}
                      >
                        <option value="none">None</option>
                        <option value="current">Current</option>
                        <option value="past">Past</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                      <label
                        htmlFor={`indicator-intensity-${definition.id}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Intensity:
                      </label>
                      <select
                        id={`indicator-intensity-${definition.id}`}
                        value={intensityValue}
                        onChange={(e) => handleIndicatorIntensityChange(definition.id, Number(e.target.value))}
                        style={{ width: '20ch' }}
                        >
                          {INTENSITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                      <label
                        htmlFor={`indicator-frequency-${definition.id}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Frequency:
                      </label>
                      <select
                        id={`indicator-frequency-${definition.id}`}
                          value={frequencyValue}
                          onChange={(e) => handleIndicatorFrequencyChange(definition.id, Number(e.target.value))}
                          style={{ width: '20ch' }}
                        >
                          {FREQUENCY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                      <label
                        htmlFor={`indicator-impact-${definition.id}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Impact:
                      </label>
                      <select
                        id={`indicator-impact-${definition.id}`}
                          value={impactValue}
                          onChange={(e) => handleIndicatorImpactChange(definition.id, Number(e.target.value))}
                          style={{ width: '20ch' }}
                        >
                          {IMPACT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>No functional indicators defined. Use the settings dialog to add some.</div>
          )
        ) : (
          <div style={{ marginTop: 12 }}>Functional indicators apply only to Person nodes.</div>
        )
      )}
      {activeTab === 'events' && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <strong>Events</strong>
            <button onClick={openNewEvent}>Add Event</button>
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
              <option value="FF">Functional Fact</option>
              <option value="EPE">Emotional Process</option>
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
              <option value="EMOTIONAL_PROCESS_EP">Emotional Process</option>
            </select>
          </div>
          {filteredAndSortedEvents.length === 0 ? (
            <div style={{ marginTop: 6, fontStyle: 'italic' }}>No events yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
              {filteredAndSortedEvents.map((event) => {
                const eventType = inferEventType(event);
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{dateText}</span>
                        <span style={{ fontWeight: 600 }}>
                          {descriptorForEvent(event)}
                        </span>
                        <span style={{ fontSize: 11, color: '#555' }}>
                          {eventType}
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditEvent(event)}>Edit</button>
                        <button onClick={() => deleteEvent(event.id)}>Delete</button>
                      </div>
                    </div>
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
                            {eventType}
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
                          <span>Intensity: {event.intensity ?? '—'}</span>
                          <span>Frequency: {event.frequency ?? '—'}</span>
                          <span>Impact: {event.impact ?? '—'}</span>
                          <span>{continuationLabel(event)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditEvent(event)}>Edit</button>
                          <button onClick={() => deleteEvent(event.id)}>Delete</button>
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
                { label: 'Attach to Previous', fn: () => linkEventToAdjacent(eventRowMenu.eventId, 'prev', true) },
                { label: 'Attach to Next', fn: () => linkEventToAdjacent(eventRowMenu.eventId, 'next', true) },
                { label: 'Detach Previous', fn: () => linkEventToAdjacent(eventRowMenu.eventId, 'prev', false) },
                { label: 'Detach Next', fn: () => linkEventToAdjacent(eventRowMenu.eventId, 'next', false) },
                { label: 'Create and Attach Previous', fn: () => createAndAttachAdjacent(eventRowMenu.eventId, 'prev') },
                { label: 'Create and Attach Next', fn: () => createAndAttachAdjacent(eventRowMenu.eventId, 'next') },
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
      )}
      {eventModalOpen && eventDraft && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <div style={{ background: 'white', padding: 20, borderRadius: 10, width: 520 }}>
            <h4 style={{ marginTop: 0 }}>
              {getEvents().some((event) => event.id === eventDraft.id) ? 'Edit Event' : 'New Event'}
            </h4>
            {(() => {
              const rowStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 8,
              };
              const labelStyle: React.CSSProperties = { width: 170, textAlign: 'right', fontWeight: 600 };
              const controlStyle: React.CSSProperties = { width: '60%' };
              const eventType = eventDraft.eventType || inferEventType(eventDraft);
              const continuationState = getContinuationState(eventDraft);
              return (
                <>
                  <div style={rowStyle}>
                    <label htmlFor="eventType" style={labelStyle}>Event Type:</label>
                    <select
                      id="eventType"
                      value={eventType}
                      onChange={(e) => handleEventDraftChange('eventType', e.target.value)}
                      style={{ ...controlStyle, width: '60%' }}
                    >
                      <option value="NODAL">Nodal</option>
                      <option value="FF">Functional Fact</option>
                      <option value="EPE">Emotional Process</option>
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <label style={labelStyle}>Anchor:</label>
                    <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
                      {eventDraft.anchorType || resolveAnchorType()} · {eventDraft.anchorId || selectedItem.id}
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventPrimaryPerson" style={labelStyle}>Primary Person:</label>
                    <div style={controlStyle}>
                      <input
                        type="text"
                        id="eventPrimaryPerson"
                        list="eventPrimaryPersonOptions"
                        value={eventDraft.primaryPersonName || ''}
                        onChange={(e) => handleEventDraftChange('primaryPersonName', e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <datalist id="eventPrimaryPersonOptions">
                        {primaryPersonOptions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventOtherPerson" style={labelStyle}>Other Person:</label>
                    <div style={controlStyle}>
                      <input
                        type="text"
                        id="eventOtherPerson"
                        list="eventOtherPersonOptions"
                        value={eventDraft.otherPersonName}
                        onChange={(e) => handleEventDraftChange('otherPersonName', e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <datalist id="eventOtherPersonOptions">
                        {otherPersonOptions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventStartDate" style={labelStyle}>Start Date:</label>
                    <div style={controlStyle}>
                      <DatePickerField
                        id="eventStartDate"
                        name="eventStartDate"
                        value={eventDraft.startDate || eventDraft.date}
                        placeholder="YYYY-MM-DD"
                        onChange={(e) => {
                          handleEventDraftChange('startDate', e.target.value);
                          handleEventDraftChange('date', e.target.value);
                        }}
                        buttonLabel="Select start date"
                      />
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventEndDate" style={labelStyle}>End Date:</label>
                    <div style={controlStyle}>
                      <DatePickerField
                        id="eventEndDate"
                        name="eventEndDate"
                        value={eventDraft.endDate || ''}
                        placeholder="YYYY-MM-DD"
                        onChange={(e) => handleEventDraftChange('endDate', e.target.value)}
                        buttonLabel="Select end date"
                      />
                    </div>
                  </div>
                  {eventType === 'NODAL' && (
                    <div style={rowStyle}>
                      <label htmlFor="eventNodalSubtype" style={labelStyle}>Nodal Subtype:</label>
                      <div style={controlStyle}>
                        <input
                          type="text"
                          id="eventNodalSubtype"
                          list="eventNodalSubtypeOptions"
                          value={eventDraft.nodalEventSubtype || ''}
                          onChange={(e) => handleEventDraftChange('nodalEventSubtype', e.target.value)}
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
                  {eventType === 'EPE' && (
                    <div style={rowStyle}>
                      <label htmlFor="eventEmotionalProcessType" style={labelStyle}>Process Type:</label>
                      <input
                        type="text"
                        id="eventEmotionalProcessType"
                        value={eventDraft.emotionalProcessType || ''}
                        onChange={(e) => handleEventDraftChange('emotionalProcessType', e.target.value)}
                        style={{ ...controlStyle, width: '60%' }}
                        placeholder="fusion, conflict, distance..."
                      />
                    </div>
                  )}
                  <div style={rowStyle}>
                    <label htmlFor="eventCategory" style={labelStyle}>Category:</label>
                    <select
                      id="eventCategory"
                      value={eventDraft.category}
                      onChange={(e) => handleEventDraftChange('category', e.target.value)}
                      style={{ ...controlStyle, width: '60%' }}
                    >
                      {eventCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventStatusLabel" style={labelStyle}>Status:</label>
                    <input
                      type="text"
                      id="eventStatusLabel"
                      value={eventDraft.statusLabel || ''}
                      onChange={(e) => handleEventDraftChange('statusLabel', e.target.value)}
                      style={{ ...controlStyle, width: '60%' }}
                      placeholder="e.g., Start, Ended"
                    />
                  </div>
                  <div style={rowStyle}>
                    <label style={labelStyle}>Event Class:</label>
                    <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
                      {EVENT_CLASS_LABELS[eventDraft.eventClass || resolveEventClass()]}
                    </div>
                  </div>
                  {eventType === 'EPE' && (
                    <>
                      <div style={rowStyle}>
                        <label htmlFor="eventIntensity" style={labelStyle}>Intensity:</label>
                        <select
                          id="eventIntensity"
                          value={eventDraft.intensity ?? 0}
                          onChange={(e) => handleEventDraftChange('intensity', e.target.value)}
                          style={{ ...controlStyle, width: '60%' }}
                        >
                          {INTENSITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="eventFrequency" style={labelStyle}>Frequency:</label>
                        <select
                          id="eventFrequency"
                          value={eventDraft.frequency ?? 0}
                          onChange={(e) => handleEventDraftChange('frequency', e.target.value)}
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
                          onChange={(e) => handleEventDraftChange('impact', e.target.value)}
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
                  <div style={rowStyle}>
                    <label htmlFor="eventContinuationState" style={labelStyle}>Continuation:</label>
                    <select
                      id="eventContinuationState"
                      value={continuationState}
                      onChange={(e) => {
                        const flags = continuationToFlags(e.target.value as EventContinuationState);
                        setEventDraft({
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
                  <div style={rowStyle}>
                    <label htmlFor="eventHowWell" style={labelStyle}>How well (1-9):</label>
                    <input
                      type="number"
                      id="eventHowWell"
                      min={1}
                      max={9}
                      value={eventDraft.howWell}
                      onChange={(e) => handleEventDraftChange('howWell', e.target.value)}
                      style={{ ...controlStyle, width: '60%' }}
                    />
                  </div>
                  <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
                    <label htmlFor="eventWwwwh" style={{ ...labelStyle, marginTop: 6 }}>WWWWH:</label>
                    <textarea
                      id="eventWwwwh"
                      value={eventDraft.wwwwh}
                      onChange={(e) => handleEventDraftChange('wwwwh', e.target.value)}
                      rows={2}
                      style={{ ...controlStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
                    <label htmlFor="eventObservations" style={{ ...labelStyle, marginTop: 6 }}>Observations:</label>
                    <textarea
                      id="eventObservations"
                      value={eventDraft.observations}
                      onChange={(e) => handleEventDraftChange('observations', e.target.value)}
                      rows={2}
                      style={{ ...controlStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
                    <label htmlFor="eventPriorNote" style={{ ...labelStyle, marginTop: 6 }}>Prior Events:</label>
                    <textarea
                      id="eventPriorNote"
                      value={eventDraft.priorEventsNote || ''}
                      onChange={(e) => handleEventDraftChange('priorEventsNote', e.target.value)}
                      rows={2}
                      style={{ ...controlStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
                    <label htmlFor="eventReflections" style={{ ...labelStyle, marginTop: 6 }}>Reflections:</label>
                    <textarea
                      id="eventReflections"
                      value={eventDraft.reflectionsNote || ''}
                      onChange={(e) => handleEventDraftChange('reflectionsNote', e.target.value)}
                      rows={2}
                      style={{ ...controlStyle, resize: 'vertical' }}
                    />
                  </div>
                </>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
              <button
                onClick={() => {
                  setEventModalOpen(false);
                  setEventDraft(null);
                }}
              >
                Cancel
              </button>
              <button onClick={saveEvent}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default PropertiesPanel;
