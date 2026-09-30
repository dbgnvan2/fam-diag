/**
 * Regression tests for REVIEW-unread-areas-2026-09-30.md: the Properties
 * panel's Events tab, person draft, pattern tab and identity fields.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PropertiesPanel from './PropertiesPanel';
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  Partnership,
  Person,
} from '../types';

const ann: Person = { id: 'p1', name: 'Ann', x: 0, y: 0, partnerships: ['pr1'], gender: 'female', birthSex: 'female' };
const bob: Person = { id: 'p2', name: 'Bob', x: 100, y: 0, partnerships: ['pr1'], gender: 'male', birthSex: 'male' };

const eplEvent: EmotionalProcessEvent = {
  id: 'epe-1',
  date: '2015-03-03',
  startDate: '2015-03-03',
  category: 'Conflict',
  eventType: 'EPE',
  anchorType: 'EMOTIONAL_PROCESS_EP',
  anchorId: 'l1',
  subtype: 'Argument',
  status: 'discrete',
  intensity: 2,
  howWell: 0,
  otherPersonName: 'Bob',
  primaryPersonName: 'Ann',
  wwwwh: '',
  observations: '',
  eventClass: 'emotional-pattern',
};

const line = (overrides: Partial<EmotionalLine> = {}): EmotionalLine => ({
  id: 'l1',
  person1_id: 'p1',
  person2_id: 'p2',
  relationshipType: 'conflict',
  lineStyle: 'conflict-solid-wide',
  lineEnding: 'none',
  events: [],
  ...overrides,
});

const partnership = (overrides: Partial<Partnership> = {}): Partnership => ({
  id: 'pr1',
  partner1_id: 'p1',
  partner2_id: 'p2',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: [],
  ...overrides,
});

type Props = React.ComponentProps<typeof PropertiesPanel>;
const renderPanel = (overrides: Partial<Props>) => {
  const handlers = {
    onUpdatePerson: vi.fn(),
    onUpdatePartnership: vi.fn(),
    onUpdateEmotionalLine: vi.fn(),
  };
  const props: Props = {
    selectedItem: ann,
    people: [ann, bob],
    partnerships: [],
    eventCategories: ['Job'],
    functionalIndicatorDefinitions: [],
    sirCategories: [],
    onClose: () => {},
    ...handlers,
    ...overrides,
  };
  const utils = render(<PropertiesPanel {...props} />);
  return { ...handlers, ...utils, props };
};

const openEventsTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Events' }));

describe('Events tab — each row acts on the entity that owns it', () => {
  it('Delete on a pattern\'s event removes it from the pattern (regression: did nothing)', () => {
    const { onUpdateEmotionalLine, onUpdatePerson } = renderPanel({
      allEmotionalLines: [line({ events: [eplEvent] })],
    });
    openEventsTab();
    const row = screen.getByText('Argument').closest('div[style]')!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(onUpdateEmotionalLine).toHaveBeenCalledWith('l1', { events: [] });
    expect(onUpdatePerson).not.toHaveBeenCalled();
  });

  it('Edit + Save of a pattern\'s event updates the pattern, not the person (regression: copied onto the person)', () => {
    const { onUpdateEmotionalLine, onUpdatePerson } = renderPanel({
      allEmotionalLines: [line({ events: [eplEvent] })],
    });
    openEventsTab();
    const row = screen.getByText('Argument').closest('div[style]')!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Observations:'), { target: { value: 'edited' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(onUpdatePerson).not.toHaveBeenCalled();
    const [lineId, updates] = onUpdateEmotionalLine.mock.calls[0];
    expect(lineId).toBe('l1');
    expect(updates.events).toHaveLength(1);
    expect(updates.events[0]).toMatchObject({ id: 'epe-1', observations: 'edited' });
  });

  it('lists the person\'s own marriage and an imported symptom, as the Timeline lane does', () => {
    const definitions: FunctionalIndicatorDefinition[] = [{ id: 'cough', label: 'Cough', group: 'physical' }];
    renderPanel({
      selectedItem: { ...ann, functionalIndicators: [{ definitionId: 'cough', status: 'current', impact: 1, date: '2022-02-02' }] },
      partnerships: [partnership({ marriedStartDate: '1990-05-05' })],
      functionalIndicatorDefinitions: definitions,
    });
    openEventsTab();
    expect(screen.getByText('Marriage')).toBeInTheDocument();
    expect(screen.getByText('Cough')).toBeInTheDocument();
  });

  it('editing the Birth block edits the birth date and keeps one event (author decision 2)', () => {
    const person = { ...ann, birthDate: '1980-01-01', events: [] };
    const { onUpdatePerson } = renderPanel({ selectedItem: person, people: [person, bob] });
    openEventsTab();
    const row = screen.getByText('Birth').closest('div[style]')!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    // The category names the field, so it is shown, not edited.
    expect(screen.queryByLabelText('Category:')).toBeNull();
    fireEvent.change(document.getElementById('eventStartDate') as HTMLInputElement, { target: { value: '1981-02-02' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const [, updates] = onUpdatePerson.mock.calls[0];
    expect(updates.birthDate).toBe('1981-02-02');
    expect(updates.events).toHaveLength(1);
    expect(updates.events[0].id).toBe('synth-birth-p1');
  });

  it('a new event starts with no date and no rating (author decisions 3 and 4)', () => {
    renderPanel({});
    openEventsTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Event' }));
    expect((document.getElementById('eventStartDate') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Intensity:') as HTMLSelectElement).value).toBe('0');
    expect((screen.getByLabelText('Category:') as HTMLSelectElement).value).toBe('');
  });

  it('the Group filter offers every event type and matches the type the card shows', () => {
    renderPanel({ selectedItem: { ...ann, events: [{ ...eplEvent, id: 'legacy', eventType: undefined as unknown as 'EPE', anchorType: 'PERSON', anchorId: 'p1', category: 'Distance', subtype: 'Legacy' }] } });
    openEventsTab();
    const filter = screen.getByLabelText('Group:') as HTMLSelectElement;
    expect(within(filter).getByRole('option', { name: 'Papero Assessment' })).toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'EPE' } });
    expect(screen.getByText('Legacy')).toBeInTheDocument();
  });
});

describe('person draft — pending date edits survive auto-saved edits', () => {
  it('a typed birth date is kept when the name auto-saves and the person re-renders (regression: discarded)', () => {
    const onUpdatePerson = vi.fn();
    const props = {
      people: [ann, bob],
      eventCategories: ['Job'],
      functionalIndicatorDefinitions: [],
      sirCategories: [],
      onUpdatePartnership: vi.fn(),
      onUpdateEmotionalLine: vi.fn(),
      onClose: () => {},
      onUpdatePerson,
    };
    const { rerender } = render(<PropertiesPanel {...props} selectedItem={ann} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
    fireEvent.change(screen.getByLabelText('Birth Date:'), { target: { value: '1970-07-07' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Name' }));
    fireEvent.change(screen.getByLabelText('First Name:'), { target: { value: 'Anna' } });
    expect(onUpdatePerson).toHaveBeenLastCalledWith('p1', expect.objectContaining({ firstName: 'Anna' }));
    // The parent applies the auto-save and passes the new person object.
    rerender(<PropertiesPanel {...props} selectedItem={{ ...ann, firstName: 'Anna', name: 'Anna' }} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
    expect((screen.getByLabelText('Birth Date:') as HTMLInputElement).value).toBe('1970-07-07');
    expect(screen.getByRole('button', { name: /^Save$/ })).not.toBeDisabled();
  });
});

describe('identity fields', () => {
  it('a person with no recorded sex shows Unknown, and Female can then be chosen (regression: showed Female)', () => {
    const unknown: Person = { id: 'p9', name: 'Kim', x: 0, y: 0, partnerships: [] };
    const { onUpdatePerson } = renderPanel({ selectedItem: unknown, people: [unknown] });
    fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
    const sex = screen.getByLabelText('Birth Sex:') as HTMLSelectElement;
    expect(sex.value).toBe('');
    fireEvent.change(sex, { target: { value: 'female' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(onUpdatePerson).toHaveBeenCalledWith('p9', expect.objectContaining({ birthSex: 'female' }));
  });

  it('changing birth sex replaces its identity event, undated when there is no birth date (regression: appended, dated today)', () => {
    const existing: EmotionalProcessEvent = {
      ...eplEvent,
      id: 'id-ev',
      eventType: 'NODAL',
      category: 'Individual',
      subtype: 'Birth Sex: Female',
      anchorType: 'PERSON',
      anchorId: 'p1',
      date: '',
      startDate: '',
    };
    const person = { ...ann, genderIdentity: 'feminine' as const, events: [existing] };
    const { onUpdatePerson } = renderPanel({ selectedItem: person, people: [person, bob] });
    fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
    fireEvent.change(screen.getByLabelText('Birth Sex:'), { target: { value: 'male' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const [, updates] = onUpdatePerson.mock.calls[0];
    expect(updates.events).toHaveLength(1);
    expect(updates.events[0]).toMatchObject({ id: 'id-ev', subtype: 'Birth Sex: Male', date: '', startDate: '' });
  });
});

describe('pattern (EPL) tab', () => {
  it('a line with no measurement is not dirty when opened (regression: style level compared with event intensity)', () => {
    renderPanel({ selectedItem: line(), allEmotionalLines: [line()] });
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled();
  });

  it('a notes-only edit appends no measurement event', () => {
    const { onUpdateEmotionalLine } = renderPanel({ selectedItem: line(), allEmotionalLines: [line()] });
    fireEvent.change(screen.getByLabelText('Notes:'), { target: { value: 'note' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const [, updates] = onUpdateEmotionalLine.mock.calls[0];
    expect(updates.events).toBeUndefined();
    expect(updates.notes).toBe('note');
  });
});

describe('Patterns tab dialog saves every field it edits', () => {
  it('the adequate (+) person is saved (regression: dropped)', () => {
    const fusion = line({ relationshipType: 'fusion', lineStyle: 'fusion-solid-wide' });
    const { onUpdateEmotionalLine } = renderPanel({ allEmotionalLines: [fusion] });
    fireEvent.click(screen.getByRole('tab', { name: 'Patterns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const adequate = screen.getByText('Adequate (+):').parentElement!.querySelector('select') as HTMLSelectElement;
    fireEvent.change(adequate, { target: { value: 'p2' } });
    const saves = screen.getAllByRole('button', { name: /^Save$/ });
    fireEvent.click(saves[saves.length - 1]);
    expect(onUpdateEmotionalLine).toHaveBeenCalledWith('l1', expect.objectContaining({ adequatePersonId: 'p2' }));
  });
});

