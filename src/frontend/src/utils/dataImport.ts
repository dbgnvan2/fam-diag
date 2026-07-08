/**
 * Data import utilities — extracted from DiagramEditor.tsx.
 * Handles transcript parsing, type guards for import formats,
 * relationship normalization, and facts-to-diagram conversion.
 */

import { nanoid } from 'nanoid';
import type { Person, Partnership, EmotionalLine } from '../types';
import type {
  DiagramImportData,
  FactsImportData,
  SessionCaptureImportData,
} from '../types/diagramEditor';
import { DEFAULT_LINE_COLOR } from './emotionalPatternOptions';
import {
  sentenceCaseName,
  inferGenderFromName,
  findLikelyExistingPerson,
  normalizeImportedChildLayout,
} from './dataNormalization';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export const isDiagramImportData = (data: unknown): data is DiagramImportData => {
  const typed = data as DiagramImportData;
  return (
    !!typed &&
    Array.isArray(typed.people) &&
    Array.isArray(typed.partnerships) &&
    Array.isArray(typed.emotionalLines)
  );
};

export const isFactsImportData = (data: unknown): data is FactsImportData => {
  const typed = data as FactsImportData;
  return !!typed && typeof typed === 'object' && (Array.isArray(typed.relationships) || !!typed.family);
};

export const isSessionCaptureImportData = (data: unknown): data is SessionCaptureImportData => {
  if (!data || typeof data !== 'object') return false;
  const raw = data as SessionCaptureImportData;
  if (raw.kind !== 'fam-diag-session-capture' || raw.version !== 1) return false;
  if (!Array.isArray(raw.operations)) return false;
  return raw.operations.every(
    (operation) => operation && typeof operation.id === 'string' && typeof operation.type === 'string'
  );
};

// ---------------------------------------------------------------------------
// Relationship normalization
// ---------------------------------------------------------------------------

export const normalizeRelationshipType = (value?: string): Partnership['relationshipType'] => {
  const raw = (value || '').toLowerCase();
  if (raw.includes('married')) return 'married';
  if (raw.includes('engag')) return 'engaged';
  if (raw.includes('common')) return 'common-law';
  if (raw.includes('living')) return 'living-together';
  if (raw.includes('dating')) return 'dating';
  if (raw.includes('affair')) return 'affair';
  if (raw.includes('friend')) return 'friendship';
  return 'dating';
};

export const normalizeRelationshipStatus = (value?: string): Partnership['relationshipStatus'] => {
  const raw = (value || '').toLowerCase();
  if (raw.includes('divorc')) return 'divorce';
  if (raw.includes('end')) return 'ended';
  if (raw.includes('separat')) return 'separated';
  if (raw.includes('widow')) return 'widowed';
  if (raw.includes('ongoing')) return 'ongoing';
  if (raw.includes('start')) return 'start';
  return 'married';
};

// ---------------------------------------------------------------------------
// Transcript → draft diagram
// ---------------------------------------------------------------------------

export const parseTranscriptToDraftDiagram = (
  transcript: string,
  sourceFileName: string
): DiagramImportData => {
  const peopleByName = new Map<string, Person>();
  const partnershipsByKey = new Map<
    string,
    {
      id: string;
      partner1: string;
      partner2: string;
      relationshipType: Partnership['relationshipType'];
      relationshipStatus: Partnership['relationshipStatus'];
      relationshipStartDate?: string;
      notes?: string;
      children: string[];
    }
  >();
  const personNotes = new Map<string, string[]>();
  const diagnosedSchizophrenia = new Set<string>();
  const parentCouples: Array<{ parent1: string; parent2: string; childCount: number }> = [];
  const coupleChildrenMentions = new Map<string, number>();
  const deceasedNames = new Set<string>();
  const emotionalLineDrafts = new Map<
    string,
    {
      person1: string;
      person2: string;
      relationshipType: EmotionalLine['relationshipType'];
      lineStyle: EmotionalLine['lineStyle'];
      lineEnding: EmotionalLine['lineEnding'];
      notes: string;
    }
  >();

  const getPerson = (raw: string) => {
    const normalized = sentenceCaseName(raw);
    const existing = findLikelyExistingPerson(peopleByName, normalized);
    if (existing) return existing;
    const next: Person = {
      id: nanoid(),
      name: normalized,
      firstName: normalized.split(/\s+/)[0],
      lastName: normalized.split(/\s+/).slice(1).join(' ') || undefined,
      x: 0,
      y: 0,
      gender: inferGenderFromName(normalized) || 'female',
      partnerships: [],
      events: [],
    };
    peopleByName.set(normalized, next);
    return next;
  };

  const addPartnership = (
    personA: string,
    personB: string,
    relationshipType: Partnership['relationshipType'] = 'married',
    relationshipStatus: Partnership['relationshipStatus'] = 'married',
    relationshipStartDate?: string,
    note?: string
  ) => {
    const a = getPerson(personA);
    const b = getPerson(personB);
    const pair = [a.name, b.name].sort();
    const key = pair.join('::');
    const existing = partnershipsByKey.get(key);
    if (existing) {
      if (note) {
        existing.notes = existing.notes ? `${existing.notes} ${note}` : note;
      }
      if (relationshipStartDate && !existing.relationshipStartDate) {
        existing.relationshipStartDate = relationshipStartDate;
      }
      return existing.id;
    }
    const id = nanoid();
    partnershipsByKey.set(key, {
      id,
      partner1: pair[0],
      partner2: pair[1],
      relationshipType,
      relationshipStatus,
      relationshipStartDate,
      notes: note,
      children: [],
    });
    return id;
  };

  const addNote = (name: string, note: string) => {
    const person = getPerson(name);
    const notes = personNotes.get(person.name) || [];
    notes.push(note);
    personNotes.set(person.name, notes);
  };

  const addEmotionalPatternDraft = (
    personA: string,
    personB: string,
    relationshipType: EmotionalLine['relationshipType'],
    notes: string
  ) => {
    const a = getPerson(personA);
    const b = getPerson(personB);
    const directional = relationshipType === 'projection' || relationshipType === 'open-connection';
    const key = directional
      ? `${a.name}->${b.name}::${relationshipType}`
      : [[a.name, b.name].sort().join('::'), relationshipType].join('::');
    if (emotionalLineDrafts.has(key)) return;
    const styleMap: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle']> = {
      fusion: 'fusion-solid-wide',
      distance: 'distance-dashed-wide',
      cutoff: 'cutoff',
      conflict: 'conflict-dotted-wide',
      projection: 'projection-3',
      'open-connection': 'open-connection-3',
    };
    emotionalLineDrafts.set(key, {
      person1: a.name,
      person2: b.name,
      relationshipType,
      lineStyle: styleMap[relationshipType],
      lineEnding: 'none',
      notes,
    });
  };

  const marryPattern = /\b([A-Z][a-z]+)\s+(?:did\s+)?marry(?:\s+to)?\s+([A-Z][a-z]+)\b/g;
  for (const match of transcript.matchAll(marryPattern)) {
    addPartnership(match[1], match[2], 'married', 'married');
  }

  const couplePattern = /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,120}\bmarried(?:\s+in\s+(\d{4}))?/gi;
  for (const match of transcript.matchAll(couplePattern)) {
    const year = match[3] ? `${match[3]}-01-01` : undefined;
    addPartnership(match[1], match[2], 'married', 'married', year);
  }

  const parentPattern = /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,120}\bhad\s+(\d+)\s+children\b/gi;
  for (const match of transcript.matchAll(parentPattern)) {
    parentCouples.push({
      parent1: sentenceCaseName(match[1]),
      parent2: sentenceCaseName(match[2]),
      childCount: Number(match[3]),
    });
  }

  const dxPattern = /\b([A-Z][a-z]+)\b[^.\n]{0,120}\bdiagnos(?:ed|is|e)\b[^.\n]{0,120}\bschizophrenia\b/gi;
  for (const match of transcript.matchAll(dxPattern)) {
    diagnosedSchizophrenia.add(sentenceCaseName(match[1]));
  }

  const killPattern = /\b([A-Z][a-z]+)\b[^.\n]{0,140}\bkilled\s+([A-Z][a-z]+)\b[^.\n]{0,80}\bkilled\s+(?:himself|herself)\b/gi;
  for (const match of transcript.matchAll(killPattern)) {
    addPartnership(match[1], match[2], 'dating', 'ended', undefined, 'Transcript references homicide-suicide sequence.');
    const killer = sentenceCaseName(match[1]);
    const victim = sentenceCaseName(match[2]);
    deceasedNames.add(killer);
    deceasedNames.add(victim);
    addNote(killer, `Transcript: killed ${victim}, then died by suicide.`);
    addNote(victim, `Transcript: killed by ${killer}.`);
  }

  const bornPattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)[^.\n]{0,30}\bborn\s+(\d{4})/gi;
  for (const match of transcript.matchAll(bornPattern)) {
    const person = getPerson(`${match[1]} ${match[2]}`);
    person.birthDate = `${match[3]}-01-01`;
  }

  const diedPattern = /\b([A-Z][a-z]+)\b[^.\n]{0,40}\bdied\s+(\d{4})/gi;
  for (const match of transcript.matchAll(diedPattern)) {
    const person = getPerson(match[1]);
    person.deathDate = `${match[2]}-01-01`;
  }

  const coupleChildrenPattern =
    /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,140}\b(?:have|had)\s+(one|two|three|four|five|\d+)\s+children\b/gi;
  const countFromWord = (value: string) => {
    const lowered = value.toLowerCase();
    const map: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    if (map[lowered]) return map[lowered];
    const parsed = Number(lowered);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  for (const match of transcript.matchAll(coupleChildrenPattern)) {
    const a = sentenceCaseName(match[1]);
    const b = sentenceCaseName(match[2]);
    const key = [a, b].sort().join('::');
    const count = countFromWord(match[3]);
    if (count > 0) {
      coupleChildrenMentions.set(key, Math.max(coupleChildrenMentions.get(key) || 0, count));
    }
  }

  const conflictPattern =
    /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,120}\b(argu(?:e|ed|ing)|argur(?:e|ed|ing)|go at it|fight(?:ing)?|conflict)\b/gi;
  for (const match of transcript.matchAll(conflictPattern)) {
    addEmotionalPatternDraft(match[1], match[2], 'conflict', `Transcript conflict phrase: "${match[0].trim()}"`);
  }

  const cutoffPattern =
    /\b([A-Z][a-z]+)[^.\n]{0,90}\b(no contact|cut\s*off|cutoff|estranged|distance|distant)\b[^.\n]{0,80}\b(with|from)\b[^A-Z\n]{0,12}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(cutoffPattern)) {
    addEmotionalPatternDraft(match[1], match[4], 'cutoff', `Transcript cutoff phrase: "${match[0].trim()}"`);
  }

  const fusionPattern =
    /\b([A-Z][a-z]+)[^.\n]{0,120}\b(reactive|fused|fusion|enmeshed|overly close)\b[^.\n]{0,80}\b(around|with|to)\b[^A-Z\n]{0,16}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(fusionPattern)) {
    addEmotionalPatternDraft(match[1], match[4], 'fusion', `Transcript fusion phrase: "${match[0].trim()}"`);
  }

  const projectionPatternNamed =
    /\b([A-Z][a-z]+)\s+(?:and|&)\s+([A-Z][a-z]+)[^.\n]{0,100}\b(focused on|project(?:ed|ion)\s+onto|overly focused on)\b[^A-Z\n]{0,16}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(projectionPatternNamed)) {
    addEmotionalPatternDraft(match[1], match[4], 'projection', `Transcript projection phrase: "${match[0].trim()}"`);
    addEmotionalPatternDraft(match[2], match[4], 'projection', `Transcript projection phrase: "${match[0].trim()}"`);
  }

  const projectionPatternSingle =
    /\b([A-Z][a-z]+)[^.\n]{0,100}\b(focused on|project(?:ed|ion)\s+onto|overly focused on)\b[^A-Z\n]{0,16}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(projectionPatternSingle)) {
    addEmotionalPatternDraft(match[1], match[3], 'projection', `Transcript projection phrase: "${match[0].trim()}"`);
  }

  const peopleList = [...peopleByName.values()];
  peopleList.forEach((person, index) => {
    person.x = 120 + (index % 6) * 150;
    person.y = 140 + Math.floor(index / 6) * 180;
    person.gender = inferGenderFromName(person.name) || person.gender || 'female';
    const notes = personNotes.get(person.name);
    if (notes?.length) {
      person.notes = notes.join(' ');
      person.notesEnabled = true;
    }
    if (diagnosedSchizophrenia.has(person.name)) {
      person.functionalIndicators = [
        { definitionId: 'indicator-schizophrenia-spectrum', status: 'past', impact: 5, frequency: 5, intensity: 5 },
      ];
    }
    if (deceasedNames.has(person.name) && !person.deathDate) {
      person.deathDate = '1973-01-01';
    }
  });

  const partnerships: Partnership[] = [...partnershipsByKey.values()].map((entry, idx) => {
    const p1 = peopleByName.get(entry.partner1)!;
    const p2 = peopleByName.get(entry.partner2)!;
    p1.partnerships = [...new Set([...p1.partnerships, entry.id])];
    p2.partnerships = [...new Set([...p2.partnerships, entry.id])];
    return {
      id: entry.id,
      partner1_id: p1.id,
      partner2_id: p2.id,
      horizontalConnectorY: Math.max(p1.y, p2.y) + 60 + idx * 4,
      relationshipType: entry.relationshipType,
      relationshipStatus: entry.relationshipStatus,
      relationshipStartDate: entry.relationshipStartDate,
      children: entry.children,
      notes: entry.notes,
      events: [],
    };
  });

  const emotionalLines: EmotionalLine[] = [...emotionalLineDrafts.values()].map((entry) => {
    const p1 = peopleByName.get(entry.person1)!;
    const p2 = peopleByName.get(entry.person2)!;
    return {
      id: nanoid(),
      person1_id: p1.id,
      person2_id: p2.id,
      status: 'ongoing',
      relationshipType: entry.relationshipType,
      lineStyle: entry.lineStyle,
      lineEnding: entry.lineEnding,
      startDate: new Date().toISOString().slice(0, 10),
      color: DEFAULT_LINE_COLOR,
      notes: entry.notes,
      events: [],
    };
  });

  for (const parent of parentCouples) {
    const parentPair = [parent.parent1, parent.parent2].sort().join('::');
    const parentPartnership = partnershipsByKey.get(parentPair);
    if (!parentPartnership) continue;
    const children = peopleList
      .filter((person) => person.name !== parent.parent1 && person.name !== parent.parent2)
      .slice(0, parent.childCount);
    children.forEach((child) => {
      child.parentPartnership = parentPartnership.id;
      parentPartnership.children.push(child.id);
    });
  }

  coupleChildrenMentions.forEach((count, pairKey) => {
    const parentPartnership = partnershipsByKey.get(pairKey);
    if (!parentPartnership) return;
    const partnership = partnerships.find((p) => p.id === parentPartnership.id);
    if (!partnership) return;
    const parent1 = peopleByName.get(parentPartnership.partner1);
    const parent2 = peopleByName.get(parentPartnership.partner2);
    if (!parent1 || !parent2) return;
    const existingCount = partnership.children.length;
    if (existingCount >= count) return;
    const needed = count - existingCount;
    const anchorX = (parent1.x + parent2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    for (let i = 0; i < needed; i += 1) {
      const childIndex = existingCount + i + 1;
      const childName = `${parentPartnership.partner1.split(' ')[0]}-${parentPartnership.partner2.split(' ')[0]} Child ${childIndex}`;
      const child: Person = {
        id: nanoid(),
        name: childName,
        firstName: childName,
        x: anchorX + (i - (needed - 1) / 2) * 42,
        y: baseY,
        gender: i % 2 === 0 ? 'female' : 'male',
        partnerships: [],
        parentPartnership: partnership.id,
        notes: 'Placeholder child generated from transcript statement about child count.',
        notesEnabled: false,
        events: [],
      };
      peopleByName.set(childName, child);
      peopleList.push(child);
      partnership.children.push(child.id);
      parentPartnership.children.push(child.id);
    }
  });

  const normalizedPeople = normalizeImportedChildLayout(peopleList, partnerships, {
    expandParentSpan: true,
    autoResizeDenseFamilies: true,
  });

  return {
    fileMeta: { fileName: `processed-${sourceFileName.replace(/\.[^.]+$/, '')}.json` },
    people: normalizedPeople,
    partnerships,
    emotionalLines,
    functionalIndicatorDefinitions: [
      { id: 'indicator-schizophrenia-spectrum', label: 'Schizophrenia Spectrum', group: 'emotional', color: '#7b1fa2', useLetter: true },
    ],
    eventCategories: ['Mental Health', 'Relationship', 'Hospitalization', 'Loss/Death', 'Other'],
    autoSaveMinutes: 1,
    ideasText:
      'Transcript-processed draft. Review person names, genders, dates, parent-child links, diagnoses, and extracted emotional pattern lines before clinical use.',
  };
};

// ---------------------------------------------------------------------------
// Facts JSON → draft diagram
// ---------------------------------------------------------------------------

/**
 * Horizontal (X) layout for image imports (R11+R12+R19). Y is already set by
 * generation; this assigns X so that:
 *   - each family occupies its own horizontal space (families don't overlap),
 *   - the drawn left-to-right order of siblings is preserved (R12), and
 *   - every couple's Partner Relationship Line is WIDER than its children row:
 *     the left partner sits left of the smallest child X and the right partner
 *     sits right of the largest child X ("parents wider than children row").
 *
 * Method: a post-order sweep over the family forest with a single left-to-right
 * cursor. Leaves take fixed slots (so no two subtrees overlap); each couple is
 * then bracketed around its already-placed children. A partner that is itself a
 * child of another family keeps the X its own family gave it (post-order
 * guarantees children are placed before their parents bracket them).
 */
function applyFamilyXLayout(people: Person[], partnerships: Partnership[]): void {
  const SIBLING_SPACING = 80; // between adjacent leaf units
  const COUPLE_MARGIN = 40; // couple sits this far outside its child span
  const SUBTREE_GAP = 60; // extra gap after a child that heads its own family

  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = (partnershipId: string) =>
    people.filter((p) => p.parentPartnership === partnershipId).sort((a, b) => a.x - b.x);
  const familyOf = (person: Person) =>
    partnerships.find(
      (pt) =>
        (pt.partner1_id === person.id || pt.partner2_id === person.id) &&
        childrenOf(pt.id).length > 0
    );

  const placed = new Set<string>();
  let cursor = 0;

  const place = (person: Person): void => {
    if (placed.has(person.id)) return;
    placed.add(person.id);

    const fam = familyOf(person);
    const kids = fam ? childrenOf(fam.id) : [];

    if (!fam || kids.length === 0) {
      person.x = cursor;
      cursor += SIBLING_SPACING;
      return;
    }

    // Place children first (post-order), with a gap after any child subtree.
    kids.forEach((kid, i) => {
      place(kid);
      if (i < kids.length - 1 && familyOf(kid)) cursor += SUBTREE_GAP;
    });

    const minK = Math.min(...kids.map((k) => k.x));
    const maxK = Math.max(...kids.map((k) => k.x));

    // Bracket the couple around the children (parents wider than children row),
    // preserving which partner is drawn on the left.
    const p1 = byId.get(fam.partner1_id);
    const p2 = byId.get(fam.partner2_id);
    let leftP = p1;
    let rightP = p2;
    if (p1 && p2 && p1.x > p2.x) {
      leftP = p2;
      rightP = p1;
    }
    if (leftP) {
      leftP.x = minK - COUPLE_MARGIN;
      placed.add(leftP.id);
    }
    if (rightP && rightP !== leftP) {
      rightP.x = maxK + COUPLE_MARGIN;
      placed.add(rightP.id);
    }
    // Keep the cursor past this family's right bracket for the next unit.
    cursor = Math.max(cursor, maxK + COUPLE_MARGIN + SIBLING_SPACING);
  };

  // Start only from top-lineage roots that HEAD a family (have descendants),
  // left-to-right by their drawn X. Childless partners / isolated people are
  // handled in the mop-up below.
  const roots = people
    .filter((p) => !p.parentPartnership && familyOf(p))
    .sort((a, b) => a.x - b.x);
  for (const r of roots) place(r);

  // Mop up anyone still unplaced: a childless partner sits beside their already
  // placed partner; a fully isolated person is appended at the right.
  for (const person of people) {
    if (placed.has(person.id)) continue;
    const mate = partnerships
      .filter((pt) => pt.partner1_id === person.id || pt.partner2_id === person.id)
      .map((pt) => (pt.partner1_id === person.id ? pt.partner2_id : pt.partner1_id))
      .map((id) => byId.get(id))
      .find((m) => m && placed.has(m.id));
    if (mate) {
      // Sit beside the mate, but never on top of someone already placed on the
      // same generation row (a childless spouse dropped into a full sibling row).
      const sameRow = people.filter(
        (o) => o.id !== person.id && placed.has(o.id) && Math.round(o.y) === Math.round(person.y)
      );
      const collides = (x: number) => sameRow.some((o) => Math.abs(o.x - x) < SIBLING_SPACING);
      let candidate = mate.x + SIBLING_SPACING;
      let guard = 0;
      while (collides(candidate) && guard++ < people.length * 2) candidate += SIBLING_SPACING;
      person.x = candidate;
    } else {
      person.x = cursor;
      cursor += SIBLING_SPACING;
    }
    placed.add(person.id);
  }
}

export const factsToDiagramImportData = (facts: FactsImportData): DiagramImportData => {
  const peopleByName = new Map<string, Person>();
  const getPerson = (name: string) => {
    const normalized = name.trim();
    if (!normalized) return null;
    const existing = findLikelyExistingPerson(peopleByName, normalized);
    if (existing) return existing;
    const next: Person = {
      id: nanoid(),
      name: normalized,
      firstName: normalized.split(/\s+/)[0],
      lastName: normalized.split(/\s+/).slice(1).join(' ') || undefined,
      x: 0,
      y: 0,
      gender: inferGenderFromName(normalized) || 'female',
      partnerships: [],
      events: [],
    };
    peopleByName.set(normalized, next);
    return next;
  };

  const parents = facts.family?.parents || [];
  parents.forEach((name) => getPerson(name));
  (facts.family?.childrenMentionedByName || []).forEach((name) => getPerson(name));
  (facts.relationships || []).forEach((rel) => {
    if (rel.a) getPerson(rel.a);
    if (rel.b) getPerson(rel.b);
  });
  (facts.clinical?.explicitSchizophreniaMentions || []).forEach((name) => getPerson(name));
  (facts.clinical?.explicitNoDiagnosisMentions || []).forEach((name) => getPerson(name));
  (facts.clinical?.events || []).forEach((evt) => {
    if (evt.person) getPerson(evt.person);
  });
  // Genogram image import: create people for ALL VLM-extracted people
  // (catches people not mentioned in any relationship, like edge siblings)
  (facts.people || []).forEach((p) => {
    if (p.name) getPerson(p.name);
  });

  const people = [...peopleByName.values()];
  people.forEach((person, idx) => {
    person.x = 120 + (idx % 6) * 150;
    person.y = 140 + Math.floor(idx / 6) * 170;
    person.gender = inferGenderFromName(person.name) || person.gender || 'female';
  });

  // Apply genogram image import metadata (sex, dates, coordinates)
  // Canvas dimensions for coordinate conversion (image % → canvas px)
  // These are scaled to reasonable defaults; can be adjusted based on actual canvas size
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;
  const POSITION_PADDING = 100; // Minimum margin from edges

  if (facts.people && facts.people.length > 0) {
    const peopleByExactName = new Map(Array.from(peopleByName.entries()).map(([k, v]) => [k.trim(), v]));

    for (const importedPerson of facts.people) {
      const matchedPerson = peopleByExactName.get((importedPerson.name || '').trim());
      if (!matchedPerson) continue;

      // Apply coordinates from image if available (convert % to canvas coordinates)
      if (importedPerson.x !== undefined && importedPerson.y !== undefined) {
        // Image coordinates are 0-100 (percentage of image dimensions)
        // Convert to canvas coordinates with padding
        matchedPerson.x = POSITION_PADDING + (importedPerson.x / 100) * (CANVAS_WIDTH - 2 * POSITION_PADDING);
        matchedPerson.y = POSITION_PADDING + (importedPerson.y / 100) * (CANVAS_HEIGHT - 2 * POSITION_PADDING);
      }

      // Apply sex if specified and overrides default inference
      if (importedPerson.sex && importedPerson.sex !== 'unknown') {
        matchedPerson.gender = importedPerson.sex === 'male' ? 'male' : 'female';
      }

      // Apply birth and death dates
      if (importedPerson.birthYear) {
        matchedPerson.birthDate = `${importedPerson.birthYear}-01-01`;
      }
      if (importedPerson.deceased && importedPerson.deathYear) {
        matchedPerson.deathDate = `${importedPerson.deathYear}-01-01`;
      } else if (importedPerson.deceased && !importedPerson.deathYear) {
        // Mark as deceased with unknown death year
        matchedPerson.deathDate = '1900-01-01'; // Placeholder, user can edit
      }

      // NOTE: Not processing notes from image import at this time
      // Focus is on coordinates and basic person metadata only
    }

    // Note: sibling X compression happens later, AFTER partnerships are built,
    // using parentPartnership (the actual data-model definition of siblings).
  }

  const partnerships: Partnership[] = [];
  const toChildCount = (text?: string) => {
    if (!text) return 0;
    const match = text.match(/\b(one|two|three|four|five|\d+)\s+children\b/i);
    if (!match) return 0;
    const token = match[1].toLowerCase();
    const map: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    if (map[token]) return map[token];
    const parsed = Number(token);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  if (parents.length >= 2) {
    const parentPartnershipId = nanoid();
    const parent1 = getPerson(parents[0])!;
    const parent2 = getPerson(parents[1])!;
    const children = (facts.family?.childrenMentionedByName || [])
      .map((name) => getPerson(name))
      .filter((person): person is Person => Boolean(person));
    children.forEach((child) => { child.parentPartnership = parentPartnershipId; });
    parent1.partnerships = [...new Set([...parent1.partnerships, parentPartnershipId])];
    parent2.partnerships = [...new Set([...parent2.partnerships, parentPartnershipId])];
    partnerships.push({
      id: parentPartnershipId,
      partner1_id: parent1.id,
      partner2_id: parent2.id,
      horizontalConnectorY: Math.max(parent1.y, parent2.y) + 60,
      relationshipType: 'married',
      relationshipStatus: 'ended',
      relationshipStartDate: facts.family?.marriageYear ? `${facts.family.marriageYear}-01-01` : undefined,
      children: children.map((child) => child.id),
      notes: 'Derived from facts.family',
      events: [],
    });
  }

  (facts.relationships || []).forEach((rel) => {
    if (!rel.a || !rel.b) return;
    const personA = getPerson(rel.a);
    const personB = getPerson(rel.b);
    if (!personA || !personB) return;
    const existing = partnerships.find(
      (p) =>
        (p.partner1_id === personA.id && p.partner2_id === personB.id) ||
        (p.partner1_id === personB.id && p.partner2_id === personA.id)
    );
    if (existing) {
      if (rel.evidence) existing.notes = existing.notes ? `${existing.notes}\n${rel.evidence}` : rel.evidence;
      const childCount = toChildCount(rel.evidence);
      if (childCount > existing.children.length) {
        const pa = people.find((p) => p.id === existing.partner1_id);
        const pb = people.find((p) => p.id === existing.partner2_id);
        const anchorX = pa && pb ? (pa.x + pb.x) / 2 : 120;
        const baseY = existing.horizontalConnectorY + 120;
        for (let i = existing.children.length; i < childCount; i += 1) {
          const childName = `${(pa?.firstName || pa?.name || 'Child').split(' ')[0]}-${(pb?.firstName || pb?.name || 'Child').split(' ')[0]} Child ${i + 1}`;
          const child = getPerson(childName);
          if (!child) continue;
          child.parentPartnership = existing.id;
          child.x = anchorX + (i - (childCount - 1) / 2) * 42;
          child.y = baseY;
          child.notes = 'Placeholder child generated from facts relationship evidence.';
          child.notesEnabled = false;
          existing.children.push(child.id);
        }
      }
      return;
    }
    const id = nanoid();
    personA.partnerships = [...new Set([...personA.partnerships, id])];
    personB.partnerships = [...new Set([...personB.partnerships, id])];

    // Link explicit children (from image import: rel.children)
    const explicitChildIds: string[] = [];
    if (rel.children && rel.children.length > 0) {
      for (const childName of rel.children) {
        const child = getPerson(childName);
        if (child) {
          child.parentPartnership = id;
          explicitChildIds.push(child.id);
        }
      }
    }

    partnerships.push({
      id,
      partner1_id: personA.id,
      partner2_id: personB.id,
      horizontalConnectorY: Math.max(personA.y, personB.y) + 60, // R15: Same Y per generation (no per-partnership offset)
      relationshipType: normalizeRelationshipType(rel.type),
      relationshipStatus: normalizeRelationshipStatus(rel.status),
      children: explicitChildIds,
      notes: rel.evidence,
      events: [],
    });
    const childCount = toChildCount(rel.evidence);
    if (childCount > 0) {
      const created = partnerships[partnerships.length - 1];
      const anchorX = (personA.x + personB.x) / 2;
      const baseY = created.horizontalConnectorY + 120;
      for (let i = 0; i < childCount; i += 1) {
        const childName = `${(personA.firstName || personA.name || 'Child').split(' ')[0]}-${(personB.firstName || personB.name || 'Child').split(' ')[0]} Child ${i + 1}`;
        const child = getPerson(childName);
        if (!child) continue;
        child.parentPartnership = created.id;
        child.x = anchorX + (i - (childCount - 1) / 2) * 42;
        child.y = baseY;
        child.notes = 'Placeholder child generated from facts relationship evidence.';
        child.notesEnabled = false;
        created.children.push(child.id);
      }
    }
  });

  const schizophreniaSet = new Set((facts.clinical?.explicitSchizophreniaMentions || []).map((n) => n.trim()));
  const noDxSet = new Set((facts.clinical?.explicitNoDiagnosisMentions || []).map((n) => n.trim()));
  people.forEach((person) => {
    if (schizophreniaSet.has(person.name)) {
      person.functionalIndicators = [
        { definitionId: 'indicator-schizophrenia-spectrum', status: 'past', impact: 5, frequency: 5, intensity: 5 },
      ];
    }
    if (noDxSet.has(person.name)) {
      person.notes = person.notes
        ? `${person.notes}\nFacts: explicitly no schizophrenia diagnosis mention.`
        : 'Facts: explicitly no schizophrenia diagnosis mention.';
      person.notesEnabled = true;
    }
  });

  (facts.clinical?.events || []).forEach((evt, idx) => {
    if (!evt.person || !evt.type) return;
    const person = getPerson(evt.person);
    if (!person) return;
    const event = {
      id: `facts-event-${idx}-${person.id}`,
      date: evt.year ? `${evt.year}-01-01` : '',
      category: 'Clinical',
      eventType: 'NODAL' as const,
      status: 'discrete' as const,
      intensity: 3,
      howWell: 0,
      otherPersonName: '',
      wwwwh: 'Derived from facts JSON',
      observations: evt.type,
      eventClass: 'individual' as const,
    };
    person.events = [...(person.events || []), event];
    if ((evt.type || '').toLowerCase().includes('homicide_suicide') && !person.deathDate) {
      person.deathDate = evt.year ? `${evt.year}-01-01` : '1973-01-01';
    }
  });

  // ===========================================================================
  // PHASE 2 LAYOUT RULES — applied after partnerships are built.
  // See: utils/genogram/genogramRules.ts for full rule documentation.
  //
  //   R7  Each generation has same Y                  → longest-path depth (Step 1)
  //   R8  Partners share a generation                 → married-in inherits partner
  //   R9  Siblings have same Y                        → share parentPartnership → same gen
  //   R10 Generations separated by N px on Y axis     → GENERATION_Y_GAP
  //   R11 Siblings spaced N px apart on X axis        → applyFamilyXLayout
  //   R12 Preserve X sequence — never reorder         → sort by drawn X in layout
  //   R13 Children X within parents' X range          → couple brackets children (R19)
  //   R14 (removed) — no positional inference of parent-child links (rule 2)
  //   R15 Partnership connector Y consistent per gen  → recompute after Y snap
  //   R16 Unknown-sex symbols are smaller (≥30 floor) → person.size = 30
  //   R17 Stillbirth detection (X at end of line)     → lifeStatus = 'stillbirth'
  //   R18 Twins/multiples grouped (inverted-V/Y cue)  → multipleBirthGroupId
  //   R19 Families don't overlap on X; couple wider   → applyFamilyXLayout
  //       than its children row (PRL brackets kids)
  //
  // Also: SKIP normalizeImportedChildLayout — it auto-repositions too aggressively.
  // ===========================================================================
  const isImageImport = Boolean(facts.people && facts.people.length > 0);

  if (isImageImport) {
    // === Step 0: (removed) — no spatial inference of parent-child links ===
    // Per the import rules, a child→partnership connection is created ONLY when a
    // line was actually drawn between them (captured by the VLM as rel.children).
    // We deliberately do NOT infer a parentPartnership from position alone: a person
    // sitting below a couple but with no drawn connecting line must be left
    // unattached rather than fabricated into that couple's child.

    // === Step 1: R7+R8+R9 — Generation depth via longest-path over drawn links ===
    // Generation comes ONLY from real drawn parent→child lines (parentPartnership,
    // built from rel.children). We assign each person a generation such that every
    // child sits strictly below the DEEPER of its two parents (longest path), and
    // partners share a generation — a married-in spouse with no drawn parents inherits
    // their partner's depth, never the other way around. This replaces the old
    // first-arrival BFS, which let a married-in root (e.g. a spouse with no parents
    // drawn) drag their deep-ancestry partner up to generation 0.
    // (R7 same gen → same Y; R8 partners same gen; R9 siblings share gen.)
    const personGeneration = new Map<string, number>();
    for (const person of people) personGeneration.set(person.id, 0);
    const genOf = (id: string) => personGeneration.get(id) ?? 0;

    // Relax to a fixpoint: child = max(parent gens)+1, then partners = max(both).
    // Generations only ever increase, so this converges; the cap guards against a
    // malformed parent-child cycle (someone made their own ancestor).
    const MAX_GEN_ITERATIONS = people.length * people.length + 50;
    let genChanged = true;
    let genIterations = 0;
    while (genChanged && genIterations++ < MAX_GEN_ITERATIONS) {
      genChanged = false;
      // (a) Each child is one generation below its deeper parent.
      for (const partnership of partnerships) {
        const parentGen = Math.max(genOf(partnership.partner1_id), genOf(partnership.partner2_id));
        for (const childId of partnership.children || []) {
          if (genOf(childId) < parentGen + 1) {
            personGeneration.set(childId, parentGen + 1);
            genChanged = true;
          }
        }
      }
      // (b) Partners share the deeper of their two generations (married-in inherits).
      for (const partnership of partnerships) {
        const target = Math.max(genOf(partnership.partner1_id), genOf(partnership.partner2_id));
        if (genOf(partnership.partner1_id) < target) {
          personGeneration.set(partnership.partner1_id, target);
          genChanged = true;
        }
        if (genOf(partnership.partner2_id) < target) {
          personGeneration.set(partnership.partner2_id, target);
          genChanged = true;
        }
      }
    }
    if (genIterations >= MAX_GEN_ITERATIONS) {
      console.warn('[vlmImport] Generation relaxation hit iteration cap — possible cycle in parent-child graph');
    }

    // === Step 1.5: Age as a SOFT check — never overrides drawn lines ===
    // Birth years (when present) are used only where the lines are silent, and to flag
    // (not fix) contradictions. Parent→child gaps can be as small as ~17y and siblings
    // as far apart as ~20y, so a year-gap is never thresholded into a generation
    // boundary. Precedence: drawn line → marriage inheritance → age nudge → position.
    const birthYearOf = (p: Person): number | null => {
      const y = p.birthDate ? parseInt(p.birthDate.slice(0, 4), 10) : NaN;
      return Number.isFinite(y) ? y : null;
    };

    // (a) Tier-3 nudge: a fully-disconnected person (no drawn parents, no partnership)
    // with a birth year is placed into the generation band whose members' median birth
    // year is closest — instead of defaulting to the top generation.
    const medianBirthByGen = new Map<number, number>();
    const yearsByGen = new Map<number, number[]>();
    for (const person of people) {
      const by = birthYearOf(person);
      if (by === null) continue;
      const g = genOf(person.id);
      if (!yearsByGen.has(g)) yearsByGen.set(g, []);
      yearsByGen.get(g)!.push(by);
    }
    for (const [g, years] of yearsByGen) {
      years.sort((a, b) => a - b);
      medianBirthByGen.set(g, years[Math.floor(years.length / 2)]);
    }
    if (medianBirthByGen.size > 0) {
      for (const person of people) {
        const isolated = !person.parentPartnership && (person.partnerships?.length ?? 0) === 0;
        const by = birthYearOf(person);
        if (!isolated || by === null) continue;
        let bestGen = genOf(person.id);
        let bestDelta = Infinity;
        for (const [g, medianYear] of medianBirthByGen) {
          const delta = Math.abs(by - medianYear);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestGen = g;
          }
        }
        personGeneration.set(person.id, bestGen);
      }
    }

    // (b) Flag age-impossible drawn links for review — but KEEP the drawn structure.
    for (const partnership of partnerships) {
      const parentYears = [partnership.partner1_id, partnership.partner2_id]
        .map((id) => people.find((p) => p.id === id))
        .map((p) => (p ? birthYearOf(p) : null));
      for (const childId of partnership.children || []) {
        const child = people.find((p) => p.id === childId);
        const cy = child ? birthYearOf(child) : null;
        if (!child || cy === null) continue;
        for (const py of parentYears) {
          if (py !== null && cy <= py) {
            facts.uncertainties = [
              ...(facts.uncertainties || []),
              `[warn] Age check: "${child.name}" (b.${cy}) is not younger than a drawn parent (b.${py}); kept the drawn line — please verify.`,
            ];
          }
        }
      }
    }

    // === Step 2: R10 — Generations separated by N px on Y axis ===
    const GENERATION_Y_GAP = 200; // Pixels between generations
    const FIRST_GEN_Y = 140;
    for (const person of people) {
      const gen = personGeneration.get(person.id);
      if (gen !== undefined) {
        person.y = FIRST_GEN_Y + gen * GENERATION_Y_GAP;
      }
    }

    // === Step 3: R11+R12+R19 — Packed family X layout ===
    // Pack each family left-to-right so families don't overlap (R19), keeping the
    // drawn left-to-right order (R12) and fixed sibling spacing (R11). Also brackets
    // every couple wider than its children row (left partner X < smallest child X,
    // right partner X > largest child X). See applyFamilyXLayout below.
    applyFamilyXLayout(people, partnerships);

    // === Step 4: R15 — Partnership connector Y consistent per generation ===
    // After Y snapping, recompute horizontalConnectorY so all partnerships at the
    // same generation share the same Y line (no per-partnership offset).
    const PARTNERSHIP_LINE_OFFSET = 60; // px below the partners' Y
    for (const partnership of partnerships) {
      const p1 = people.find((p) => p.id === partnership.partner1_id);
      const p2 = people.find((p) => p.id === partnership.partner2_id);
      if (p1 && p2) {
        // Both partners are at same Y now (R8), so this is deterministic per generation
        partnership.horizontalConnectorY = Math.max(p1.y, p2.y) + PARTNERSHIP_LINE_OFFSET;
      }
    }

    // === Step 5: R16 — Unknown-sex people render as smaller symbol ===
    // Per user spec: unknown-sex symbols (X without enclosing shape, or otherwise unknown)
    // should appear smaller than known-sex symbols — but never below the 30px floor
    // (rule 3: no person object smaller than 30 points).
    const UNKNOWN_SEX_SIZE = 30; // minimum person size (rule 3 floor)
    const importedBySex = new Map(
      (facts.people || []).map((p) => [p.name, p.sex])
    );
    for (const person of people) {
      const sex = importedBySex.get(person.name);
      if (sex === 'unknown') {
        person.size = UNKNOWN_SEX_SIZE;
      }
    }

    // === Step 6: R17 — Stillbirth detection ===
    // Detection: VLM marks stillbirths in the notes field with "stillbirth" keyword.
    // OR: a person with sex='unknown', deceased=true, no birth year, child of a partnership
    // → likely a stillbirth (small X at end of descending line per genogram convention).
    // Apply person.lifeStatus = 'stillbirth' so the renderer can show appropriate symbol.
    const importedByName = new Map(
      (facts.people || []).map((p) => [p.name, p])
    );
    for (const person of people) {
      const imported = importedByName.get(person.name);
      if (!imported) continue;

      // Explicit detection: notes contain "stillbirth"
      const notesHaveStillbirth = (imported.notes || '').toLowerCase().includes('stillbirth');

      // Implicit detection: unknown sex + deceased + child of partnership + no birth year
      const looksLikeStillbirth =
        imported.sex === 'unknown' &&
        imported.deceased === true &&
        !imported.birthYear &&
        Boolean(person.parentPartnership);

      if (notesHaveStillbirth || looksLikeStillbirth) {
        person.lifeStatus = 'stillbirth';
        // Stillbirths are very small (already smaller via R16 if sex=unknown,
        // but ensure they're small even if sex is known)
        if (!person.size || person.size > UNKNOWN_SEX_SIZE) {
          person.size = UNKNOWN_SEX_SIZE;
        }
      }
    }

    // === Step 7: R18 — Twins / multiple births ===
    // The VLM tags twins (inverted-V or inverted-Y cue) with a shared twinGroup.
    // People who share the same non-empty twinGroup AND the same parent partnership
    // become a multiple-birth group: a shared multipleBirthGroupId + a shared
    // connectionAnchorX (their X midpoint) so their child lines converge on the PRL
    // as an inverted-V, matching the existing multiple-birth data model.
    const twinKeyToMembers = new Map<string, Person[]>();
    for (const person of people) {
      const imported = importedByName.get(person.name);
      const group = imported?.twinGroup?.trim();
      if (!group || !person.parentPartnership) continue;
      // Key by parentPartnership too: twins must share the same parents.
      const key = `${person.parentPartnership}||${group}`;
      if (!twinKeyToMembers.has(key)) twinKeyToMembers.set(key, []);
      twinKeyToMembers.get(key)!.push(person);
    }
    for (const members of twinKeyToMembers.values()) {
      if (members.length < 2) continue; // a group of one is not a multiple birth
      const groupId = nanoid();
      const anchorX = members.reduce((sum, p) => sum + p.x, 0) / members.length;
      for (const member of members) {
        member.multipleBirthGroupId = groupId;
        member.connectionAnchorX = anchorX;
      }
    }
  }

  // Skip normalizeImportedChildLayout for VLM imports — it auto-repositions too aggressively
  // and would override the carefully-extracted VLM coordinates and sequence.
  const normalizedPeople = isImageImport
    ? people
    : normalizeImportedChildLayout(people, partnerships, {
        expandParentSpan: true,
        autoResizeDenseFamilies: true,
      });

  return {
    fileMeta: { fileName: `facts-import-${facts.processedAt || 'processed'}.json` },
    people: normalizedPeople,
    partnerships,
    emotionalLines: [],
    triangles: [],
    functionalIndicatorDefinitions: [
      { id: 'indicator-schizophrenia-spectrum', label: 'Schizophrenia Spectrum', group: 'emotional', color: '#7b1fa2', useLetter: true },
    ],
    eventCategories: ['Clinical', 'Relationship', 'Hospitalization', 'Loss/Death', 'Other'],
    autoSaveMinutes: 1,
    ideasText: (facts.uncertainties || []).join('\n'),
  };
};
