/**
 * Settings categories (Self in Relationship, Nodal, Functional Fact) and the
 * events that name them.
 *
 * An event records its category by name (`event.category`), not by id. So a
 * rename in Settings must rewrite every event that carries the old name, and
 * a delete must be refused while any event still carries it (settings-02,
 * the same rule as removing a symptom type). Prediction conditions also name
 * an SIR category (`linkedSIRCategory`).
 *
 * Symptom types are linked by id (`sourceIndicatorId`); their rename is
 * `renameSymptomTypeOnPeople` (settings-01).
 */
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  EventType,
  Partnership,
  Person,
  PredictionSet,
  Triangle,
} from '../types';
import { EVENT_CATEGORIES, EVENT_TYPE_LABELS, inferEventType } from '../constants/eventConstants';

export type CategoryEventType = Extract<EventType, 'SIR' | 'NODAL' | 'FF'>;

/** Every list in the diagram that holds events, plus the predictions. */
export type CategoryHolders = {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  triangles: Triangle[];
  predictionSets?: PredictionSet[];
};

export type CategoryUsage = {
  /** Who uses the category: people, couples, patterns, predictions. */
  ownerNames: string[];
  eventCount: number;
  predictionConditionCount: number;
};

export type CategoryRename = { from: string; to: string };

const sameName = (a: string | undefined, b: string | undefined) =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

const eventUsesCategory = (event: EmotionalProcessEvent, type: CategoryEventType, name: string) =>
  !!name.trim() && sameName(event.category, name) && inferEventType(event) === type;

const renameEvents = (
  events: EmotionalProcessEvent[] | undefined,
  type: CategoryEventType,
  rename: CategoryRename,
): EmotionalProcessEvent[] | undefined => {
  if (!events || !events.some((event) => eventUsesCategory(event, type, rename.from))) return events;
  return events.map((event) =>
    eventUsesCategory(event, type, rename.from) ? { ...event, category: rename.to } : event,
  );
};

const nameOf = (people: Person[], id: string) => people.find((person) => person.id === id)?.name || '';

const pairName = (people: Person[], a: string, b: string) =>
  [nameOf(people, a), nameOf(people, b)].filter(Boolean).join(' & ') || 'Unnamed';

/**
 * Who still uses a category: events of that type whose category is the name,
 * and (SIR only) prediction conditions linked to it.
 */
export const categoryUsage = (
  holders: CategoryHolders,
  type: CategoryEventType,
  name: string,
): CategoryUsage => {
  const ownerNames: string[] = [];
  let eventCount = 0;
  const count = (owner: string, events: EmotionalProcessEvent[] | undefined) => {
    const used = (events || []).filter((event) => eventUsesCategory(event, type, name)).length;
    if (used > 0) {
      eventCount += used;
      if (!ownerNames.includes(owner)) ownerNames.push(owner);
    }
  };
  holders.people.forEach((person) => count(person.name || 'Unnamed', person.events));
  holders.partnerships.forEach((partnership) => {
    const owner = partnership.familyName || pairName(holders.people, partnership.partner1_id, partnership.partner2_id);
    count(owner, partnership.events);
    count(owner, partnership.familyEvents);
  });
  holders.emotionalLines.forEach((line) =>
    count(pairName(holders.people, line.person1_id, line.person2_id), line.events),
  );
  holders.triangles.forEach((triangle) => {
    const owner = [triangle.person1_id, triangle.person2_id, triangle.person3_id]
      .map((id) => nameOf(holders.people, id))
      .filter(Boolean)
      .join(', ');
    count(owner || 'Triangle', triangle.events);
    (triangle.tpls || []).forEach((line) =>
      count(pairName(holders.people, line.person1_id, line.person2_id), line.events),
    );
  });
  let predictionConditionCount = 0;
  if (type === 'SIR') {
    (holders.predictionSets || []).forEach((set) =>
      set.predictions.forEach((prediction) => {
        const used = prediction.conditions.filter((condition) => sameName(condition.linkedSIRCategory, name)).length;
        if (used > 0) {
          predictionConditionCount += used;
          const owner = `prediction "${prediction.title || 'Untitled'}"`;
          if (!ownerNames.includes(owner)) ownerNames.push(owner);
        }
      }),
    );
  }
  return { ownerNames, eventCount, predictionConditionCount };
};

/** The alert shown when a delete is refused, or null when nothing uses the category. */
export const categoryInUseMessage = (name: string, usage: CategoryUsage): string | null => {
  const total = usage.eventCount + usage.predictionConditionCount;
  if (total === 0) return null;
  const parts = [
    usage.eventCount > 0 ? `${usage.eventCount} ${usage.eventCount === 1 ? 'event' : 'events'}` : '',
    usage.predictionConditionCount > 0
      ? `${usage.predictionConditionCount} prediction ${usage.predictionConditionCount === 1 ? 'condition' : 'conditions'}`
      : '',
  ].filter(Boolean);
  return (
    `"${name}" is still used by ${parts.join(' and ')}: ${usage.ownerNames.join(', ')}.\n\n` +
    'Delete those events, or change them to another category, before deleting it.'
  );
};

/** Pairs of old and new names for entries whose id stayed and whose name changed. */
export const categoryRenames = (
  prev: Array<{ id: string; name: string }>,
  next: Array<{ id: string; name: string }>,
): CategoryRename[] =>
  next.flatMap((entry) => {
    const before = prev.find((candidate) => candidate.id === entry.id);
    return before && before.name !== entry.name ? [{ from: before.name, to: entry.name }] : [];
  });

export const renamePeopleCategory = (people: Person[], type: CategoryEventType, rename: CategoryRename): Person[] =>
  people.map((person) => {
    const events = renameEvents(person.events, type, rename);
    return events === person.events ? person : { ...person, events };
  });

export const renamePartnershipsCategory = (
  partnerships: Partnership[],
  type: CategoryEventType,
  rename: CategoryRename,
): Partnership[] =>
  partnerships.map((partnership) => {
    const events = renameEvents(partnership.events, type, rename);
    const familyEvents = renameEvents(partnership.familyEvents, type, rename);
    return events === partnership.events && familyEvents === partnership.familyEvents
      ? partnership
      : { ...partnership, events, familyEvents };
  });

export const renameLinesCategory = (
  lines: EmotionalLine[],
  type: CategoryEventType,
  rename: CategoryRename,
): EmotionalLine[] =>
  lines.map((line) => {
    const events = renameEvents(line.events, type, rename);
    return events === line.events ? line : { ...line, events };
  });

export const renameTrianglesCategory = (
  triangles: Triangle[],
  type: CategoryEventType,
  rename: CategoryRename,
): Triangle[] =>
  triangles.map((triangle) => {
    const events = renameEvents(triangle.events, type, rename);
    const tpls = triangle.tpls && renameLinesCategory(triangle.tpls, type, rename);
    const tplsChanged = !!tpls && tpls.some((line, index) => line !== triangle.tpls?.[index]);
    return events === triangle.events && !tplsChanged ? triangle : { ...triangle, events, tpls };
  });

export const renamePredictionSetsCategory = (
  sets: PredictionSet[],
  type: CategoryEventType,
  rename: CategoryRename,
): PredictionSet[] => {
  if (type !== 'SIR') return sets;
  return sets.map((set) => ({
    ...set,
    predictions: set.predictions.map((prediction) => ({
      ...prediction,
      conditions: prediction.conditions.map((condition) =>
        sameName(condition.linkedSIRCategory, rename.from)
          ? { ...condition, linkedSIRCategory: rename.to }
          : condition,
      ),
    })),
  }));
};

/** React setters for the lists a category rename rewrites. */
export type CategoryRenameSetters = {
  setPeople: (updater: (prev: Person[]) => Person[]) => void;
  setPartnerships: (updater: (prev: Partnership[]) => Partnership[]) => void;
  setEmotionalLines: (updater: (prev: EmotionalLine[]) => EmotionalLine[]) => void;
  setTriangles: (updater: (prev: Triangle[]) => Triangle[]) => void;
  setPredictionSets: (updater: (prev: PredictionSet[]) => PredictionSet[]) => void;
  /** The Properties panel holds its own copy of the selected item. */
  setPropertiesPanelItem?: (updater: (prev: PanelItem) => PanelItem) => void;
};

type PanelItem = Person | Partnership | EmotionalLine | null;

const renamePanelItem = (item: PanelItem, type: CategoryEventType, rename: CategoryRename): PanelItem => {
  if (!item) return item;
  if ('partner1_id' in item) return renamePartnershipsCategory([item], type, rename)[0];
  if ('person1_id' in item) return renameLinesCategory([item], type, rename)[0];
  return renamePeopleCategory([item], type, rename)[0];
};

/**
 * Save a new category list from a Settings dialog: each renamed entry's old
 * name is rewritten on every event (and SIR prediction link) first, so no
 * event is left on a name the list no longer has (settings-02).
 */
export const saveCategoryList = <T extends { id: string; name: string }>(
  type: CategoryEventType,
  prev: T[],
  next: T[],
  setList: (list: T[]) => void,
  setters: CategoryRenameSetters,
): void => {
  categoryRenames(prev, next).forEach((rename) => {
    setters.setPeople((list) => renamePeopleCategory(list, type, rename));
    setters.setPartnerships((list) => renamePartnershipsCategory(list, type, rename));
    setters.setEmotionalLines((list) => renameLinesCategory(list, type, rename));
    setters.setTriangles((list) => renameTrianglesCategory(list, type, rename));
    if (type === 'SIR') setters.setPredictionSets((list) => renamePredictionSetsCategory(list, type, rename));
    setters.setPropertiesPanelItem?.((item) => renamePanelItem(item, type, rename));
  });
  setList(next);
};

/**
 * Why a name cannot be used for a list entry, or null when it can.
 *
 * - empty, or the same as another entry in any letter case (settings-07);
 * - for a Nodal or SIR category, a built-in category of another event type
 *   (settings-08). `inferEventType` reads such an event as that other type,
 *   so a custom Nodal category "Stress" would turn its events into Family
 *   events.
 */
export const categoryNameError = (
  name: string,
  otherNames: string[],
  type?: CategoryEventType,
): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name.';
  if (otherNames.some((other) => sameName(other, trimmed))) return `"${trimmed}" is already in the list.`;
  if (type === 'NODAL' || type === 'SIR') {
    const clash = (Object.entries(EVENT_CATEGORIES) as Array<[EventType, string[]]>).find(
      ([otherType, categories]) => otherType !== type && categories.some((category) => sameName(category, trimmed)),
    );
    if (clash) {
      return `"${trimmed}" is a built-in ${EVENT_TYPE_LABELS[clash[0]]} category. Choose another name.`;
    }
  }
  return null;
};

/**
 * Rename a symptom type on the events linked to it (settings-01).
 *
 * The definition holds the label; a symptom event carries its own copy in
 * `symptomType` and `subtype`. Renaming only the definition left the events
 * on the old name, so the symptom showed under two names. Every event whose
 * `sourceIndicatorId` is the definition gets the new `symptomType` (symptom
 * events only — other events do not carry one) and, when its `subtype` was the
 * old label, the new `subtype`.
 */
export const renameSymptomTypeOnPeople = (
  people: Person[],
  definitionId: string,
  oldLabel: string,
  newLabel: string,
): Person[] =>
  people.map((person) => {
    const events = person.events || [];
    if (!events.some((event) => event.sourceIndicatorId === definitionId)) return person;
    return {
      ...person,
      events: events.map((event) => {
        if (event.sourceIndicatorId !== definitionId) return event;
        const isSymptom = inferEventType(event) === 'SYMPTOM';
        return {
          ...event,
          ...(isSymptom ? { symptomType: newLabel } : {}),
          ...(sameName(event.subtype, oldLabel) ? { subtype: newLabel } : {}),
        };
      }),
    };
  });

/**
 * The delete step of a Settings category dialog (settings-02): refused with
 * an alert naming who still uses the category, otherwise asked for
 * confirmation. Returns true when the category may be deleted.
 */
export const confirmCategoryDelete = (
  name: string,
  usage: CategoryUsage,
  alertFn: (message: string) => void = (message) => window.alert(message),
  confirmFn: (message: string) => boolean = (message) => window.confirm(message),
): boolean => {
  const blocked = categoryInUseMessage(name, usage);
  if (blocked) {
    alertFn(blocked);
    return false;
  }
  return confirmFn(`Delete the category "${name}"?`);
};
