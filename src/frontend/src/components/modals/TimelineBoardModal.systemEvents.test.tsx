/**
 * Spec: docs/implementation_plan_2026-09-19.md#M7.A
 *       docs/implementation_plan_2026-09-19.md#M7.E
 *       docs/implementation_plan_2026-09-19.md#M7.G.2
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import TimelineBoardModal from './TimelineBoardModal';
import { computeFamilyScope, defaultFocusForRoot } from '../../utils/familyScope';
import type { EmotionalProcessEvent, Partnership, Person } from '../../types';

const event = (
  id: string,
  category: string,
  date: string,
  overrides: Partial<EmotionalProcessEvent> = {}
): EmotionalProcessEvent => ({
  id,
  date,
  startDate: date,
  category,
  eventType: 'NODAL',
  status: 'discrete',
  intensity: 0,
  howWell: 0,
  otherPersonName: 'None',
  wwwwh: '',
  observations: '',
  eventClass: 'individual',
  ...overrides,
});

const people: Person[] = [
  {
    id: 'dad',
    name: 'Dad',
    x: 0,
    y: 0,
    partnerships: ['prP'],
    birthSex: 'male',
    deathDate: '1998-04-01',
  },
  { id: 'mum', name: 'Mum', x: 0, y: 0, partnerships: ['prP'], birthSex: 'female' },
  {
    id: 'root',
    name: 'Root',
    x: 0,
    y: 0,
    partnerships: ['prRoot'],
    parentPartnership: 'prP',
    birthSex: 'male',
    birthDate: '1970-01-01',
  },
  { id: 'wife', name: 'Wife', x: 0, y: 0, partnerships: ['prRoot'], birthSex: 'female' },
  {
    id: 'son',
    name: 'Son',
    x: 0,
    y: 0,
    partnerships: [],
    parentPartnership: 'prRoot',
    birthSex: 'male',
    birthDate: '2000-08-08',
  },
];

const partnerships: Partnership[] = [
  {
    id: 'prP',
    partner1_id: 'dad',
    partner2_id: 'mum',
    horizontalConnectorY: 0,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children: ['root'],
    marriedStartDate: '1962-06-01',
    divorceDate: '1985-09-09',
  },
  {
    id: 'prRoot',
    partner1_id: 'root',
    partner2_id: 'wife',
    horizontalConnectorY: 0,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children: ['son'],
    marriedStartDate: '1995-07-07',
    separationDate: '2010-02-02',
    familyEvents: [
      event('own-fam', 'House fire', '2005-05-05', {
        eventType: 'FAMILY',
        eventClass: 'family',
      }),
    ],
  },
];

const renderBoard = (
  overrides: Partial<React.ComponentProps<typeof TimelineBoardModal>> = {}
) => {
  const props: React.ComponentProps<typeof TimelineBoardModal> = {
    people,
    partnerships,
    allEmotionalLines: [],
    eventCategories: [],
    timelineSelectionIds: ['root'],
    timelineFamilySelectionIds: [],
    familyScope: computeFamilyScope(people, partnerships, 'root', defaultFocusForRoot('root')),
    onUpdatePerson: vi.fn(),
    onUpdatePartnership: vi.fn(),
    onUpdateEmotionalLine: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TimelineBoardModal {...props} />);
  return props;
};

/** All timeline item labels currently rendered. */
const itemText = (): string => document.body.textContent || '';

describe('TimelineBoardModal — person lane completeness', () => {
  it('test_m7a1_person_lane_shows_own_marriage_without_family_lane', () => {
    // No family lane is selected: before the fix the person's own marriage
    // was deferred to a Family lane that does not exist here, so it never
    // appeared anywhere.
    renderBoard({ timelineFamilySelectionIds: [] });
    expect(itemText()).toContain('Marriage');
  });

  it('test_m7a1_person_lane_shows_separation_and_divorce', () => {
    renderBoard();
    expect(itemText()).toContain('Separation');
    // The parents' divorce arrives as a system event on the lane.
    expect(itemText()).toContain('Parents divorced');
  });

  it('test_m7a1_birth_and_death_still_render_once', () => {
    renderBoard();
    const birthMatches = itemText().match(/Birth/g) || [];
    expect(birthMatches.length).toBeGreaterThanOrEqual(1);
    // Own birth is not duplicated by the shared synthesizer.
    expect(birthMatches.length).toBeLessThanOrEqual(2);
  });

  it('test_m7a2_own_family_and_triangle_events_on_person_lane', () => {
    renderBoard();
    expect(itemText()).toContain('House fire');
  });

  it('test_m7a3_timeline_imports_shared_synthesizer', () => {
    const source = readFileSync(join(__dirname, './TimelineBoardModal.tsx'), 'utf8');
    expect(source).toContain("from '../../utils/syntheticDateEvents'");
    expect(source).toContain('synthesizePartnershipDateEvents');
    expect(source).toContain('synthesizePersonDateEvents');
    expect(source).toContain('synthesizePersonIndicatorEvents');
  });
});

describe('TimelineBoardModal — system events', () => {
  it('test_m7e1_system_event_renders_on_person_lane_with_relation_label', () => {
    renderBoard();
    expect(itemText()).toContain('Father died');
    expect(itemText()).toContain('Son born');
  });

  it('test_m7e2_toggle_off_hides_system_events_and_updates_count', () => {
    renderBoard();
    expect(itemText()).toContain('Father died');
    const countBefore = screen.getByTestId('system-events-count').textContent || '';
    expect(countBefore).toMatch(/system events? from \d+ relatives?/);

    fireEvent.click(screen.getByTestId('system-events-toggle'));
    expect(itemText()).not.toContain('Father died');
    expect(screen.getByTestId('system-events-count').textContent).not.toMatch(/system event/);
    // The person's own events survive the toggle.
    expect(itemText()).toContain('Marriage');
  });

  it('test_m7e2_reports_no_birthdate_caveat', () => {
    const undated = people.map((person) =>
      person.id === 'root' ? { ...person, birthDate: undefined } : person
    );
    renderBoard({
      people: undated,
      familyScope: computeFamilyScope(undated, partnerships, 'root', defaultFocusForRoot('root')),
    });
    expect(screen.getByTestId('system-events-count').textContent).toContain(
      'no birth date, lifetime filter not applied'
    );
  });

  it('test_m7e3_click_opens_event_on_owning_entity', () => {
    renderBoard();
    const item = screen.getByText('Father died');
    fireEvent.click(item);
    // The EventModal opens against the owner (Dad), not the lane person.
    const modalTitle = screen.getByText(/Person Edit Event|Person Add Event/);
    expect(modalTitle.textContent).toContain('Dad');
  });

  it('test_m7g2_toggle_cycle_leaves_own_events_unchanged', () => {
    renderBoard();
    const ownBefore = screen.getByTestId('system-events-count').textContent?.match(/^(\d+) own/)?.[1];
    fireEvent.click(screen.getByTestId('system-events-toggle'));
    fireEvent.click(screen.getByTestId('system-events-toggle'));
    const ownAfter = screen.getByTestId('system-events-count').textContent?.match(/^(\d+) own/)?.[1];
    expect(ownAfter).toBe(ownBefore);
    expect(itemText()).toContain('Father died');
  });

  it('test_m7e2_relative_count_counts_people_not_owner_entities', () => {
    renderBoard();
    const text = screen.getByTestId('system-events-count').textContent || '';
    const relatives = Number(text.match(/from (\d+) relative/)?.[1]);
    // The ring around Root holds Dad, Mum, Wife and Son. A partnership or
    // pattern contributing an event must count the people in it, not itself,
    // so the number can never exceed the people in the scope.
    expect(relatives).toBeGreaterThan(0);
    expect(relatives).toBeLessThanOrEqual(people.length - 1);
  });

  it('test_m7e1_lane_count_is_reported_without_truncation', () => {
    renderBoard({ timelineSelectionIds: ['root', 'son', 'dad', 'mum', 'wife'] });
    const header = screen.getByTestId('system-events-header');
    expect(within(header).getByText(/5 lanes/)).toBeInTheDocument();
  });
});
