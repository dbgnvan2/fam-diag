/**
 * System events — the nodal events of the family system a person belongs to,
 * as opposed to the events that person owns or is a named party to.
 *
 * Purpose: collect a relative's events (a father's death, the parents'
 *          divorce, a son's birth, a sister's symptom onset, the family's own
 *          FAMILY/TRIANGLE events) and label them by relation, so one
 *          person's lane can be read against their system's shocks.
 * Spec:    docs/implementation_plan_2026-09-19.md#M7.C
 * Tests:   src/frontend/src/utils/systemEvents.test.ts
 *
 * The ring is the family scope (M1) — the active canvas focus when one is
 * set, its defaults otherwise (D10) — and the result is clipped to the
 * lifetime of the person whose lane it is (D11). No event-type filtering
 * happens anywhere here: symptom, nodal, EPE, FF, SIR and PAPERO events all
 * come through (D15).
 */
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  Partnership,
  Person,
} from '../types';
import type { FamilyScope } from './familyScope';
import {
  DISTANT_ANCESTOR_NOUN,
  DISTANT_DESCENDANT_NOUN,
  EVENT_PHRASES,
  OWN_UNION_NOUN,
  PARENTAL_UNION_NOUN,
  RELATION_NOUNS,
  SPOUSE_NOUNS,
  UNION_FORMATION_CATEGORIES,
  type RelationClass,
  type RelationGender,
} from '../constants/relationLabels';
import {
  synthesizeEmotionalLineDateEvents,
  synthesizePartnershipDateEvents,
  synthesizePersonDateEvents,
  synthesizePersonIndicatorEvents,
} from './syntheticDateEvents';

export type SystemEventOwnerType = 'person' | 'partnership' | 'emotional';

export type SystemEvent = {
  event: EmotionalProcessEvent;
  relationClass: RelationClass;
  relationLabel: string;
  ownerEntityType: SystemEventOwnerType;
  ownerEntityId: string;
  /** For a partnership owner: which array on it holds the event. */
  partnershipTarget?: 'events' | 'familyEvents';
};

export type SystemEventsResult = {
  events: SystemEvent[];
  /** Distinct relatives (people other than the lane person) contributing events. */
  relativeCount: number;
  /** Ids of those relatives, so several lanes can be unioned without double counting. */
  relativeIds: string[];
  /** False when the person has no birth date, so no lower bound was applied. */
  lifetimeFilterApplied: boolean;
};

const genderOf = (person?: Person): RelationGender => {
  const raw = (person?.birthSex || person?.gender || '').toString().toLowerCase();
  if (raw.startsWith('m') || raw === 'b') return 'male';
  if (raw.startsWith('f') || raw === 's' || raw === 'g') return 'female';
  return 'unknown';
};

const kinshipNoun = (generation: number, gender: RelationGender): string => {
  const row = RELATION_NOUNS[generation];
  if (row) return row[gender];
  return generation < 0 ? DISTANT_ANCESTOR_NOUN : DISTANT_DESCENDANT_NOUN;
};

const phraseFor = (event: EmotionalProcessEvent): string => {
  // A symptom's category is its group ("emotional"); the symptom itself is on
  // symptomType / subtype, which is what belongs in a lane label.
  if (event.eventType === 'SYMPTOM') {
    const symptom = (event.symptomType || event.subtype || '').trim();
    if (symptom) return symptom;
  }
  const category = (event.category || '').trim();
  return EVENT_PHRASES[category.toLowerCase()] || category || 'event';
};

/**
 * Purpose: "Father died", "Parents divorced", "Son born".
 * Spec:    docs/implementation_plan_2026-09-19.md#M7.C.3
 */
export const buildRelationLabel = (
  relationClass: RelationClass,
  noun: string,
  event: EmotionalProcessEvent
): string => {
  const phrase = phraseFor(event);
  if (relationClass === 'self') return event.category || phrase;
  return `${noun} ${phrase}`;
};

const eventDate = (event: EmotionalProcessEvent): string | undefined =>
  event.startDate || event.date || undefined;

const toTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const isUnionFormation = (event: EmotionalProcessEvent): boolean =>
  UNION_FORMATION_CATEGORIES.includes((event.category || '').trim().toLowerCase());

/**
 * Purpose: keep only the system events that overlap the lane person's
 *          lifetime, with one exception — the parental union's formation,
 *          which by construction precedes the person's birth (D11).
 * Spec:    docs/implementation_plan_2026-09-19.md#M7.D
 * Tests:   systemEvents.test.ts::test_m7d1_grandparent_death_before_birth_excluded
 */
export function clipToLifetime(
  systemEvents: SystemEvent[],
  person: Person,
  now: Date = new Date()
): { kept: SystemEvent[]; lifetimeFilterApplied: boolean } {
  const lower = toTimestamp(person.birthDate);
  if (lower == null) return { kept: systemEvents, lifetimeFilterApplied: false };
  const upper = toTimestamp(person.deathDate) ?? now.getTime();

  const kept = systemEvents.filter((entry) => {
    if (entry.relationClass === 'self') return true;
    if (entry.relationClass === 'parental' && isUnionFormation(entry.event)) return true;
    const start = toTimestamp(eventDate(entry.event));
    if (start == null) return false;
    const end = toTimestamp(entry.event.endDate) ?? start;
    // Overlap, not start-containment: a span that began before birth and ran
    // on into the person's life still belongs on the lane.
    return end >= lower && start <= upper;
  });
  return { kept, lifetimeFilterApplied: true };
}

type CollectArgs = {
  personId: string;
  scope: FamilyScope | null;
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines?: EmotionalLine[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  /** Skip the lifetime clip (used when a caller wants the raw ring). */
  clipLifetime?: boolean;
  now?: Date;
};

/**
 * Purpose: collect every event belonging to the person's family system,
 *          labelled by relation and deduplicated across relations.
 * Spec:    docs/implementation_plan_2026-09-19.md#M7.C.1
 * Tests:   systemEvents.test.ts::test_m7c1_returns_relation_class_and_label_per_event
 */
export function collectSystemEvents({
  personId,
  scope,
  people,
  partnerships,
  allEmotionalLines = [],
  functionalIndicatorDefinitions = [],
  clipLifetime = true,
  now,
}: CollectArgs): SystemEventsResult {
  const personById = new Map(people.map((entry) => [entry.id, entry]));
  const lanePerson = personById.get(personId);
  if (!lanePerson) {
    return { events: [], relativeCount: 0, relativeIds: [], lifetimeFilterApplied: false };
  }

  const inRing = (id?: string): boolean => {
    if (!id) return false;
    if (id === personId) return true;
    return scope ? scope.personIds.has(id) : false;
  };
  const generationOf = (id: string): number => {
    if (!scope) return id === personId ? 0 : 0;
    const laneGen = scope.generation.get(personId) ?? 0;
    return (scope.generation.get(id) ?? 0) - laneGen;
  };

  const collected: SystemEvent[] = [];
  // Dedup key is (owner, event) — never the event id alone, because
  // partnership events are cloned onto both partners with -p1 / -p2 suffixes
  // and synthetic ids are prefixed.
  const seen = new Set<string>();
  const relatives = new Set<string>();

  const push = (entry: SystemEvent) => {
    const key = `${entry.ownerEntityType}:${entry.ownerEntityId}:${entry.event.id}`;
    if (seen.has(key)) return;
    // The same underlying event reached through two relations appears once.
    const cloneKey = entry.event.id.replace(/-p[12]$/, '');
    const altKey = `${entry.ownerEntityType}:${entry.ownerEntityId}:${cloneKey}`;
    if (seen.has(altKey)) return;
    seen.add(key);
    seen.add(altKey);
    if (!eventDate(entry.event)) return;
    collected.push(entry);
    if (entry.ownerEntityType === 'person' && entry.ownerEntityId !== personId) {
      relatives.add(entry.ownerEntityId);
    }
  };

  const parentPartnershipIds = new Set(
    [lanePerson.parentPartnership, lanePerson.birthParentPartnership].filter(
      (id): id is string => !!id
    )
  );
  const ownPartnershipIds = new Set(lanePerson.partnerships || []);

  // ── People in the ring: own events + synthesized dates + indicators.
  people.forEach((relative) => {
    if (!inRing(relative.id)) return;
    const isSelf = relative.id === personId;
    const generation = generationOf(relative.id);
    const marriedIn = scope?.marriedIn.has(relative.id) ?? false;
    const isPartnerOfLanePerson =
      !isSelf &&
      (relative.partnerships || []).some((id) => ownPartnershipIds.has(id));

    let relationClass: RelationClass;
    let noun: string;
    if (isSelf) {
      relationClass = 'self';
      noun = '';
    } else if (isPartnerOfLanePerson) {
      relationClass = 'spousal';
      noun = SPOUSE_NOUNS[genderOf(relative)];
    } else if (generation < 0) {
      relationClass = 'ascendant';
      noun = kinshipNoun(generation, genderOf(relative));
    } else if (generation > 0) {
      relationClass = 'descendant';
      noun = kinshipNoun(generation, genderOf(relative));
    } else {
      relationClass = 'sibling';
      noun = marriedIn
        ? SPOUSE_NOUNS[genderOf(relative)]
        : kinshipNoun(0, genderOf(relative));
    }

    const ownEvents = [
      ...(relative.events || []),
      ...synthesizePersonDateEvents(relative),
      ...synthesizePersonIndicatorEvents(relative, functionalIndicatorDefinitions),
    ];
    ownEvents.forEach((event) => {
      push({
        event,
        relationClass,
        relationLabel: isSelf
          ? buildRelationLabel('self', '', event)
          : `${noun} ${phraseFor(event)}`.trim(),
        ownerEntityType: 'person',
        ownerEntityId: relative.id,
      });
    });
  });

  // ── Partnerships in the ring: PRL date events, relationship events and
  //    family-level events (FAMILY / TRIANGLE) — D16.
  partnerships.forEach((partnership) => {
    const bothInRing = inRing(partnership.partner1_id) && inRing(partnership.partner2_id);
    if (!bothInRing) return;
    const isOwn = ownPartnershipIds.has(partnership.id);
    const isParental = parentPartnershipIds.has(partnership.id);
    const partner1 = personById.get(partnership.partner1_id);
    const partner2 = personById.get(partnership.partner2_id);

    let relationClass: RelationClass;
    let noun: string;
    if (isOwn) {
      relationClass = 'union';
      noun = OWN_UNION_NOUN;
    } else if (isParental) {
      relationClass = 'parental';
      noun = PARENTAL_UNION_NOUN;
    } else {
      relationClass = 'union';
      noun = [partner1?.name, partner2?.name].filter(Boolean).join(' + ') || 'Family';
    }

    const dateEvents = synthesizePartnershipDateEvents(
      partnership,
      partner1?.name,
      partner2?.name
    );
    [...(partnership.events || []), ...dateEvents].forEach((event) => {
      push({
        event,
        relationClass,
        relationLabel: `${noun} ${phraseFor(event)}`.trim(),
        ownerEntityType: 'partnership',
        ownerEntityId: partnership.id,
        partnershipTarget: 'events',
      });
    });
    (partnership.familyEvents || []).forEach((event) => {
      const prefix = event.eventType === 'TRIANGLE' ? 'Triangle' : 'Family';
      push({
        event,
        relationClass,
        relationLabel: `${noun} · ${prefix}: ${event.category || prefix}`,
        ownerEntityType: 'partnership',
        ownerEntityId: partnership.id,
        partnershipTarget: 'familyEvents',
      });
    });
  });

  // ── Emotional pattern lines whose endpoints are both in the ring.
  allEmotionalLines.forEach((line) => {
    if (!inRing(line.person1_id) || !inRing(line.person2_id)) return;
    const involvesLanePerson = line.person1_id === personId || line.person2_id === personId;
    // The lane person's own EPLs are already rendered as spans by the
    // Timeline; only pull EPL events from patterns between relatives.
    if (involvesLanePerson) return;
    const p1 = personById.get(line.person1_id)?.name || '';
    const p2 = personById.get(line.person2_id)?.name || '';
    const pairLabel = [p1, p2].filter(Boolean).join(' ↔ ') || 'Pattern';
    const dateEvents = synthesizeEmotionalLineDateEvents(line, p1, p2);
    [...(line.events || []), ...dateEvents].forEach((event) => {
      push({
        event,
        relationClass: 'sibling',
        relationLabel: `${pairLabel} · ${event.category || line.relationshipType}`,
        ownerEntityType: 'emotional',
        ownerEntityId: line.id,
      });
    });
  });

  const nonSelf = collected.filter((entry) => entry.relationClass !== 'self');
  if (!clipLifetime) {
    return {
      events: nonSelf,
      relativeCount: relatives.size,
      relativeIds: [...relatives],
      lifetimeFilterApplied: false,
    };
  }

  const { kept, lifetimeFilterApplied } = clipToLifetime(nonSelf, lanePerson, now);
  const keptRelatives = new Set<string>();
  kept.forEach((entry) => {
    if (entry.ownerEntityType === 'person') {
      if (entry.ownerEntityId !== personId) keptRelatives.add(entry.ownerEntityId);
      return;
    }
    if (entry.ownerEntityType === 'partnership') {
      const partnership = partnerships.find((item) => item.id === entry.ownerEntityId);
      [partnership?.partner1_id, partnership?.partner2_id].forEach((id) => {
        if (id && id !== personId) keptRelatives.add(id);
      });
      return;
    }
    const line = allEmotionalLines.find((item) => item.id === entry.ownerEntityId);
    [line?.person1_id, line?.person2_id].forEach((id) => {
      if (id && id !== personId) keptRelatives.add(id);
    });
  });
  return {
    events: kept,
    relativeCount: keptRelatives.size,
    relativeIds: [...keptRelatives],
    lifetimeFilterApplied,
  };
}
