import type { Person } from '../types';

const DEFAULT_SIZE = 60;

const getShapeSize = (person: Person) => person.size ?? DEFAULT_SIZE;

export const getPersonVerticalExtents = (person: Person) => {
  const size = getShapeSize(person);
  switch (person.lifeStatus) {
    case 'miscarriage': {
      const extent = size / 2;
      return { top: extent, bottom: extent };
    }
    case 'stillbirth': {
      const radius = size / 3;
      return { top: radius, bottom: radius };
    }
    default: {
      const half = size / 2;
      return { top: half, bottom: half };
    }
  }
};
