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
import { computeFamilyScope, defaultFocusForRoot, type FamilyScope } from './familyScope';
import {
  DISTANT_ANCESTOR_NOUN,
  DISTANT_DESCENDANT_NOUN,
  COLLATERAL_NOUNS,
  DISTANT_BLOOD_NOUN,
  DISTANT_IN_LAW_NOUN,
  RELATIVE_SPOUSE_NOUNS,
  SPOUSE_ANCESTOR_NOUNS,
  SPOUSE_DESCENDANT_NOUNS,
  SPOUSE_SIBLING_NOUNS,
  EVENT_PHRASES,
  PARENTAL_UNION_NOUN,
  RELATION_NOUNS,
  SPOUSE_NOUNS,
  UNION_FORMATION_CATEGORIES,
  type RelationClass,
  type RelationGender,
} from '../constants/relationLabels';
import { baseEventId, hasSameEvent } from './eventDedup';
import { withoutPersonDateRecords } from './personDateEvents';
import { withoutPartnershipStatusRecords } from './partnershipStatusEvents';
import { withoutPatternEditRecords } from './patternEventRecords';
import { eventDisplayName } from './timelineItemText';
import { computeBloodPaths, computeKinRoutes, type BloodPath, type KinRoute } from './kinship';
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
  /** The kinship noun alone ("Grandson", "Father", "Parents"). */
  relationNoun: string;
  /** Display name of the entity the event belongs to. */
  ownerName: string;
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
  /** Events in the ring that carry no usable date and could not be placed. */
  undatedDropped: number;
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

/**
 * The noun for a blood relative, from the shape of the path to them. The
 * direct line is named by generation (Father, Grandson); everyone else by how
 * far up the shared ancestor is and how far back down (Uncle, Cousin). Keyed
 * on generation alone, an uncle one generation up read as "Father".
 */
const bloodNoun = (
  path: BloodPath | undefined,
  generation: number,
  gender: RelationGender
): string => {
  if (!path) return kinshipNoun(generation, gender);
  const { ups, downs } = path;
  if (downs === 0) return kinshipNoun(-ups, gender); // direct ancestor
  if (ups === 0) return kinshipNoun(downs, gender); // direct descendant
  const row = COLLATERAL_NOUNS[`${ups},${downs}`];
  return row ? row[gender] : DISTANT_BLOOD_NOUN;
};

/**
 * The noun for someone related by marriage. The route decides the family of
 * terms and the generation picks the word; anything without an everyday term
 * is a "relative by marriage" rather than a guess.
 */
const marriageNoun = (route: KinRoute, generation: number, gender: RelationGender): string => {
  const table =
    route === 'ownSpouseUp'
      ? SPOUSE_ANCESTOR_NOUNS
      : route === 'ownSpouseDown'
      ? SPOUSE_DESCENDANT_NOUNS
      : route === 'ownSpouseSide'
      ? SPOUSE_SIBLING_NOUNS
      : route === 'relativeSpouse'
      ? RELATIVE_SPOUSE_NOUNS
      : null;
  const row = table?.[generation];
  return row ? row[gender] : DISTANT_IN_LAW_NOUN;
};

const phraseFor = (event: EmotionalProcessEvent): string => {
  // A symptom's category is its group ("emotional"); the symptom itself is on
  // symptomType / subtype. eventDisplayName owns that rule so the lane label
  // and the hover bubble cannot disagree.
  const name = eventDisplayName(event, '');
  const category = (event.category || '').trim();
  if (name && name !== category) return name;
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
    return {
      events: [],
      relativeCount: 0,
      relativeIds: [],
      undatedDropped: 0,
      lifetimeFilterApplied: false,
    };
  }

  // D10: the ring follows the active canvas focus when there is one, and uses
  // the same defaults otherwise. Without this the feature is inert until the
  // user happens to set a focus, and the UI reports "0 system events" — which
  // reads as "this family has none" rather than "nothing was looked for".
  const ring =
    scope ?? computeFamilyScope(people, partnerships, personId, defaultFocusForRoot(personId));

  // How each person is related to the lane: by birth, as a relative's spouse,
  // or as a spouse's relative. The term depends on where the marriage is
  // crossed, which a single married-in flag cannot express.
  const bloodIds = new Set(
    [...ring.personIds].filter((id) => !ring.marriedIn.has(id))
  );
  const kinRoutes = computeKinRoutes(people, partnerships, personId, bloodIds);
  const bloodPaths = computeBloodPaths(people, partnerships, personId, bloodIds);

  const inRing = (id?: string): boolean => {
    if (!id) return false;
    if (id === personId) return true;
    return ring.personIds.has(id);
  };
  const generationOf = (id: string): number => {
    const laneGen = ring.generation.get(personId) ?? 0;
    return (ring.generation.get(id) ?? 0) - laneGen;
  };

  const collected: SystemEvent[] = [];
  // Dedup key is (owner, event) — never the event id alone, because
  // partnership events are cloned onto both partners with -p1 / -p2 suffixes
  // and synthetic ids are prefixed.
  const seen = new Set<string>();
  const relatives = new Set<string>();
  // Events with no usable date cannot be placed on a timeline. They are
  // dropped, but never silently — the count is reported (P2).
  let undatedDropped = 0;

  // A partnership event is cloned onto both partners. If the lane person
  // already holds this event — as their own clone or as the original — it is
  // their event, not a relative's, and listing the partner's copy as a system
  // event showed the same marriage twice.
  const lanePersonEventIds = new Set((lanePerson.events || []).map((entry) => entry.id));

  const push = (entry: SystemEvent) => {
    if (hasSameEvent(entry.event.id, lanePersonEventIds)) return;
    // Test the date BEFORE reserving the dedup key: an undated reach must not
    // burn the key and lock the event out of every other relation.
    if (!eventDate(entry.event)) {
      undatedDropped += 1;
      return;
    }
    const key = `${entry.ownerEntityType}:${entry.ownerEntityId}:${entry.event.id}`;
    if (seen.has(key)) return;
    // The same underlying event reached through two relations appears once.
    const altKey = `${entry.ownerEntityType}:${entry.ownerEntityId}:${baseEventId(entry.event.id)}`;
    if (seen.has(altKey)) return;
    seen.add(key);
    seen.add(altKey);
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
    const marriedIn = ring.marriedIn.has(relative.id);
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
    } else {
      relationClass = generation < 0 ? 'ascendant' : generation > 0 ? 'descendant' : 'sibling';
      const route = kinRoutes.get(relative.id) ?? (marriedIn ? 'distant' : 'blood');
      noun =
        route === 'blood'
          ? bloodNoun(bloodPaths.get(relative.id), generation, genderOf(relative))
          : marriageNoun(route, generation, genderOf(relative));
    }

    const ownEvents = [
      ...withoutPersonDateRecords(relative.events || []),
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
        relationNoun: noun,
        ownerName: relative.name || 'Unnamed',
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
    // The lane person's OWN partnerships are their own events, not the
    // system's. Both consumers already list them directly, so emitting them
    // here rendered every marriage and family event twice.
    if (ownPartnershipIds.has(partnership.id)) return;
    const isParental = parentPartnershipIds.has(partnership.id);
    const partner1 = personById.get(partnership.partner1_id);
    const partner2 = personById.get(partnership.partner2_id);

    let relationClass: RelationClass;
    let noun: string;
    if (isParental) {
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
    [
      ...withoutPartnershipStatusRecords(partnership.events || [], partnership),
      ...dateEvents,
    ].forEach((event) => {
      push({
        event,
        relationClass,
        relationLabel: `${noun} ${phraseFor(event)}`.trim(),
        relationNoun: noun,
        ownerName: [partner1?.name, partner2?.name].filter(Boolean).join(' + ') || 'Family',
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
        relationNoun: noun,
        ownerName: [partner1?.name, partner2?.name].filter(Boolean).join(' + ') || 'Family',
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
    [...withoutPatternEditRecords(line.events || []), ...dateEvents].forEach((event) => {
      push({
        event,
        relationClass: 'sibling',
        relationLabel: `${pairLabel} · ${event.category || line.relationshipType}`,
        relationNoun: line.relationshipType,
        ownerName: pairLabel,
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
      undatedDropped,
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
    undatedDropped,
    lifetimeFilterApplied,
  };
}
