import type { Person, Partnership } from '../types';

export const removeOrphanedMiscarriages = (people: Person[], partnerships: Partnership[]) => {
  const validPartnershipIds = new Set(partnerships.map((p) => p.id));
  const orphanIds = new Set<string>();

  for (const person of people) {
    if (
      person.lifeStatus === 'miscarriage' &&
      (!person.parentPartnership || !validPartnershipIds.has(person.parentPartnership))
    ) {
      orphanIds.add(person.id);
    }
  }

  if (!orphanIds.size) {
    return {
      people,
      partnerships,
    };
  }

  const cleanedPeople = people.filter((person) => !orphanIds.has(person.id));
  const cleanedPartnerships = partnerships.map((partnership) => ({
    ...partnership,
    children: partnership.children.filter((childId) => !orphanIds.has(childId)),
  }));

  return {
    people: cleanedPeople,
    partnerships: cleanedPartnerships,
  };
};

export default removeOrphanedMiscarriages;
