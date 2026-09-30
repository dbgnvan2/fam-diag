import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  SIRCategoryDefinition,
  FunctionalFactCategoryDefinition,
  NodalCategoryDefinition,
  EventClass,
  EventType,
  EventAnchorType,
  SymptomGroup,
} from '../types';
import {
  clampIndicatorDimension,
} from '../constants/functionalIndicatorScales';
import { EVENT_TYPE_LABELS, EVENT_SUBTYPES, PAPERO_SUBTYPE_TO_KEY, inferEventType as inferEventTypeFromConstants } from '../constants/eventConstants';
import {
  deriveSiblingPositionResult,
  getSiblingPositionOptions,
} from '../utils/siblingPosition';
import { computeDefaultFamilyName } from '../utils/partnershipUtils';
import type { FamilyScope } from '../utils/familyScope';
import { collectSystemEvents, type SystemEvent } from '../utils/systemEvents';
import { hasSameEvent } from '../utils/eventDedup';
import { RELATIONSHIP_TYPE_STATUS_ROWS } from '../constants/relationshipStatusLabels';
import { withoutPersonDateRecords } from '../utils/personDateEvents';
import { withoutPartnershipStatusRecords } from '../utils/partnershipStatusEvents';
import { withoutPatternEditRecords } from '../utils/patternEventRecords';
import {
  synthesizePersonDateEvents,
  synthesizePersonIndicatorEvents,
  synthesizePartnershipDateEvents,
  synthesizeEmotionalLineDateEvents,
  withoutDateSlotCompanions,
} from '../utils/syntheticDateEvents';
import {
  EPE_CATEGORY_BY_PATTERN_TYPE,
  anchorTypeForOwner,
  applyEventDraftFieldChange,
  buildNewEventDraft,
  createEventId,
  deleteEventFromOwner,
  eventClassForOwner,
  isDateSlotEventId,
  normalizeEventForSave,
  saveEventOnOwner,
  type EventOwner,
  type EventOwnerEntity,
} from '../utils/eventDraft';
import {
  LEGACY_STATUS_DATE_FIELD_BY_KEY,
  canonicalRelationshipStatusKey,
  readPartnershipStatusDate,
  withPartnershipStatusDate,
} from '../utils/relationshipStatusKeys';
import PersonNameSection from './sections/PersonNameSection';
import PersonDatesSection from './sections/PersonDatesSection';
import PersonFormatSection from './sections/PersonFormatSection';
import PersonFOOSection from './sections/PersonFOOSection';
import PersonPaperoSection from './sections/PersonPaperoSection';
import PersonSIRSection from './sections/PersonSIRSection';
import PersonSiblingSection from './sections/PersonSiblingSection';
import PartnershipPropertiesSection from './sections/PartnershipPropertiesSection';
import EPLPropertiesSection from './sections/EPLPropertiesSection';
import EventModal from './EventModal';
import EventsSection from './EventsSection';
import EventCard from './EventCard';
import EmotionalPatternModal from './modals/EmotionalPatternModal';
import type { EmotionalPatternDraft } from '../types/diagramEditor';
import {
  LINE_STYLE_VALUES,
  lineStyleForLevel,
  lineStyleLevel,
} from '../utils/emotionalPatternOptions';


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
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const humanizeOptionLabel = (value: string) =>
  value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const relationshipStatusRowsForType = (relationshipType: string) =>
  RELATIONSHIP_TYPE_STATUS_ROWS[relationshipType.trim().toLowerCase()] || [];
const relationshipDateLabelFor = (relationshipType: string, status: string) => {
  const canonicalStatus = canonicalRelationshipStatusKey(status);
  const mapped = relationshipStatusRowsForType(relationshipType).find(
    (entry) => canonicalRelationshipStatusKey(entry.status) === canonicalStatus
  );
  return mapped?.dateLabel || humanizeOptionLabel(status);
};
const AddPatternRow = ({ people, onAdd }: { people: Person[]; onAdd: (otherId: string) => void }) => {
  const [otherId, setOtherId] = React.useState(people[0]?.id ?? '');
  React.useEffect(() => { setOtherId(people[0]?.id ?? ''); }, [people]);
  if (people.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      <select
        value={otherId}
        onChange={(e) => setOtherId(e.target.value)}
        style={{ flex: 1, fontSize: 13, padding: '4px 6px', borderRadius: 4, border: '1px solid #c0ccd9' }}
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name || '(unnamed)'}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => { if (otherId) onAdd(otherId); }}
        disabled={!otherId}
        style={{ padding: '4px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: otherId ? 'pointer' : 'not-allowed', fontSize: 13, whiteSpace: 'nowrap' }}
      >
        + Add Pattern
      </button>
    </div>
  );
};

const TAB_HELP_COPY: Record<'properties' | 'functional' | 'events' | 'patterns' | 'papero' | 'sir', { title: string; body: string }> = {
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
      'The Patterns tab lists all emotional patterns (+/- adequate, distance, conflict, cutoff, projection) connected to this person. Click a pattern to open its full properties.',
  },
  papero: {
    title: 'Papero Assessment Help',
    body:
      'The Papero Assessment tab captures the Family Unit Response to Challenge Framework (adapted from Dr Dan Papero). Rate each topic on a 1-5 continuum from low functioning to high functioning. Click the "?" button for detailed level descriptions.',
  },
  sir: {
    title: 'Self in Relationship Help',
    body:
      'The Self in Relationship tab tracks how well you managed yourself in interactions with others. Each entry records a category, the other person, and scores for Intensity, Stress, and HWDID (How Well Did I Do). Configure categories via Settings → Self in Relationship Categories.',
  },
};
const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());
// An identity event takes the date of the field it belongs to. With no date
// there, it has none — "today" is not when anyone's sex or gender was
// recorded (author decision 2026-09-30: a default of today is fabrication).
const normalizePersonEventDate = (value?: string) =>
  value && DATE_PATTERN.test(value) ? value : '';
const getBirthSexLabel = (value?: Person['birthSex']) =>
  value === 'male'
    ? 'Male'
    : value === 'female'
      ? 'Female'
      : value === 'intersex'
        ? 'Intersex'
        : value === 'ai-agent'
          ? 'AI Agent'
          : 'Unknown';
const getGenderIdentityLabel = (value?: Person['genderIdentity']) => {
  if (value === 'feminine') return 'Feminine';
  if (value === 'masculine') return 'Masculine';
  if (value === 'nonbinary') return 'Non-Binary';
  if (value === 'agender') return 'Agender';
  return 'Unknown';
};
/** Subtype prefix of the identity event each identity field writes. */
const IDENTITY_EVENT_PREFIX: Record<'birthSex' | 'genderIdentity', string> = {
  birthSex: 'Birth Sex:',
  genderIdentity: 'Gender:',
};
const defaultGenderIdentityForBirthSex = (birthSex?: Person['birthSex']): Person['genderIdentity'] =>
  birthSex === 'male' ? 'masculine' : birthSex === 'intersex' || birthSex === 'ai-agent' ? 'nonbinary' : 'feminine';
// cloneEventForPerson was removed with its only caller. Partnership status
// events are no longer written, so there is nothing to copy onto each
// partner; utils/eventDedup.ts still recognises the -p1 / -p2 clones that
// existing diagrams contain.

const normalizeStatusKey = (value: string) => canonicalRelationshipStatusKey(value);
const PERSON_DEFERRED_DATE_FIELDS: (keyof Pick<Person, 'birthDate' | 'deathDate' | 'genderDate'>)[] = [
  'birthDate',
  'deathDate',
  'genderDate',
];
const PERSON_DEFERRED_IDENTITY_FIELDS: (keyof Pick<Person, 'birthSex' | 'genderIdentity'>)[] = [
  'birthSex',
  'genderIdentity',
];
const PARTNERSHIP_STRING_FIELDS: (keyof Pick<Partnership, 'relationshipType' | 'relationshipStatus' | 'relationshipStartDate' | 'marriedStartDate' | 'separationDate' | 'divorceDate' | 'familyName' | 'notes' | 'color' | 'backgroundColor'>)[] = [
  'relationshipType',
  'relationshipStatus',
  'relationshipStartDate',
  'marriedStartDate',
  'separationDate',
  'divorceDate',
  'familyName',
  'notes',
  'color',
  'backgroundColor',
];
const EMOTIONAL_STRING_FIELDS: (keyof Pick<EmotionalLine, 'startDate' | 'endDate' | 'relationshipType' | 'lineStyle' | 'lineEnding' | 'color' | 'notes' | 'status' | 'adequatePersonId'>)[] = [
  'startDate',
  'endDate',
  'relationshipType',
  'lineStyle',
  'lineEnding',
  'color',
  'notes',
  'status',
  'adequatePersonId',
];
interface PropertiesPanelProps {
  selectedItem: Person | Partnership | EmotionalLine;
  people: Person[];
  partnerships?: Partnership[];
  eventCategories: string[];
  relationshipTypes?: string[];
  relationshipStatuses?: string[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  sirCategories: SIRCategoryDefinition[];
  functionalFactCategories?: FunctionalFactCategoryDefinition[];
  nodalCategories?: NodalCategoryDefinition[];
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  onUpdatePartnership: (partnershipId: string, updatedProps: Partial<Partnership>) => void;
  onUpdateEmotionalLine: (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => void;
  triangleId?: string;
  triangleColor?: string;
  triangleIntensity?: 'low' | 'medium' | 'high';
  triangleNotes?: string;
  onUpdateTriangleColor?: (triangleId: string, color: string) => void;
  onUpdateTriangleIntensity?: (
    triangleId: string,
    intensity: 'low' | 'medium' | 'high'
  ) => void;
  onUpdateTriangleNotes?: (triangleId: string, notes: string) => void;
  allEmotionalLines?: EmotionalLine[];
  /**
   * Active canvas family scope — supplies the relation ring for the system
   * events listed read-only under a person's own events (D10/D14).
   * Spec: docs/implementation_plan_2026-09-19.md#M7.F.1
   */
  familyScope?: FamilyScope | null;
  onSelectEmotionalLine?: (line: EmotionalLine) => void;
  onRemoveEmotionalLine?: (id: string) => void;
  onAddEmotionalPattern?: (person1Id: string, person2Id: string) => void;
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
  /** Open a system event on the entity that owns it (M7.F.2). */
  onSelectSystemEventOwner?: (owner: {
    type: 'person' | 'partnership' | 'emotional';
    id: string;
  }) => void;
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
  sirCategories,
  functionalFactCategories = [],
  nodalCategories = [],
  onUpdatePerson,
  onUpdatePartnership,
  onUpdateEmotionalLine,
  triangleId,
  triangleColor,
  triangleIntensity,
  triangleNotes,
  onUpdateTriangleColor,
  onUpdateTriangleIntensity,
  onUpdateTriangleNotes,
  initialActiveTab,
  initialPersonSection,
  initialPartnershipType,
  focusEventId,
  openNewEventRequestId,
  newEventSeed,
  openNewEventPosition,
  newEventModalTitle,
  allEmotionalLines = [],
  familyScope = null,
  onSelectEmotionalLine: _onSelectEmotionalLine,
  onRemoveEmotionalLine,
  onAddEmotionalPattern,
  onEnsureSymptomCategoryDefinition,
  compactPersonSectionMode = false,
  compactPartnershipSectionMode = false,
  isFamilyView = false,
  onOpenFamilyProperty,
  onAddFamilyEvent,
  onOpenFamilyEventEdit,
  onDeleteFamilyEvent,
  onSelectSystemEventOwner,
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
  const [activeTab, setActiveTab] = useState<'properties' | 'functional' | 'events' | 'patterns' | 'papero' | 'sir'>('properties');
  const [activeFamilyTab, setActiveFamilyTab] = useState<'family' | 'triangles' | 'stressors' | 'events'>('family');
  const [familyNotesDraft, setFamilyNotesDraft] = useState('');
  const [activePersonSection, setActivePersonSection] = useState<
    'name' | 'dates' | 'format' | 'sibling' | 'foo'
  >('name');
  const [activeSiblingSubtab, setActiveSiblingSubtab] = useState<
    'override' | 'position' | 'compatibility'
  >('override');
  const [tabHelpOpen, setTabHelpOpen] = useState<'properties' | 'functional' | 'events' | 'patterns' | 'papero' | 'sir' | null>(null);
  const [siblingHelpOpen, setSiblingHelpOpen] = useState(false);
  const [fooHelpOpen, setFooHelpOpen] = useState<'familyStability' | 'familyIntactness' | null>(null);
  const [_symptomIntensityHelpOpen, setSymptomIntensityHelpOpen] = useState<string | null>(null);
  const [editingPatternDraft, setEditingPatternDraft] = useState<EmotionalPatternDraft | null>(null);
  const [editingPatternLineId, setEditingPatternLineId] = useState<string | null>(null);
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
      : activeTab === 'papero'
      ? 'Papero'
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
    selectedEmotionalLine
      ? lineStyleLevel(selectedEmotionalLine.relationshipType, selectedEmotionalLine.lineStyle)
      : 0
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
  const [triangleNotesDraft, setTriangleNotesDraft] = useState(triangleNotes || '');
  const selectedPersonIdRef = useRef<string | null>(selectedPerson?.id ?? null);
  // The person's unsaved date / identity edits. Every other person field
  // saves as it is typed, and the draft is rebuilt from the live person plus
  // these edits whenever the person changes — so an auto-saved edit (a name,
  // a colour, a FOO or Papero score) or an event added elsewhere no longer
  // throws the pending edits away, and nothing is written from a stale copy.
  const pendingPersonEditsRef = useRef<Partial<Person>>({});
  const selectedPartnershipIdRef = useRef<string | null>(selectedPartnership?.id ?? null);
  const selectedEmotionalLineIdRef = useRef<string | null>(selectedEmotionalLine?.id ?? null);
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
    if (selectedPersonIdRef.current !== nextId) {
      selectedPersonIdRef.current = nextId;
      pendingPersonEditsRef.current = {};
    }
    setPersonDraft(selectedPerson ? { ...selectedPerson, ...pendingPersonEditsRef.current } : null);
  }, [selectedPerson]);

  // A different partnership starts clean. The same partnership changing
  // (an event saved on it) keeps unsaved edits — see the pristine effect.
  useEffect(() => {
    const nextId = selectedPartnership?.id ?? null;
    if (selectedPartnershipIdRef.current === nextId) return;
    selectedPartnershipIdRef.current = nextId;
    setPartnershipPristine(true);
    setPartnershipDraft(selectedPartnership ? { ...selectedPartnership } : null);
  }, [selectedPartnership]);

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

  // The EPL tab's intensity control is the line's GRAPHIC level (its style).
  // It is not a measurement's `event.intensity` — CLAUDE.md "two unrelated
  // intensity concepts". Frequency and impact are the measured metrics.
  const resetEmotionalDrafts = (line: EmotionalLine | null) => {
    setEmotionalDraft(line ? { ...line } : null);
    const metrics = deriveEmotionalMetricDraft(line);
    setEmotionalIntensityDraft(line ? lineStyleLevel(line.relationshipType, line.lineStyle) : 0);
    setEmotionalFrequencyDraft(metrics.frequency);
    setEmotionalImpactDraft(metrics.impact);
  };

  useEffect(() => {
    const nextId = selectedEmotionalLine?.id ?? null;
    if (selectedEmotionalLineIdRef.current === nextId) return;
    selectedEmotionalLineIdRef.current = nextId;
    setEmotionalPristine(true);
    resetEmotionalDrafts(selectedEmotionalLine);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmotionalLine]);

  useEffect(() => {
    if (!emotionalPristine) return;
    resetEmotionalDrafts(selectedEmotionalLine);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmotionalLine, emotionalPristine]);

  useEffect(() => {
    setTriangleColorDraft(triangleColor || '#8a5a00');
  }, [triangleId, triangleColor]);
  useEffect(() => {
    setTriangleIntensityDraft(triangleIntensity || 'medium');
  }, [triangleId, triangleIntensity]);
  useEffect(() => {
    setTriangleNotesDraft(triangleNotes || '');
  }, [triangleId, triangleNotes]);

  useEffect(() => {
    if (isFamilyView && selectedPartnership) {
      const p = partnerships.find((x) => x.id === selectedPartnership.id) || selectedPartnership;
      setFamilyNotesDraft(p.familyNotes || '');
    }
  }, [isFamilyView, selectedPartnership?.id]);

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
    let nextValue: string | number | boolean | undefined = value;
    if (isCheckbox) {
      nextValue = (e.target as HTMLInputElement).checked;
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
    let updates = { [name]: nextValue } as Partial<Person>;
    if (name === 'birthSex') {
      // '' is "Unknown / not recorded".
      const birthSex = (nextValue || undefined) as Person['birthSex'];
      updates = {
        ...updates,
        birthSex,
        gender: birthSex,
      };
      if (birthSex && !personDraft.genderIdentity) {
        updates.genderIdentity = defaultGenderIdentityForBirthSex(birthSex);
      }
    } else if (name === 'genderIdentity') {
      updates = {
        ...updates,
        genderIdentity: (nextValue || undefined) as Person['genderIdentity'],
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
      name === 'birthDate' || name === 'deathDate' || name === 'genderDate' || name === 'adoptionDate' || name === 'deathDateKnown';
    const isDeferredIdentityField = name === 'birthSex' || name === 'genderIdentity';
    if (!selectedPerson) return;
    if (isDeferredDateField || isDeferredIdentityField) {
      pendingPersonEditsRef.current = { ...pendingPersonEditsRef.current, ...updates };
      return;
    }
    // All non-date person properties auto-save and update live. Pending
    // date / identity edits are untouched.
    onUpdatePerson(selectedPerson.id, updates);
  };

  const setPersonSize = (value: number) => {
    if (!personDraft || !selectedPerson) return;
    onUpdatePerson(selectedPerson.id, { size: value });
    updatePersonDraftState({ size: value });
  };

  const adjustPersonSize = (delta: number) => {
    if (!personDraft || !selectedPerson) return;
    const next = Math.max(10, Math.min(400, (personDraft.size ?? 60) + delta));
    setPersonSize(next);
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

  const updateEmotionalDraftState = (updates: Partial<EmotionalLine>) => {
    setEmotionalDraft((prev) => (prev ? { ...prev, ...updates } : prev));
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
      const availableStyles = LINE_STYLE_VALUES[newRelationshipType] || ['low'];
      const currentStyle = emotionalDraft.lineStyle;
      const nextStyle = availableStyles.includes(currentStyle)
        ? currentStyle
        : availableStyles[0];
      updateEmotionalDraftState({
        relationshipType: newRelationshipType,
        lineStyle: nextStyle,
      });
      setEmotionalIntensityDraft(lineStyleLevel(newRelationshipType, nextStyle));
    } else if (name === 'lineStyle') {
      const nextLineStyle = value as EmotionalLine['lineStyle'];
      updateEmotionalDraftState({ [name]: nextLineStyle });
      setEmotionalIntensityDraft(lineStyleLevel(emotionalDraft.relationshipType, nextLineStyle));
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
      anchorType: 'PERSON' as const,
      anchorId: person.id,
      status: 'discrete' as const,
      subtype,
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: 0,
      otherPersonName: '',
      primaryPersonName: displayName,
      wwwwh: '',
      observations: '',
      eventClass: 'individual' as const,
      createdAt: Date.now(),
    };
  };

  const buildPaperoScoreEvent = (
    person: Person,
    subtypeKey: string,
    newValue: number,
    oldValue: number
  ): EmotionalProcessEvent => {
    // No date: the score records an assessment, and when that assessment
    // applies is the user's to say. createdAt keeps when it was entered.
    const displayName = composeDisplayName({}, person) || person.name || '';
    const paperoSubtypes = EVENT_SUBTYPES.PAPERO ?? {};
    const category =
      Object.entries(paperoSubtypes).find(([, topics]) => topics.includes(subtypeKey))?.[0] ??
      'Resourceful';
    const scoreFieldKey = PAPERO_SUBTYPE_TO_KEY[subtypeKey] ?? subtypeKey;
    return {
      id: createEventId(),
      date: '',
      startDate: '',
      category,
      eventType: 'PAPERO' as const,
      anchorType: 'PERSON' as const,
      anchorId: person.id,
      status: 'discrete' as const,
      subtype: subtypeKey,
      intensity: newValue,
      frequency: oldValue,
      impact: 0,
      howWell: 0,
      otherPersonName: '',
      primaryPersonName: displayName,
      wwwwh: '',
      observations: `${scoreFieldKey}: ${oldValue > 0 ? oldValue : 'unset'} → ${newValue}`,
      eventClass: 'individual' as const,
      createdAt: Date.now(),
    };
  };

  type EmotionalDateField = 'startDate' | 'endDate';

  const buildEmotionalPatternMeasurementEvent = (
    line: EmotionalLine,
    intensity: number,
    frequency: number,
    impact: number
  ): EmotionalProcessEvent | null => {
    const person1 = people.find((person) => person.id === line.person1_id);
    const person2 = people.find((person) => person.id === line.person2_id);
    if (!person1 || !person2) return null;
    const typeLabel = toTitleCase(line.relationshipType);
    return {
      id: createEventId(),
      // Undated: when the measurement applies is the user's to say.
      date: '',
      startDate: '',
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
      howWell: 0,
      otherPersonName: person2.name || '',
      primaryPersonName: person1.name || '',
      wwwwh: '',
      observations: '',
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
    const hasDeathKnownChange = (personDraft.deathDateKnown ?? false) !== (selectedPerson.deathDateKnown ?? false);
    return hasDeferredDateChanges || hasAdoptionDateChanges || hasIdentityChanges || hasDeathKnownChange;
  }, [selectedPerson, personDraft]);

  const savePersonProperties = () => {
    if (!selectedPerson || !personDraft || !personDirty) return;
    const updates: Partial<Person> = {};
    let nextEvents: EmotionalProcessEvent[] = selectedPerson.events || [];
    let eventsChanged = false;
    const prevDeathKnown = selectedPerson.deathDateKnown ?? false;
    const nextDeathKnown = personDraft.deathDateKnown ?? false;
    if (prevDeathKnown !== nextDeathKnown) {
      updates.deathDateKnown = nextDeathKnown || undefined;
    }
    PERSON_DEFERRED_DATE_FIELDS.forEach((field) => {
      const prev = selectedPerson[field] ?? '';
      const next = personDraft[field] ?? '';
      if (prev !== next) {
        updates[field] = next || undefined;
        // No event is written for the date itself. This used to APPEND one on
        // every change and never update the previous one, so correcting a
        // birth date left the old year on the timeline as its own life event.
        // The field is the record; syntheticDateEvents surfaces exactly one
        // Birth / Death / Adoption / Gender block from it.
      }
      // "Deceased, date unknown" used to write a Death Date event dated
      // TODAY — a date the death did not happen on. A death with no date
      // cannot be placed on a timeline honestly; the node's death marker
      // carries it instead.
    });
    if ((selectedPerson.adoptionDate ?? '') !== (personDraft.adoptionDate ?? '')) {
      updates.adoptionDate = personDraft.adoptionDate || undefined;
      // As above: the date field is the record, not an appended event.
    }
    PERSON_DEFERRED_IDENTITY_FIELDS.forEach((field) => {
      const prev = selectedPerson[field];
      const next = personDraft[field];
      if ((prev ?? '') !== (next ?? '')) {
        if (field === 'birthSex') {
          updates.birthSex = personDraft.birthSex || undefined;
          updates.gender = personDraft.birthSex || undefined;
        } else {
          updates.genderIdentity = personDraft.genderIdentity || undefined;
        }
        // One identity event per field: a change replaces the previous one
        // (keeping its id), and "Unknown" removes it. Appending left two
        // contradictory "Birth Sex:" events after a correction.
        const prefix = IDENTITY_EVENT_PREFIX[field];
        const isIdentityEvent = (event: EmotionalProcessEvent) =>
          (event.category || '') === 'Individual' && (event.subtype || '').startsWith(prefix);
        const existing = nextEvents.find(isIdentityEvent);
        const others = nextEvents.filter((event) => !isIdentityEvent(event));
        if (next) {
          const eventDate =
            field === 'birthSex'
              ? personDraft.birthDate || selectedPerson.birthDate || ''
              : personDraft.genderDate || selectedPerson.genderDate || '';
          const built = buildPersonIdentityEvent(personDraft, field, next, eventDate);
          nextEvents = [
            ...others,
            existing ? { ...existing, ...built, id: existing.id, createdAt: existing.createdAt ?? built.createdAt } : built,
          ];
        } else {
          nextEvents = others;
        }
        eventsChanged = eventsChanged || !!next || !!existing;
      }
    });
    if (eventsChanged) {
      updates.events = nextEvents;
    }
    pendingPersonEditsRef.current = {};
    if (!Object.keys(updates).length) {
      setPersonDraft({ ...selectedPerson });
      return;
    }
    onUpdatePerson(selectedPerson.id, updates);
    setPersonDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const cancelPersonChanges = () => {
    if (!selectedPerson) return;
    pendingPersonEditsRef.current = {};
    setPersonDraft({ ...selectedPerson });
  };

  const partnershipDirty = useMemo(() => {
    if (!selectedPartnership || !partnershipDraft) return false;
    const stringFieldChanged = PARTNERSHIP_STRING_FIELDS.some((field) =>
      stringDiffers(partnershipDraft[field], selectedPartnership[field])
    );
    if (stringFieldChanged) return true;
    const hasStatusDateChanges = allRelationshipStatuses.some((status) =>
      stringDiffers(
        readPartnershipStatusDate(partnershipDraft, status),
        readPartnershipStatusDate(selectedPartnership, status)
      )
    );
    return hasStatusDateChanges;
  }, [selectedPartnership, partnershipDraft, allRelationshipStatuses]);

  const savePartnershipProperties = () => {
    if (!selectedPartnership || !partnershipDraft || !partnershipDirty) return;
    const updates: Partial<Partnership> = {};
    PARTNERSHIP_STRING_FIELDS.forEach((field) => {
      if (stringDiffers(partnershipDraft[field], selectedPartnership[field])) {
        const value = partnershipDraft[field];
        (updates as Record<string, unknown>)[field] = value && value !== '' ? value : undefined;
      }
    });
    // No "type/status changed" event is written. It was dated TODAY rather
    // than the day anything happened, appended on every edit, and duplicated
    // the status date the synthesizer already renders.
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
        // As with person dates, the status date is the record. Appending an
        // event here produced a second block for the same marriage, and a
        // third once the date was edited.

      }
    });
    // Nothing is appended here any more: the status fields are the record,
    // so there is no event to store and none to clone onto each partner.
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
    ) || emotionalDraft.person1_id !== selectedEmotionalLine.person1_id;
  }, [selectedEmotionalLine, emotionalDraft]);
  // A measurement is recorded only when a MEASURED metric changed. The
  // intensity control sets the line's style (compared in emotionalDirty via
  // lineStyle); comparing it with the last measurement's event.intensity made
  // every line without a matching measurement "dirty" as soon as it opened.
  const emotionalMetricDirty = useMemo(() => {
    if (!selectedEmotionalLine) return false;
    const baseline = deriveEmotionalMetricDraft(selectedEmotionalLine);
    return (
      emotionalFrequencyDraft !== baseline.frequency ||
      emotionalImpactDraft !== baseline.impact
    );
  }, [selectedEmotionalLine, emotionalFrequencyDraft, emotionalImpactDraft]);
  const triangleColorDirty = useMemo(() => {
    if (!triangleId) return false;
    return triangleColorDraft !== (triangleColor || '#8a5a00');
  }, [triangleId, triangleColor, triangleColorDraft]);
  const triangleIntensityDirty = useMemo(() => {
    if (!triangleId) return false;
    return triangleIntensityDraft !== (triangleIntensity || 'medium');
  }, [triangleId, triangleIntensity, triangleIntensityDraft]);
  const triangleNotesDirty = useMemo(() => {
    if (!triangleId) return false;
    return triangleNotesDraft !== (triangleNotes || '');
  }, [triangleId, triangleNotes, triangleNotesDraft]);

  const saveEmotionalLineProperties = () => {
    if (
      !selectedEmotionalLine ||
      !emotionalDraft ||
      (!emotionalDirty && !emotionalMetricDirty && !triangleColorDirty && !triangleIntensityDirty && !triangleNotesDirty)
    ) {
      return;
    }
    const updates: Partial<EmotionalLine> = {};
    EMOTIONAL_STRING_FIELDS.forEach((field) => {
      if (stringDiffers(emotionalDraft[field], selectedEmotionalLine[field])) {
        const value = emotionalDraft[field];
        (updates as Record<string, unknown>)[field] = value && value !== '' ? value : undefined;
      }
    });
    if (emotionalDraft.person1_id !== selectedEmotionalLine.person1_id) {
      updates.person1_id = emotionalDraft.person1_id;
      updates.person2_id = emotionalDraft.person2_id;
    }
    const newEvents: EmotionalProcessEvent[] = [];
    (['startDate', 'endDate'] as EmotionalDateField[]).forEach((field) => {
      const prev = selectedEmotionalLine[field] ?? '';
      const next = emotionalDraft[field] ?? '';
      if (prev !== next) {
        updates[field] = next || undefined;
        // No event is written for the date itself. Each edit used to APPEND
        // one and never replace the last, so a corrected start date left the
        // old one behind — on top of the Pattern Started / Pattern Ended that
        // syntheticDateEvents already renders from the field.
      }
    });
    // Changing a pattern's type, status or line style no longer appends an
    // event dated TODAY. It recorded an edit, not something that happened
    // between two people, and it was the source of repeated identical
    // blocks on the timeline. The pattern's own fields carry its state.
    if (emotionalMetricDirty) {
      // The measurement's own intensity carries forward from the last
      // measurement — the line-style level is not a measured value.
      const metricEvent = buildEmotionalPatternMeasurementEvent(
        { ...selectedEmotionalLine, ...emotionalDraft },
        deriveEmotionalMetricDraft(selectedEmotionalLine).intensity,
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
    if (triangleId && onUpdateTriangleNotes && triangleNotesDirty) {
      onUpdateTriangleNotes(triangleId, triangleNotesDraft);
    }
    if (!Object.keys(updates).length) {
      setEmotionalPristine(true);
      resetEmotionalDrafts(selectedEmotionalLine);
      return;
    }
    onUpdateEmotionalLine(selectedEmotionalLine.id, updates);
    resetEmotionalDrafts({ ...selectedEmotionalLine, ...updates });
    setEmotionalPristine(true);
  };

  const cancelEmotionalChanges = () => {
    if (!selectedEmotionalLine) return;
    resetEmotionalDrafts(selectedEmotionalLine);
    setTriangleColorDraft(triangleColor || '#8a5a00');
    setTriangleIntensityDraft(triangleIntensity || 'medium');
    setTriangleNotesDraft(triangleNotes || '');
    setEmotionalPristine(true);
  };

  const termLabel = () => {
    if (isPerson) return 'Person (Person Node)';
    if (isPartnership) return 'Partner Relationship Line (PRL)';
    if (isEmotionalLine) return 'Emotional Pattern Line (EPL)';
    return '';
  };

  // The entity whose tab this is, as an event owner.
  const selfOwner = useMemo<EventOwner>(
    () => ({
      kind: isPerson ? 'person' : isPartnership ? 'partnership' : 'emotional',
      id: selectedItem.id,
    }),
    [isPerson, isPartnership, selectedItem.id]
  );

  // Every row on this Events tab, each with the entity that owns it. A
  // person's tab lists events it does not own — its partnerships' events and
  // family events, its patterns' events, and the date fields of all of them —
  // and Edit / Delete must act on that owner. They used to act on the
  // person's own list, so Delete did nothing and Edit wrote a copy.
  // Date fields appear through the synthesizer (one event per field); the
  // companion events that hold their notes are therefore not listed directly.
  const displayRows = useMemo((): Array<{ event: EmotionalProcessEvent; owner: EventOwner }> => {
    const nameOf = (id: string) => people.find((p) => p.id === id)?.name;
    if (isPartnership) {
      const partnership = selectedItem as Partnership;
      return [
        ...withoutDateSlotCompanions(partnership.events),
        ...synthesizePartnershipDateEvents(partnership, nameOf(partnership.partner1_id), nameOf(partnership.partner2_id)),
      ].map((event) => ({ event, owner: selfOwner }));
    }
    if (isEmotionalLine) {
      const line = selectedItem as EmotionalLine;
      return [
        // The pattern's own tab: one event for it, one each for its start
        // and end — edit records hidden (utils/patternEventRecords.ts).
        ...withoutPatternEditRecords(withoutDateSlotCompanions(line.events)),
        ...synthesizeEmotionalLineDateEvents(line, nameOf(line.person1_id), nameOf(line.person2_id)),
      ].map((event) => ({ event, owner: selfOwner }));
    }
    const person = selectedItem as Person;
    // Date records are hidden rather than deleted — see utils/personDateEvents.ts.
    const ownEvents = withoutPersonDateRecords(withoutDateSlotCompanions(person.events));
    const ownIds = new Set(ownEvents.map((e) => e.id));
    // The clone rule lives in utils/eventDedup.ts so this panel and the
    // Timeline cannot drift.
    const isAlreadyCloned = (sourceId: string) => hasSameEvent(sourceId, ownIds);
    const rows: Array<{ event: EmotionalProcessEvent; owner: EventOwner }> = [
      ...ownEvents,
      // Birth / death / adoption / gender dates and indicator-backed
      // symptoms — the same synthesizers the Timeline lane uses (M7.A.1,
      // M7.B.1), so the two views list the same events.
      ...synthesizePersonDateEvents(person),
      ...synthesizePersonIndicatorEvents(person, functionalIndicatorDefinitions),
    ].map((event) => ({ event, owner: selfOwner }));
    partnerships.forEach((p) => {
      if (p.partner1_id !== person.id && p.partner2_id !== person.id) return;
      const owner: EventOwner = { kind: 'partnership', id: p.id };
      withoutPartnershipStatusRecords(withoutDateSlotCompanions(p.events), p).forEach((event) => {
        if (!isAlreadyCloned(event.id)) rows.push({ event, owner });
      });
      // Family-level events of the person's own partnerships (M7.A.2).
      (p.familyEvents || []).forEach((event) => {
        if (!isAlreadyCloned(event.id)) rows.push({ event, owner: { ...owner, list: 'familyEvents' } });
      });
      synthesizePartnershipDateEvents(p, nameOf(p.partner1_id), nameOf(p.partner2_id)).forEach((event) => {
        rows.push({ event, owner });
      });
    });
    allEmotionalLines.forEach((line) => {
      if (line.person1_id !== person.id && line.person2_id !== person.id) return;
      const owner: EventOwner = { kind: 'emotional', id: line.id };
      withoutPatternEditRecords(withoutDateSlotCompanions(line.events)).forEach((event) => {
        if (!isAlreadyCloned(event.id)) rows.push({ event, owner });
      });
      synthesizeEmotionalLineDateEvents(line, nameOf(line.person1_id), nameOf(line.person2_id)).forEach((event) => {
        rows.push({ event, owner });
      });
    });
    return rows;
  }, [isPartnership, isEmotionalLine, selectedItem, people, partnerships, allEmotionalLines, functionalIndicatorDefinitions, selfOwner]);
  const displayEvents = useMemo(() => displayRows.map((row) => row.event), [displayRows]);
  const ownerOfEvent = useCallback(
    (eventId: string): EventOwner =>
      displayRows.find((row) => row.event.id === eventId)?.owner || selfOwner,
    [displayRows, selfOwner]
  );
  const entityForOwner = (owner: EventOwner): EventOwnerEntity | undefined => {
    if (owner.id === selectedItem.id) return selectedItem;
    if (owner.kind === 'person') return people.find((p) => p.id === owner.id);
    if (owner.kind === 'partnership') return partnerships.find((p) => p.id === owner.id);
    return allEmotionalLines.find((line) => line.id === owner.id);
  };
  const applyOwnerUpdates = (owner: EventOwner, updates: Partial<Person> | Partial<Partnership> | Partial<EmotionalLine>) => {
    if (owner.kind === 'person') onUpdatePerson(owner.id, updates as Partial<Person>);
    else if (owner.kind === 'partnership') onUpdatePartnership(owner.id, updates as Partial<Partnership>);
    else onUpdateEmotionalLine(owner.id, updates as Partial<EmotionalLine>);
  };
  // Which owner the open event dialog saves to.
  const [eventDraftOwner, setEventDraftOwner] = useState<EventOwner | null>(null);

  // System events — a relative's nodal events, shown read-only on a person's
  // Events tab so it lists the same set the Timeline lane shows (D14).
  // Spec: docs/implementation_plan_2026-09-19.md#M7.F.1
  const systemEventsResult = useMemo(() => {
    if (!isPerson || !selectedItem) {
      return { events: [] as SystemEvent[], relativeCount: 0, lifetimeFilterApplied: true };
    }
    return collectSystemEvents({
      personId: selectedItem.id,
      scope: familyScope,
      people,
      partnerships,
      allEmotionalLines,
      functionalIndicatorDefinitions,
    });
  }, [
    isPerson,
    selectedItem,
    familyScope,
    people,
    partnerships,
    allEmotionalLines,
    functionalIndicatorDefinitions,
  ]);

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
      category: string;
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
        // The stored group; older data can hold other spellings.
        category: string;
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
          category,
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
          category,
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


  // A new event holds only what its seed gives (author decisions
  // 2026-09-30): no date, no rating, nothing copied from the last event.
  const buildEventDraft = useCallback((
    eventType: EventType,
    seed?: Partial<EmotionalProcessEvent> | null
  ): EmotionalProcessEvent =>
    buildNewEventDraft({
      eventType,
      anchorType: resolveAnchorType(),
      anchorId: selectedItem.id,
      eventClass: resolveEventClass(),
      primaryPersonName: primaryPersonOptions[0] || '',
      // An event on a pattern starts in the pattern's own category.
      defaultCategory:
        isEmotionalLine && eventType === 'EPE'
          ? EPE_CATEGORY_BY_PATTERN_TYPE[(selectedItem as EmotionalLine).relationshipType]
          : undefined,
      seed,
    }), [isEmotionalLine, primaryPersonOptions, resolveAnchorType, resolveEventClass, selectedItem]);

  const openNewEvent = (seed?: Partial<EmotionalProcessEvent> | null, modalTitle?: string) => {
    const eventType = (seed?.eventType as EventType) || resolveDefaultEventType();
    setEventDraft(buildEventDraft(eventType, seed));
    setEventDraftOwner(selfOwner);
    setEventModalPosition(openNewEventPosition || null);
    setEventModalTitle(modalTitle || undefined);
    setEventModalOpen(true);
  };

  const openEditEvent = (event: EmotionalProcessEvent) => {
    const eType = inferEventType(event);
    const typeLabel = EVENT_TYPE_LABELS[eType] || eType;
    const cat = event.category || '';
    const sub = event.symptomType || event.subtype || '';
    const editTitle = ['Edit', typeLabel, cat, sub].filter(Boolean).join(' ');
    const owner = ownerOfEvent(event.id);
    setEventDraftOwner(owner);
    setEventDraft({
      ...event,
      category: event.category || '',
      eventType: eType,
      startDate: event.startDate ?? event.date ?? '',
      date: event.startDate ?? event.date ?? '',
      endDate: event.endDate || '',
      subtype: event.subtype || (eType === 'SYMPTOM' ? event.symptomType || '' : ''),
      anchorType: event.anchorType || anchorTypeForOwner(owner.kind, owner.list),
      anchorId: event.anchorId || owner.id,
      otherPersonName: event.otherPersonName || 'None',
      primaryPersonName: event.primaryPersonName || primaryPersonOptions[0] || '',
      frequency: typeof event.frequency === 'number' ? event.frequency : 0,
      impact: typeof event.impact === 'number' ? event.impact : 0,
      intensity: typeof event.intensity === 'number' ? event.intensity : 0,
      priorEventsNote: event.priorEventsNote || '',
      reflectionsNote: event.reflectionsNote || '',
      status: event.status || 'discrete',
      createdAt: event.createdAt ?? Date.now(),
      symptomType: eType === 'SYMPTOM' ? (event.symptomType || event.subtype || '') : undefined,
      eventClass: event.eventClass || eventClassForOwner(owner.kind, owner.list),
    });
    setEventModalPosition(null);
    setEventModalTitle(editTitle);
    setEventModalOpen(true);
  };

  useEffect(() => {
    if (!openNewEventRequestId || openNewEventRequestId === lastNewEventRequestIdRef.current) return;
    lastNewEventRequestIdRef.current = openNewEventRequestId;
    setActiveTab('events');
    const eventType = (newEventSeed?.eventType as EventType) || resolveDefaultEventType();
    setEventDraft(buildEventDraft(eventType, newEventSeed || null));
    setEventDraftOwner(selfOwner);
    setEventModalPosition(openNewEventPosition || null);
    setEventModalTitle(newEventModalTitle || undefined);
    setEventModalOpen(true);
  }, [openNewEventRequestId, newEventSeed, openNewEventPosition, newEventModalTitle, resolveDefaultEventType, buildEventDraft, selfOwner]);

  const handleEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    if (!eventDraft) return;
    setEventDraft(applyEventDraftFieldChange(eventDraft, field, value));
  };

  const saveEvent = () => {
    if (!eventDraft) return;
    const owner = eventDraftOwner || selfOwner;
    const entity = entityForOwner(owner);
    if (!entity) return;
    const normalized = normalizeEventForSave(eventDraft, {
      anchorType: anchorTypeForOwner(owner.kind, owner.list),
      anchorId: owner.id,
      eventClass: eventClassForOwner(owner.kind, owner.list),
      primaryPersonName: primaryPersonOptions[0] || '',
    });
    applyOwnerUpdates(
      owner,
      saveEventOnOwner(owner, entity, normalized, {
        definitions: functionalIndicatorDefinitions,
        ensureSymptomDefinition: onEnsureSymptomCategoryDefinition,
      })
    );
    setEventModalOpen(false);
    setEventDraft(null);
    setEventDraftOwner(null);
  };

  const deleteEvent = (id: string) => {
    const owner = ownerOfEvent(id);
    const entity = entityForOwner(owner);
    if (!entity) return;
    applyOwnerUpdates(owner, deleteEventFromOwner(owner, entity, id));
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
        onSizeSet={setPersonSize}
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
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: '#c0392b',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ✕
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
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: '#c0392b',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
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
            onColorPresetSelect={(field, hex) => { updatePartnershipDraftState({ [field]: hex }); setPartnershipPristine(false); }}
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

    // The wrapper carries data-ev-id so Edit can open the editor next to the
    // card; nothing rendered the attribute before, so it opened at the
    // viewport corner.
    const renderFamilyEventCard = (ev: EmotionalProcessEvent) => (
      <div key={ev.id} data-ev-id={ev.id}>
      <EventCard
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
      </div>
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
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#c0392b', color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
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
            <div style={{ fontSize: 12, color: '#6b7a93', marginBottom: 12 }}>
              {partnerNames ? `Partners: ${partnerNames}` : 'No partners recorded'}
            </div>
            <div style={{ marginTop: 8 }}>
              <label htmlFor="familyNotes" style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#23324a', marginBottom: 4 }}>Notes:</label>
              <textarea
                id="familyNotes"
                value={familyNotesDraft}
                onChange={(e) => setFamilyNotesDraft(e.target.value)}
                rows={6}
                style={{ width: '100%', minHeight: '7rem', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  disabled={familyNotesDraft === (familyPartnership.familyNotes || '')}
                  onClick={() => setFamilyNotesDraft(familyPartnership.familyNotes || '')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={familyNotesDraft === (familyPartnership.familyNotes || '')}
                  onClick={() => onUpdatePartnership(familyPartnership.id, { familyNotes: familyNotesDraft || undefined })}
                >
                  Save
                </button>
              </div>
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
        <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#c0392b', color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{panelTitle}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{termLabel()}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
        {(() => {
          const topTabs: Array<'properties' | 'functional' | 'events' | 'patterns' | 'papero' | 'sir'> = isPerson
            ? ['properties', 'patterns', 'functional', 'papero', 'sir', 'events']
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
                : tab === 'papero'
                ? 'Papero'
                : tab === 'sir'
                ? 'SIR'
                : 'Events';
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  borderLeft: index === 0 ? 'none' : '1px solid #d0d6e2',
                  background: isActive ? '#dfe7f7' : '#fff',
                  color: isActive ? '#1f3f78' : '#23324a',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
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
            onColorPresetSelect={(field, hex) => { updatePartnershipDraftState({ [field]: hex }); setPartnershipPristine(false); }}
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
            person1Name={people.find((p) => p.id === emotionalDraft.person1_id)?.name || 'Unknown'}
            person2Name={people.find((p) => p.id === emotionalDraft.person2_id)?.name || 'Unknown'}
            onSelectChange={handleEmotionalLineChange}
            onInputChange={handleEmotionalLineInputChange}
            onIntensityLevelChange={applyEmotionalIntensityLevel}
            onImpactChange={(val) => { setEmotionalImpactDraft(val); setEmotionalPristine(false); }}
            onFrequencyChange={(val) => { setEmotionalFrequencyDraft(val); setEmotionalPristine(false); }}
            onColorPresetSelect={(hex) => { updateEmotionalDraftState({ color: hex }); setEmotionalPristine(false); }}
            onSwapPersons={() => { updateEmotionalDraftState({ person1_id: emotionalDraft.person2_id, person2_id: emotionalDraft.person1_id }); setEmotionalPristine(false); }}
            onAdequatePersonChange={(personId) => { updateEmotionalDraftState({ adequatePersonId: personId || undefined }); setEmotionalPristine(false); }}
            triangleId={triangleId}
            triangleColorDraft={triangleColorDraft}
            triangleIntensityDraft={triangleIntensityDraft}
            triangleNotesDraft={triangleNotesDraft}
            onTriangleColorChange={(c) => { setTriangleColorDraft(c); setEmotionalPristine(false); }}
            onTriangleIntensityChange={(i) => { setTriangleIntensityDraft(i); setEmotionalPristine(false); }}
            onTriangleNotesChange={(n) => { setTriangleNotesDraft(n); setEmotionalPristine(false); }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={cancelEmotionalChanges}
              disabled={!emotionalDirty && !emotionalMetricDirty && !triangleColorDirty && !triangleIntensityDirty && !triangleNotesDirty}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEmotionalLineProperties}
              disabled={!emotionalDirty && !emotionalMetricDirty && !triangleColorDirty && !triangleIntensityDirty && !triangleNotesDirty}
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
              <button type="button" onClick={() => openNewEvent({ eventType: 'SYMPTOM' }, 'Person Add Symptom')} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: '1px solid #4b68a6', background: '#f0f4ff', color: '#23324a', cursor: 'pointer' }}>+ Add Symptom</button>
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
                      openNewEvent({ eventType: 'SYMPTOM', category: symptom.category, symptomType: symptom.type }, `Person Add Symptom ${toTitleCase(symptom.category)}`);
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
          {onAddEmotionalPattern && (() => {
            const person = selectedItem as Person;
            const others = people.filter((p) => p.id !== person.id);
            return (
              <AddPatternRow
                people={others}
                onAdd={(otherId) => onAddEmotionalPattern(person.id, otherId)}
              />
            );
          })()}
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
              'open-connection': 'Open Connection',
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
                    const metrics = deriveEmotionalMetricDraft(el);
                    setEditingPatternLineId(el.id);
                    setEditingPatternDraft({
                      person1Id: el.person1_id,
                      person2Id: el.person2_id,
                      relationshipType: el.relationshipType,
                      status: el.status || 'ongoing',
                      lineStyle: el.lineStyle,
                      startDate: el.startDate || '',
                      endDate: el.endDate || '',
                      intensityLevel: lineStyleLevel(el.relationshipType, el.lineStyle),
                      // The last measurement, so an untouched Save records nothing new.
                      frequency: metrics.frequency,
                      impact: metrics.impact,
                      notes: el.notes || '',
                      color: el.color || '#444444',
                      adequatePersonId: el.adequatePersonId || '',
                    });
                  }}
                  onDelete={onRemoveEmotionalLine ? () => onRemoveEmotionalLine(el.id) : undefined}
                />
              );
            });
          })()}
        </div>
      )}
      {activeTab === 'papero' && isPerson && selectedPerson && personDraft && (
        <PersonPaperoSection
          personDraft={personDraft}
          selectedPerson={selectedPerson}
          onUpdatePerson={onUpdatePerson}
          updatePersonDraftState={(updates) => setPersonDraft((prev) => ({ ...prev!, ...updates }))}
          onScoreChange={(subtypeKey, newValue, oldValue) => {
            const event = buildPaperoScoreEvent(selectedPerson, subtypeKey, newValue, oldValue);
            appendEventsToPerson(selectedPerson.id, [event]);
          }}
        />
      )}
      {activeTab === 'sir' && isPerson && selectedPerson && personDraft && (
        <PersonSIRSection
          selectedPerson={selectedPerson}
          people={people}
          sirCategories={sirCategories}
          onUpdatePerson={onUpdatePerson}
        />
      )}
      {activeTab === 'events' && (
        <EventsSection
          allEvents={displayEvents}
          addEventButtonLabel="+ Add Event"
          onAddEvent={() => {
            const entityLabel = isPerson ? 'Person' : isPartnership ? 'Partnership' : isEmotionalLine ? 'Emotional Pattern' : '';
            openNewEvent(null, `${entityLabel} Add Event`);
          }}
          onEditEvent={openEditEvent}
          onDeleteEvent={deleteEvent}
          systemEvents={systemEventsResult.events}
          systemEventsNote={
            systemEventsResult.lifetimeFilterApplied
              ? `read-only — from ${systemEventsResult.relativeCount} relative${
                  systemEventsResult.relativeCount === 1 ? '' : 's'
                } in this family`
              : 'read-only — no birth date, lifetime filter not applied'
          }
          onOpenSystemEvent={(entry) => {
            if (entry.ownerEntityType === 'person') {
              onSelectSystemEventOwner?.({ type: 'person', id: entry.ownerEntityId });
              return;
            }
            if (entry.ownerEntityType === 'partnership') {
              onSelectSystemEventOwner?.({ type: 'partnership', id: entry.ownerEntityId });
              return;
            }
            onSelectSystemEventOwner?.({ type: 'emotional', id: entry.ownerEntityId });
          }}
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
          functionalFactCategoryNames={functionalFactCategories.map((c) => c.name)}
          nodalCategoryNames={nodalCategories.map((c) => c.name)}
          symptomTypeOptions={symptomTypeOptions}
          resolvedEventClass={resolveEventClass()}
          modalTitle={eventModalTitle}
          lockCategory={isDateSlotEventId(eventDraft.id)}
          onChange={handleEventDraftChange}
          onSetDraft={setEventDraft}
          onSave={saveEvent}
          onCancel={() => { setEventModalOpen(false); setEventDraft(null); setEventDraftOwner(null); }}
        />
      )}
      <EmotionalPatternModal
        open={!!editingPatternDraft}
        draft={editingPatternDraft}
        people={people}
        onUpdate={(updates) => setEditingPatternDraft((prev) => prev ? { ...prev, ...updates } : prev)}
        onCancel={() => { setEditingPatternDraft(null); setEditingPatternLineId(null); }}
        onSave={() => {
          const line = allEmotionalLines.find((entry) => entry.id === editingPatternLineId);
          if (editingPatternDraft && editingPatternLineId && line) {
            // Every field the dialog edits is saved. Adequate person,
            // frequency, impact and the intensity slider used to be dropped.
            const draft = editingPatternDraft;
            const validStyles = LINE_STYLE_VALUES[draft.relationshipType] || [];
            const styleFromLevel =
              draft.intensityLevel !== lineStyleLevel(line.relationshipType, line.lineStyle)
                ? lineStyleForLevel(draft.relationshipType, draft.intensityLevel)
                : null;
            const candidate = styleFromLevel || draft.lineStyle;
            const lineStyle = validStyles.includes(candidate)
              ? candidate
              : (validStyles[0] as EmotionalLine['lineStyle']);
            const updates: Partial<EmotionalLine> = {
              person1_id: draft.person1Id,
              person2_id: draft.person2Id,
              relationshipType: draft.relationshipType,
              status: draft.status,
              lineStyle,
              startDate: draft.startDate || undefined,
              endDate: draft.endDate || undefined,
              notes: draft.notes || undefined,
              color: draft.color,
              adequatePersonId: draft.adequatePersonId || undefined,
            };
            const baseline = deriveEmotionalMetricDraft(line);
            if (draft.frequency !== baseline.frequency || draft.impact !== baseline.impact) {
              const measurement = buildEmotionalPatternMeasurementEvent(
                { ...line, ...updates },
                baseline.intensity,
                draft.frequency,
                draft.impact
              );
              if (measurement) updates.events = [...(line.events || []), measurement];
            }
            onUpdateEmotionalLine(editingPatternLineId, updates);
          }
          setEditingPatternDraft(null);
          setEditingPatternLineId(null);
        }}
      />
    </div>
  );
};


export default PropertiesPanel;
