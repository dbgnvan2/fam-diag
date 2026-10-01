import { describe, expect, it, vi } from 'vitest';
import type { EmotionalProcessEvent, Person } from '../types';
import {
  buildTimelineJson,
  buildPersonEventBundle,
  isTimelineJson,
  isPersonEventBundle,
  mergePersonEventsFromBundle,
  timelineJsonToBundle,
  importPersonEventFile,
  normalizePersonNameKey,
  sanitizeBundlePeople,
  type PersonEventBundle,
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

describe('buildPersonEventBundle — hidden date records', () => {
  it('leaves out the old person-date records, and merging back keeps them', () => {
    const record = {
      id: 'rec', date: '1990-01-01', startDate: '1990-01-01', category: 'Individual', subtype: 'Birth Date',
      eventType: 'NODAL' as const, status: 'discrete' as const, intensity: 0, howWell: 0,
      otherPersonName: '', wwwwh: '', observations: '', eventClass: 'individual' as const,
    };
    const own = { ...record, id: 'own', category: 'Relocation', subtype: 'Moved' };
    const people = [{ id: 'p', name: 'P', x: 0, y: 0, partnerships: [], events: [record, own] }];
    const bundle = buildPersonEventBundle(people);
    expect(bundle.people[0].events.map((e) => e.id)).toEqual(['own']);
    expect(bundle.people[0].baselineEventIds).toEqual(['own']);
  });
});

// ─── REVIEW-final-areas-2026-09-30.md bundle-01..04 ──────────────────────────

const ev = (overrides: Partial<EmotionalProcessEvent> = {}): EmotionalProcessEvent => ({
  id: 'e1',
  date: '2001-05-01',
  startDate: '2001-05-01',
  category: 'Relocation',
  subtype: 'Moved',
  eventType: 'NODAL',
  status: 'discrete',
  intensity: 2,
  howWell: 0,
  otherPersonName: '',
  wwwwh: '',
  observations: 'Moved',
  eventClass: 'individual',
  ...overrides,
});

const bundleOf = (
  people: Array<{ personId?: string; personName: string; baselineEventIds?: string[]; events: unknown[] }>,
): PersonEventBundle => ({
  kind: 'fam-diag-person-events',
  version: 1,
  exportedAt: '2026-09-30T00:00:00.000Z',
  people: people as PersonEventBundle['people'],
});

describe('bundle-01: unchanged events and confirmation', () => {
  it('bundle_01_identical_events_are_not_counted_or_replaced', () => {
    const stored = ev({ createdAt: 5 });
    const people = [makePerson({ id: 'p1', events: [stored] })];
    const result = mergePersonEventsFromBundle(people, buildPersonEventBundle(people));
    expect(result.summary.updatedEvents).toBe(0);
    expect(result.summary.unchangedEvents).toBe(1);
    expect(result.people[0].events?.[0]).toBe(stored);
  });

  it('bundle_01_import_asks_with_counts_before_changing_anything', () => {
    const people = [
      makePerson({ id: 'p1', events: [ev(), ev({ id: 'e2', observations: 'Gone' })] }),
    ];
    const bundle = bundleOf([
      {
        personId: 'p1',
        personName: 'Jane Doe',
        baselineEventIds: ['e1', 'e2'],
        events: [ev({ observations: 'Edited' }), ev({ id: 'e3' })],
      },
      { personName: 'Nobody Here', events: [ev({ id: 'e9' })] },
    ]);
    const confirm = vi.fn(() => false);
    const cancelled = importPersonEventFile(bundle, people, confirm);
    expect(cancelled.status).toBe('cancelled');
    expect(confirm).toHaveBeenCalledTimes(1);
    const message = String(confirm.mock.calls[0][0]);
    expect(message).toContain('Add: 1');
    expect(message).toContain('Update: 1');
    expect(message).toContain('Remove: 1');
    expect(message).toContain('Nobody Here');

    const applied = importPersonEventFile(bundle, people, () => true);
    expect(applied.status).toBe('applied');
    if (applied.status !== 'applied') return;
    expect(applied.people[0].events?.map((event) => event.id).sort()).toEqual(['e1', 'e3']);
  });

  it('bundle_01_no_changes_does_not_ask', () => {
    const people = [makePerson({ id: 'p1', events: [ev()] })];
    const confirm = vi.fn(() => true);
    const outcome = importPersonEventFile(buildTimelineJson(people), people, confirm);
    expect(outcome.status).toBe('no-changes');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('bundle_01_rejects_a_file_that_is_not_a_bundle', () => {
    expect(importPersonEventFile({ kind: 'other' }, [], () => true).status).toBe('invalid');
  });
});

describe('bundle-02: Unicode-aware name matching', () => {
  it('bundle_02_matches_non_latin_and_accented_names', () => {
    expect(normalizePersonNameKey('李明')).toBe('李明');
    expect(normalizePersonNameKey('José')).toBe('jose');
    const people = [
      makePerson({ id: 'a', name: '李明', events: [] }),
      makePerson({ id: 'b', name: 'Jose Alvarez', events: [] }),
    ];
    const result = mergePersonEventsFromBundle(
      people,
      bundleOf([
        { personName: '李明', events: [ev({ id: 'x1' })] },
        { personName: 'José Álvarez', events: [ev({ id: 'x2' })] },
      ]),
    );
    expect(result.summary.matchedPeople).toBe(2);
    expect(result.people[0].events?.map((event) => event.id)).toEqual(['x1']);
    expect(result.people[1].events?.map((event) => event.id)).toEqual(['x2']);
  });

  it('bundle_02_two_people_with_the_name_match_nobody', () => {
    const people = [
      makePerson({ id: 'a', name: 'Sam Lee', events: [] }),
      makePerson({ id: 'b', name: 'Sam Lee', events: [] }),
    ];
    const result = mergePersonEventsFromBundle(people, bundleOf([{ personName: 'Sam Lee', events: [ev()] }]));
    expect(result.summary.matchedPeople).toBe(0);
    expect(result.summary.ambiguousPeople).toEqual(['Sam Lee']);
    expect(result.people.every((person) => (person.events || []).length === 0)).toBe(true);
  });

  it('bundle_02_an_empty_name_key_never_matches', () => {
    const people = [makePerson({ id: 'a', name: '???', events: [] })];
    const result = mergePersonEventsFromBundle(people, bundleOf([{ personName: '!!!', events: [ev()] }]));
    expect(result.summary.matchedPeople).toBe(0);
    expect(result.summary.unmatchedPeople).toEqual(['!!!']);
  });
});

describe('bundle-03: imported events go through eventDraft', () => {
  it('bundle_03_new_event_gets_owner_dates_and_keeps_its_class_and_category', () => {
    const people = [makePerson({ id: 'p1', events: [] })];
    const incoming = { ...ev({ id: 'n1', eventClass: 'relationship', category: '' }) } as Partial<EmotionalProcessEvent>;
    delete incoming.startDate;
    delete incoming.subtype;
    const result = mergePersonEventsFromBundle(people, bundleOf([{ personId: 'p1', personName: 'Jane Doe', events: [incoming] }]));
    const event = result.people[0].events?.[0];
    expect(event?.anchorType).toBe('PERSON');
    expect(event?.anchorId).toBe('p1');
    expect(event?.date).toBe('2001-05-01');
    expect(event?.startDate).toBe('2001-05-01');
    expect(event?.subtype).toBe('');
    expect(typeof event?.createdAt).toBe('number');
    expect(event?.eventClass).toBe('relationship');
    expect(event?.category).toBe('');
  });

  it('bundle_03_numeric_string_ratings_are_read_and_others_reported', () => {
    const people = [makePerson({ id: 'p1', events: [] })];
    const result = mergePersonEventsFromBundle(
      people,
      bundleOf([
        {
          personId: 'p1',
          personName: 'Jane Doe',
          events: [{ ...ev({ id: 'r1' }), intensity: '4', howWell: 'high' }],
        },
      ]),
    );
    const event = result.people[0].events?.[0];
    expect(event?.intensity).toBe(4);
    expect(event?.howWell).toBe(0);
    expect(result.summary.unreadableRatings).toBe(1);
  });

  it('bundle_03_an_edited_date_beside_a_stale_startDate_wins', () => {
    const people = [makePerson({ id: 'p1', events: [ev()] })];
    const result = mergePersonEventsFromBundle(
      people,
      bundleOf([{ personId: 'p1', personName: 'Jane Doe', events: [ev({ date: '2009-09-09' })] }]),
    );
    const event = result.people[0].events?.[0];
    expect(event?.date).toBe('2009-09-09');
    expect(event?.startDate).toBe('2009-09-09');
  });
});

describe('bundle-04: invalid events in a file', () => {
  it('bundle_04_invalid_entries_are_dropped_counted_and_not_read_as_deletions', () => {
    const people = [makePerson({ id: 'p1', events: [ev({ id: 'bad' }), ev()] })];
    const result = mergePersonEventsFromBundle(
      people,
      bundleOf([
        {
          personId: 'p1',
          personName: 'Jane Doe',
          baselineEventIds: ['bad', 'e1'],
          events: [null, { ...ev({ id: 'bad' }), observations: { text: 'x' } }, ev()],
        },
      ]),
    );
    expect(result.summary.droppedEvents).toBe(2);
    expect(result.summary.removedEvents).toBe(0);
    expect(result.people[0].events?.map((event) => event.id).sort()).toEqual(['bad', 'e1']);
  });

  it('bundle_04_sanitize_counts_dropped_events', () => {
    const checked = sanitizeBundlePeople([
      { personName: 'A', events: [null, 'x', ev()] as unknown as EmotionalProcessEvent[] },
    ]);
    expect(checked.droppedEvents).toBe(2);
    expect(checked.people[0].events).toHaveLength(1);
  });
});

describe('person names follow the app\'s display-name rule (gate 2026-10-01 #6)', () => {
  const annie = makePerson({ id: 'ann', name: 'Annie', firstName: 'Ann', lastName: 'Lee', events: [] });

  it('a bundle names a person as the rest of the app does', () => {
    const bundle = buildPersonEventBundle([annie]);
    expect(bundle.people[0].personName).toBe('Ann Lee');
  });

  it('a bundle written under the old rule (stored name) still matches by name', () => {
    const oldBundle: PersonEventBundle = {
      ...buildPersonEventBundle([annie]),
      people: [{ personName: 'Annie', events: [] }],
    };
    const { summary } = mergePersonEventsFromBundle([annie], oldBundle);
    expect(summary.matchedPeople).toBe(1);
    expect(summary.unmatchedPeople).toEqual([]);
  });
});
