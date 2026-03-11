import { nanoid } from 'nanoid';
import type {
  EmotionalLine,
  FunctionalIndicatorDefinition,
  PageNote,
  Partnership,
  Person,
  Triangle,
} from '../types';
import demoFamilyDiagramDataJson from './demofamilydiagram.json';

export const FALLBACK_FILE_NAME = 'newDiagram';
const FALLBACK_AUTO_SAVE_MINUTES = 1;
const FALLBACK_EVENT_CATEGORIES = [
  'Relationship',
  'Health',
  'Career',
  'Education',
  'Location',
  'Legal',
  'Finance',
  'Faith',
  'Achievement',
  'Social',
];

const FALLBACK_FUNCTIONAL_INDICATORS: FunctionalIndicatorDefinition[] = [
  {
    id: 'symptom-physical-default',
    label: 'Physical Symptom',
    group: 'physical',
    color: '#1f77b4',
    useLetter: true,
  },
  {
    id: 'symptom-emotional-default',
    label: 'Emotional Symptom',
    group: 'emotional',
    color: '#d81b60',
    useLetter: true,
  },
  {
    id: 'symptom-social-default',
    label: 'Social Symptom',
    group: 'social',
    color: '#2e7d32',
    useLetter: true,
  },
];

const fallbackPartner1Id = nanoid();
const fallbackPartner2Id = nanoid();
const fallbackChildId = nanoid();

const FALLBACK_PEOPLE: Person[] = [
  {
    id: fallbackPartner1Id,
    name: 'John Doe',
    x: 50,
    y: 50,
    gender: 'male',
    partnerships: ['p1'],
    birthDate: '1970-01-01',
  },
  {
    id: fallbackPartner2Id,
    name: 'Jane Doe',
    x: 250,
    y: 50,
    gender: 'female',
    partnerships: ['p1'],
    birthDate: '1972-03-15',
  },
  {
    id: fallbackChildId,
    name: 'Junior Doe',
    x: 150,
    y: 200,
    gender: 'male',
    parentPartnership: 'p1',
    partnerships: [],
    birthDate: '2000-05-20',
  },
];

const FALLBACK_PARTNERSHIPS: Partnership[] = [
  {
    id: 'p1',
    partner1_id: fallbackPartner1Id,
    partner2_id: fallbackPartner2Id,
    horizontalConnectorY: 150,
    relationshipType: 'married',
    relationshipStatus: 'married',
    relationshipStartDate: '1995-06-01',
    children: [fallbackChildId],
  },
];

const FALLBACK_EMOTIONAL_LINES: EmotionalLine[] = [];
const FALLBACK_TRIANGLES: Triangle[] = [];

export type RawDiagramFile = {
  fileMeta?: { fileName?: string; displayName?: string };
  people?: Person[];
  partnerships?: Partnership[];
  emotionalLines?: EmotionalLine[];
  pageNotes?: PageNote[];
  triangles?: Triangle[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  eventCategories?: string[];
  autoSaveMinutes?: number;
  ideasText?: string;
};

export type DefaultDiagramState = {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  pageNotes: PageNote[];
  triangles: Triangle[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  eventCategories: string[];
  autoSaveMinutes: number;
  fileName: string;
  displayName: string;
  ideasText: string;
};

const toPositiveNumberOrNull = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value > 0 ? value : null;
};

const sanitizeStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const trimmed = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length);
  return trimmed.length ? trimmed : null;
};

const hasItems = <T,>(value: T[] | undefined | null): value is T[] =>
  Array.isArray(value) && value.length > 0;

const sanitizePeople = (value: unknown): Person[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map((person) => {
    if (!person || typeof person !== 'object') {
      return person as Person;
    }
    const typed = person as Person & { size?: unknown };
    if (typeof typed.size === 'number') return typed;
    if (typeof typed.size === 'string') {
      const parsed = Number(typed.size);
      if (Number.isFinite(parsed) && parsed > 0) {
        return { ...typed, size: parsed };
      }
    }
    const next = { ...typed };
    delete next.size;
    return next;
  }) as Person[];
};

export const buildDefaultDiagramState = (rawData: unknown): DefaultDiagramState => {
  const typed = rawData as RawDiagramFile | undefined;
  const base: DefaultDiagramState = {
    people: FALLBACK_PEOPLE,
    partnerships: FALLBACK_PARTNERSHIPS,
    emotionalLines: FALLBACK_EMOTIONAL_LINES,
    pageNotes: [],
    triangles: FALLBACK_TRIANGLES,
    functionalIndicatorDefinitions: FALLBACK_FUNCTIONAL_INDICATORS,
    eventCategories: FALLBACK_EVENT_CATEGORIES,
    autoSaveMinutes: FALLBACK_AUTO_SAVE_MINUTES,
    fileName: FALLBACK_FILE_NAME,
    displayName: FALLBACK_FILE_NAME,
    ideasText: '',
  };

  if (!typed) {
    return base;
  }

  const sanitizedPeople = sanitizePeople(typed.people);

  return {
    people: sanitizedPeople ?? base.people,
    partnerships: hasItems(typed.partnerships) ? typed.partnerships : base.partnerships,
    emotionalLines: Array.isArray(typed.emotionalLines)
      ? typed.emotionalLines.map((line) => ({
          ...line,
          status: line.status || 'ongoing',
        }))
      : base.emotionalLines,
    pageNotes: Array.isArray(typed.pageNotes) ? typed.pageNotes : base.pageNotes,
    triangles: Array.isArray(typed.triangles) ? typed.triangles : base.triangles,
    functionalIndicatorDefinitions:
      Array.isArray(typed.functionalIndicatorDefinitions) &&
      typed.functionalIndicatorDefinitions.length
        ? typed.functionalIndicatorDefinitions
        : base.functionalIndicatorDefinitions,
    eventCategories: sanitizeStringArray(typed.eventCategories) ?? base.eventCategories,
    autoSaveMinutes: toPositiveNumberOrNull(typed.autoSaveMinutes) ?? base.autoSaveMinutes,
    fileName:
      typeof typed.fileMeta?.fileName === 'string' && typed.fileMeta.fileName.trim().length
        ? typed.fileMeta.fileName.trim()
        : base.fileName,
    displayName:
      typeof typed.fileMeta?.displayName === 'string' && typed.fileMeta.displayName.trim().length
        ? typed.fileMeta.displayName.trim()
        : typeof typed.fileMeta?.fileName === 'string' && typed.fileMeta.fileName.trim().length
        ? typed.fileMeta.fileName.trim()
        : base.displayName,
    ideasText: typeof typed.ideasText === 'string' ? typed.ideasText : base.ideasText,
  };
};

export const DEFAULT_DIAGRAM_STATE = buildDefaultDiagramState(demoFamilyDiagramDataJson);
