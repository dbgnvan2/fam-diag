import { describe, expect, it } from 'vitest';
import type { Person } from '../types';
import {
  buildTimelineJson,
  buildPersonEventBundle,
  isTimelineJson,
  isPersonEventBundle,
  mergePersonEventsFromBundle,
  timelineJsonToBundle,
} from './personEventBundle';

const makePerson = (overrides: Partial<Person>): Person => ({
  id: 'p1',
  x: 0,
  y: 0,
  name: 'Jane Doe',
  partnerships: [],
  ...overrides,
});

describe('personEventBundle', () => {
  it('builds a valid person event bundle', () => {
    const people: Person[] = [
      makePerson({
        id: 'p1',
        name: 'Jane Doe',
        events: [
          {
            id: 'evt-1',
            date: '2025-01-01',
            category: 'Individual',
            intensity: 1,
            frequency: 1,
            impact: 1,
            howWell: 5,
            otherPersonName: '',
            primaryPersonName: 'Jane Doe',
            wwwwh: '',
            observations: 'Started therapy',
            eventClass: 'individual',
          },
        ],
      }),
    ];

    const bundle = buildPersonEventBundle(people, 'family.json');
    expect(isPersonEventBundle(bundle)).toBe(true);
    expect(bundle.people).toHaveLength(1);
    expect(bundle.people[0].baselineEventIds).toEqual(['evt-1']);
    expect(bundle.sourceFileName).toBe('family.json');
  });

  it('merges updates, additions, and deletions based on baseline event ids', () => {
    const currentPeople: Person[] = [
      makePerson({
        id: 'p1',
        events: [
          {
            id: 'evt-1',
            date: '2025-01-01',
            category: 'Individual',
            intensity: 1,
            frequency: 1,
            impact: 1,
            howWell: 5,
            otherPersonName: '',
            primaryPersonName: 'Jane Doe',
            wwwwh: '',
            observations: 'Old note',
            eventClass: 'individual',
          },
          {
            id: 'evt-2',
            date: '2025-01-02',
            category: 'Individual',
            intensity: 1,
            frequency: 1,
            impact: 1,
            howWell: 5,
            otherPersonName: '',
            primaryPersonName: 'Jane Doe',
            wwwwh: '',
            observations: 'Delete me',
            eventClass: 'individual',
          },
          {
            id: 'evt-local',
            date: '2025-01-03',
            category: 'Individual',
            intensity: 1,
            frequency: 1,
            impact: 1,
            howWell: 5,
            otherPersonName: '',
            primaryPersonName: 'Jane Doe',
            wwwwh: '',
            observations: 'Keep me',
            eventClass: 'individual',
          },
        ],
      }),
    ];

    const bundle = {
      kind: 'fam-diag-person-events' as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      people: [
        {
          personId: 'p1',
          personName: 'Jane Doe',
          baselineEventIds: ['evt-1', 'evt-2'],
          events: [
            {
              id: 'evt-1',
              date: '2025-01-01',
              category: 'Individual',
              intensity: 2,
              frequency: 1,
              impact: 1,
              howWell: 5,
              otherPersonName: '',
              primaryPersonName: 'Jane Doe',
              wwwwh: '',
              observations: 'Updated note',
              eventClass: 'individual' as const,
            },
            {
              id: 'evt-3',
              date: '2025-01-04',
              category: 'Individual',
              intensity: 1,
              frequency: 1,
              impact: 1,
              howWell: 5,
              otherPersonName: '',
              primaryPersonName: 'Jane Doe',
              wwwwh: '',
              observations: 'New event',
              eventClass: 'individual' as const,
            },
          ],
        },
      ],
    };

    const result = mergePersonEventsFromBundle(currentPeople, bundle);
    const mergedEvents = result.people[0].events || [];
    expect(mergedEvents.map((event) => event.id).sort()).toEqual(['evt-1', 'evt-3', 'evt-local']);
    expect(mergedEvents.find((event) => event.id === 'evt-1')?.observations).toBe('Updated note');
    expect(result.summary.removedEvents).toBe(1);
    expect(result.summary.addedEvents).toBe(1);
    expect(result.summary.matchedPeople).toBe(1);
  });

  it('supports standalone timeline json format and conversion', () => {
    const people: Person[] = [
      makePerson({
        id: 'p1',
        name: 'Jane Doe',
        events: [],
      }),
    ];
    const timeline = buildTimelineJson(people, 'Name1.json');
    expect(isTimelineJson(timeline)).toBe(true);
    expect(timeline.timelineName).toBe('Name1 - timeline');
    const bundle = timelineJsonToBundle(timeline);
    expect(isPersonEventBundle(bundle)).toBe(true);
    expect(bundle.people[0].personName).toBe('Jane Doe');
  });
});
