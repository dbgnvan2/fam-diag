import { nanoid } from 'nanoid';
import type {
  EmotionalLine,
  FunctionalIndicatorDefinition,
  Partnership,
  Person,
} from '../types';
import defaultDiagramDataJson from './defaultDiagramData.json';

export const FALLBACK_FILE_NAME = 'Untitled';
const FALLBACK_AUTO_SAVE_MINUTES = 1;
const FALLBACK_EVENT_CATEGORIES = ['Job', 'School', 'Health', 'Relationship', 'Other'];

const FALLBACK_FUNCTIONAL_INDICATORS: FunctionalIndicatorDefinition[] = [
  { id: 'indicator-affair', label: 'Affair' },
  { id: 'indicator-su', label: 'Substance Use' },
  { id: 'indicator-gambling', label: 'Gambling' },
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

export type RawDiagramFile = {
  fileMeta?: { fileName?: string };
  people?: Person[];
  partnerships?: Partnership[];
  emotionalLines?: EmotionalLine[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  eventCategories?: string[];
  autoSaveMinutes?: number;
};

export type DefaultDiagramState = {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  eventCategories: string[];
  autoSaveMinutes: number;
  fileName: string;
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

export const buildDefaultDiagramState = (rawData: unknown): DefaultDiagramState => {
  const typed = rawData as RawDiagramFile | undefined;
  const base: DefaultDiagramState = {
    people: FALLBACK_PEOPLE,
    partnerships: FALLBACK_PARTNERSHIPS,
    emotionalLines: FALLBACK_EMOTIONAL_LINES,
    functionalIndicatorDefinitions: FALLBACK_FUNCTIONAL_INDICATORS,
    eventCategories: FALLBACK_EVENT_CATEGORIES,
    autoSaveMinutes: FALLBACK_AUTO_SAVE_MINUTES,
    fileName: FALLBACK_FILE_NAME,
  };

  if (!typed) {
    return base;
  }

  return {
    people: hasItems(typed.people) ? typed.people : base.people,
    partnerships: hasItems(typed.partnerships) ? typed.partnerships : base.partnerships,
    emotionalLines: Array.isArray(typed.emotionalLines) ? typed.emotionalLines : base.emotionalLines,
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
  };
};

export const DEFAULT_DIAGRAM_STATE = buildDefaultDiagramState(defaultDiagramDataJson);
