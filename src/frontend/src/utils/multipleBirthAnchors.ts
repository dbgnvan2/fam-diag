import type { Partnership, Person } from '../types';

/**
 * Keep multiple-birth connection anchors consistent with the parents.
 *
 * Purpose: members of a multiple-birth group (same multipleBirthGroupId and
 *          parent partnership) share one connectionAnchorX — their mean x,
 *          clamped between the two parents — so their child lines meet at one
 *          point on the parents' line. Anyone else loses a stale anchor.
 * Tests:   src/frontend/src/utils/multipleBirthAnchors.test.ts
 *
 * Returns `people` unchanged (same array) when nothing needs to move. Moved
 * out of DiagramEditor (domain logic belongs in utils); a never-populated
 * "derivedAssignments" branch was dropped in the move.
 */
export const alignMultipleBirthAnchors = (people: Person[], partnerships: Partnership[]): Person[] => {
  const list = people;
  if (!partnerships.length) return list;
  const personLookup = new Map(list.map((p) => [p.id, p]));
  const partnershipRanges = new Map<string, { min: number; max: number }>();
  partnerships.forEach((partnership) => {
    const partner1 = personLookup.get(partnership.partner1_id);
    const partner2 = personLookup.get(partnership.partner2_id);
    if (!partner1 || !partner2) return;
    partnershipRanges.set(partnership.id, {
      min: Math.min(partner1.x, partner2.x),
      max: Math.max(partner1.x, partner2.x),
    });
  });

  const multiGroupMembers = new Map<
    string,
    { partnershipId: string; members: Person[] }
  >();
  list.forEach((person) => {
    if (!person.parentPartnership) return;
    if (!person.multipleBirthGroupId) return;
    const current = multiGroupMembers.get(person.multipleBirthGroupId);
    if (current) {
      current.members.push(person);
    } else {
      multiGroupMembers.set(person.multipleBirthGroupId, {
        partnershipId: person.parentPartnership,
        members: [person],
      });
    }
  });

  const anchorByPerson = new Map<string, number>();
  const clampValue = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  multiGroupMembers.forEach(({ partnershipId, members }) => {
    if (members.length < 2) {
      return;
    }
    const range = partnershipRanges.get(partnershipId);
    if (!range) return;
    const center =
      members.reduce((sum, member) => sum + member.x, 0) / members.length;
    const anchor = clampValue(center, range.min, range.max);
    members.forEach((member) => {
      anchorByPerson.set(member.id, anchor);
    });
  });

  let changed = false;
  const next = list.map((person) => {
    let updated = person;

    const targetAnchor = anchorByPerson.get(person.id);
    if (typeof targetAnchor === 'number') {
      if (updated.connectionAnchorX !== targetAnchor) {
        updated = { ...updated, connectionAnchorX: targetAnchor };
        changed = true;
      }
      return updated;
    }

    if (!updated.parentPartnership && updated.connectionAnchorX !== undefined) {
      updated = { ...updated };
      delete updated.connectionAnchorX;
      changed = true;
      return updated;
    }

    if (updated.parentPartnership && updated.multipleBirthGroupId && typeof updated.connectionAnchorX === 'number') {
      const range = partnershipRanges.get(updated.parentPartnership);
      if (range) {
        const clamped = clampValue(updated.connectionAnchorX, range.min, range.max);
        if (clamped !== updated.connectionAnchorX) {
          updated = { ...updated, connectionAnchorX: clamped };
          changed = true;
        }
      }
    } else if (updated.parentPartnership && !updated.multipleBirthGroupId && updated.connectionAnchorX !== undefined) {
      updated = { ...updated };
      delete updated.connectionAnchorX;
      changed = true;
    }
    return updated;
  });

  return changed ? next : list;
};
