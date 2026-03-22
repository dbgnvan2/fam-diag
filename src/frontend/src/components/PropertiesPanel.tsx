import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  EventClass,
  EventType,
  EventAnchorType,
  SymptomGroup,
} from '../types';
import {
  clampIndicatorDimension,
} from '../constants/functionalIndicatorScales';
import { EVENT_TYPE_LABELS, inferEventType as inferEventTypeFromConstants } from '../constants/eventConstants';
import {
  deriveSiblingPositionResult,
  getSiblingPositionOptions,
} from '../utils/siblingPosition';
import { computeDefaultFamilyName } from '../utils/partnershipUtils';
import PersonNameSection from './sections/PersonNameSection';
import PersonDatesSection from './sections/PersonDatesSection';
import PersonFormatSection from './sections/PersonFormatSection';
import PersonFOOSection from './sections/PersonFOOSection';
import PersonSiblingSection from './sections/PersonSiblingSection';
import PartnershipPropertiesSection from './sections/PartnershipPropertiesSection';
import EPLPropertiesSection from './sections/EPLPropertiesSection';
import EventModal from './EventModal';
import EventsSection from './EventsSection';
import EventCard from './EventCard';
import EmotionalPatternModal from './modals/EmotionalPatternModal';
import type { EmotionalPatternDraft } from '../types/diagramEditor';
import { LINE_STYLE_VALUES, intensityValueForLineStyle } from '../utils/emotionalPatternOptions';


const familyAddBtnStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#4b68a6',
  border: '1px solid #c0ccdf',
  borderRadius: 4,
  background: '#f0f4fb',
  padding: '1px 7px',
  cursor: 'pointer',
};

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';
const DEFAULT_FOREGROUND_COLOR = '#000000';
const createEventId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERSON_DATE_LABELS: Record<'birthDate' | 'deathDate' | 'genderDate', string> = {
  birthDate: 'Birth Date',
  deathDate: 'Death Date',
  genderDate: 'Gender Date',
};
const DEFAULT_OBSERVATION = 'Not recorded - ask client';
const DEFAULT_HOW_WELL = 1;
const humanizeOptionLabel = (value: string) =>
  value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const RELATIONSHIP_TYPE_STATUS_ROWS: Record<string, { status: string; dateLabel: string }[]> = {
  married: [
    { status: 'married', dateLabel: 'Married' },
    { status: 'divorce', dateLabel: 'Divorces' },
    { status: 'separated', dateLabel: 'Separated' },
    { status: 'widowed', dateLabel: 'Widowed' },
  ],
  engaged: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  friendship: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  affair: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  'living-together': [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  'common-law': [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ended', dateLabel: 'Ended' },
    { status: 'separated', dateLabel: 'Separated' },
    { status: 'widowed', dateLabel: 'Widowed' },
  ],
  dating: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
};
const RELATIONSHIP_STATUS_KEY_ALIASES: Record<string, string> = {
  started: 'start',
  start: 'start',
  divorced: 'divorce',
  divorce: 'divorce',
  widowed: 'widowed',
  ongoing: 'ongoing',
  ended: 'ended',
  married: 'married',
  separated: 'separated',
};
const canonicalRelationshipStatusKey = (value: string) =>
  RELATIONSHIP_STATUS_KEY_ALIASES[value.trim().toLowerCase()] || value.trim().toLowerCase();
const relationshipStatusRowsForType = (relationshipType: string) =>
  RELATIONSHIP_TYPE_STATUS_ROWS[relationshipType.trim().toLowerCase()] || [];
const relationshipDateLabelFor = (relationshipType: string, status: string) => {
  const canonicalStatus = canonicalRelationshipStatusKey(status);
  const mapped = relationshipStatusRowsForType(relationshipType).find(
    (entry) => canonicalRelationshipStatusKey(entry.status) === canonicalStatus
  );
  return mapped?.dateLabel || humanizeOptionLabel(status);
};
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
const TAB_HELP_COPY: Record<'properties' | 'functional' | 'events' | 'patterns', { title: string; body: string }> = {
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
  patterns: {
    title: 'Patterns Tab Help',
    body:
      'The Patterns tab lists all emotional patterns (fusion, distance, conflict, cutoff, projection) connected to this person. Click a pattern to open its full properties.',
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
const normalizeStatusKey = (value: string) => canonicalRelationshipStatusKey(value);
const LEGACY_STATUS_DATE_FIELD_BY_KEY: Partial<
  Record<string, 'relationshipStartDate' | 'marriedStartDate' | 'separationDate' | 'divorceDate'>
> = {
  started: 'relationshipStartDate',
  start: 'relationshipStartDate',
  ongoing: 'relationshipStartDate',
  married: 'marriedStartDate',
  separated: 'separationDate',
  divorced: 'divorceDate',
  divorce: 'divorceDate',
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
const PARTNERSHIP_STRING_FIELDS: (keyof Pick<Partnership, 'relationshipType' | 'relationshipStatus' | 'relationshipStartDate' | 'marriedStartDate' | 'separationDate' | 'divorceDate' | 'familyName' | 'notes'>)[] = [
  'relationshipType',
  'relationshipStatus',
  'relationshipStartDate',
  'marriedStartDate',
  'separationDate',
  'divorceDate',
  'familyName',
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
const readPartnershipStatusDate = (partnership: Partnership, status: string) => {
  const key = normalizeStatusKey(status);
  const explicit = partnership.statusDates?.[key];
  if (explicit) return explicit;
  const aliasMatches = Object.entries(partnership.statusDates || {}).find(
    ([entryKey]) => canonicalRelationshipStatusKey(entryKey) === key
  );
  if (aliasMatches?.[1]) return aliasMatches[1];
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
  partnerships?: Partnership[];
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
  allEmotionalLines?: EmotionalLine[];
  onSelectEmotionalLine?: (line: EmotionalLine) => void;
  onRemoveEmotionalLine?: (id: string) => void;
  initialActiveTab?: 'properties' | 'functional' | 'events' | 'patterns';
  initialPersonSection?: 'name' | 'dates' | 'format' | 'sibling' | 'foo';
  initialPartnershipType?: string;
  focusEventId?: string;
  openNewEventRequestId?: string;
  newEventSeed?: Partial<EmotionalProcessEvent> | null;
  openNewEventPosition?: { x: number; y: number };
  newEventModalTitle?: string;
  onEnsureSymptomCategoryDefinition?: (label: string, group: SymptomGroup) => string | null;
  compactPersonSectionMode?: boolean;
  compactPartnershipSectionMode?: boolean;
  isFamilyView?: boolean;
  onOpenFamilyProperty?: (category: string, subtype: string, position: { x: number; y: number }) => void;
  onAddFamilyEvent?: (position: { x: number; y: number }) => void;
  onOpenFamilyEventEdit?: (partnershipId: string, eventId: string, position: { x: number; y: number }) => void;
  onDeleteFamilyEvent?: (partnershipId: string, eventId: string) => void;
  onClose: () => void;
}

const PropertiesPanel = ({
  selectedItem,
  people,
  partnerships = [],
  eventCategories,
  relationshipTypes = ['married', 'engaged', 'common-law', 'living-together', 'dating', 'affair', 'friendship'],
  relationshipStatuses = ['married', 'separated', 'divorce', 'widowed', 'start', 'ended', 'ongoing'],
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
  initialPartnershipType,
  focusEventId,
  openNewEventRequestId,
  newEventSeed,
  openNewEventPosition,
  newEventModalTitle,
  allEmotionalLines = [],
  onSelectEmotionalLine: _onSelectEmotionalLine,
  onRemoveEmotionalLine,
  onEnsureSymptomCategoryDefinition,
  compactPersonSectionMode = false,
  compactPartnershipSectionMode = false,
  isFamilyView = false,
  onOpenFamilyProperty,
  onAddFamilyEvent,
  onOpenFamilyEventEdit,
  onDeleteFamilyEvent,
  onClose,
}: PropertiesPanelProps) => {
  const colorInputRefs = {
    foreground: useRef<HTMLInputElement | null>(null),
    border: useRef<HTMLInputElement | null>(null),
    background: useRef<HTMLInputElement | null>(null),
  };
  const formatOptionLabel = humanizeOptionLabel;
  const isPerson = 'name' in selectedItem;
  const isPartnership = 'partner1_id' in selectedItem && 'children' in selectedItem;
  const isEmotionalLine = 'lineStyle' in selectedItem;
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<EmotionalProcessEvent | null>(null);
  const [eventModalPosition, setEventModalPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [eventModalTitle, setEventModalTitle] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'properties' | 'functional' | 'events' | 'patterns'>('properties');
  const [activeFamilyTab, setActiveFamilyTab] = useState<'family' | 'triangles' | 'stressors' | 'events'>('family');
  const [activePersonSection, setActivePersonSection] = useState<
    'name' | 'dates' | 'format' | 'sibling' | 'foo'
  >('name');
  const [activeSiblingSubtab, setActiveSiblingSubtab] = useState<
    'override' | 'position' | 'compatibility'
  >('override');
  const [tabHelpOpen, setTabHelpOpen] = useState<'properties' | 'functional' | 'events' | 'patterns' | null>(null);
  const [siblingHelpOpen, setSiblingHelpOpen] = useState(false);
  const [fooHelpOpen, setFooHelpOpen] = useState<'familyStability' | 'familyIntactness' | null>(null);
  const [_symptomIntensityHelpOpen, setSymptomIntensityHelpOpen] = useState<string | null>(null);
  const [editingPatternDraft, setEditingPatternDraft] = useState<EmotionalPatternDraft | null>(null);
  const [editingPatternLineId, setEditingPatternLineId] = useState<string | null>(null);
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
  const siblingPositionResult = useMemo(
    () =>
      selectedPerson
        ? deriveSiblingPositionResult({
            person: selectedPerson,
            people,
            partnerships,
          })
        : null,
    [selectedPerson, people, partnerships]
  );
  const siblingPositionOptions = useMemo(
    () =>
      selectedPerson
        ? getSiblingPositionOptions({
            person: selectedPerson,
            people,
            partnerships,
          })
        : [],
    [selectedPerson, people, partnerships]
  );
  const computedFamilyName = useMemo(() => {
    if (!selectedPartnership) return '';
    const p1 = people.find((p) => p.id === selectedPartnership.partner1_id);
    const p2 = people.find((p) => p.id === selectedPartnership.partner2_id);
    if (!p1 || !p2) return '';
    return computeDefaultFamilyName(p1, p2);
  }, [selectedPartnership, people]);

  const activeTabLabel =
    activeTab === 'properties'
      ? isEmotionalLine
        ? 'Pattern'
        : isPartnership
        ? 'Relationship'
        : 'Person'
      : activeTab === 'functional'
      ? 'Symptoms'
      : activeTab === 'patterns'
      ? 'Patterns'
      : 'Events';
  const partnershipTypeOptions = useMemo(() => {
    const options = [...relationshipTypes, ...Object.keys(RELATIONSHIP_TYPE_STATUS_ROWS)];
    if (
      selectedPartnership?.relationshipType &&
      !options.includes(selectedPartnership.relationshipType)
    ) {
      options.push(selectedPartnership.relationshipType);
    }
    return Array.from(new Set(options));
  }, [relationshipTypes, selectedPartnership]);
  const partnershipStatusOptions = useMemo(() => {
    const relationshipType = partnershipDraft?.relationshipType || selectedPartnership?.relationshipType || '';
    const mapped = relationshipStatusRowsForType(relationshipType).map((entry) => entry.status);
    const selectedTypeMatches =
      (selectedPartnership?.relationshipType || '') === relationshipType;
    const draftTypeMatches = (partnershipDraft?.relationshipType || '') === relationshipType;
    const extraStatuses = [
      selectedTypeMatches ? selectedPartnership?.relationshipStatus || '' : '',
      draftTypeMatches ? partnershipDraft?.relationshipStatus || '' : '',
      ...(selectedTypeMatches ? Object.keys(selectedPartnership?.statusDates || {}) : []),
      ...(draftTypeMatches ? Object.keys(partnershipDraft?.statusDates || {}) : []),
    ].filter(Boolean);
    const sourceStatuses = mapped.length > 0 ? extraStatuses : [...relationshipStatuses, ...extraStatuses];
    const extras = sourceStatuses.filter(
      (status, index, source) =>
        source.findIndex(
          (entry) =>
            canonicalRelationshipStatusKey(entry) === canonicalRelationshipStatusKey(status)
        ) === index &&
        !mapped.some(
          (mappedStatus) =>
            canonicalRelationshipStatusKey(mappedStatus) === canonicalRelationshipStatusKey(status)
        )
    );
    return [...mapped, ...extras];
  }, [relationshipStatuses, selectedPartnership, partnershipDraft]);
  const partnershipStatusDateRows = useMemo(() => {
    const relationshipType = partnershipDraft?.relationshipType || selectedPartnership?.relationshipType || '';
    return partnershipStatusOptions.map((status) => ({
      status,
      dateLabel: relationshipDateLabelFor(relationshipType, status),
    }));
  }, [partnershipStatusOptions, partnershipDraft, selectedPartnership]);
  const allRelationshipStatuses = useMemo(
    () =>
      Array.from(
        new Set([
          ...relationshipStatuses,
          ...Object.values(RELATIONSHIP_TYPE_STATUS_ROWS).flatMap((rows) => rows.map((row) => row.status)),
          ...Object.keys(selectedPartnership?.statusDates || {}),
          ...Object.keys(partnershipDraft?.statusDates || {}),
        ])
      ),
    [relationshipStatuses, selectedPartnership, partnershipDraft]
  );
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
  const sectionNavButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${active ? '#4b68a6' : '#c6cfde'}`,
    background: active ? '#e7eefb' : '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  });
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
  useEffect(() => {
    setEventModalOpen(false);
    setEventDraft(null);
    setActiveTab(initialActiveTab || 'properties');
    setActivePersonSection(initialPersonSection || 'name');
    setActiveSiblingSubtab('override');
    setSiblingHelpOpen(false);
    setFooHelpOpen(null);
    setSymptomIntensityHelpOpen(null);
    setActiveFamilyTab('family');
  }, [selectedItem.id, initialActiveTab, initialPersonSection, focusEventId]);

  useEffect(() => {
    if (!focusEventId) return;
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
    if (!selectedPartnership || !initialPartnershipType) return;
    setPartnershipDraft((prev) => {
      const base = prev || { ...selectedPartnership };
      const nextStatusOptions = relationshipStatusRowsForType(initialPartnershipType).map(
        (entry) => entry.status
      );
      const nextStatus =
        nextStatusOptions.length > 0 &&
        !nextStatusOptions.some(
          (status) =>
            canonicalRelationshipStatusKey(status) ===
            canonicalRelationshipStatusKey(base.relationshipStatus)
        )
          ? nextStatusOptions[0]
          : base.relationshipStatus;
      return {
        ...base,
        relationshipType: initialPartnershipType,
        relationshipStatus: nextStatus,
      };
    });
    setPartnershipPristine(false);
  }, [selectedPartnership, initialPartnershipType]);

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
    } else if (name === 'birthOrderOverride') {
      const trimmed = value.trim();
      if (!trimmed) {
        nextValue = undefined;
      } else {
        const numericValue = Number(trimmed);
        if (!Number.isFinite(numericValue) || numericValue < 1) {
          return;
        }
        nextValue = Math.floor(numericValue);
      }
    } else if (
      name === 'siblingPositionOverride' ||
      name === 'fatherPositionOverride' ||
      name === 'motherPositionOverride' ||
      name === 'partnerPositionOverride'
    ) {
      nextValue = value.trim() || undefined;
    } else if (name === 'siblingMaturityLevel') {
      nextValue = value ? (parseInt(value, 10) as 1 | 2 | 3 | 4 | 5) : undefined;
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
    } else if (name === 'foregroundEnabled' && nextValue) {
      updates = {
        ...updates,
        foregroundColor: personDraft.foregroundColor ?? DEFAULT_FOREGROUND_COLOR,
      };
    } else if (name === 'borderEnabled' && nextValue) {
      updates = {
        ...updates,
        borderColor: personDraft.borderColor ?? DEFAULT_BORDER_COLOR,
      };
    } else if (name === 'backgroundEnabled' && nextValue) {
      updates = {
        ...updates,
        backgroundColor: personDraft.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
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
    if (name === 'relationshipType') {
      const nextType = value;
      const nextStatusOptions = relationshipStatusRowsForType(nextType).map((entry) => entry.status);
      const nextStatusKeys = new Set(nextStatusOptions.map(canonicalRelationshipStatusKey));
      const nextStatus =
        nextStatusOptions.length > 0 &&
        !nextStatusKeys.has(canonicalRelationshipStatusKey(partnershipDraft.relationshipStatus))
          ? nextStatusOptions[0]
          : partnershipDraft.relationshipStatus;
      // Filter statusDates to only keep entries valid for the new type
      const currentDates = partnershipDraft.statusDates || {};
      const filteredDates: Record<string, string> = {};
      for (const [key, val] of Object.entries(currentDates)) {
        if (nextStatusKeys.has(canonicalRelationshipStatusKey(key))) {
          filteredDates[key] = val;
        }
      }
      updatePartnershipDraftState({
        relationshipType: nextType,
        relationshipStatus: nextStatus,
        statusDates: filteredDates,
      });
      setPartnershipPristine(false);
      return;
    }
    if (name === 'familyName') {
      updatePartnershipDraftState({ familyName: value || undefined });
    } else {
      updatePartnershipDraftState({ [name]: value } as Partial<Partnership>);
    }
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
      startDate: dateValue,
      category: 'Individual',
      eventType: 'NODAL' as const,
      status: 'discrete' as const,
      subtype: PERSON_DATE_LABELS[field],
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: '',
      primaryPersonName: displayName,
      wwwwh: DEFAULT_OBSERVATION,
      observations: person.notes || DEFAULT_OBSERVATION,
      eventClass: 'individual' as const,
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
    const subtype = isBirthSex
      ? `Birth Sex: ${getBirthSexLabel(value as Person['birthSex'])}`
      : `Gender: ${getGenderIdentityLabel(value as Person['genderIdentity'])}`;
    const normalizedDate = normalizePersonEventDate(dateValue);
    return {
      id: createEventId(),
      date: normalizedDate,
      startDate: normalizedDate,
      category: 'Individual',
      eventType: 'NODAL' as const,
      status: 'discrete' as const,
      subtype,
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: '',
      primaryPersonName: displayName,
      wwwwh: DEFAULT_OBSERVATION,
      observations: person.notes || DEFAULT_OBSERVATION,
      eventClass: 'individual' as const,
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
    const label = relationshipDateLabelFor(partnership.relationshipType, status);
    return {
      id: createEventId(),
      date: dateValue,
      category: toTitleCase(partnership.relationshipType),
      eventType: 'NODAL' as const,
      status: 'discrete' as const,
      subtype: label,
      intensity: RELATIONSHIP_STATUS_INTENSITY[normalizeStatusKey(status)] ?? 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: partner2.name || '',
      primaryPersonName: partner1.name || '',
      wwwwh: DEFAULT_OBSERVATION,
      observations: partnership.notes || DEFAULT_OBSERVATION,
      eventClass: 'relationship' as const,
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
    const typeLabel = toTitleCase(line.relationshipType);
    const statusText = toTitleCase(line.status || 'ongoing');
    return {
      id: createEventId(),
      date: dateValue,
      startDate: dateValue,
      category: 'Emotional Pattern',
      eventType: 'EPE' as const,
      anchorType: 'EMOTIONAL_PROCESS_EP' as const,
      anchorId: line.id,
      status: 'discrete' as const,
      subtype: `${typeLabel} – ${statusText} – ${stageLabel}`,
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: person2.name || '',
      primaryPersonName: person1.name || '',
      wwwwh: DEFAULT_OBSERVATION,
      observations: line.notes || DEFAULT_OBSERVATION,
      eventClass: 'emotional-pattern' as const,
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
    const today = new Date().toISOString().slice(0, 10);
    const typeLabel = toTitleCase(line.relationshipType);
    return {
      id: createEventId(),
      date: today,
      startDate: today,
      endDate: line.endDate || undefined,
      category: 'Emotional Pattern',
      eventType: 'EPE' as const,
      anchorType: 'EMOTIONAL_PROCESS_EP' as const,
      anchorId: line.id,
      status: line.status === 'ended' ? 'end' as const : 'ongoing' as const,
      subtype: `${typeLabel} – Measurement`,
      intensity,
      frequency,
      impact,
      howWell: DEFAULT_HOW_WELL,
      otherPersonName: person2.name || '',
      primaryPersonName: person1.name || '',
      wwwwh: DEFAULT_OBSERVATION,
      observations: line.notes || DEFAULT_OBSERVATION,
      eventClass: 'emotional-pattern' as const,
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
      if (personDraft.adoptionDate && DATE_PATTERN.test(personDraft.adoptionDate)) {
        newEvents.push({
          id: createEventId(),
          date: personDraft.adoptionDate,
          startDate: personDraft.adoptionDate,
          category: 'Individual',
          eventType: 'NODAL' as const,
          status: 'discrete' as const,
          subtype: 'Adoption Date',
          intensity: 0,
          frequency: 0,
          impact: 0,
          howWell: DEFAULT_HOW_WELL,
          otherPersonName: 'None',
          primaryPersonName: personDraft.name || '',
          wwwwh: DEFAULT_OBSERVATION,
          observations: DEFAULT_OBSERVATION,
          eventClass: 'individual' as const,
          createdAt: Date.now(),
        });
      }
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
    return allRelationshipStatuses.some((status) =>
      stringDiffers(
        readPartnershipStatusDate(partnershipDraft, status),
        readPartnershipStatusDate(selectedPartnership, status)
      )
    );
  }, [selectedPartnership, partnershipDraft, allRelationshipStatuses]);

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
    // Create event when type or status changes
    const typeChanged = stringDiffers(partnershipDraft.relationshipType, selectedPartnership.relationshipType);
    const statusChanged = stringDiffers(partnershipDraft.relationshipStatus, selectedPartnership.relationshipStatus);
    if (typeChanged || statusChanged) {
      const today = new Date().toISOString().slice(0, 10);
      const statusLabel = typeChanged
        ? `Type changed to ${humanizeOptionLabel(partnershipDraft.relationshipType)}`
        : `Status changed to ${humanizeOptionLabel(partnershipDraft.relationshipStatus)}`;
      newEvents.push({
        id: createEventId(),
        date: today,
        startDate: today,
        category: toTitleCase(partnershipDraft.relationshipType),
        eventType: 'NODAL' as const,
        status: 'discrete' as const,
        subtype: statusLabel,
        intensity: RELATIONSHIP_STATUS_INTENSITY[normalizeStatusKey(partnershipDraft.relationshipStatus)] ?? 0,
        frequency: 0,
        impact: 0,
        howWell: DEFAULT_HOW_WELL,
        otherPersonName: partner2?.name || '',
        primaryPersonName: partner1?.name || '',
        wwwwh: DEFAULT_OBSERVATION,
        observations: DEFAULT_OBSERVATION,
        eventClass: 'relationship' as const,
        createdAt: Date.now(),
      });
    }
    allRelationshipStatuses.forEach((status) => {
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
    // Create event for non-date property changes (relationshipType, status, lineStyle, etc.)
    const nonDateChanged = (['relationshipType', 'status', 'lineStyle'] as const).some(
      (field) => stringDiffers(emotionalDraft[field], selectedEmotionalLine[field])
    );
    if (nonDateChanged) {
      const today = new Date().toISOString().slice(0, 10);
      const person1 = people.find((p) => p.id === emotionalDraft.person1_id);
      const person2 = people.find((p) => p.id === emotionalDraft.person2_id);
      const changes: string[] = [];
      if (stringDiffers(emotionalDraft.relationshipType, selectedEmotionalLine.relationshipType)) {
        changes.push(`Type: ${humanizeOptionLabel(emotionalDraft.relationshipType)}`);
      }
      if (stringDiffers(emotionalDraft.status, selectedEmotionalLine.status)) {
        changes.push(`Status: ${humanizeOptionLabel(emotionalDraft.status || 'ongoing')}`);
      }
      if (stringDiffers(emotionalDraft.lineStyle, selectedEmotionalLine.lineStyle)) {
        changes.push(`Style: ${humanizeOptionLabel(emotionalDraft.lineStyle)}`);
      }
      newEvents.push({
        id: createEventId(),
        date: today,
        startDate: today,
        category: 'Emotional Pattern',
        eventType: 'EPE' as const,
        anchorType: 'EMOTIONAL_PROCESS_EP' as const,
        anchorId: selectedEmotionalLine.id,
        status: 'discrete' as const,
        subtype: changes.join(', '),
        intensity: 0,
        frequency: 0,
        impact: 0,
        howWell: DEFAULT_HOW_WELL,
        otherPersonName: person2?.name || '',
        primaryPersonName: person1?.name || '',
        wwwwh: DEFAULT_OBSERVATION,
        observations: DEFAULT_OBSERVATION,
        eventClass: 'emotional-pattern' as const,
        createdAt: Date.now(),
      });
    }
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
    (): EventType => (isEmotionalLine ? 'EPE' : 'NODAL'),
    [isEmotionalLine]
  );
  const inferEventType = inferEventTypeFromConstants;
  const normalizeEventDate = (event: EmotionalProcessEvent): string =>
    event.startDate || event.date || '';
  const symptomTypeOptions = useMemo(() => {
    const currentCategory = (eventDraft?.category || 'physical').toLowerCase().trim();
    const labels = functionalIndicatorDefinitions
      .filter((definition) => (definition.group || 'physical').toLowerCase() === currentCategory)
      .map((definition) => definition.label?.trim())
      .filter((label): label is string => !!label);
    return Array.from(new Set(labels));
  }, [functionalIndicatorDefinitions, eventDraft?.category]);
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
      sourceEventId?: string;
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
        sourceEventId?: string;
        status: 'past' | 'current' | 'none';
        intensity: number;
        frequency: number;
        impact: number;
        lastTimestamp: number;
      }
    >();
    (selectedPerson.events || [])
      .filter((event) => inferEventType(event) === 'SYMPTOM')
      .forEach((event) => {
        const category = (event.category || 'physical').toLowerCase();
        const type = (event.symptomType || event.subtype || event.category || 'General').slice(0, 30);
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
        const eventStatus = event.status || 'discrete';
        const status: 'past' | 'current' | 'none' =
          eventStatus === 'end' ? 'past' : 'current';
        const sourceDef = event.sourceIndicatorId
          ? definitionById.get(event.sourceIndicatorId)
          : undefined;
        buckets.set(key, {
          key,
          category: category as any,
          type,
          definitionId: sourceDef?.id,
          sourceEventId: event.id,
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
      const category = (definition.group || 'physical').toLowerCase();
      const type = (definition.label || 'General').slice(0, 30);
      const key = `${category}|${type.toLowerCase()}`;
      const existing = buckets.get(key);
      const indicatorTimestamp = entry.lastUpdatedAt || 0;
      if (!existing || indicatorTimestamp >= existing.lastTimestamp) {
        buckets.set(key, {
          key,
          category: category as any,
          type,
          definitionId: definition.id,
          sourceEventId: existing?.sourceEventId,
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


  const buildEventDraft = useCallback((
    eventType: EventType,
    seed?: Partial<EmotionalProcessEvent> | null
  ): EmotionalProcessEvent => {
    const anchorType = resolveAnchorType();
    const anchorId = selectedItem.id;
    const anchorEvents = getEvents();
    const similarEvents = anchorEvents
      .filter((event) => {
        const eType = inferEventType(event);
        if (eType !== eventType) return false;
        if ((event.anchorType || anchorType) !== anchorType) return false;
        if ((event.anchorId || anchorId) !== anchorId) return false;
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
    const normalizeSymptomCat = (cat: string) => {
      const lower = cat.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    };
    const baseCategory =
      eventType === 'SYMPTOM'
        ? normalizeSymptomCat(seed?.category || latest?.category || 'Physical')
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
      subtype: seed?.subtype || latest?.subtype || '',
      anchorType,
      anchorId,
      status: seed?.status || latest?.status || 'discrete',
      intensity: typeof (seed?.intensity ?? latest?.intensity) === 'number' ? Number(seed?.intensity ?? latest?.intensity) : 1,
      frequency: typeof (seed?.frequency ?? latest?.frequency) === 'number' ? Number(seed?.frequency ?? latest?.frequency) : 0,
      impact: typeof (seed?.impact ?? latest?.impact) === 'number' ? Number(seed?.impact ?? latest?.impact) : 0,
      howWell: typeof (seed?.howWell ?? latest?.howWell) === 'number' ? Number(seed?.howWell ?? latest?.howWell) : 5,
      otherPersonName: seed?.otherPersonName || latest?.otherPersonName || 'None',
      primaryPersonName: seed?.primaryPersonName || latest?.primaryPersonName || primaryPersonOptions[0] || '',
      wwwwh: seed?.wwwwh || latest?.wwwwh || '',
      observations: seed?.observations || latest?.observations || '',
      priorEventsNote: seed?.priorEventsNote || latest?.priorEventsNote || '',
      reflectionsNote: seed?.reflectionsNote || latest?.reflectionsNote || '',
      createdAt: Date.now(),
      symptomType: eventType === 'SYMPTOM' ? (seed?.symptomType || latest?.symptomType || '') : undefined,
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
    setEventModalTitle(undefined);
    setEventModalOpen(true);
  };

  const openEditEvent = (event: EmotionalProcessEvent) => {
    const eType = inferEventType(event);
    setEventDraft({
      ...event,
      category: event.category || eventCategories[0] || '',
      eventType: eType,
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || '',
      subtype: event.subtype || '',
      anchorType: event.anchorType || resolveAnchorType(),
      anchorId: event.anchorId || selectedItem.id,
      otherPersonName: event.otherPersonName || 'None',
      primaryPersonName: event.primaryPersonName || primaryPersonOptions[0] || '',
      frequency: typeof event.frequency === 'number' ? event.frequency : 0,
      impact: typeof event.impact === 'number' ? event.impact : 0,
      intensity: typeof event.intensity === 'number' ? event.intensity : 0,
      priorEventsNote: event.priorEventsNote || '',
      reflectionsNote: event.reflectionsNote || '',
      status: event.status || 'discrete',
      createdAt: event.createdAt ?? Date.now(),
      symptomType: eType === 'SYMPTOM' ? (event.symptomType || '') : undefined,
      eventClass: event.eventClass || resolveEventClass(),
    });
    setEventModalPosition(null);
    setEventModalTitle(undefined);
    setEventModalOpen(true);
  };

  useEffect(() => {
    if (!openNewEventRequestId || openNewEventRequestId === lastNewEventRequestIdRef.current) return;
    lastNewEventRequestIdRef.current = openNewEventRequestId;
    setActiveTab('events');
    const eventType = (newEventSeed?.eventType as EventType) || resolveDefaultEventType();
    setEventDraft(buildEventDraft(eventType, newEventSeed || null));
    setEventModalPosition(openNewEventPosition || null);
    setEventModalTitle(newEventModalTitle || undefined);
    setEventModalOpen(true);
  }, [openNewEventRequestId, newEventSeed, openNewEventPosition, newEventModalTitle, resolveDefaultEventType, buildEventDraft]);

  const handleEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    if (!eventDraft) return;
    if (field === 'eventType') {
      const nextType = value as EventType;
      if (nextType === 'SYMPTOM') {
        const nextCategory = (eventDraft.category || 'physical').toLowerCase();
        setEventDraft({
          ...eventDraft,
          eventType: nextType,
          category: nextCategory,
          symptomType: eventDraft.symptomType || '',
        });
        return;
      }
      if (nextType === 'EPE') {
        setEventDraft({
          ...eventDraft,
          eventType: nextType,
          category: eventDraft.category || 'Emotional Pattern',
          symptomType: undefined,
        });
        return;
      }
      setEventDraft({
        ...eventDraft,
        eventType: nextType,
        symptomType: undefined,
      });
      return;
    }
    if (field === 'intensity' || field === 'howWell' || field === 'frequency' || field === 'impact') {
      const numeric = Number(value);
      setEventDraft({ ...eventDraft, [field]: Number.isNaN(numeric) ? 0 : numeric });
      return;
    }
    if (field === 'category' && inferEventType(eventDraft) === 'SYMPTOM') {
      const normalizedCat = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      setEventDraft({
        ...eventDraft,
        category: normalizedCat,
      });
      return;
    }
    if (field === 'symptomType' && inferEventType(eventDraft) === 'SYMPTOM') {
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
        normalizedType === 'SYMPTOM'
          ? (() => { const c = eventDraft.category || 'Physical'; return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(); })()
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
      status: eventDraft.status || 'discrete',
      createdAt: eventDraft.createdAt ?? Date.now(),
      sourceIndicatorId: eventDraft.sourceIndicatorId,
      symptomType: normalizedType === 'SYMPTOM' ? (eventDraft.symptomType || '') : undefined,
      eventClass: eventDraft.eventClass || resolveEventClass(),
    };
    const events = getEvents();
    const existingIndex = events.findIndex((evt) => evt.id === eventDraft.id);
    const nextEvents = existingIndex === -1
      ? [...events, cleanedDraft]
      : events.map((evt) => (evt.id === eventDraft.id ? cleanedDraft : evt));
    if (isPerson) {
      const person = selectedItem as Person;
      const updates: Partial<Person> = { events: nextEvents };
      if (normalizedType === 'SYMPTOM') {
        const normalizedGroup = (cleanedDraft.category || 'physical').toLowerCase();
        const normalizedTypeLabel = (cleanedDraft.symptomType || '').slice(0, 30);
        const definition =
          (normalizedTypeLabel
            ? functionalIndicatorDefinitions.find(
                (entry) => entry.label.trim().toLowerCase() === normalizedTypeLabel.toLowerCase()
              )
            : undefined) ||
          functionalIndicatorDefinitions.find((entry) => entry.group === normalizedGroup);
        const ensuredDefinitionId =
          definition?.id ||
          onEnsureSymptomCategoryDefinition?.(normalizedTypeLabel, normalizedGroup as any) ||
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

  const deleteEvent = (id: string) => {
    const events = getEvents().filter((ev) => ev.id !== id);
    if (isPerson) onUpdatePerson(selectedItem.id, { events });
    else if (isPartnership) onUpdatePartnership(selectedItem.id, { events });
    else onUpdateEmotionalLine(selectedItem.id, { events });
  };

  const deleteIndicatorOnly = (definitionId: string) => {
    if (!isPerson || !selectedPerson) return;
    const indicators = (selectedPerson.functionalIndicators || []).filter(
      (ind) => ind.definitionId !== definitionId
    );
    onUpdatePerson(selectedItem.id, { functionalIndicators: indicators });
  };

  const panelTitle = triangleId
    ? 'Triangle Properties'
    : isEmotionalLine
    ? 'Emotional Pattern Functional Facts'
    : isPartnership
    ? 'Partner Relationship Functional Facts'
    : 'Individual Functional Facts';
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
      {(['name', 'dates', 'format', 'sibling', 'foo'] as const).map((section) => (
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
            : section === 'format'
            ? 'Format'
            : section === 'sibling'
            ? 'Sibling'
            : 'FOO'}
        </button>
      ))}
    </div>
  );
  const renderActivePersonSection = () => {
    if (!selectedPerson || !personDraft) return null;

    if (activePersonSection === 'name') {
      return (
        <PersonNameSection
          personDraft={personDraft}
          nameFallbackParts={nameFallbackParts}
          onChange={handlePersonChange}
        />
      );
    }

    if (activePersonSection === 'dates') {
      return (
        <PersonDatesSection
          personDraft={personDraft}
          onChange={handlePersonChange}
        />
      );
    }

    if (activePersonSection === 'sibling') {
      return (
        <PersonSiblingSection
          personDraft={personDraft}
          people={people}
          partnerships={partnerships}
          siblingPositionResult={siblingPositionResult}
          siblingPositionOptions={siblingPositionOptions}
          onChange={handlePersonChange}
          onUpdateOtherPersonPosition={(personId, position) =>
            onUpdatePerson(personId, { siblingPositionOverride: position })
          }
          compactMode={compactPersonSectionMode}
          activeSiblingSubtab={activeSiblingSubtab}
          onSiblingSubtabChange={setActiveSiblingSubtab}
          siblingHelpOpen={siblingHelpOpen}
          onSiblingHelpOpenChange={setSiblingHelpOpen}
        />
      );
    }

    if (activePersonSection === 'foo') {
      return (
        <PersonFOOSection
          personDraft={personDraft}
          selectedPerson={selectedPerson}
          onChange={handlePersonChange}
          onUpdatePerson={onUpdatePerson}
          updatePersonDraftState={updatePersonDraftState}
          onSetPersonPristine={setPersonPristine}
          fooHelpOpen={fooHelpOpen}
          onFooHelpOpenChange={setFooHelpOpen}
        />
      );
    }

    return (
      <PersonFormatSection
        personDraft={personDraft}
        onChange={handlePersonChange}
        onAdjustSize={adjustPersonSize}
        colorInputRefs={colorInputRefs}
      />
    );
  };

  if (compactPersonSectionMode && isPerson && selectedPerson && personDraft) {
    const compactTitle =
      activePersonSection === 'name'
        ? 'Name'
        : activePersonSection === 'dates'
        ? 'Dates'
        : activePersonSection === 'format'
        ? 'Format'
        : activePersonSection === 'sibling'
        ? 'Sibling'
        : 'FOO';

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

  if (compactPartnershipSectionMode && isPartnership && selectedPartnership && partnershipDraft) {
    const partner1Name =
      people.find((person) => person.id === selectedPartnership.partner1_id)?.name || 'Partner 1';
    const partner2Name =
      people.find((person) => person.id === selectedPartnership.partner2_id)?.name || 'Partner 2';
    return (
      <div
        role="dialog"
        aria-label="Relationship properties"
        style={{
          background: '#f8f9fc',
          padding: '12px 14px 14px',
          border: '1px solid #cfd7e5',
          borderRadius: 10,
          boxSizing: 'border-box',
          minWidth: 380,
          maxWidth: 500,
          boxShadow: '0 16px 42px rgba(16, 24, 40, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f3248' }}>Relationship</div>
            <div style={{ fontSize: 12, color: '#58677c' }}>
              {partner1Name} + {partner2Name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close relationship section popup"
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
        <div style={{ marginTop: 10 }}>
          <PartnershipPropertiesSection
            partnershipDraft={partnershipDraft}
            computedFamilyName={computedFamilyName}
            typeOptions={partnershipTypeOptions}
            statusOptions={partnershipStatusOptions}
            statusDateRows={partnershipStatusDateRows}
            onChange={handlePartnershipChange}
            formatOptionLabel={formatOptionLabel}
            normalizeStatusKey={normalizeStatusKey}
            readStatusDate={readPartnershipStatusDate}
            showNotes={false}
            fieldIdPrefix="popup-"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={cancelPartnershipChanges} disabled={!partnershipDirty}>Cancel</button>
          <button type="button" onClick={savePartnershipProperties} disabled={!partnershipDirty}>Save</button>
        </div>
      </div>
    );
  }

  if (isFamilyView && isPartnership && selectedPartnership) {
    const familyPartnership =
      partnerships.find((p) => p.id === selectedPartnership.id) || selectedPartnership;
    const partner1 = people.find((p) => p.id === familyPartnership.partner1_id);
    const partner2 = people.find((p) => p.id === familyPartnership.partner2_id);
    const partnerNames = [partner1?.name, partner2?.name].filter(Boolean).join(' & ');
    const familyName =
      familyPartnership.familyName ||
      [partner1?.name, partner2?.name].filter(Boolean).join(' / ') ||
      'Family';
    const allFamilyEvents = familyPartnership.familyEvents || [];
    const triangleEvents = allFamilyEvents.filter(
      (e) => (e.category || '').toLowerCase().startsWith('triangle')
    );
    const stressorEvents = allFamilyEvents.filter(
      (e) => (e.category || '').toLowerCase() === 'stress'
    );
    const familyTabs = [
      { id: 'family' as const, label: 'Family' },
      { id: 'triangles' as const, label: 'Triangles' },
      { id: 'stressors' as const, label: 'Stressors' },
      { id: 'events' as const, label: 'Events' },
    ];

    const renderFamilyEventCard = (ev: EmotionalProcessEvent) => (
      <EventCard
        key={ev.id}
        date={ev.startDate || ev.date || ''}
        type={EVENT_TYPE_LABELS[ev.eventType as keyof typeof EVENT_TYPE_LABELS] || ev.eventType || '—'}
        category={ev.category || '—'}
        subtype={ev.subtype || undefined}
        status={ev.status || 'discrete'}
        intensity={typeof ev.intensity === 'number' ? ev.intensity : null}
        onEdit={() => {
          const el = document.querySelector(`[data-ev-id="${ev.id}"]`) as HTMLElement | null;
          const rect = el?.getBoundingClientRect() ?? { left: 0, bottom: 0 };
          onOpenFamilyEventEdit?.(familyPartnership.id, ev.id, { x: rect.left, y: (rect as DOMRect).bottom + 4 });
        }}
        onDelete={() => onDeleteFamilyEvent?.(familyPartnership.id, ev.id)}
      />
    );

    return (
      <div
        style={{
          background: '#f0f0f0',
          padding: '10px 12px 12px 12px',
          border: '1px solid #ccc',
          height: '100vh',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>X</button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Family Function Facts</div>
            <div style={{ fontSize: 11, color: '#555' }}>Family</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div
            role="tablist"
            aria-label="Family properties tabs"
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              border: '1px solid #b8c2d3',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            {familyTabs.map((tab, index) => {
              const isActive = tab.id === activeFamilyTab;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveFamilyTab(tab.id)}
                  style={{
                    padding: '8px 10px',
                    border: 'none',
                    borderLeft: index === 0 ? 'none' : '1px solid #d0d6e2',
                    background: isActive ? '#dfe7f7' : '#fff',
                    color: isActive ? '#1f3f78' : '#23324a',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeFamilyTab === 'family' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#23324a', marginBottom: 6 }}>{familyName}</div>
            <div style={{ fontSize: 12, color: '#6b7a93' }}>
              {partnerNames ? `Partners: ${partnerNames}` : 'No partners recorded'}
            </div>
          </div>
        )}

        {activeFamilyTab === 'triangles' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onOpenFamilyProperty?.('Triangles', 'Functioning', { x: rect.left, y: rect.bottom + 4 });
                }}
                style={familyAddBtnStyle}
              >
                + Add Triangle
              </button>
            </div>
            {triangleEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9aaac4', fontStyle: 'italic' }}>No triangle events recorded</div>
            ) : (
              triangleEvents.map(renderFamilyEventCard)
            )}
          </div>
        )}

        {activeFamilyTab === 'stressors' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onOpenFamilyProperty?.('Stress', 'Emotional Reactivity', { x: rect.left, y: rect.bottom + 4 });
                }}
                style={{ ...familyAddBtnStyle, color: '#7a5a9e', border: '1px solid #c8b8df', background: '#f6f0fb' }}
              >
                + Add Stressor
              </button>
            </div>
            {stressorEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9aaac4', fontStyle: 'italic' }}>No stressor events recorded</div>
            ) : (
              stressorEvents.map(renderFamilyEventCard)
            )}
          </div>
        )}

        {activeFamilyTab === 'events' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onAddFamilyEvent?.({ x: rect.left, y: rect.bottom + 4 });
                }}
                style={familyAddBtnStyle}
              >
                + Add Family Event
              </button>
            </div>
            {allFamilyEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9aaac4', fontStyle: 'italic' }}>No events recorded</div>
            ) : (
              allFamilyEvents.map(renderFamilyEventCard)
            )}
          </div>
        )}
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
        {(() => {
          const topTabs: Array<'properties' | 'functional' | 'events' | 'patterns'> = isPerson
            ? ['properties', 'patterns', 'functional', 'events']
            : ['properties', 'functional', 'events'];
          return (
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
          {topTabs.map((tab, index) => {
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
                : tab === 'patterns'
                ? 'Patterns'
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
          );
        })()}
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
          <PartnershipPropertiesSection
            partnershipDraft={partnershipDraft}
            computedFamilyName={computedFamilyName}
            typeOptions={partnershipTypeOptions}
            statusOptions={partnershipStatusOptions}
            statusDateRows={partnershipStatusDateRows}
            onChange={handlePartnershipChange}
            formatOptionLabel={formatOptionLabel}
            normalizeStatusKey={normalizeStatusKey}
            readStatusDate={readPartnershipStatusDate}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={cancelPartnershipChanges} disabled={!partnershipDirty}>Cancel</button>
            <button type="button" onClick={savePartnershipProperties} disabled={!partnershipDirty}>Save</button>
          </div>
        </div>
        )}
        {isEmotionalLine && selectedEmotionalLine && emotionalDraft && (
        <div>
          <EPLPropertiesSection
            emotionalDraft={emotionalDraft}
            emotionalIntensityDraft={emotionalIntensityDraft}
            emotionalImpactDraft={emotionalImpactDraft}
            emotionalFrequencyDraft={emotionalFrequencyDraft}
            onSelectChange={handleEmotionalLineChange}
            onInputChange={handleEmotionalLineInputChange}
            onIntensityLevelChange={applyEmotionalIntensityLevel}
            onImpactChange={(val) => { setEmotionalImpactDraft(val); setEmotionalPristine(false); }}
            onFrequencyChange={(val) => { setEmotionalFrequencyDraft(val); setEmotionalPristine(false); }}
            onColorPresetSelect={(hex) => { updateEmotionalDraftState({ color: hex }); setEmotionalPristine(false); }}
            triangleId={triangleId}
            triangleColorDraft={triangleColorDraft}
            triangleIntensityDraft={triangleIntensityDraft}
            onTriangleColorChange={(c) => { setTriangleColorDraft(c); setEmotionalPristine(false); }}
            onTriangleIntensityChange={(i) => { setTriangleIntensityDraft(i); setEmotionalPristine(false); }}
          />
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
        )}
        </>
      )}
      {activeTab === 'functional' && (
        isPerson && selectedPerson ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Symptoms</strong>
              <button type="button" onClick={() => openNewEvent({ eventType: 'SYMPTOM' })} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: '1px solid #4b68a6', background: '#f0f4ff', color: '#23324a', cursor: 'pointer' }}>+ Add Symptom</button>
            </div>
            {symptomRows.length === 0 ? (
              <div style={{ color: '#7a8aaa', fontSize: 13, padding: '8px 0' }}>No symptoms recorded yet.</div>
            ) : (
              symptomRows.map((symptom) => {
                const categoryBorderColors: Record<string, string> = { physical: '#1f77b4', emotional: '#d81b60', social: '#2e7d32' };
                const sourceEvent = symptom.sourceEventId
                  ? (selectedPerson.events || []).find((e) => e.id === symptom.sourceEventId)
                  : undefined;
                return (
                  <EventCard
                    key={symptom.key}
                    date={sourceEvent?.startDate || sourceEvent?.date || ''}
                    type="Symptom"
                    category={toTitleCase(symptom.category)}
                    subtype={symptom.type}
                    status={symptom.status}
                    intensity={symptom.intensity ?? null}
                    leftBorderColor={categoryBorderColors[symptom.category] || '#4b68a6'}
                    onEdit={() => {
                      if (sourceEvent) { openEditEvent(sourceEvent); return; }
                      openNewEvent({ eventType: 'SYMPTOM', category: symptom.category, symptomType: symptom.type });
                    }}
                    onDelete={
                      symptom.sourceEventId
                        ? () => deleteEvent(symptom.sourceEventId!)
                        : symptom.definitionId
                          ? () => deleteIndicatorOnly(symptom.definitionId!)
                          : undefined
                    }
                  />
                );
              })
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>Symptoms apply only to Person nodes.</div>
        )
      )}
      {activeTab === 'patterns' && isPerson && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Patterns</strong>
          </div>
          {(() => {
            const person = selectedItem as Person;
            const connected = allEmotionalLines.filter(
              (el) => el.person1_id === person.id || el.person2_id === person.id
            );
            const typeLabels: Record<string, string> = {
              fusion: '+ / - Adequate',
              distance: 'Distance',
              cutoff: 'Cutoff',
              conflict: 'Conflict',
              projection: 'Projection',
            };
            if (connected.length === 0) {
              return (
                <div style={{ color: '#7a8aaa', fontSize: 13, padding: '8px 0' }}>
                  No emotional patterns connected to this person.
                </div>
              );
            }
            return connected.map((el) => {
              const otherId = el.person1_id === person.id ? el.person2_id : el.person1_id;
              const other = people.find((p) => p.id === otherId);
              const otherName = other?.name || 'Unknown';
              const typeLabel = typeLabels[el.relationshipType] || el.relationshipType;
              const status = el.status === 'ended' ? 'ended' : 'ongoing';
              return (
                <EventCard
                  key={el.id}
                  date={el.startDate || ''}
                  type="Emotional Pattern"
                  category={typeLabel}
                  subtype={`with ${otherName}`}
                  status={status}
                  intensity={null}
                  leftBorderColor={el.color || '#444444'}
                  onEdit={() => {
                    setEditingPatternLineId(el.id);
                    setEditingPatternDraft({
                      person1Id: el.person1_id,
                      person2Id: el.person2_id,
                      relationshipType: el.relationshipType,
                      status: el.status || 'ongoing',
                      lineStyle: el.lineStyle,
                      startDate: el.startDate || '',
                      endDate: el.endDate || '',
                      intensityLevel: intensityValueForLineStyle(el.lineStyle),
                      frequency: 0,
                      impact: 0,
                      notes: el.notes || '',
                      color: el.color || '#444444',
                    });
                  }}
                  onDelete={onRemoveEmotionalLine ? () => onRemoveEmotionalLine(el.id) : undefined}
                />
              );
            });
          })()}
        </div>
      )}
      {activeTab === 'events' && (
        <EventsSection
          allEvents={getEvents()}
          currentAnchorType={resolveAnchorType()}
          currentAnchorId={selectedItem.id}
          addEventButtonLabel="+ Add Event"
          onAddEvent={() => openNewEvent()}
          onEditEvent={openEditEvent}
          onDeleteEvent={deleteEvent}
          onLinkEvent={() => {}}
          onCreateAndAttach={() => {}}
        />
      )}
      {eventModalOpen && eventDraft && (
        <EventModal
          eventDraft={eventDraft}
          position={eventModalPosition}
          popupLeft={popupLeft ?? 0}
          popupTop={popupTop ?? 0}
          popupMaxHeight={popupMaxHeight ?? null}
          primaryPersonOptions={primaryPersonOptions}
          otherPersonOptions={otherPersonOptions}
          eventCategories={eventCategories}
          symptomTypeOptions={symptomTypeOptions}
          resolvedEventClass={resolveEventClass()}
          modalTitle={eventModalTitle}
          onChange={handleEventDraftChange}
          onSetDraft={setEventDraft}
          onSave={saveEvent}
          onCancel={() => { setEventModalOpen(false); setEventDraft(null); }}
        />
      )}
      <EmotionalPatternModal
        open={!!editingPatternDraft}
        draft={editingPatternDraft}
        onUpdate={(updates) => setEditingPatternDraft((prev) => prev ? { ...prev, ...updates } : prev)}
        onCancel={() => { setEditingPatternDraft(null); setEditingPatternLineId(null); }}
        onSave={() => {
          if (editingPatternDraft && editingPatternLineId) {
            const validStyles = LINE_STYLE_VALUES[editingPatternDraft.relationshipType] || [];
            const lineStyle = validStyles.includes(editingPatternDraft.lineStyle)
              ? editingPatternDraft.lineStyle
              : (validStyles[0] as EmotionalLine['lineStyle']);
            onUpdateEmotionalLine(editingPatternLineId, {
              relationshipType: editingPatternDraft.relationshipType,
              status: editingPatternDraft.status,
              lineStyle,
              startDate: editingPatternDraft.startDate || undefined,
              endDate: editingPatternDraft.endDate || undefined,
              notes: editingPatternDraft.notes || undefined,
              color: editingPatternDraft.color,
            });
          }
          setEditingPatternDraft(null);
          setEditingPatternLineId(null);
        }}
      />
    </div>
  );
};


export default PropertiesPanel;
