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

/**
 * The identification a user can actually read. The block itself only shows a
 * three-letter code (Bir, Dea, Mar) because it is positioned by date and is
 * often a few pixels wide; the hover bubble carries "what — who — relation",
 * and that is what these assertions check.
 */
const hoverTexts = (): string =>
  Array.from(document.querySelectorAll('[data-hover-text]'))
    .map((element) => element.getAttribute('data-hover-text') || '')
    .join('\n');

/** The three-letter codes rendered inside the blocks. */
const blockCodes = (): string[] =>
  Array.from(document.querySelectorAll('div[data-hover-text] strong')).map(
    (element) => element.textContent || ''
  );

describe('TimelineBoardModal — person lane completeness', () => {
  it('test_m7a1_person_lane_shows_own_marriage_without_family_lane', () => {
    // No family lane is selected: before the fix the person's own marriage
    // was deferred to a Family lane that does not exist here, so it never
    // appeared anywhere.
    renderBoard({ timelineFamilySelectionIds: [] });
    expect(hoverTexts()).toContain('Marriage');
  });

  it('test_m7a1_person_lane_shows_separation_and_divorce', () => {
    renderBoard();
    expect(hoverTexts()).toContain('Separation');
    // The parents' divorce arrives as a system event on the lane.
    expect(hoverTexts()).toContain('Divorce \u2014 Dad + Mum \u2014 Parents');
  });

  it('test_m7a1_birth_and_death_still_render_once', () => {
    renderBoard();
    const birthMatches = hoverTexts().match(/Birth/g) || [];
    expect(birthMatches.length).toBeGreaterThanOrEqual(1);
    // Own birth is not duplicated by the shared synthesizer.
    expect(birthMatches.length).toBeLessThanOrEqual(2);
  });

  it('test_m7a2_own_family_and_triangle_events_on_person_lane', () => {
    renderBoard();
    expect(hoverTexts()).toContain('House fire');
  });

  it('test_timeline_block_shows_a_three_letter_code', () => {
    renderBoard();
    const codes = blockCodes();
    expect(codes.length).toBeGreaterThan(0);
    // Every block carries a short code, not a truncated sentence.
    codes.forEach((code) => expect(code.length).toBeLessThanOrEqual(3));
    expect(codes).toContain('Bir');
    expect(codes).toContain('Mar');
  });

  it('test_timeline_block_has_no_native_title_tooltip', () => {
    // A `title` makes the browser draw its own tooltip a second or two after
    // the styled bubble, so every block showed two hover bubbles.
    renderBoard();
    const blocks = Array.from(document.querySelectorAll('div[data-hover-text]'));
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => expect(block.hasAttribute('title')).toBe(false));
    // The text is still exposed to assistive tech.
    expect(blocks[0].getAttribute('aria-label')).toBe(
      blocks[0].getAttribute('data-hover-text')
    );
  });

  it('test_timeline_hover_never_shows_the_synthesizer_placeholder', () => {
    renderBoard();
    expect(hoverTexts()).not.toContain('auto-generated from date field');
  });

  it('test_m7a3_timeline_imports_shared_synthesizer', () => {
    const source = readFileSync(join(__dirname, './TimelineBoardModal.tsx'), 'utf8');
    expect(source).toContain("from '../../utils/syntheticDateEvents'");
    expect(source).toContain('synthesizePartnershipDateEvents');
    expect(source).toContain('synthesizePersonDateEvents');
    expect(source).toContain('synthesizePersonIndicatorEvents');
  });
});

describe('TimelineBoardModal — opening and closing', () => {
  it('test_timeline_board_survives_being_opened_after_being_closed', () => {
    // The component returns null when nothing is selected, so every hook has
    // to sit above that line. A hook declared below it runs only while the
    // board is open, and React crashes with "rendered more hooks than during
    // the previous render" the moment a user opens the board — a white
    // screen that never shows up in a test that renders it already-open.
    const props = {
      people,
      partnerships,
      allEmotionalLines: [],
      eventCategories: [],
      timelineFamilySelectionIds: [],
      familyScope: computeFamilyScope(people, partnerships, 'root', defaultFocusForRoot('root')),
      onUpdatePerson: vi.fn(),
      onUpdatePartnership: vi.fn(),
      onUpdateEmotionalLine: vi.fn(),
      onClose: vi.fn(),
    };
    // Closed first...
    const { rerender } = render(<TimelineBoardModal {...props} timelineSelectionIds={[]} />);
    expect(screen.queryByText('Timeline Board')).not.toBeInTheDocument();

    // ...then opened, which is when the hook order used to change.
    rerender(<TimelineBoardModal {...props} timelineSelectionIds={['root']} />);
    expect(screen.getByText('Timeline Board')).toBeInTheDocument();

    // ...and closed again.
    rerender(<TimelineBoardModal {...props} timelineSelectionIds={[]} />);
    expect(screen.queryByText('Timeline Board')).not.toBeInTheDocument();
  });
});

describe('TimelineBoardModal — duplicate partnership events', () => {
  /**
   * Reported on "Peter Doe": each of his marriage events appeared twice.
   * A partnership event is cloned onto both partners with a `-p1` / `-p2`
   * id suffix, and the lane compared exact ids — so it listed the clone held
   * on the person AND the partnership's own original.
   */
  const marriageEvent = event('1789853310593-a33193f5d8f1f', 'Married', '1990-01-01', {
    eventClass: 'relationship',
    anchorType: 'RELATIONSHIP_PRL',
    anchorId: 'prRoot',
  });

  const clonedPeople: Person[] = people.map((person) =>
    person.id === 'root'
      ? { ...person, events: [{ ...marriageEvent, id: `${marriageEvent.id}-p1` }] }
      : person.id === 'wife'
      ? { ...person, events: [{ ...marriageEvent, id: `${marriageEvent.id}-p2` }] }
      : person
  );
  const clonedPartnerships: Partnership[] = partnerships.map((partnership) =>
    partnership.id === 'prRoot'
      ? { ...partnership, events: [marriageEvent] }
      : partnership
  );

  it('test_timeline_partnership_event_is_not_listed_twice_on_a_partners_lane', () => {
    renderBoard({
      people: clonedPeople,
      partnerships: clonedPartnerships,
      familyScope: computeFamilyScope(
        clonedPeople,
        clonedPartnerships,
        'root',
        defaultFocusForRoot('root')
      ),
    });
    const married = Array.from(document.querySelectorAll('[data-hover-text]')).filter((element) =>
      (element.getAttribute('data-hover-text') || '').startsWith('Married')
    );
    expect(married).toHaveLength(1);
  });

  it('test_timeline_the_other_partners_clone_is_not_listed_either', () => {
    renderBoard({
      people: clonedPeople,
      partnerships: clonedPartnerships,
      timelineSelectionIds: ['wife'],
      familyScope: computeFamilyScope(
        clonedPeople,
        clonedPartnerships,
        'wife',
        defaultFocusForRoot('wife')
      ),
    });
    const married = Array.from(document.querySelectorAll('[data-hover-text]')).filter((element) =>
      (element.getAttribute('data-hover-text') || '').startsWith('Married')
    );
    expect(married).toHaveLength(1);
  });
});

describe('TimelineBoardModal — year header', () => {
  /**
   * Reported: the year header showed only three digits. Each year cell has an
   * opaque background, so a label centred inside a narrow cell had its
   * overflow painted over by the next cell and "2026" read as "202".
   */
  it('test_timeline_year_labels_show_all_four_digits', () => {
    renderBoard();
    const labels = screen.getAllByTestId('timeline-year-label');
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect((label.textContent || '').trim()).toMatch(/^\d{4}$/);
    });
  });

  it('test_timeline_year_labels_are_not_drawn_inside_the_year_cells', () => {
    // The mechanism, not just the symptom: a label nested in a cell is
    // clipped by whatever the next cell paints. Labels must be their own
    // layer, and the cells must carry no text of their own.
    renderBoard();
    const labels = screen.getAllByTestId('timeline-year-label');
    labels.forEach((label) => {
      expect(label.parentElement?.getAttribute('data-testid')).not.toBe(
        'timeline-year-label'
      );
      // Sized by its content, never by the year cell's width.
      expect(label.style.width).toBe('');
      expect(label.style.whiteSpace).toBe('nowrap');
      // And it must not swallow the cell's click target underneath.
      expect(label.style.pointerEvents).toBe('none');
    });
  });
});

describe('TimelineBoardModal — block shape and intensity', () => {
  const styleOf = (titlePrefix: string): CSSStyleDeclaration | undefined => {
    const element = Array.from(document.querySelectorAll('div[data-hover-text]')).find((node) =>
      (node.getAttribute('data-hover-text') || '').startsWith(titlePrefix)
    ) as HTMLElement | undefined;
    return element?.style;
  };

  it('test_timeline_male_events_are_rectangles_and_female_events_are_ovals', () => {
    // The fixture's women had no dated events, so the female half of this
    // rule was never exercised here. Give the wife and the mother one each.
    const withFemaleEvents = people.map((person) =>
      person.id === 'wife'
        ? { ...person, birthDate: '1972-03-03' }
        : person.id === 'mum'
        ? { ...person, events: [event('mum-evt', 'Illness', '1994-02-02')] }
        : person
    );
    renderBoard({
      people: withFemaleEvents,
      timelineSelectionIds: ['root', 'wife'],
      familyScope: computeFamilyScope(
        withFemaleEvents,
        partnerships,
        'root',
        defaultFocusForRoot('root')
      ),
    });

    // Male owners: rectangles.
    expect(styleOf('Birth — Root')?.borderRadius).toBe('2px');
    expect(styleOf('Birth — Son')?.borderRadius).toBe('2px');
    // Female owners: wide ovals — on her own lane and as a system event on his.
    expect(styleOf('Birth — Wife')?.borderRadius).toBe('999px');
    expect(styleOf('Illness — Mum')?.borderRadius).toBe('999px');
  });

  it('test_timeline_couple_events_stay_neutral', () => {
    renderBoard();
    expect(styleOf('Marriage — Root + Wife')?.borderRadius).toBe('6px');
  });

  it('test_timeline_intensity_drives_the_fill', () => {
    const rated = people.map((person) =>
      person.id === 'root'
        ? {
            ...person,
            events: [event('rated-5', 'Crisis', '2001-01-01', { intensity: 5 })],
          }
        : person
    );
    renderBoard({
      people: rated,
      familyScope: computeFamilyScope(rated, partnerships, 'root', defaultFocusForRoot('root')),
    });
    const style = styleOf('Crisis — Root');
    expect(style?.background).toBeTruthy();
    // An unrated event must not share the fill of a rated one.
    expect(style?.background).not.toBe(styleOf('Birth — Root')?.background);
  });
});

describe('TimelineBoardModal — system events', () => {
  it('test_m7e1_system_event_renders_on_person_lane_with_relation_label', () => {
    renderBoard();
    // "what — who — relation", the form the user asked for.
    expect(hoverTexts()).toContain('Death \u2014 Dad \u2014 Father');
    expect(hoverTexts()).toContain('Birth \u2014 Son \u2014 Son');
  });

  it('test_m7e2_toggle_off_hides_system_events_and_updates_count', () => {
    renderBoard();
    expect(hoverTexts()).toContain('Death \u2014 Dad');
    const countBefore = screen.getByTestId('system-events-count').textContent || '';
    expect(countBefore).toMatch(/system events? from \d+ relatives?/);

    fireEvent.click(screen.getByTestId('system-events-toggle'));
    expect(hoverTexts()).not.toContain('Death \u2014 Dad');
    expect(screen.getByTestId('system-events-count').textContent).not.toMatch(/system event/);
    // The person's own events survive the toggle.
    expect(hoverTexts()).toContain('Marriage');
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

  it('test_m7e3_system_event_does_not_open_a_local_editor', () => {
    // A relative's event is read-only here. Opening the local editor would
    // edit the relative's record — and for a synthesized item would fabricate
    // a brand-new event on them, with the relation label as its category,
    // which then reaches the saved diagram.
    renderBoard();
    fireEvent.click(document.querySelector('[data-hover-text^="Death \u2014 Dad"]')!);
    expect(screen.queryByText(/Person Edit Event|Person Add Event/)).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline-selection-hint').textContent).toMatch(/Read-only/);
  });

  it('test_m7e3_own_event_still_opens_the_editor', () => {
    renderBoard();
    // Root's own marriage: an own item, so the local editor still opens.
    const own = Array.from(document.querySelectorAll('[data-hover-text]')).find((element) =>
      (element.getAttribute('data-hover-text') || '').startsWith('Marriage \u2014 Root + Wife')
    );
    expect(own).toBeDefined();
    fireEvent.click(own!);
    expect(screen.getByText(/Partnership Edit Event|Partnership Add Event/)).toBeInTheDocument();
  });

  it('test_m7e3_system_event_side_panel_fields_are_read_only', () => {
    renderBoard();
    fireEvent.click(document.querySelector('[data-hover-text^="Death \u2014 Dad"]')!);
    const nameField = screen.getByDisplayValue('Dad') as HTMLInputElement;
    expect(nameField.readOnly).toBe(true);
    // No "Add Event" button that would write to the relative.
    expect(screen.queryByRole('button', { name: 'Add Event' })).not.toBeInTheDocument();
  });

  it('test_m7g2_toggle_cycle_leaves_own_events_unchanged', () => {
    renderBoard();
    const ownBefore = screen.getByTestId('system-events-count').textContent?.match(/^(\d+) own/)?.[1];
    fireEvent.click(screen.getByTestId('system-events-toggle'));
    fireEvent.click(screen.getByTestId('system-events-toggle'));
    const ownAfter = screen.getByTestId('system-events-count').textContent?.match(/^(\d+) own/)?.[1];
    expect(ownAfter).toBe(ownBefore);
    expect(hoverTexts()).toContain('Death \u2014 Dad');
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

  it('test_m7e2_undated_ring_events_are_reported_not_dropped_silently', () => {
    const withUndated = people.map((person) =>
      person.id === 'mum'
        ? {
            ...person,
            events: [
              {
                ...event('mum-undated', 'Illness', ''),
                date: '',
                startDate: undefined,
              },
            ],
          }
        : person
    );
    renderBoard({
      people: withUndated,
      familyScope: computeFamilyScope(withUndated, partnerships, 'root', defaultFocusForRoot('root')),
    });
    expect(screen.getByTestId('system-events-count').textContent).toMatch(
      /\d+ undated, not placed/
    );
  });

  it('test_m7e1_lane_count_is_reported_without_truncation', () => {
    renderBoard({ timelineSelectionIds: ['root', 'son', 'dad', 'mum', 'wife'] });
    const header = screen.getByTestId('system-events-header');
    expect(within(header).getByText(/5 lanes/)).toBeInTheDocument();
  });
});
