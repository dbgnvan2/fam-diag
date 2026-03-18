import type { Person } from '../types';

export function computeDefaultFamilyName(partner1: Person, partner2: Person): string {
  const isMale = (p: Person) => p.birthSex === 'male' || p.gender === 'b';
  const male = isMale(partner1) ? partner1 : isMale(partner2) ? partner2 : partner1;
  const female = isMale(partner1) ? partner2 : isMale(partner2) ? partner1 : partner2;

  const lastName = male.lastName || male.name?.trim().split(/\s+/).at(-1) || '';
  const maidenName = female.maidenName || '';

  if (lastName && maidenName) return `${lastName}-${maidenName}`;
  if (lastName) return lastName;
  if (maidenName) return maidenName;
  return '';
}
