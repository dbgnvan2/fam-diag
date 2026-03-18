/**
 * Data normalization utilities — extracted from DiagramEditor.tsx.
 * Handles functional indicator sanitization, event normalization,
 * name/gender inference, and imported layout adjustment.
 */

import type {
  Person,
  Partnership,
  FunctionalIndicatorDefinition,
  EmotionalProcessEvent,
  EventClass,
  GenderSymbol,
  BirthSex,
  GenderIdentity,
} from '../types';

// ---------------------------------------------------------------------------
// Functional indicator sanitization
// ---------------------------------------------------------------------------

const buildAllowedIndicatorSet = (defs: FunctionalIndicatorDefinition[]) =>
  new Set(defs.map((def) => def.id));

const sanitizePersonIndicatorsWithSet = (person: Person, allowed: Set<string>) => {
  if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
    return person;
  }
  const filtered = person.functionalIndicators.filter((entry) => allowed.has(entry.definitionId));
  if (filtered.length === person.functionalIndicators.length) {
    return person;
  }
  const updated: Person = { ...person };
  if (filtered.length) {
    updated.functionalIndicators = filtered;
  } else {
    delete (updated as any).functionalIndicators;
  }
  return updated;
};

export const sanitizePeopleIndicators = (
  peopleList: Person[],
  defs: FunctionalIndicatorDefinition[]
) => {
  if (!peopleList.length) return peopleList;
  const allowed = buildAllowedIndicatorSet(defs);
  if (allowed.size === 0) {
    let changed = false;
    const next = peopleList.map((person) => {
      if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
        return person;
      }
      changed = true;
      const updated = { ...person };
      delete (updated as any).functionalIndicators;
      return updated;
    });
    return changed ? next : peopleList;
  }
  let changed = false;
  const next = peopleList.map((person) => {
    const sanitized = sanitizePersonIndicatorsWithSet(person, allowed);
    if (sanitized !== person) {
      changed = true;
    }
    return sanitized;
  });
  return changed ? next : peopleList;
};

export const sanitizeSinglePersonIndicators = (
  person: Person,
  defs: FunctionalIndicatorDefinition[]
) => {
  const allowed = buildAllowedIndicatorSet(defs);
  return sanitizePersonIndicatorsWithSet(person, allowed);
};

// ---------------------------------------------------------------------------
// Event normalization
// ---------------------------------------------------------------------------

export const parseIsoDateToTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

export const normalizeEventList = (
  events: EmotionalProcessEvent[] | undefined,
  fallbackClass: EventClass
): EmotionalProcessEvent[] | undefined =>
  events
    ? events.map((event) => ({
        ...event,
        statusLabel: event.statusLabel ?? '',
        eventClass: event.eventClass || fallbackClass,
      }))
    : undefined;

export const attachEventClassToEntities = <T extends { events?: EmotionalProcessEvent[] }>(
  entities: T[],
  fallbackClass: EventClass
): T[] =>
  entities.map((entity) => ({
    ...entity,
    events: normalizeEventList(entity.events, fallbackClass),
  }));

// ---------------------------------------------------------------------------
// Name / gender inference
// ---------------------------------------------------------------------------

export const sentenceCaseName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const GENDER_NAME_OVERRIDES: Record<string, Person['gender']> = {
  don: 'male',
  donald: 'male',
  jim: 'male',
  john: 'male',
  brian: 'male',
  michael: 'male',
  richard: 'male',
  joseph: 'male',
  mark: 'male',
  matthew: 'male',
  peter: 'male',
  rick: 'male',
  mimi: 'female',
  margaret: 'female',
  mary: 'female',
  jean: 'female',
  kathy: 'female',
  nancy: 'female',
  noni: 'female',
  betty: 'female',
};

export const GENDER_SYMBOL_OPTIONS: Array<{
  label: string;
  symbol: GenderSymbol;
  birthSex: BirthSex;
  genderIdentity: GenderIdentity;
}> = [
  { label: 'Female × Feminine (Cis)', symbol: 'female_cis', birthSex: 'female', genderIdentity: 'feminine' },
  { label: 'Female × Masculine', symbol: 'female_trans', birthSex: 'female', genderIdentity: 'masculine' },
  { label: 'Female × Non-Binary', symbol: 'nonbinary', birthSex: 'female', genderIdentity: 'nonbinary' },
  { label: 'Female × Agender', symbol: 'agender', birthSex: 'female', genderIdentity: 'agender' },
  { label: 'Male × Feminine', symbol: 'female_trans', birthSex: 'male', genderIdentity: 'feminine' },
  { label: 'Male × Masculine (Cis)', symbol: 'male_cis', birthSex: 'male', genderIdentity: 'masculine' },
  { label: 'Male × Non-Binary', symbol: 'nonbinary', birthSex: 'male', genderIdentity: 'nonbinary' },
  { label: 'Male × Agender', symbol: 'agender', birthSex: 'male', genderIdentity: 'agender' },
  { label: 'Intersex × Feminine', symbol: 'intersex_feminine', birthSex: 'intersex', genderIdentity: 'feminine' },
  { label: 'Intersex × Masculine', symbol: 'intersex_masculine', birthSex: 'intersex', genderIdentity: 'masculine' },
  { label: 'Intersex × Non-Binary', symbol: 'intersex_nonbinary', birthSex: 'intersex', genderIdentity: 'nonbinary' },
  { label: 'Intersex × Agender', symbol: 'intersex_agender', birthSex: 'intersex', genderIdentity: 'agender' },
];

export const inferGenderFromName = (value: string): Person['gender'] | undefined => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  const first = normalized.split(/\s+/)[0];
  if (GENDER_NAME_OVERRIDES[first]) return GENDER_NAME_OVERRIDES[first];
  if (GENDER_NAME_OVERRIDES[normalized]) return GENDER_NAME_OVERRIDES[normalized];
  return undefined;
};

export const findLikelyExistingPerson = (
  peopleByName: Map<string, Person>,
  normalizedName: string
): Person | undefined => {
  const exact = peopleByName.get(normalizedName);
  if (exact) return exact;

  const normalized = normalizedName.trim().toLowerCase();
  if (!normalized) return undefined;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const all = [...peopleByName.values()];

  if (tokens.length === 1) {
    const first = tokens[0];
    const matches = all.filter(
      (person) => (person.firstName || person.name || '').trim().toLowerCase() === first
    );
    if (matches.length === 1) return matches[0];
  }

  const phraseMatches = all.filter((person) => {
    const existing = (person.name || '').trim().toLowerCase();
    if (!existing) return false;
    return existing.startsWith(`${normalized} `) || normalized.startsWith(`${existing} `);
  });
  if (phraseMatches.length === 1) return phraseMatches[0];

  return undefined;
};

// ---------------------------------------------------------------------------
// Imported layout normalization
// ---------------------------------------------------------------------------

type NormalizeImportedLayoutOptions = {
  expandParentSpan?: boolean;
  autoResizeDenseFamilies?: boolean;
};

export const normalizeImportedChildLayout = (
  people: Person[],
  partnerships: Partnership[],
  options?: NormalizeImportedLayoutOptions
): Person[] => {
  if (!people.length || !partnerships.length) return people;

  const expandParentSpan = options?.expandParentSpan ?? false;
  const autoResizeDenseFamilies = options?.autoResizeDenseFamilies ?? false;
  const personById = new Map(people.map((person) => [person.id, person]));
  const updates = new Map<string, Person>();

  const getEditablePerson = (id: string) => {
    const existing = updates.get(id);
    if (existing) return existing;
    const base = personById.get(id);
    if (!base) return null;
    const clone = { ...base };
    updates.set(id, clone);
    return clone;
  };
  const getCurrentPerson = (id: string) => updates.get(id) || personById.get(id) || null;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));
  const targetChildSize = (count: number) => {
    if (count >= 12) return 42;
    if (count >= 10) return 46;
    if (count >= 8) return 50;
    if (count >= 6) return 54;
    return 60;
  };
  const targetPartnerSize = (childCount: number) => {
    const childSize = targetChildSize(childCount);
    return Math.max(46, childSize + 6);
  };

  const enforceChildSpouseSequence = () => {
    partnerships.forEach((parentPartnership) => {
      const children = (parentPartnership.children || [])
        .map((childId) => getCurrentPerson(childId))
        .filter((person): person is Person => Boolean(person))
        .filter((person) => person.parentPartnership === parentPartnership.id)
        .sort((a, b) => a.x - b.x);
      if (!children.length) return;

      children.forEach((child, index) => {
        const childEditable = getEditablePerson(child.id);
        if (!childEditable) return;

        const spousePartnership = partnerships.find(
          (candidate) =>
            candidate.id !== parentPartnership.id &&
            (candidate.partner1_id === child.id || candidate.partner2_id === child.id)
        );
        if (!spousePartnership) return;

        const spouseId =
          spousePartnership.partner1_id === child.id
            ? spousePartnership.partner2_id
            : spousePartnership.partner1_id;
        const spouse = getCurrentPerson(spouseId);
        const spouseEditable = getEditablePerson(spouseId);
        if (!spouse || !spouseEditable) return;

        const prev = index > 0 ? children[index - 1] : null;
        const next = index < children.length - 1 ? children[index + 1] : null;
        const distPrev = prev ? Math.abs(child.x - prev.x) : Number.POSITIVE_INFINITY;
        const distNext = next ? Math.abs(next.x - child.x) : Number.POSITIVE_INFINITY;
        const nearestSiblingDistance = Math.min(distPrev, distNext);
        const preferredGap = 56;
        const maxGapFromSibling = Number.isFinite(nearestSiblingDistance)
          ? Math.max(26, nearestSiblingDistance * 0.45)
          : preferredGap;
        const gap = Math.min(preferredGap, maxGapFromSibling);

        let direction = 1;
        if (childEditable.gender === 'female' && spouseEditable.gender === 'male') direction = -1;
        if (childEditable.gender === 'male' && spouseEditable.gender === 'female') direction = 1;

        let targetX = childEditable.x + direction * gap;
        if (direction > 0 && next) {
          const hardMax = childEditable.x + Math.max(24, (next.x - childEditable.x) * 0.45);
          targetX = Math.min(targetX, hardMax);
        }
        if (direction < 0 && prev) {
          const hardMin = childEditable.x - Math.max(24, (childEditable.x - prev.x) * 0.45);
          targetX = Math.max(targetX, hardMin);
        }

        spouseEditable.x = targetX;
        spouseEditable.y = childEditable.y;
        const sharedSize = Math.min(childEditable.size ?? 60, spouseEditable.size ?? 60);
        childEditable.size = sharedSize;
        spouseEditable.size = sharedSize;
        spousePartnership.horizontalConnectorY = Math.max(childEditable.y, spouseEditable.y) + 60;
      });
    });
  };

  partnerships.forEach((partnership, partnershipIndex) => {
    const partner1Base = personById.get(partnership.partner1_id);
    const partner2Base = personById.get(partnership.partner2_id);
    if (!partner1Base || !partner2Base) return;

    const partner1Editable = getEditablePerson(partnership.partner1_id);
    const partner2Editable = getEditablePerson(partnership.partner2_id);
    if (partner1Editable && partner2Editable) {
      // Imported couples should share the same baseline to produce the expected U-shaped PRL.
      const alignedY = Math.min(partner1Editable.y, partner2Editable.y);
      partner1Editable.y = alignedY;
      partner2Editable.y = alignedY;
      const p1Size = partner1Editable.size ?? 60;
      const p2Size = partner2Editable.size ?? 60;
      const matchedPartnerSize = Math.min(p1Size, p2Size);
      partner1Editable.size = matchedPartnerSize;
      partner2Editable.size = matchedPartnerSize;

      // Rule: male left, female right for partnerships when both genders are known.
      if (partner1Editable.gender === 'female' && partner2Editable.gender === 'male') {
        const leftX = Math.min(partner1Editable.x, partner2Editable.x);
        const rightX = Math.max(partner1Editable.x, partner2Editable.x);
        partner2Editable.x = leftX;
        partner1Editable.x = rightX;
      } else if (partner1Editable.gender === 'male' && partner2Editable.gender === 'female') {
        const leftX = Math.min(partner1Editable.x, partner2Editable.x);
        const rightX = Math.max(partner1Editable.x, partner2Editable.x);
        partner1Editable.x = leftX;
        partner2Editable.x = rightX;
      }
    }

    const children = (partnership.children || [])
      .map((childId) => personById.get(childId))
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.parentPartnership === partnership.id);
    if (children.length === 0) return;

    if (partner1Editable && partner2Editable) {
      const hasChildPartner = Boolean(partner1Base.parentPartnership || partner2Base.parentPartnership);
      if (hasChildPartner) {
        const stagger = (partnershipIndex % 3) * 14;
        partner1Editable.y += stagger;
        partner2Editable.y += stagger;
        partnership.horizontalConnectorY = Math.max(partner1Editable.y, partner2Editable.y) + 60;
      }
    }

    if (autoResizeDenseFamilies) {
      const desiredSize = targetChildSize(children.length);
      const currentPartnerSize = Math.min(partner1Editable?.size ?? 60, partner2Editable?.size ?? 60);
      const maxChildSize = Math.max(36, currentPartnerSize - 6);
      const childSize = Math.min(desiredSize, maxChildSize);
      children.forEach((child) => {
        const editable = getEditablePerson(child.id);
        if (!editable) return;
        const currentSize = editable.size ?? 60;
        editable.size = Math.min(currentSize, childSize);
      });
      if (children.length >= 6) {
        const desiredPartnerSize = targetPartnerSize(children.length);
        const editableP1 = getEditablePerson(partnership.partner1_id);
        const editableP2 = getEditablePerson(partnership.partner2_id);
        if (editableP1) {
          const p1Current = editableP1.size ?? 60;
          editableP1.size = Math.min(p1Current, desiredPartnerSize);
        }
        if (editableP2) {
          const p2Current = editableP2.size ?? 60;
          editableP2.size = Math.min(p2Current, desiredPartnerSize);
        }
        if (editableP1 && editableP2) {
          const syncedPartnerSize = Math.min(editableP1.size ?? 60, editableP2.size ?? 60);
          editableP1.size = syncedPartnerSize;
          editableP2.size = syncedPartnerSize;
        }
      }
    }

    const partner1 = getEditablePerson(partnership.partner1_id);
    const partner2 = getEditablePerson(partnership.partner2_id);
    if (!partner1 || !partner2) return;

    if (expandParentSpan && children.length > 1) {
      const childMin = Math.min(...children.map((child) => child.x));
      const childMax = Math.max(...children.map((child) => child.x));
      const desiredSpan = Math.max(200, childMax - childMin + 80);
      const currentSpan = Math.abs(partner2.x - partner1.x);
      if (currentSpan < desiredSpan) {
        const center = (childMin + childMax) / 2;
        const leftX = center - desiredSpan / 2;
        const rightX = center + desiredSpan / 2;
        if (partner1.x <= partner2.x) {
          partner1.x = leftX;
          partner2.x = rightX;
        } else {
          partner1.x = rightX;
          partner2.x = leftX;
        }
      }
    }

    const minX = Math.min(partner1.x, partner2.x);
    const maxX = Math.max(partner1.x, partner2.x);
    if (maxX <= minX) return;

    const groups = new Map<string, Person[]>();
    children.forEach((child) => {
      const key = (child as any).multipleBirthGroupId || `single:${child.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(child);
      } else {
        groups.set(key, [child]);
      }
    });

    const orderedGroups = [...groups.values()]
      .map((members) => ({
        members,
        center: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      }))
      .sort((a, b) => a.center - b.center);

    const count = orderedGroups.length;
    orderedGroups.forEach((group, index) => {
      const anchor =
        count === 1 ? (minX + maxX) / 2 : minX + (index * (maxX - minX)) / (count - 1);
      group.members.forEach((member) => {
        const editable = getEditablePerson(member.id);
        if (!editable) return;
        const clampedAnchor = clamp(anchor, minX, maxX);
        editable.x = clampedAnchor;
        if ((editable as any).multipleBirthGroupId) {
          (editable as any).connectionAnchorX = clampedAnchor;
        } else if ((editable as any).connectionAnchorX !== undefined) {
          delete (editable as any).connectionAnchorX;
        }
      });
    });
  });

  enforceChildSpouseSequence();

  // Resolve person-to-person overlaps after anchor and resize adjustments.
  const overlapPasses = 6;
  for (let pass = 0; pass < overlapPasses; pass += 1) {
    const currentPeople = people
      .map((person) => getCurrentPerson(person.id))
      .filter((person): person is Person => Boolean(person))
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    let moved = false;
    for (let i = 0; i < currentPeople.length; i += 1) {
      const a = currentPeople[i];
      const aW = (a.size ?? 60) + 36;
      const aH = (a.size ?? 60) + 44;
      for (let j = i + 1; j < currentPeople.length; j += 1) {
        const b = currentPeople[j];
        const bW = (b.size ?? 60) + 36;
        const bH = (b.size ?? 60) + 44;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = aW / 2 + bW / 2 - Math.abs(dx);
        const overlapY = aH / 2 + bH / 2 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        const shift = overlapX + 18;
        const target = getEditablePerson(b.id);
        if (!target) continue;
        target.x = target.x + shift;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Keep child anchors in sync after overlap shifts and assign partnership note positions.
  const occupiedNoteRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const noteIntersects = (x: number, y: number, w: number, h: number) =>
    occupiedNoteRects.some(
      (rect) =>
        x < rect.x + rect.w &&
        x + w > rect.x &&
        y < rect.y + rect.h &&
        y + h > rect.y
    );

  partnerships.forEach((partnership) => {
    const partner1 = getCurrentPerson(partnership.partner1_id);
    const partner2 = getCurrentPerson(partnership.partner2_id);
    if (!partner1 || !partner2) return;
    const minX = Math.min(partner1.x, partner2.x);
    const maxX = Math.max(partner1.x, partner2.x);
    const children = (partnership.children || [])
      .map((childId) => getCurrentPerson(childId))
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.parentPartnership === partnership.id);
    children.forEach((child) => {
      const editable = getEditablePerson(child.id);
      if (!editable) return;
      if ((editable as any).multipleBirthGroupId && typeof (child as any).connectionAnchorX === 'number') {
        const clamped = clamp((child as any).connectionAnchorX, minX, maxX);
        (editable as any).connectionAnchorX = clamped;
        editable.x = clamped;
      } else if ((editable as any).connectionAnchorX !== undefined) {
        delete (editable as any).connectionAnchorX;
      }
    });

    if (!partnership.notes || (partnership as any).notesPosition) return;
    const noteWidth = 260;
    const noteHeight = 96;
    let noteX = (partner1.x + partner2.x) / 2 + 24;
    let noteY = partnership.horizontalConnectorY + 88;
    for (let tries = 0; tries < 20; tries += 1) {
      const intersectsPerson = people.some((p) => {
        const current = getCurrentPerson(p.id);
        if (!current) return false;
        const w = (current.size ?? 60) + 30;
        const h = (current.size ?? 60) + 36;
        const px = current.x - w / 2;
        const py = current.y - h / 2;
        return (
          noteX < px + w &&
          noteX + noteWidth > px &&
          noteY < py + h &&
          noteY + noteHeight > py
        );
      });
      if (!intersectsPerson && !noteIntersects(noteX, noteY, noteWidth, noteHeight)) {
        (partnership as any).notesPosition = { x: noteX, y: noteY };
        occupiedNoteRects.push({ x: noteX, y: noteY, w: noteWidth, h: noteHeight });
        break;
      }
      noteY += 28;
      noteX += 18;
    }
  });

  enforceChildSpouseSequence();

  if (updates.size === 0) return people;
  return people.map((person) => updates.get(person.id) || person);
};
