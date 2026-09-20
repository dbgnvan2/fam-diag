/**
 * Spec: docs/implementation_plan_2026-09-19.md#M7.F
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PropertiesPanel from './PropertiesPanel';
import { computeFamilyScope, defaultFocusForRoot } from '../utils/familyScope';
import type { EmotionalProcessEvent, Partnership, Person } from '../types';

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
  anchorType: 'PERSON',
  ...overrides,
});

const buildPeople = (): Person[] => [
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
    partnerships: [],
    parentPartnership: 'prP',
    birthSex: 'male',
    birthDate: '1970-01-01',
    events: [event('own-1', 'Job change', '1999-01-01', { anchorId: 'root' })],
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
];

const renderPanel = (
  overrides: Partial<React.ComponentProps<typeof PropertiesPanel>> = {}
) => {
  const people = buildPeople();
  const props: React.ComponentProps<typeof PropertiesPanel> = {
    selectedItem: people.find((person) => person.id === 'root')!,
    people,
    partnerships,
    eventCategories: ['Job change'],
    functionalIndicatorDefinitions: [],
    sirCategories: [],
    functionalFactCategories: [],
    allEmotionalLines: [],
    familyScope: computeFamilyScope(people, partnerships, 'root', defaultFocusForRoot('root')),
    initialActiveTab: 'events',
    onUpdatePerson: vi.fn(),
    onUpdatePartnership: vi.fn(),
    onUpdateEmotionalLine: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<PropertiesPanel {...props} />);
  return props;
};

describe('PropertiesPanel — system events on the Events tab', () => {
  it('test_m7f1_events_tab_lists_parents_divorce', () => {
    renderPanel();
    const section = screen.getByTestId('system-events-section');
    expect(within(section).getByText('Parents divorced')).toBeInTheDocument();
    expect(within(section).getByText('Father died')).toBeInTheDocument();
  });

  it('test_m7f1_reports_how_many_relatives_contributed', () => {
    renderPanel();
    const section = screen.getByTestId('system-events-section');
    expect(section.textContent).toMatch(/from \d+ relatives? in this family/);
  });

  it('test_m7f2_system_event_card_is_readonly_on_person', () => {
    renderPanel();
    const section = screen.getByTestId('system-events-section');
    // No edit pencil and no delete control on a relative's event.
    expect(within(section).queryByLabelText('Delete')).not.toBeInTheDocument();
    expect(within(section).queryByLabelText('Edit')).not.toBeInTheDocument();
    expect(within(section).getAllByLabelText('Open on owner').length).toBeGreaterThan(0);
  });

  it('test_m7f2_own_event_card_still_editable', () => {
    renderPanel();
    const section = screen.getByTestId('system-events-section');
    const allDeletes = screen.getAllByLabelText('Delete');
    // The person's own event keeps its controls, outside the system section.
    expect(allDeletes.length).toBeGreaterThan(0);
    allDeletes.forEach((button) => expect(section.contains(button)).toBe(false));
  });

  it('test_m7f2_opening_a_system_event_targets_its_owner', () => {
    const onSelectSystemEventOwner = vi.fn();
    renderPanel({ onSelectSystemEventOwner });
    const section = screen.getByTestId('system-events-section');
    const openButtons = within(section).getAllByLabelText('Open on owner');
    fireEvent.click(openButtons[0]);
    expect(onSelectSystemEventOwner).toHaveBeenCalledTimes(1);
    const owner = onSelectSystemEventOwner.mock.calls[0][0];
    expect(['person', 'partnership', 'emotional']).toContain(owner.type);
    expect(owner.id).not.toBe('root');
  });

  it('test_m7f3_deleting_owner_event_clears_it_from_relative_view', () => {
    // The panel is a projection: remove the owner's event and it is gone from
    // the relative's tab on the next render.
    const people = buildPeople();
    const withSiblingEvent = [
      ...people,
      {
        id: 'sister',
        name: 'Sister',
        x: 0,
        y: 0,
        partnerships: [],
        parentPartnership: 'prP',
        birthSex: 'female' as const,
        birthDate: '1972-01-01',
        events: [event('sis-1', 'Illness', '1990-01-01', { anchorId: 'sister' })],
      },
    ];
    const withChildren: Partnership[] = [
      { ...partnerships[0], children: ['root', 'sister'] },
    ];
    const scope = computeFamilyScope(withSiblingEvent, withChildren, 'root', defaultFocusForRoot('root'));
    const { unmount } = render(
      <PropertiesPanel
        selectedItem={withSiblingEvent.find((person) => person.id === 'root')!}
        people={withSiblingEvent}
        partnerships={withChildren}
        eventCategories={[]}
        functionalIndicatorDefinitions={[]}
        sirCategories={[]}
        functionalFactCategories={[]}
        allEmotionalLines={[]}
        familyScope={scope}
        initialActiveTab="events"
        onUpdatePerson={vi.fn()}
        onUpdatePartnership={vi.fn()}
        onUpdateEmotionalLine={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Sister Illness/)).toBeInTheDocument();
    unmount();

    const pruned = withSiblingEvent.map((person) =>
      person.id === 'sister' ? { ...person, events: [] } : person
    );
    render(
      <PropertiesPanel
        selectedItem={pruned.find((person) => person.id === 'root')!}
        people={pruned}
        partnerships={withChildren}
        eventCategories={[]}
        functionalIndicatorDefinitions={[]}
        sirCategories={[]}
        functionalFactCategories={[]}
        allEmotionalLines={[]}
        familyScope={computeFamilyScope(pruned, withChildren, 'root', defaultFocusForRoot('root'))}
        initialActiveTab="events"
        onUpdatePerson={vi.fn()}
        onUpdatePartnership={vi.fn()}
        onUpdateEmotionalLine={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText(/Sister Illness/)).not.toBeInTheDocument();
  });

  it('test_m7f1_no_system_section_without_a_scope', () => {
    renderPanel({ familyScope: null });
    expect(screen.queryByTestId('system-events-section')).not.toBeInTheDocument();
  });
});
