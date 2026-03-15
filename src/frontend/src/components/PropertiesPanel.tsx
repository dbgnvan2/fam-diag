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
  SymptomGroup,
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
const DEFAULT_FOREGROUND_COLOR = '#000000';
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
const PERSON_DATE_LABELS: Record<'birthDate' | 'deathDate' | 'genderDate', string> = {
  birthDate: 'Birth Date',
  deathDate: 'Death Date',
  genderDate: 'Gender Date',
};
const DEFAULT_OBSERVATION = 'Not recorded - ask client';
const DEFAULT_HOW_WELL = 1;
const CONFLICT_INTENSITY_HELP = [
  'Minimum – very occasional bickering, little or no arguments.',
  'Mild – frequent bickering, short-lived or infrequent quarelling.',
  'Moderate – frequent arguments, high irritability of partners, raised voices.',
  'Major – frequent arguments, physical contact (pushing, shoving, occasional slapping), involvement of others.',
  'Maximal – frequent arguments and striking one another, involvement of outside agencies to restore order.',
];
const CONFLICT_INTENSITY_LEVEL_LABELS = ['Minimum', 'Mild', 'Moderate', 'Major', 'Maximal'];
const DISTANCE_INTENSITY_HELP = [
  'Minimal – Occasional use of distance to manage tension (superficial contact, seeking out other relationships and/or activities).',
  'Mild – regular use of distance to manage tension.',
  'Moderate – Use of emotional distance even during calmer times; little ability to discuss personal issues.',
  'Major – chronic distance maintained with tense periods of silence or frequent absences; large / frequent geographic distance.',
  'Severe – Distance is structured into separate lifestyles or living arrangements.',
];
const DISTANCE_INTENSITY_LEVEL_LABELS = ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'];
const emotionalLineStyleLevelFor = (
  relationshipType: EmotionalLine['relationshipType'],
  lineStyle: EmotionalLine['lineStyle']
) => {
  const lineStyleValues: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle'][]> = {
    fusion: [
      'fusion-dotted-wide',
      'fusion-dotted-tight',
      'fusion-solid-wide',
      'fusion-solid-tight',
      'fusion-triple',
    ],
    distance: [
      'distance-dashed-tight',
      'distance-dashed-wide',
      'distance-long',
      'distance-dotted-tight',
      'distance-dotted-wide',
    ],
    cutoff: ['cutoff'],
    conflict: [
      'conflict-dotted-wide',
      'conflict-dotted-tight',
      'conflict-solid-wide',
      'conflict-solid-tight',
      'conflict-double',
    ],
    projection: ['projection-1', 'projection-2', 'projection-3', 'projection-4', 'projection-5'],
  };
  const index = lineStyleValues[relationshipType].indexOf(lineStyle);
  return index >= 0 ? index + 1 : 0;
};
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
const SYMPTOM_GROUP_OPTIONS: SymptomGroup[] = ['physical', 'emotional', 'social'];
const isSymptomCategory = (value?: string): value is SymptomGroup =>
  value === 'physical' || value === 'emotional' || value === 'social';
const normalizeSymptomCategory = (value?: string): SymptomGroup =>
  isSymptomCategory(value?.toLowerCase()) ? (value!.toLowerCase() as SymptomGroup) : 'physical';
const clampSymptomType = (value?: string) => (value || '').trim().slice(0, 30);
const TAB_HELP_COPY: Record<'properties' | 'functional' | 'events', { title: string; body: string }> = {
  properties: {
    title: 'Person Tab Help',
    body:
      'Persons have basic nodal events of Birth, Death, Birth Sex, and Gender (with Gender Date). Other Symptom events can be added as Events. Persons can be given background colors and border colors to designate whatever is needed (e.g., people living at the same location).',
  },
  functional: {
    title: 'Symptoms Tab Help',
    body:
      'Symptom categories can be configured on this tab. Ongoing changes to Frequency, Intensity, and Impact can be captured as events.',
  },
  events: {
    title: 'Events Tab Help',
    body:
      'The Events tab lists the events related to the Person, Relationship, or Emotional Pattern. Add events by right-clicking on the item and choosing "Add Event...".',
  },
};
const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());
const normalizePersonEventDate = (value?: string) =>
  value && DATE_PATTERN.test(value) ? value : new Date().toISOString().slice(0, 10);
const getBirthSexLabel = (value?: Person['birthSex']) =>
  value === 'male' ? 'Male' : value === 'intersex' ? 'Intersex' : 'Female';
const getGenderIdentityLabel = (value?: Person['genderIdentity']) => {
  if (value === 'masculine') return 'Masculine';
  if (value === 'nonbinary') return 'Non-Binary';
  if (value === 'agender') return 'Agender';
  return 'Feminine';
};
const defaultGenderIdentityForBirthSex = (birthSex?: Person['birthSex']): Person['genderIdentity'] =>
  birthSex === 'male' ? 'masculine' : birthSex === 'intersex' ? 'nonbinary' : 'feminine';
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

const RELATIONSHIP_STATUS_INTENSITY: Record<string, number> = {
  married: 3,
  separated: 4,
  divorced: 5,
  started: 2,
  ended: 4,
  ongoing: 3,
};
const normalizeStatusKey = (value: string) => value.trim().toLowerCase();
const LEGACY_STATUS_DATE_FIELD_BY_KEY: Partial<
  Record<string, 'relationshipStartDate' | 'marriedStartDate' | 'separationDate' | 'divorceDate'>
> = {
  started: 'relationshipStartDate',
  ongoing: 'relationshipStartDate',
  married: 'marriedStartDate',
  separated: 'separationDate',
  divorced: 'divorceDate',
};
const PERSON_DEFERRED_DATE_FIELDS: (keyof Pick<Person, 'birthDate' | 'deathDate' | 'genderDate'>)[] = [
  'birthDate',
  'deathDate',
  'genderDate',
];
const PERSON_DEFERRED_IDENTITY_FIELDS: (keyof Pick<Person, 'birthSex' | 'genderIdentity'>)[] = [
  'birthSex',
  'genderIdentity',
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
const eventTypeLabel = (eventType: EventType): string => {
  if (eventType === 'FF') return 'Symptom';
  if (eventType === 'EPE') return 'Emotional Pattern';
  return 'Nodal';
};
const compactRelationshipStatusLabel = (event: EmotionalProcessEvent) =>
  (event.statusLabel || descriptorForCompactFallback(event)).replace(/\s+Date$/i, '').trim();
const descriptorForCompactFallback = (event: EmotionalProcessEvent) =>
  formatCategoryStatus(event.category || 'Event', event.statusLabel);
const readPartnershipStatusDate = (partnership: Partnership, status: string) => {
  const key = normalizeStatusKey(status);
  const explicit = partnership.statusDates?.[key];
  if (explicit) return explicit;
  const legacyField = LEGACY_STATUS_DATE_FIELD_BY_KEY[key];
  return legacyField ? partnership[legacyField] || '' : '';
};

const withPartnershipStatusDate = (partnership: Partnership, status: string, value: string) => {
  const key = normalizeStatusKey(status);
  const trimmed = value.trim();
  const nextStatusDates = { ...(partnership.statusDates || {}) };
  if (trimmed) {
    nextStatusDates[key] = trimmed;
  } else {
    delete nextStatusDates[key];
  }
  const legacyField = LEGACY_STATUS_DATE_FIELD_BY_KEY[key];
  const next: Partnership = {
    ...partnership,
    statusDates: Object.keys(nextStatusDates).length ? nextStatusDates : undefined,
  };
  if (legacyField) {
    next[legacyField] = trimmed || undefined;
  }
  return next;
};

interface PropertiesPanelProps {
  selectedItem: Person | Partnership | EmotionalLine;
  people: Person[];
  eventCategories: string[];
  relationshipTypes?: string[];
  relationshipStatuses?: string[];
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
  initialPersonSection?: 'name' | 'dates' | 'notes' | 'format';
  focusEventId?: string;
  openNewEventRequestId?: string;
  newEventSeed?: Partial<EmotionalProcessEvent> | null;
  openNewEventPosition?: { x: number; y: number };
  onEnsureSymptomCategoryDefinition?: (label: string, group: SymptomGroup) => string | null;
  compactPersonSectionMode?: boolean;
  onClose: () => void;
}

const PropertiesPanel = ({
  selectedItem,
  people,
  eventCategories,
  relationshipTypes = ['married', 'common-law', 'living-together', 'dating', 'affair', 'friendship'],
  relationshipStatuses = ['married', 'separated', 'divorced', 'started', 'ended', 'ongoing'],
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
  initialPersonSection,
  focusEventId,
  openNewEventRequestId,
  newEventSeed,
  openNewEventPosition,
  onEnsureSymptomCategoryDefinition,
  compactPersonSectionMode = false,
  onClose,
}: PropertiesPanelProps) => {
  const colorInputRefs = {
    foreground: useRef<HTMLInputElement | null>(null),
    border: useRef<HTMLInputElement | null>(null),
    background: useRef<HTMLInputElement | null>(null),
  };
  const formatOptionLabel = (value: string) =>
    value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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
  const [eventModalPosition, setEventModalPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'properties' | 'functional' | 'events'>('properties');
  const [activePersonSection, setActivePersonSection] = useState<
    'name' | 'dates' | 'notes' | 'format'
  >('name');
  const [tabHelpOpen, setTabHelpOpen] = useState<'properties' | 'functional' | 'events' | null>(null);
  const [emotionalIntensityHelpOpen, setEmotionalIntensityHelpOpen] = useState(false);
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
  const activeTabLabel =
    activeTab === 'properties'
      ? isEmotionalLine
        ? 'Pattern'
        : isPartnership
        ? 'Relationship'
        : 'Person'
      : activeTab === 'functional'
      ? 'Symptoms'
      : 'Events';
  const partnershipTypeOptions = useMemo(() => {
    const options = [...relationshipTypes];
    if (
      selectedPartnership?.relationshipType &&
      !options.includes(selectedPartnership.relationshipType)
    ) {
      options.push(selectedPartnership.relationshipType);
    }
    return options;
  }, [relationshipTypes, selectedPartnership]);
  const partnershipStatusOptions = useMemo(() => {
    const options = [...relationshipStatuses];
    if (
      selectedPartnership?.relationshipStatus &&
      !options.includes(selectedPartnership.relationshipStatus)
    ) {
      options.push(selectedPartnership.relationshipStatus);
    }
    return options;
  }, [relationshipStatuses, selectedPartnership]);
  const deriveEmotionalMetricDraft = (line: EmotionalLine | null) => {
    const latest = [...(line?.events || [])]
      .filter((event) => (event.eventType || (event.eventClass === 'emotional-pattern' ? 'EPE' : '')) === 'EPE')
      .sort((a, b) => {
        const aTs = (a.startDate || a.date) ? new Date(a.startDate || a.date).getTime() : 0;
        const bTs = (b.startDate || b.date) ? new Date(b.startDate || b.date).getTime() : 0;
        return bTs - aTs;
      })[0];
    return {
      intensity: typeof latest?.intensity === 'number' ? latest.intensity : 0,
      frequency: typeof latest?.frequency === 'number' ? latest.frequency : 0,
      impact: typeof latest?.impact === 'number' ? latest.impact : 0,
    };
  };
  const initialEmotionalMetrics = deriveEmotionalMetricDraft(selectedEmotionalLine);
  const [emotionalIntensityDraft, setEmotionalIntensityDraft] = useState<number>(
    initialEmotionalMetrics.intensity
  );
  const [emotionalFrequencyDraft, setEmotionalFrequencyDraft] = useState<number>(
    initialEmotionalMetrics.frequency
  );
  const [emotionalImpactDraft, setEmotionalImpactDraft] = useState<number>(
    initialEmotionalMetrics.impact
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
  const labelColumnWidth = 140;
  const labelStyle: React.CSSProperties = { width: labelColumnWidth, textAlign: 'right', fontWeight: 600 };
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };
  const sectionCardStyle: React.CSSProperties = {
    marginTop: 12,
    border: '1px solid #d4dae5',
    borderRadius: 8,
    background: '#fff',
    padding: '10px 12px 12px',
  };
  const sectionNavButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${active ? '#4b68a6' : '#c6cfde'}`,
    background: active ? '#e7eefb' : '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  });
  const eventActionButtonStyle: React.CSSProperties = {
    padding: '1px 4px',
    fontSize: 11,
    lineHeight: 1.1,
    minHeight: 20,
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
  const formatColorRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  };

  useEffect(() => {
    setEventModalOpen(false);
    setEventDraft(null);
    setFocusedEventId(focusEventId || null);
    setActiveTab(initialActiveTab || 'properties');
    setActivePersonSection(initialPersonSection || 'name');
  }, [selectedItem.id, initialActiveTab, initialPersonSection, focusEventId]);

  useEffect(() => {
    if (!focusEventId) return;
    setFocusedEventId(focusEventId);
    setActiveTab(initialActiveTab || 'events');
  }, [focusEventId, initialActiveTab]);

  useEffect(() => {
    if (!eventModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setEventModalOpen(false);
      setEventDraft(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [eventModalOpen]);

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
    const metrics = deriveEmotionalMetricDraft(selectedEmotionalLine);
    setEmotionalIntensityDraft(
      selectedEmotionalLine
        ? emotionalLineStyleLevelFor(
            selectedEmotionalLine.relationshipType,
            selectedEmotionalLine.lineStyle
          )
        : metrics.intensity
    );
    setEmotionalFrequencyDraft(metrics.frequency);
    setEmotionalImpactDraft(metrics.impact);
  }, [selectedEmotionalLine?.id, selectedEmotionalLine]);

  useEffect(() => {
    if (!emotionalPristine) return;
    setEmotionalDraft(selectedEmotionalLine ? { ...selectedEmotionalLine } : null);
    const metrics = deriveEmotionalMetricDraft(selectedEmotionalLine);
    setEmotionalIntensityDraft(
      selectedEmotionalLine
        ? emotionalLineStyleLevelFor(
            selectedEmotionalLine.relationshipType,
            selectedEmotionalLine.lineStyle
          )
        : metrics.intensity
    );
    setEmotionalFrequencyDraft(metrics.frequency);
    setEmotionalImpactDraft(metrics.impact);
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
      eventType: 'FF',
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
      symptomGroup: definition.group,
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
    if (name === 'birthSex') {
      const birthSex = nextValue as Person['birthSex'];
      updates = {
        ...updates,
        birthSex,
        gender: birthSex,
      };
      if (!personDraft.genderIdentity) {
        updates.genderIdentity = defaultGenderIdentityForBirthSex(birthSex);
      }
    } else if (name === 'genderIdentity') {
      updates = {
        ...updates,
        genderIdentity: nextValue as Person['genderIdentity'],
      };
    }
    const nextDraft = { ...personDraft, ...updates };
    if (name === 'firstName' || name === 'lastName') {
      updates = { ...updates, name: composeDisplayName({}, nextDraft) };
    }
    updatePersonDraftState(updates);
    const isDeferredDateField =
      name === 'birthDate' || name === 'deathDate' || name === 'genderDate' || name === 'adoptionDate';
    const isDeferredIdentityField = name === 'birthSex' || name === 'genderIdentity';
    if (!selectedPerson) return;
    if (isDeferredDateField || isDeferredIdentityField) {
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
    if (name.startsWith('statusDate:')) {
      const status = name.slice('statusDate:'.length);
      const nextDraft = withPartnershipStatusDate(partnershipDraft, status, value);
      setPartnershipDraft(nextDraft);
      setPartnershipPristine(false);
      return;
    }
    updatePartnershipDraftState({ [name]: value } as Partial<Partnership>);
    setPartnershipPristine(false);
  };

  const lineStyleValues: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle'][]> = {
    fusion: [
      'fusion-dotted-wide',
      'fusion-dotted-tight',
      'fusion-solid-wide',
      'fusion-solid-tight',
      'fusion-triple',
    ],
    distance: [
      'distance-dashed-tight',
      'distance-dashed-wide',
      'distance-long',
      'distance-dotted-tight',
      'distance-dotted-wide',
    ],
    cutoff: ['cutoff'],
    conflict: [
      'conflict-dotted-wide',
      'conflict-dotted-tight',
      'conflict-solid-wide',
      'conflict-solid-tight',
      'conflict-double',
    ],
    projection: ['projection-1', 'projection-2', 'projection-3', 'projection-4', 'projection-5'],
  };

  const updateEmotionalDraftState = (updates: Partial<EmotionalLine>) => {
    setEmotionalDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const styleOptionMeta = (relationshipType: EmotionalLine['relationshipType']) => {
    switch (relationshipType) {
      case 'fusion':
        return [
          { value: 'fusion-dotted-wide', label: 'Level 1 (double dotted, two spaces)' },
          { value: 'fusion-dotted-tight', label: 'Level 2 (double dotted, no space)' },
          { value: 'fusion-solid-wide', label: 'Level 3 (double solid, two spaces)' },
          { value: 'fusion-solid-tight', label: 'Level 4 (double solid, no space)' },
          { value: 'fusion-triple', label: 'Level 5 (triple lines)' },
        ];
      case 'distance':
        return [
          { value: 'distance-dashed-tight', label: 'Level 1 (dashed, very little space)' },
          { value: 'distance-dashed-wide', label: 'Level 2 (longer segments, some space)' },
          { value: 'distance-long', label: 'Level 3 (longer segments, lots of space)' },
          { value: 'distance-dotted-tight', label: 'Level 4 (short segments, space)' },
          { value: 'distance-dotted-wide', label: 'Level 5 (dots, space)' },
        ];
      case 'conflict':
        return [
          { value: 'conflict-dotted-wide', label: 'Level 1 (single dotted sawtooth)' },
          { value: 'conflict-dotted-tight', label: 'Level 2 (double dotted sawtooth)' },
          { value: 'conflict-solid-wide', label: 'Level 3 (short line sawtooth)' },
          { value: 'conflict-solid-tight', label: 'Level 4 (double line sawtooth)' },
          { value: 'conflict-double', label: 'Level 5 (triple line sawtooth)' },
        ];
      case 'projection':
        return [
          { value: 'projection-1', label: 'Level 1 (>....>)' },
          { value: 'projection-2', label: 'Level 2 (>...>)' },
          { value: 'projection-3', label: 'Level 3 (>.>)' },
          { value: 'projection-4', label: 'Level 4 (>>>>)' },
          { value: 'projection-5', label: 'Level 5 (>>>>>)' },
        ];
      default:
        return [{ value: 'cutoff', label: 'Cutoff' }];
    }
  };

  const lineStyleForLevel = (
    relationshipType: EmotionalLine['relationshipType'],
    level: number
  ): EmotionalLine['lineStyle'] | null => {
    const styles = lineStyleValues[relationshipType] || [];
    if (!styles.length) return null;
    const boundedIndex = Math.max(0, Math.min(styles.length - 1, level - 1));
    return styles[boundedIndex] || null;
  };

  const applyEmotionalIntensityLevel = (nextLevel: number) => {
    setEmotionalIntensityDraft(nextLevel);
    if (emotionalDraft) {
      const nextLineStyle = lineStyleForLevel(emotionalDraft.relationshipType, nextLevel);
      if (nextLineStyle) {
        updateEmotionalDraftState({ lineStyle: nextLineStyle });
      }
    }
    setEmotionalPristine(false);
  };

  const intensityChooserConfig =
    emotionalDraft?.relationshipType === 'conflict'
      ? {
          title: 'Conflict Intensity Level',
          helpLines: CONFLICT_INTENSITY_HELP,
          labels: CONFLICT_INTENSITY_LEVEL_LABELS,
          buttonLabel: 'Conflict intensity level help',
        }
      : emotionalDraft?.relationshipType === 'distance'
      ? {
          title: 'Distance Intensity Level',
          helpLines: DISTANCE_INTENSITY_HELP,
          labels: DISTANCE_INTENSITY_LEVEL_LABELS,
          buttonLabel: 'Distance intensity level help',
        }
      : null;

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
      setEmotionalIntensityDraft(emotionalLineStyleLevelFor(newRelationshipType, nextStyle));
    } else if (name === 'lineStyle') {
      const nextLineStyle = value as EmotionalLine['lineStyle'];
      updateEmotionalDraftState({ [name]: nextLineStyle });
      setEmotionalIntensityDraft(
        emotionalLineStyleLevelFor(emotionalDraft.relationshipType, nextLineStyle)
      );
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
  const buildPersonIdentityEvent = (
    person: Person,
    field: keyof Pick<Person, 'birthSex' | 'genderIdentity'>,
    value: string,
    dateValue: string
  ): EmotionalProcessEvent => {
    const displayName = composeDisplayName({}, person) || person.name || '';
    const isBirthSex = field === 'birthSex';
    const statusLabel = isBirthSex
      ? `Birth Sex: ${getBirthSexLabel(value as Person['birthSex'])}`
      : `Gender: ${getGenderIdentityLabel(value as Person['genderIdentity'])}`;
    return {
      id: createEventId(),
      date: normalizePersonEventDate(dateValue),
      category: 'Individual',
      statusLabel,
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

  const buildPartnershipEvent = (
    partnership: Partnership,
    status: string,
    dateValue: string
  ): EmotionalProcessEvent | null => {
    if (!DATE_PATTERN.test(dateValue)) return null;
    const partner1 = people.find((person) => person.id === partnership.partner1_id);
    const partner2 = people.find((person) => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return null;
    const label = `${toTitleCase(status)} Date`;
    return {
      id: createEventId(),
      date: dateValue,
      category: toTitleCase(partnership.relationshipType),
      statusLabel: label,
      intensity: RELATIONSHIP_STATUS_INTENSITY[normalizeStatusKey(status)] ?? 0,
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
  const buildEmotionalPatternMeasurementEvent = (
    line: EmotionalLine,
    intensity: number,
    frequency: number,
    impact: number
  ): EmotionalProcessEvent | null => {
    const person1 = people.find((person) => person.id === line.person1_id);
    const person2 = people.find((person) => person.id === line.person2_id);
    if (!person1 || !person2) return null;
    const start = line.startDate && DATE_PATTERN.test(line.startDate)
      ? line.startDate
      : new Date().toISOString().slice(0, 10);
    return {
      id: createEventId(),
      date: start,
      startDate: start,
      endDate: line.endDate || undefined,
      category: 'Emotional Pattern',
      eventType: 'EPE',
      emotionalProcessType: line.relationshipType,
      anchorType: 'EMOTIONAL_PROCESS_EP',
      anchorId: line.id,
      statusLabel: toTitleCase(line.status || 'ongoing'),
      intensity,
      frequency,
      impact,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: person2.name || '',
      primaryPersonName: person1.name || '',
      wwwwh: DEFAULT_OBSERVATION,
      observations: line.notes || DEFAULT_OBSERVATION,
      isNodalEvent: false,
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
    const hasDeferredDateChanges = PERSON_DEFERRED_DATE_FIELDS.some((field) =>
      stringDiffers(personDraft[field], selectedPerson[field])
    );
    const hasAdoptionDateChanges = stringDiffers(personDraft.adoptionDate, selectedPerson.adoptionDate);
    const hasIdentityChanges = PERSON_DEFERRED_IDENTITY_FIELDS.some((field) => {
      const draftValue = personDraft[field] ?? '';
      const selectedValue = selectedPerson[field] ?? '';
      return draftValue !== selectedValue;
    });
    return hasDeferredDateChanges || hasAdoptionDateChanges || hasIdentityChanges;
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
    if ((selectedPerson.adoptionDate ?? '') !== (personDraft.adoptionDate ?? '')) {
      updates.adoptionDate = personDraft.adoptionDate || undefined;
    }
    PERSON_DEFERRED_IDENTITY_FIELDS.forEach((field) => {
      const prev = selectedPerson[field];
      const next = personDraft[field];
      if ((prev ?? '') !== (next ?? '')) {
        (updates as any)[field] = next || undefined;
        if (field === 'birthSex') {
          updates.gender = next || undefined;
        }
        if (next) {
          const eventDate =
            field === 'birthSex'
              ? personDraft.birthDate || selectedPerson.birthDate || ''
              : personDraft.genderDate || selectedPerson.genderDate || '';
          newEvents.push(buildPersonIdentityEvent(personDraft, field, next, eventDate));
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
    const stringFieldChanged = PARTNERSHIP_STRING_FIELDS.some((field) =>
      stringDiffers(partnershipDraft[field], selectedPartnership[field])
    );
    if (stringFieldChanged) return true;
    return relationshipStatuses.some((status) =>
      stringDiffers(
        readPartnershipStatusDate(partnershipDraft, status),
        readPartnershipStatusDate(selectedPartnership, status)
      )
    );
  }, [selectedPartnership, partnershipDraft, relationshipStatuses]);

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
    relationshipStatuses.forEach((status) => {
      const prev = readPartnershipStatusDate(selectedPartnership, status);
      const next = readPartnershipStatusDate(partnershipDraft, status);
      if (prev !== next) {
        const nextDraft = withPartnershipStatusDate(
          { ...(updates as Partnership), ...partnershipDraft },
          status,
          next
        );
        updates.statusDates = nextDraft.statusDates;
        const legacyField = LEGACY_STATUS_DATE_FIELD_BY_KEY[normalizeStatusKey(status)];
        if (legacyField) {
          updates[legacyField] = next || undefined;
        }
        if (next) {
          const event = buildPartnershipEvent(partnershipDraft, status, next);
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
  const emotionalMetricDirty = useMemo(() => {
    if (!selectedEmotionalLine) return false;
    const baseline = deriveEmotionalMetricDraft(selectedEmotionalLine);
    return (
      emotionalIntensityDraft !== baseline.intensity ||
      emotionalFrequencyDraft !== baseline.frequency ||
      emotionalImpactDraft !== baseline.impact
    );
  }, [
    selectedEmotionalLine,
    emotionalIntensityDraft,
    emotionalFrequencyDraft,
    emotionalImpactDraft,
  ]);
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
      (!emotionalDirty && !emotionalMetricDirty && !triangleColorDirty && !triangleIntensityDirty)
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
    if (emotionalMetricDirty) {
      const metricEvent = buildEmotionalPatternMeasurementEvent(
        { ...selectedEmotionalLine, ...emotionalDraft },
        emotionalIntensityDraft,
        emotionalFrequencyDraft,
        emotionalImpactDraft
      );
      if (metricEvent) newEvents.push(metricEvent);
    }
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
    const metrics = deriveEmotionalMetricDraft({ ...selectedEmotionalLine, ...updates });
    setEmotionalIntensityDraft(metrics.intensity);
    setEmotionalFrequencyDraft(metrics.frequency);
    setEmotionalImpactDraft(metrics.impact);
    setEmotionalPristine(true);
  };

  const cancelEmotionalChanges = () => {
    if (!selectedEmotionalLine) return;
    setEmotionalDraft({ ...selectedEmotionalLine });
    const metrics = deriveEmotionalMetricDraft(selectedEmotionalLine);
    setEmotionalIntensityDraft(metrics.intensity);
    setEmotionalFrequencyDraft(metrics.frequency);
    setEmotionalImpactDraft(metrics.impact);
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
  const symptomTypeOptions = useMemo(() => {
    const labels = functionalIndicatorDefinitions
      .map((definition) => definition.label?.trim())
      .filter((label): label is string => !!label);
    return Array.from(new Set(labels));
  }, [functionalIndicatorDefinitions]);
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
  const symptomRows = useMemo(() => {
    if (!selectedPerson) return [] as Array<{
      key: string;
      category: SymptomGroup;
      type: string;
      definitionId?: string;
      status: 'past' | 'current' | 'none';
      intensity: number;
      frequency: number;
      impact: number;
      lastTimestamp: number;
    }>;
    const definitionById = new Map(
      functionalIndicatorDefinitions.map((definition) => [definition.id, definition])
    );
    const buckets = new Map<
      string,
      {
        key: string;
        category: SymptomGroup;
        type: string;
        definitionId?: string;
        status: 'past' | 'current' | 'none';
        intensity: number;
        frequency: number;
        impact: number;
        lastTimestamp: number;
      }
    >();
    (selectedPerson.events || [])
      .filter((event) => inferEventType(event) === 'FF')
      .forEach((event) => {
        const category = normalizeSymptomCategory(event.category || event.symptomGroup);
        const type =
          clampSymptomType(
            event.symptomType || (!isSymptomCategory(event.category) ? event.category : '')
          ) || 'General';
        const eventTime = event.startDate || event.date || '';
        const parsed = eventTime ? new Date(eventTime).getTime() : 0;
        const timestamp =
          (Number.isFinite(parsed) && parsed > 0 ? parsed : 0) +
          ((event.createdAt || 0) / 1_000_000_000_000);
        const key = `${category}|${type.toLowerCase()}`;
        const existing = buckets.get(key);
        if (existing && existing.lastTimestamp >= timestamp) {
          return;
        }
        const statusLower = (event.statusLabel || '').trim().toLowerCase();
        const status =
          statusLower === 'past' || statusLower === 'none' || statusLower === 'current'
            ? (statusLower as 'past' | 'none' | 'current')
            : 'current';
        const sourceDef = event.sourceIndicatorId
          ? definitionById.get(event.sourceIndicatorId)
          : undefined;
        buckets.set(key, {
          key,
          category,
          type,
          definitionId: sourceDef?.id,
          status,
          intensity: clampIndicatorDimension(event.intensity),
          frequency: clampIndicatorDimension(event.frequency),
          impact: clampIndicatorDimension(event.impact),
          lastTimestamp: timestamp,
        });
      });
    (selectedPerson.functionalIndicators || []).forEach((entry) => {
      const definition = definitionById.get(entry.definitionId);
      if (!definition) return;
      const category = normalizeSymptomCategory(definition.group || 'physical');
      const type = clampSymptomType(definition.label) || 'General';
      const key = `${category}|${type.toLowerCase()}`;
      const existing = buckets.get(key);
      const indicatorTimestamp = entry.lastUpdatedAt || 0;
      if (!existing || indicatorTimestamp >= existing.lastTimestamp) {
        buckets.set(key, {
          key,
          category,
          type,
          definitionId: definition.id,
          status: entry.status,
          intensity: clampIndicatorDimension(entry.intensity),
          frequency: clampIndicatorDimension(entry.frequency),
          impact: clampIndicatorDimension(entry.impact),
          lastTimestamp: indicatorTimestamp,
        });
      } else if (!existing.definitionId) {
        buckets.set(key, { ...existing, definitionId: definition.id });
      }
    });
    return Array.from(buckets.values()).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.type.localeCompare(b.type);
    });
  }, [selectedPerson, functionalIndicatorDefinitions]);
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
    const baseSymptomCategory = normalizeSymptomCategory(
      (seed?.category as string | undefined) ||
        (seed?.symptomGroup as string | undefined) ||
        (latest?.category as string | undefined) ||
        (latest?.symptomGroup as string | undefined)
    );
    const baseSymptomType = clampSymptomType(
      (seed?.symptomType as string | undefined) ||
        (latest?.symptomType as string | undefined) ||
        (latest && inferEventType(latest) === 'FF' && !isSymptomCategory(latest.category)
          ? latest.category
          : '')
    );
    const baseCategory =
      eventType === 'FF'
        ? baseSymptomCategory
        : seed?.category ||
          latest?.category ||
          (eventType === 'EPE' ? 'Emotional Pattern' : eventCategories[0] || 'Nodal');
    return {
      id: createEventId(),
      date: baseDate,
      startDate: baseDate,
      endDate: baseEndDate,
      category: baseCategory,
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
      otherPersonName: seed?.otherPersonName || latest?.otherPersonName || 'None',
      primaryPersonName: seed?.primaryPersonName || latest?.primaryPersonName || primaryPersonOptions[0] || '',
      wwwwh: seed?.wwwwh || latest?.wwwwh || '',
      observations: seed?.observations || latest?.observations || '',
      priorEventsNote: seed?.priorEventsNote || latest?.priorEventsNote || '',
      reflectionsNote: seed?.reflectionsNote || latest?.reflectionsNote || '',
      isNodalEvent: eventType === 'NODAL',
      continuesFromPrevious: seed?.continuesFromPrevious ?? false,
      continuesToNext: seed?.continuesToNext ?? false,
      createdAt: Date.now(),
      symptomGroup: eventType === 'FF' ? baseSymptomCategory : undefined,
      symptomType: eventType === 'FF' ? baseSymptomType : undefined,
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
    setEventModalPosition(openNewEventPosition || null);
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
      otherPersonName: event.otherPersonName || 'None',
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
      symptomGroup:
        inferEventType(event) === 'FF'
          ? normalizeSymptomCategory(event.symptomGroup || event.category)
          : undefined,
      symptomType:
        inferEventType(event) === 'FF'
          ? clampSymptomType(event.symptomType || (!isSymptomCategory(event.category) ? event.category : ''))
          : undefined,
      eventClass: event.eventClass || resolveEventClass(),
    });
    setEventModalPosition(null);
    setEventModalOpen(true);
  };

  useEffect(() => {
    if (!openNewEventRequestId || openNewEventRequestId === lastNewEventRequestIdRef.current) return;
    lastNewEventRequestIdRef.current = openNewEventRequestId;
    setActiveTab('events');
    const eventType = (newEventSeed?.eventType as EventType) || resolveDefaultEventType();
    setEventDraft(buildEventDraft(eventType, newEventSeed || null));
    setEventModalPosition(openNewEventPosition || null);
    setEventModalOpen(true);
  }, [openNewEventRequestId, newEventSeed, openNewEventPosition, resolveDefaultEventType, buildEventDraft]);

  const handleEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    if (!eventDraft) return;
    if (field === 'eventType') {
      const nextType = value as EventType;
      if (nextType === 'FF') {
        const nextCategory = normalizeSymptomCategory(eventDraft.category);
        setEventDraft({
          ...eventDraft,
          eventType: nextType,
          category: nextCategory,
          symptomGroup: nextCategory,
          symptomType: clampSymptomType(eventDraft.symptomType || ''),
          isNodalEvent: false,
        });
        return;
      }
      if (nextType === 'EPE') {
        setEventDraft({
          ...eventDraft,
          eventType: nextType,
          category: eventDraft.category || 'Emotional Pattern',
          symptomGroup: undefined,
          symptomType: undefined,
          isNodalEvent: false,
        });
        return;
      }
      setEventDraft({
        ...eventDraft,
        eventType: nextType,
        symptomGroup: undefined,
        symptomType: undefined,
        isNodalEvent: nextType === 'NODAL',
      });
      return;
    }
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
    if (field === 'category' && (eventDraft.eventType || inferEventType(eventDraft)) === 'FF') {
      const normalizedCategory = normalizeSymptomCategory(value);
      setEventDraft({
        ...eventDraft,
        category: normalizedCategory,
        symptomGroup: normalizedCategory,
      });
      return;
    }
    if (field === 'symptomType' && (eventDraft.eventType || inferEventType(eventDraft)) === 'FF') {
      setEventDraft({
        ...eventDraft,
        symptomType: value.slice(0, 30),
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
      category:
        normalizedType === 'FF'
          ? normalizeSymptomCategory(eventDraft.category || eventDraft.symptomGroup)
          : eventDraft.category,
      anchorType: eventDraft.anchorType || resolveAnchorType(),
      anchorId: eventDraft.anchorId || selectedItem.id,
      startDate: normalizedStart,
      date: normalizedStart,
      otherPersonName: (eventDraft.otherPersonName || '').trim() || 'None',
      primaryPersonName: eventDraft.primaryPersonName || primaryPersonOptions[0] || '',
      intensity: typeof eventDraft.intensity === 'number' ? eventDraft.intensity : 0,
      frequency: typeof eventDraft.frequency === 'number' ? eventDraft.frequency : 0,
      impact: typeof eventDraft.impact === 'number' ? eventDraft.impact : 0,
      priorEventsNote: eventDraft.priorEventsNote || '',
      reflectionsNote: eventDraft.reflectionsNote || '',
      statusLabel: eventDraft.statusLabel || '',
      createdAt: eventDraft.createdAt ?? Date.now(),
      sourceIndicatorId: eventDraft.sourceIndicatorId,
      symptomGroup:
        normalizedType === 'FF'
          ? normalizeSymptomCategory(eventDraft.category || eventDraft.symptomGroup)
          : undefined,
      symptomType: normalizedType === 'FF' ? clampSymptomType(eventDraft.symptomType) : undefined,
      eventClass: eventDraft.eventClass || resolveEventClass(),
      isNodalEvent: normalizedType === 'NODAL',
    };
    const events = getEvents();
    const existingIndex = events.findIndex((evt) => evt.id === eventDraft.id);
    const nextEvents = existingIndex === -1
      ? [...events, cleanedDraft]
      : events.map((evt) => (evt.id === eventDraft.id ? cleanedDraft : evt));
    if (isPerson) {
      const person = selectedItem as Person;
      const updates: Partial<Person> = { events: nextEvents };
      if (normalizedType === 'FF') {
        const normalizedGroup = normalizeSymptomCategory(cleanedDraft.category);
        const normalizedTypeLabel = clampSymptomType(cleanedDraft.symptomType);
        const definition =
          (normalizedTypeLabel
            ? functionalIndicatorDefinitions.find(
                (entry) => entry.label.trim().toLowerCase() === normalizedTypeLabel.toLowerCase()
              )
            : undefined) ||
          functionalIndicatorDefinitions.find((entry) => entry.group === normalizedGroup);
        const ensuredDefinitionId =
          definition?.id ||
          onEnsureSymptomCategoryDefinition?.(normalizedTypeLabel, normalizedGroup) ||
          null;
        if (ensuredDefinitionId) {
          cleanedDraft.sourceIndicatorId = ensuredDefinitionId;
          updates.events = existingIndex === -1
            ? [...events, cleanedDraft]
            : events.map((evt) => (evt.id === eventDraft.id ? cleanedDraft : evt));
          const entry = {
            definitionId: ensuredDefinitionId,
            status: 'current' as const,
            impact: typeof cleanedDraft.impact === 'number' ? cleanedDraft.impact : 0,
            frequency: typeof cleanedDraft.frequency === 'number' ? cleanedDraft.frequency : 0,
            intensity: typeof cleanedDraft.intensity === 'number' ? cleanedDraft.intensity : 0,
            date: cleanedDraft.startDate || cleanedDraft.date || '',
            lastUpdatedAt: cleanedDraft.createdAt,
          };
          const current = person.functionalIndicators || [];
          updates.functionalIndicators = [
            ...current.filter((indicator) => indicator.definitionId !== ensuredDefinitionId),
            entry,
          ];
        }
      }
      onUpdatePerson(selectedItem.id, updates);
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
    ? 'Partner Relationship Functional Facts'
    : 'Individual Functional Facts';
  const addEventButtonLabel = isEmotionalLine
    ? 'Add Emotional Pattern Event'
    : isPartnership
    ? 'Add Relationship Event'
    : 'Add Event';
  const newEventTitle = isEmotionalLine
    ? 'New Emotional Pattern Event'
    : isPartnership
    ? 'New Relationship Event'
    : 'New Event';
  const editEventTitle = isEmotionalLine
    ? 'Edit Emotional Pattern Event'
    : isPartnership
    ? 'Edit Relationship Event'
    : 'Edit Event';
  const popupLeft =
    eventModalPosition && typeof window !== 'undefined'
      ? Math.max(12, Math.min(eventModalPosition.x + 8, window.innerWidth - 560))
      : undefined;
  const popupTop =
    eventModalPosition && typeof window !== 'undefined'
      ? Math.max(12, Math.min(eventModalPosition.y + 8, window.innerHeight - 560))
      : undefined;
  const popupMaxHeight =
    typeof window !== 'undefined'
      ? eventModalPosition && typeof popupTop === 'number'
        ? Math.max(260, window.innerHeight - popupTop - 12)
        : window.innerHeight - 24
      : undefined;
  const renderPersonSectionNav = () => (
    <div
      role="tablist"
      aria-label="Person property sections"
      style={{
        display: 'inline-flex',
        gap: 0,
        marginTop: 12,
        border: '1px solid #c6cfde',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {(['name', 'dates', 'notes', 'format'] as const).map((section) => (
        <button
          key={section}
          type="button"
          role="tab"
          id={`person-section-tab-${section}`}
          aria-selected={activePersonSection === section}
          aria-controls={`person-section-panel-${section}`}
          onClick={() => setActivePersonSection(section)}
          style={{
            ...sectionNavButtonStyle(activePersonSection === section),
            borderRadius: 0,
            border: 'none',
            borderLeft:
              section === 'name' ? 'none' : '1px solid #c6cfde',
          }}
        >
          {section === 'name'
            ? 'Name'
            : section === 'dates'
            ? 'Dates'
            : section === 'notes'
            ? 'Notes'
            : 'Format'}
        </button>
      ))}
    </div>
  );
  const renderActivePersonSection = () => {
    if (!selectedPerson || !personDraft) return null;

    if (activePersonSection === 'name') {
      return (
        <div
          role="tabpanel"
          id="person-section-panel-name"
          aria-labelledby="person-section-tab-name"
          style={sectionCardStyle}
        >
          <div style={{ fontWeight: 700, color: '#23324a' }}>Name</div>
          <div style={rowStyle}>
            <label htmlFor="firstName" style={labelStyle}>First Name:</label>
            <input type="text" id="firstName" name="firstName" value={personDraft.firstName ?? nameFallbackParts.first} onChange={handlePersonChange} style={{ width: '25ch', textAlign: 'left' }} />
          </div>
          <div style={rowStyle}>
            <label htmlFor="lastName" style={labelStyle}>Last Name:</label>
            <input type="text" id="lastName" name="lastName" value={personDraft.lastName ?? nameFallbackParts.last} onChange={handlePersonChange} style={{ width: '25ch', textAlign: 'left' }} />
          </div>
          <div style={rowStyle}>
            <label htmlFor="maidenName" style={labelStyle}>Maiden Name:</label>
            <input type="text" id="maidenName" name="maidenName" value={personDraft.maidenName ?? ''} onChange={handlePersonChange} style={{ width: '25ch', textAlign: 'left' }} />
          </div>
        </div>
      );
    }

    if (activePersonSection === 'dates') {
      return (
        <div
          role="tabpanel"
          id="person-section-panel-dates"
          aria-labelledby="person-section-tab-dates"
          style={sectionCardStyle}
        >
          <div style={{ fontWeight: 700, color: '#23324a' }}>Dates</div>
          <div style={rowStyle}>
            <label htmlFor="birthDate" style={labelStyle}>Birth Date:</label>
            <DatePickerField id="birthDate" name="birthDate" value={personDraft.birthDate} placeholder="YYYY-MM-DD" onChange={handlePersonChange} pickerLabel="Select birth date" />
          </div>
          <div style={rowStyle}>
            <label htmlFor="deathDate" style={labelStyle}>Death Date:</label>
            <DatePickerField id="deathDate" name="deathDate" value={personDraft.deathDate} placeholder="YYYY-MM-DD" onChange={handlePersonChange} pickerLabel="Select death date" />
          </div>
          <div style={rowStyle}>
            <label htmlFor="birthSex" style={labelStyle}>Birth Sex:</label>
            <select id="birthSex" name="birthSex" value={personDraft.birthSex || (personDraft.gender === 'male' ? 'male' : personDraft.gender === 'intersex' ? 'intersex' : 'female')} onChange={handlePersonChange} style={{ width: 160 }}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="intersex">Intersex</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="genderIdentity" style={labelStyle}>Gender:</label>
            <select id="genderIdentity" name="genderIdentity" value={personDraft.genderIdentity || defaultGenderIdentityForBirthSex(personDraft.birthSex || (personDraft.gender === 'male' ? 'male' : personDraft.gender === 'intersex' ? 'intersex' : 'female'))} onChange={handlePersonChange} style={{ width: 180 }}>
              <option value="feminine">Feminine</option>
              <option value="masculine">Masculine</option>
              <option value="nonbinary">Non-Binary</option>
              <option value="agender">Agender</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="genderDate" style={labelStyle}>Gender Date:</label>
            <DatePickerField id="genderDate" name="genderDate" value={personDraft.genderDate} placeholder="YYYY-MM-DD" onChange={handlePersonChange} pickerLabel="Select gender date" />
          </div>
          <div style={rowStyle}>
            <label htmlFor="adoptionStatus" style={labelStyle}>Adoption Status:</label>
            <select id="adoptionStatus" name="adoptionStatus" value={personDraft.adoptionStatus || 'biological'} onChange={handlePersonChange} style={{ width: 160 }}>
              <option value="biological">Biological</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="adoptionDate" style={labelStyle}>Adoption Date:</label>
            <DatePickerField id="adoptionDate" name="adoptionDate" value={personDraft.adoptionDate} placeholder="YYYY-MM-DD" onChange={handlePersonChange} pickerLabel="Select adoption date" />
          </div>
          {(personDraft.parentPartnership || personDraft.birthParentPartnership) && (
            <div style={rowStyle}>
              <label htmlFor="parentConnectionPattern" style={labelStyle}>Parent Line Pattern:</label>
              <select id="parentConnectionPattern" name="parentConnectionPattern" value={personDraft.parentConnectionPattern || 'none'} onChange={handlePersonChange} style={{ width: 180 }}>
                <option value="none">None</option>
                <option value="family-cutoff">Family Cutoff</option>
              </select>
            </div>
          )}
        </div>
      );
    }

    if (activePersonSection === 'notes') {
      return (
        <div
          role="tabpanel"
          id="person-section-panel-notes"
          aria-labelledby="person-section-tab-notes"
          style={sectionCardStyle}
        >
          <div style={{ fontWeight: 700, color: '#23324a' }}>Notes</div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <label htmlFor="notes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
            <textarea id="notes" name="notes" value={personDraft.notes || ''} onChange={handlePersonChange} rows={6} style={{ width: '100%', minHeight: '8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
          </div>
          <div style={rowStyle}>
            <label htmlFor="notesEnabled" style={labelStyle}>Enabled:</label>
            <input type="checkbox" id="notesEnabled" name="notesEnabled" checked={personDraft.notesEnabled ?? false} onChange={handlePersonChange} />
          </div>
        </div>
      );
    }

    return (
      <div
        role="tabpanel"
        id="person-section-panel-format"
        aria-labelledby="person-section-tab-format"
        style={sectionCardStyle}
      >
        <div style={{ fontWeight: 700, color: '#23324a' }}>Format</div>
        <div style={rowStyle}>
          <label htmlFor="size" style={labelStyle}>Size:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={() => adjustPersonSize(-1)} style={{ padding: '0 6px' }}>−</button>
            <input type="number" id="size" name="size" min={20} max={200} value={personDraft.size ?? 60} onChange={handlePersonChange} style={{ width: 60, textAlign: 'center' }} />
            <button type="button" onClick={() => adjustPersonSize(1)} style={{ padding: '0 6px' }}>+</button>
          </div>
        </div>
        {renderFormatColorControl('foreground', 'Foreground Color', personDraft.foregroundEnabled ?? !!personDraft.foregroundColor, personDraft.foregroundColor ?? DEFAULT_FOREGROUND_COLOR)}
        {renderFormatColorControl('border', 'Border Color', personDraft.borderEnabled ?? !!personDraft.borderColor, personDraft.borderColor ?? DEFAULT_BORDER_COLOR)}
        {renderFormatColorControl('background', 'Background Color', personDraft.backgroundEnabled ?? false, personDraft.backgroundColor ?? DEFAULT_BACKGROUND_COLOR)}
      </div>
    );
  };
  const renderFormatColorControl = (
    key: 'foreground' | 'border' | 'background',
    label: string,
    enabled: boolean,
    color: string
  ) => (
    <div style={formatColorRowStyle}>
      <div style={{ fontWeight: 600, minWidth: 120 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label={`${label} color`}
          title={`Choose ${label.toLowerCase()}`}
          onClick={() => colorInputRefs[key].current?.click()}
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1px solid #7b8ba5',
            background: color,
            cursor: 'pointer',
            padding: 0,
            boxShadow: enabled ? '0 0 0 2px rgba(75, 104, 166, 0.18)' : 'none',
          }}
        />
        <input
          ref={colorInputRefs[key]}
          type="color"
          name={`${key}Color`}
          value={color}
          onChange={handlePersonChange}
          aria-label={`${label} color picker`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
          tabIndex={-1}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            name={`${key}Enabled`}
            checked={enabled}
            onChange={handlePersonChange}
          />
          Enabled
        </label>
      </div>
    </div>
  );

  if (compactPersonSectionMode && isPerson && selectedPerson && personDraft) {
    const compactTitle =
      activePersonSection === 'name'
        ? 'Name'
        : activePersonSection === 'dates'
        ? 'Dates'
        : activePersonSection === 'notes'
        ? 'Notes'
        : 'Format';

    return (
      <div
        role="dialog"
        aria-label={`${compactTitle} properties`}
        style={{
          background: '#f8f9fc',
          padding: '12px 14px 14px',
          border: '1px solid #cfd7e5',
          borderRadius: 10,
          boxSizing: 'border-box',
          minWidth: 360,
          maxWidth: 460,
          boxShadow: '0 16px 42px rgba(16, 24, 40, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f3248' }}>{compactTitle}</div>
            <div style={{ fontSize: 12, color: '#58677c' }}>
              {[selectedPerson.firstName, selectedPerson.lastName].filter(Boolean).join(' ').trim() || selectedPerson.name || 'Person'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close person section popup"
            style={{
              border: '1px solid #c3cad8',
              background: '#fff',
              borderRadius: 6,
              cursor: 'pointer',
              width: 28,
              height: 28,
            }}
          >
            ×
          </button>
        </div>
        {renderActivePersonSection()}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={cancelPersonChanges} disabled={!personDirty}>Cancel</button>
          <button type="button" onClick={savePersonProperties} disabled={!personDirty}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#f0f0f0',
        padding: '10px 12px 12px 12px',
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
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
        <div
          role="tablist"
          aria-label="Properties tabs"
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            border: '1px solid #b8c2d3',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          {(['properties', 'functional', 'events'] as const).map((tab, index) => {
            const disabled = tab === 'functional' && (!isPerson || functionalIndicatorDefinitions.length === 0);
            const isActive = tab === activeTab;
            const tabLabel =
              tab === 'properties'
                ? isEmotionalLine
                  ? 'Pattern'
                  : isPartnership
                  ? 'Relationship'
                  : 'Person'
                : tab === 'functional'
                ? 'Symptoms'
                : 'Events';
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderLeft: index === 0 ? 'none' : '1px solid #d0d6e2',
                  background: isActive ? '#dfe7f7' : '#fff',
                  color: isActive ? '#1f3f78' : '#23324a',
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  minWidth: 88,
                }}
              >
                {tabLabel}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setTabHelpOpen(activeTab)}
          aria-label={`Help for ${activeTabLabel} tab`}
          title={`Help for ${activeTabLabel}`}
          style={helpBadgeStyle}
        >
          ?
        </button>
      </div>
      {tabHelpOpen && (
        <div
          role="dialog"
          aria-label="Tab help"
          style={{
            marginTop: 8,
            border: '1px solid #b7c6df',
            borderRadius: 8,
            background: '#f8fbff',
            padding: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <strong>{TAB_HELP_COPY[tabHelpOpen].title}</strong>
            <button
              type="button"
              onClick={() => setTabHelpOpen(null)}
              aria-label="Close tab help"
              style={{ border: '1px solid #bdbdbd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.4 }}>{TAB_HELP_COPY[tabHelpOpen].body}</div>
        </div>
      )}
      {activeTab === 'properties' && (
        <>
        {isPerson && selectedPerson && personDraft && (
        <div>
          {renderPersonSectionNav()}
          {renderActivePersonSection()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={cancelPersonChanges} disabled={!personDirty}>Cancel</button>
            <button type="button" onClick={savePersonProperties} disabled={!personDirty}>Save</button>
          </div>
        </div>
        )}
        {isPartnership && selectedPartnership && partnershipDraft && (
        <div>
          <div style={rowStyle}>
            <label htmlFor="relationshipType" style={labelStyle}>Type:</label>
            <select
              id="relationshipType" 
              name="relationshipType" 
              value={partnershipDraft.relationshipType} 
              onChange={handlePartnershipChange}
              style={{ width: 180 }}
            >
              {partnershipTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="relationshipStatus" style={labelStyle}>Status:</label>
            <select
              id="relationshipStatus" 
              name="relationshipStatus" 
              value={partnershipDraft.relationshipStatus} 
              onChange={handlePartnershipChange}
              style={{ width: 180 }}
            >
              {partnershipStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {formatOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>
          {partnershipStatusOptions.map((statusOption) => {
            const statusKey = normalizeStatusKey(statusOption);
            const fieldId = `statusDate-${statusKey.replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <div key={statusOption} style={rowStyle}>
                <label htmlFor={fieldId} style={labelStyle}>{formatOptionLabel(statusOption)} Date:</label>
                <DatePickerField
                  id={fieldId}
                  name={`statusDate:${statusOption}`}
                  value={readPartnershipStatusDate(partnershipDraft, statusOption)}
                  placeholder="YYYY-MM-DD"
                  onChange={handlePartnershipChange}
                  pickerLabel={`Select ${formatOptionLabel(statusOption).toLowerCase()} date`}
                />
              </div>
            );
          })}
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
        const presetColors = ['#444444', '#FF1744', '#2979FF', '#00C853', '#FF9100', '#E040FB'];

        return (
          <div>
            <div style={rowStyle}>
              <label htmlFor="relationshipType" style={labelStyle}>Type:</label>
              <select
                id="relationshipType"
                name="relationshipType"
                value={emotionalDraft.relationshipType}
                onChange={handleEmotionalLineChange}
                style={{ width: 180 }}
              >
                <option value="fusion">+ / - Adequate</option>
                <option value="distance">Distance</option>
                <option value="cutoff">Cutoff</option>
                <option value="conflict">Conflict</option>
                <option value="projection">Projection</option>
              </select>
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
              <label htmlFor="lineStyle" style={labelStyle}>Intensity:</label>
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
              <label htmlFor="startDate" style={labelStyle}>Start:</label>
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
              <label htmlFor="emotionalIntensityLevel" style={labelStyle}>Intensity Level:</label>
              <select
                id="emotionalIntensityLevel"
                value={emotionalIntensityDraft}
                onChange={(e) => applyEmotionalIntensityLevel(Number(e.target.value))}
                style={{ width: 180 }}
              >
                {INTENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {intensityChooserConfig && (
                <button
                  type="button"
                  aria-label={intensityChooserConfig.buttonLabel}
                  onClick={() => setEmotionalIntensityHelpOpen(true)}
                  style={helpBadgeStyle}
                >
                  ?
                </button>
              )}
            </div>
            {intensityChooserConfig && emotionalIntensityHelpOpen && (
              <div
                role="dialog"
                aria-label={intensityChooserConfig.title}
                style={{
                  marginTop: 8,
                  marginLeft: labelColumnWidth + 10,
                  width: 520,
                  maxWidth: 'calc(100% - 32px)',
                  border: '1px solid #c6cfde',
                  borderRadius: 10,
                  background: '#fff',
                  padding: '12px 14px',
                  boxShadow: '0 10px 28px rgba(28, 41, 61, 0.16)',
                  position: 'relative',
                  zIndex: 20,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <strong>{intensityChooserConfig.title}</strong>
                  <button
                    type="button"
                    onClick={() => setEmotionalIntensityHelpOpen(false)}
                    style={{ padding: '4px 10px' }}
                  >
                    Cancel
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {intensityChooserConfig.helpLines.map((line, index) => {
                    const level = index + 1;
                    const isActive = emotionalIntensityDraft === level;
                    return (
                      <button
                        key={line}
                        type="button"
                        onClick={() => {
                          applyEmotionalIntensityLevel(level);
                          setEmotionalIntensityHelpOpen(false);
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
                        <div style={{ fontWeight: 700, color: '#23324a' }}>
                          {intensityChooserConfig.labels[index]}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>{line}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={rowStyle}>
              <label htmlFor="emotionalImpact" style={labelStyle}>Impact:</label>
              <select
                id="emotionalImpact"
                value={emotionalImpactDraft}
                onChange={(e) => {
                  setEmotionalImpactDraft(Number(e.target.value));
                  setEmotionalPristine(false);
                }}
                style={{ width: 180 }}
              >
                {IMPACT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={rowStyle}>
              <label htmlFor="emotionalFrequency" style={labelStyle}>Frequency:</label>
              <select
                id="emotionalFrequency"
                value={emotionalFrequencyDraft}
                onChange={(e) => {
                  setEmotionalFrequencyDraft(Number(e.target.value));
                  setEmotionalPristine(false);
                }}
                style={{ width: 180 }}
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={cancelEmotionalChanges}
                disabled={!emotionalDirty && !emotionalMetricDirty && !triangleColorDirty && !triangleIntensityDirty}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEmotionalLineProperties}
                disabled={!emotionalDirty && !emotionalMetricDirty && !triangleColorDirty && !triangleIntensityDirty}
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
          symptomRows.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <strong>Symptoms</strong>
              {symptomRows.map((symptom) => {
                const definitionId = symptom.definitionId || '';
                const ensureDefinitionId = () =>
                  definitionId ||
                  onEnsureSymptomCategoryDefinition?.(symptom.type, symptom.category) ||
                  '';
                return (
                <div
                  key={symptom.key}
                  style={{
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    padding: 8,
                    marginTop: 6,
                    background: '#fff',
                  }}
                >
                  <div style={{ textAlign: 'center', fontWeight: 700 }}>
                    {toTitleCase(symptom.category)} · {symptom.type}
                  </div>
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
                        htmlFor={`indicator-status-${symptom.key}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Status:
                      </label>
                      <select
                        id={`indicator-status-${symptom.key}`}
                        value={symptom.status}
                        onChange={(e) => {
                          const resolvedDefinitionId = ensureDefinitionId();
                          if (!resolvedDefinitionId) return;
                          handleIndicatorStatusChange(
                            resolvedDefinitionId,
                            e.target.value as 'past' | 'current' | 'none'
                          );
                        }}
                        style={{ width: '20ch' }}
                      >
                        <option value="none">None</option>
                        <option value="current">Current</option>
                        <option value="past">Past</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                      <label
                        htmlFor={`indicator-intensity-${symptom.key}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Intensity:
                      </label>
                      <select
                        id={`indicator-intensity-${symptom.key}`}
                        value={symptom.intensity}
                        onChange={(e) => {
                          const resolvedDefinitionId = ensureDefinitionId();
                          if (!resolvedDefinitionId) return;
                          handleIndicatorIntensityChange(resolvedDefinitionId, Number(e.target.value));
                        }}
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
                        htmlFor={`indicator-frequency-${symptom.key}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Frequency:
                      </label>
                      <select
                        id={`indicator-frequency-${symptom.key}`}
                          value={symptom.frequency}
                          onChange={(e) => {
                            const resolvedDefinitionId = ensureDefinitionId();
                            if (!resolvedDefinitionId) return;
                            handleIndicatorFrequencyChange(resolvedDefinitionId, Number(e.target.value));
                          }}
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
                        htmlFor={`indicator-impact-${symptom.key}`}
                        style={{ fontSize: 12, width: 80, textAlign: 'right', fontWeight: 600 }}
                      >
                        Impact:
                      </label>
                      <select
                        id={`indicator-impact-${symptom.key}`}
                          value={symptom.impact}
                          onChange={(e) => {
                            const resolvedDefinitionId = ensureDefinitionId();
                            if (!resolvedDefinitionId) return;
                            handleIndicatorImpactChange(resolvedDefinitionId, Number(e.target.value));
                          }}
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
            <div style={{ marginTop: 12 }}>No symptoms recorded yet. Add a Symptom event to populate this list.</div>
          )
        ) : (
          <div style={{ marginTop: 12 }}>Symptoms apply only to Person nodes.</div>
        )
      )}
      {activeTab === 'events' && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <strong>Events</strong>
            <button onClick={() => openNewEvent()}>{addEventButtonLabel}</button>
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
                          <button style={eventActionButtonStyle} onClick={() => openEditEvent(event)}>Edit</button>
                          <button
                            aria-label="Delete"
                            title="Delete"
                            style={eventActionButtonStyle}
                            onClick={() => deleteEvent(event.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{dateText}</span>
                          <span style={{ fontWeight: 600 }}>
                            {descriptorForEvent(event)}
                          </span>
                          <span style={{ fontSize: 11, color: '#555' }}>
                            {eventTypeLabel(eventType)}
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
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={eventActionButtonStyle} onClick={() => openEditEvent(event)}>Edit</button>
                          <button
                            aria-label="Delete"
                            title="Delete"
                            style={eventActionButtonStyle}
                            onClick={() => deleteEvent(event.id)}
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
                            {eventTypeLabel(eventType)}
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
                            {eventType === 'FF'
                              ? toTitleCase(normalizeSymptomCategory(event.category || event.symptomGroup))
                              : '—'}
                          </span>
                          <span>
                            Symptom Type:{' '}
                            {eventType === 'FF'
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
                          <button style={eventActionButtonStyle} onClick={() => openEditEvent(event)}>Edit</button>
                          <button
                            aria-label="Delete"
                            title="Delete"
                            style={eventActionButtonStyle}
                            onClick={() => deleteEvent(event.id)}
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
            alignItems: eventModalPosition ? 'stretch' : 'center',
            justifyContent: eventModalPosition ? 'stretch' : 'center',
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
              position: eventModalPosition ? 'absolute' : 'relative',
              left: popupLeft,
              top: popupTop,
            }}
          >
            <h4 style={{ marginTop: 0 }}>
              {getEvents().some((event) => event.id === eventDraft.id) ? editEventTitle : newEventTitle}
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
                    <label style={labelStyle}>Anchor:</label>
                    <div style={{ ...controlStyle, width: '60%', textAlign: 'left' }}>
                      {eventDraft.anchorType || resolveAnchorType()} · {eventDraft.anchorId || selectedItem.id}
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventType" style={labelStyle}>Event Type:</label>
                    <select
                      id="eventType"
                      value={eventType}
                      onChange={(e) => handleEventDraftChange('eventType', e.target.value)}
                      style={{ ...controlStyle, width: '60%' }}
                    >
                      <option value="NODAL">Nodal</option>
                      <option value="FF">Symptom</option>
                      <option value="EPE">Emotional Pattern</option>
                    </select>
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
                        <option value="None" />
                        {otherPersonOptions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
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
                            handleEventDraftChange('startDate', e.target.value);
                            handleEventDraftChange('date', e.target.value);
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
                          onChange={(e) => handleEventDraftChange('endDate', e.target.value)}
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
                  {eventType === 'FF' && (
                    <div style={rowStyle}>
                      <label htmlFor="eventCategory" style={labelStyle}>Symptom Category:</label>
                      <select
                        id="eventCategory"
                        value={normalizeSymptomCategory(eventDraft.category || eventDraft.symptomGroup)}
                        onChange={(e) => handleEventDraftChange('category', e.target.value)}
                        style={{ ...controlStyle, width: '60%' }}
                      >
                        {SYMPTOM_GROUP_OPTIONS.map((category) => (
                          <option key={category} value={category}>
                            {toTitleCase(category)}
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
                          onChange={(e) => handleEventDraftChange('symptomType', e.target.value)}
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
                  {eventType === 'EPE' && (
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
                  )}
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
                  {eventType !== 'NODAL' && (
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
