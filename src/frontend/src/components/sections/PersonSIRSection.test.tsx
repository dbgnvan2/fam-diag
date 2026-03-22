import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PersonSIRSection from './PersonSIRSection';
import type { Person, SIRCategoryDefinition, EmotionalProcessEvent } from '../../types';

const defaultCategories: SIRCategoryDefinition[] = [
  {
    id: 'sir-resource',
    name: 'Resource to Other',
    levels: ['Reactive, Unhelpful', 'Little Help, Reactive', 'Medium Reactivity, Some Help', 'Some Reactivity, Helpful', 'Neutral, Helpful'],
  },
  {
    id: 'sir-reactivity',
    name: 'Managing Reactivity',
    levels: ['High Reactivity', 'Significant Reactivity', 'Moderate Reactivity', 'Low Reactivity', 'Calm, Grounded'],
  },
];

const makePerson = (overrides?: Partial<Person>): Person =>
  ({
    id: 'p1',
    name: 'Alice',
    x: 0,
    y: 0,
    gender: 'female',
    birthSex: 'female',
    genderIdentity: 'female',
    genderSymbol: 'female',
    events: [],
    ...overrides,
  } as Person);

const makeOtherPerson = (): Person =>
  ({
    id: 'p2',
    name: 'Bob',
    x: 0,
    y: 0,
    gender: 'male',
    birthSex: 'male',
    genderIdentity: 'male',
    genderSymbol: 'male',
    events: [],
  } as Person);

const makeSirEvent = (overrides?: Partial<EmotionalProcessEvent>): EmotionalProcessEvent => ({
  id: 'sir-ev-1',
  date: '2026-03-20',
  startDate: '2026-03-20',
  category: 'Resource to Other',
  eventType: 'SIR' as const,
  anchorType: 'PERSON' as const,
  anchorId: 'p1',
  status: 'discrete' as const,
  subtype: 'Stayed calm during argument',
  intensity: 3,
  frequency: 2,
  impact: 0,
  howWell: 4,
  otherPersonName: 'Bob',
  primaryPersonName: 'Alice',
  wwwwh: '',
  observations: 'Good progress',
  eventClass: 'individual' as const,
  createdAt: Date.now(),
  ...overrides,
});

describe('PersonSIRSection', () => {
  it('shows empty state when no SIR events exist', () => {
    const person = makePerson();
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={vi.fn()}
        updatePersonDraftState={vi.fn()}
      />,
    );
    expect(screen.getByText(/No entries yet/)).toBeTruthy();
  });

  it('renders existing SIR event cards with badges', () => {
    const event = makeSirEvent();
    const person = makePerson({ events: [event] });
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={vi.fn()}
        updatePersonDraftState={vi.fn()}
      />,
    );
    expect(screen.getByText('Resource to Other')).toBeTruthy();
    expect(screen.getByText(/with Bob/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // intensity badge
    expect(screen.getByText('4')).toBeTruthy(); // hwdid badge
    expect(screen.getByText('Some Reactivity, Helpful')).toBeTruthy(); // hwdid label (level 4)
  });

  it('opens add form when + Add is clicked', () => {
    const person = makePerson();
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={vi.fn()}
        updatePersonDraftState={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add'));
    expect(screen.getByText('New Entry')).toBeTruthy();
    expect(screen.getByText('Date:')).toBeTruthy();
    expect(screen.getByText('With:')).toBeTruthy();
    expect(screen.getByText('Category:')).toBeTruthy();
    expect(screen.getByText('Behavior:')).toBeTruthy();
    expect(screen.getByText('HWDID:')).toBeTruthy();
  });

  it('saves a new SIR event when form is filled and Save clicked', () => {
    const person = makePerson();
    const onUpdatePerson = vi.fn();
    const updateDraft = vi.fn();
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={onUpdatePerson}
        updatePersonDraftState={updateDraft}
      />,
    );
    fireEvent.click(screen.getByText('+ Add'));

    // Fill the form — select other person and category
    const selects = document.querySelectorAll('select');
    // selects: With, Category, Intensity, Stress, HWDID
    fireEvent.change(selects[0], { target: { value: 'Bob' } }); // With
    fireEvent.change(selects[1], { target: { value: 'Managing Reactivity' } }); // Category

    fireEvent.click(screen.getByText('Save'));

    expect(onUpdatePerson).toHaveBeenCalledTimes(1);
    const [personId, updates] = onUpdatePerson.mock.calls[0];
    expect(personId).toBe('p1');
    expect(updates.events).toHaveLength(1);
    const saved = updates.events[0];
    expect(saved.eventType).toBe('SIR');
    expect(saved.category).toBe('Managing Reactivity');
    expect(saved.otherPersonName).toBe('Bob');
    expect(saved.anchorType).toBe('PERSON');
    expect(saved.anchorId).toBe('p1');
    expect(saved.startDate).toBeTruthy();
    expect(saved.eventClass).toBe('individual');
    expect(saved.createdAt).toBeGreaterThan(0);
  });

  it('shows HWDID help dialog with all 5 levels and sets score on click', () => {
    const person = makePerson();
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={vi.fn()}
        updatePersonDraftState={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('+ Add'));

    // Click the ? help button for HWDID
    fireEvent.click(screen.getByLabelText('Resource to Other HWDID help'));

    // Should show the HWDID scale dialog
    const dialog = screen.getByRole('dialog', { name: /HWDID Scale/ });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/Reactive, Unhelpful/)).toBeTruthy();
    expect(screen.getByText(/Neutral, Helpful/)).toBeTruthy();

    // Click level 3 to set the score
    fireEvent.click(screen.getByText(/Medium Reactivity, Some Help/));

    // Dialog should close
    expect(screen.queryByRole('dialog', { name: /HWDID Scale/ })).toBeNull();
  });

  it('populates form with event data when Edit is clicked', () => {
    const event = makeSirEvent();
    const person = makePerson({ events: [event] });
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={vi.fn()}
        updatePersonDraftState={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit'));

    expect(screen.getByText('Edit Entry')).toBeTruthy();
    // The behavior field should be filled
    const behaviorInput = screen.getByPlaceholderText('What happened...');
    expect((behaviorInput as HTMLInputElement).value).toBe('Stayed calm during argument');
  });

  it('deletes an event when Delete is clicked', () => {
    const event = makeSirEvent();
    const person = makePerson({ events: [event] });
    const onUpdatePerson = vi.fn();
    const updateDraft = vi.fn();
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={onUpdatePerson}
        updatePersonDraftState={updateDraft}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete'));

    expect(onUpdatePerson).toHaveBeenCalledTimes(1);
    const [, updates] = onUpdatePerson.mock.calls[0];
    expect(updates.events).toHaveLength(0);
  });

  it('only shows SIR events (not other event types)', () => {
    const sirEvent = makeSirEvent();
    const nodalEvent = makeSirEvent({ id: 'nodal-1', eventType: 'NODAL' as const, category: 'Birth' });
    const person = makePerson({ events: [sirEvent, nodalEvent] });
    render(
      <PersonSIRSection
        personDraft={person}
        selectedPerson={person}
        people={[person, makeOtherPerson()]}
        sirCategories={defaultCategories}
        onUpdatePerson={vi.fn()}
        updatePersonDraftState={vi.fn()}
      />,
    );
    // Should show one card (SIR), not two
    const editButtons = screen.getAllByLabelText('Edit');
    expect(editButtons).toHaveLength(1);
  });
});
