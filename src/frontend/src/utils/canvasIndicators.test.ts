import { describe, it, expect } from 'vitest';
import type { EmotionalProcessEvent, Person } from '../types';
import { latestEmotionalAutonomyLevel, latestEventByDate, personAgeLabel, ratingLabel } from './canvasIndicators';

const ev = (id: string, startDate: string, intensity: number, eventType: EmotionalProcessEvent['eventType'] = 'EA') =>
  ({ id, startDate, date: startDate, intensity, eventType }) as EmotionalProcessEvent;
const person = (overrides: Partial<Person>): Person => ({ id: 'p', name: 'P', x: 0, y: 0, partnerships: [], ...overrides });
const today = new Date(2026, 8, 30);

describe('canvas indicators (review 2026-09-30)', () => {
  it('nodes-01: no present-day age for a death with no date, a miscarriage or a stillbirth', () => {
    expect(personAgeLabel(person({ birthDate: '1900-03-01', deathDateKnown: true }), today)).toBeNull();
    expect(personAgeLabel(person({ birthDate: '1990-05-01', lifeStatus: 'stillbirth' }), today)).toBeNull();
    expect(personAgeLabel(person({ birthDate: '1990-05-01', lifeStatus: 'miscarriage' }), today)).toBeNull();
    expect(personAgeLabel(person({ birthDate: '1950-01-01', deathDate: '2000-06-01', deathDateKnown: true }), today)).toBe('Age 50');
    expect(personAgeLabel(person({ birthDate: '2000-01-01' }), today)).toBe('Age 26');
  });

  it('nodes-02: an unrated EA event neither shows 0 nor hides an older real rating', () => {
    expect(latestEmotionalAutonomyLevel([ev('a', '2020-01-01', 4), ev('b', '2024-01-01', 0)])).toBe(4);
    expect(latestEmotionalAutonomyLevel([ev('b', '2024-01-01', 0)])).toBeNull();
    expect(ratingLabel(0)).toBe('');
    expect(ratingLabel(3)).toBe('3');
  });

  it('nodes-03: the latest by date wins, not the last created', () => {
    const recorded2022 = ev('x', '2022-01-01', 2, 'FAMILY');
    const backfilled2010 = ev('y', '2010-01-01', 5, 'FAMILY');
    expect(latestEventByDate([recorded2022, backfilled2010])?.id).toBe('x');
    expect(latestEventByDate([ev('u', '', 1, 'FAMILY'), recorded2022])?.id).toBe('x');
    expect(latestEventByDate([])).toBeUndefined();
  });
});
