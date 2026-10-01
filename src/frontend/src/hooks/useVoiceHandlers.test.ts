import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import type { EmotionalLine, Partnership, Person } from '../types';
import type { VoiceCommandOperation } from '../utils/voiceCommands';
import { describeVoiceOperation } from '../utils/voiceCommands';
import { useVoiceHandlers } from './useVoiceHandlers';

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({
  id,
  name,
  firstName: name.split(' ')[0],
  lastName: name.split(' ').slice(1).join(' ') || undefined,
  x: 0,
  y: 0,
  partnerships: [],
  ...extra,
});

/** Real useState for the diagram data; the hook runs exactly as in the editor. */
const useHarness = (
  text: string,
  initialPeople: Person[] = [],
  initialPartnerships: Partnership[] = []
) => {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);
  const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>([]);
  const [operations, setOperations] = useState<VoiceCommandOperation[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const handlers = useVoiceHandlers({
    voiceCommandText: text,
    voiceListening: false,
    people,
    partnerships,
    emotionalLines,
    speechRecognitionRef: { current: null },
    alignAllAnchors: (list) => list,
    setVoiceCommandOperations: setOperations,
    setVoiceCommandErrors: setErrors,
    setVoiceStatusMessage: setStatus,
    setVoiceListening: vi.fn(),
    setPeople,
    setPartnerships,
    setEmotionalLines,
    setSelectedPeopleIds: vi.fn(),
    setSelectedPartnershipId: vi.fn(),
    setPropertiesPanelItem: vi.fn(),
  });
  return { people, partnerships, emotionalLines, operations, errors, status, handlers };
};

const byName = (people: Person[], name: string) => people.filter((p) => p.name === name);

const run = (
  text: string,
  people: Person[] = [],
  partnerships: Partnership[] = [],
  action: 'apply' | 'review' = 'apply'
) => {
  const { result } = renderHook(() => useHarness(text, people, partnerships));
  act(() => {
    if (action === 'apply') result.current.handlers.applyVoiceCommands();
    else result.current.handlers.reviewVoiceCommands();
  });
  return result.current;
};

describe('useVoiceHandlers — voice-02 partner sex is not forced by speaking order', () => {
  it('"Mary and John are married" keeps Mary female and John male (name evidence)', () => {
    const out = run('Mary and John are married');
    expect(out.errors).toEqual([]);
    expect(byName(out.people, 'Mary')[0].gender).toBe('female');
    expect(byName(out.people, 'John')[0].gender).toBe('male');
  });

  it('new partners with no stated sex and no name evidence get the decided female default', () => {
    const out = run("Alex's partner is Sam");
    expect(byName(out.people, 'Alex')[0].gender).toBe('female');
    expect(byName(out.people, 'Sam')[0].gender).toBe('female');
  });

  it('never sets the sex of an existing person who has none', () => {
    const out = run("Robin's partner is Sam", [person('r', 'Robin')]);
    expect(out.errors).toEqual([]);
    expect(byName(out.people, 'Robin')[0].gender).toBeUndefined();
  });

  it('never overwrites the sex of an existing person', () => {
    const out = run("Robin's partner is Sam", [person('r', 'Robin', { gender: 'female' })]);
    expect(byName(out.people, 'Robin')[0].gender).toBe('female');
  });
});

describe('useVoiceHandlers — voice-03 nouns set the sex end to end', () => {
  it('"add a man named Taylor" creates Taylor as male; "add a son named Bob" creates Bob', () => {
    const out = run('Add a man named Taylor. Add a son named Bob.');
    expect(out.errors).toEqual([]);
    expect(byName(out.people, 'Taylor')[0].gender).toBe('male');
    expect(byName(out.people, 'Bob')[0].gender).toBe('male');
    expect(out.people.some((p) => /named/i.test(p.name))).toBe(false);
  });
});

describe('useVoiceHandlers — voice-04 multi-word child names', () => {
  it('"Mary Ann, Tom" creates two children, Mary Ann and Tom', () => {
    const out = run("Harry and Betty's children are Mary Ann, Tom");
    expect(out.errors).toEqual([]);
    const family = out.partnerships[0];
    const childNames = family.children.map((id) => out.people.find((p) => p.id === id)?.name);
    expect(childNames).toEqual(['Mary Ann', 'Tom']);
  });
});

describe('useVoiceHandlers — voice-05 name matching against all people', () => {
  it('two people with the same full name make the command an error at review time, and Apply changes nothing', () => {
    const people = [person('a', 'John Smith'), person('b', 'John Smith')];
    const reviewed = run('John Smith was born in 1950', people, [], 'review');
    expect(reviewed.errors).toEqual(['2 people named John Smith — use the canvas.']);

    const applied = run('John Smith was born in 1950', people);
    expect(applied.errors).toEqual(['2 people named John Smith — use the canvas.']);
    expect(applied.people).toBe(people);
    expect(applied.people.every((p) => !p.birthDate)).toBe(true);
  });

  it('an exact full-name match is used even when first names repeat', () => {
    const people = [person('a', 'John Smith'), person('b', 'John Jones')];
    const out = run('John Jones was born in 1950', people);
    expect(out.errors).toEqual([]);
    expect(out.people.find((p) => p.id === 'b')?.birthDate).toBe('1950-01-01');
    expect(out.people.find((p) => p.id === 'a')?.birthDate).toBeUndefined();
    expect(out.people).toHaveLength(2);
  });

  it('a unique first-name match is used', () => {
    const out = run('John was born in 1950', [person('a', 'John Smith')]);
    expect(out.errors).toEqual([]);
    expect(out.people).toHaveLength(1);
    expect(out.people[0].birthDate).toBe('1950-01-01');
  });

  it('a first name shared by two people is an error, not a guess', () => {
    const out = run('John was born in 1950', [person('a', 'John Smith'), person('b', 'John Jones')]);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toContain('2 people have the first name John');
    expect(out.people.every((p) => !p.birthDate)).toBe(true);
  });

  it('the review line says when a command will create a person', () => {
    const out = run('Jon was born in 1950', [person('a', 'John Smith')], [], 'review');
    expect(out.errors).toEqual([]);
    expect(out.operations[0].createsPeople).toEqual(['Jon']);
    expect(describeVoiceOperation(out.operations[0])).toBe(
      'Create person Jon; Set birth year: Jon -> 1950'
    );
  });

  it('a person created earlier in the same batch is reused, not created twice', () => {
    const out = run('Add a man named Jon. Jon was born in 1950.', [], [], 'review');
    expect(out.operations.map((op) => op.createsPeople)).toEqual([['Jon'], []]);
  });
});

describe('useVoiceHandlers — voice-06 a child in another family is not moved', () => {
  it('reports the child at review time and leaves the existing family unchanged', () => {
    const people = [
      person('h', 'Harry', { partnerships: ['f1'] }),
      person('b', 'Betty', { partnerships: ['f1'] }),
      person('t', 'Tom', { parentPartnership: 'f1' }),
      person('g', 'George'),
      person('s', 'Sue'),
    ];
    const partnerships: Partnership[] = [
      {
        id: 'f1',
        partner1_id: 'h',
        partner2_id: 'b',
        horizontalConnectorY: 100,
        relationshipType: 'married',
        relationshipStatus: 'married',
        children: ['t'],
      },
    ];
    const reviewed = run("George and Sue's children are Tom", people, partnerships, 'review');
    expect(reviewed.errors).toEqual([
      'Tom already belongs to another family — use the canvas to change their parents.',
    ]);

    const applied = run("George and Sue's children are Tom", people, partnerships);
    expect(applied.partnerships).toBe(partnerships);
    expect(applied.people.find((p) => p.id === 't')?.parentPartnership).toBe('f1');
  });
});

describe('useVoiceHandlers — voice-07 possessive "s" with no apostrophe', () => {
  it('"Doris partner is Tom" uses existing Doris, not a new "Dori"', () => {
    const out = run('Doris partner is Tom', [person('d', 'Doris')]);
    expect(out.errors).toEqual([]);
    expect(out.people.map((p) => p.name).sort()).toEqual(['Doris', 'Tom']);
  });

  it('with nobody on the diagram the name as spoken is used', () => {
    const out = run('Doris partner is Tom');
    expect(out.people.map((p) => p.name).sort()).toEqual(['Doris', 'Tom']);
  });

  it('the stripped name is used when only it matches someone ("harrys" -> Harry)', () => {
    const out = run('harrys partner is betty', [person('h', 'Harry')]);
    expect(out.people.map((p) => p.name).sort()).toEqual(['Betty', 'Harry']);
  });

  it('"they were married" refers to the same chosen name', () => {
    const out = run('Doris partner is Tom. They were married in 1970.');
    expect(out.people).toHaveLength(2);
    expect(out.partnerships).toHaveLength(1);
    expect(out.partnerships[0].marriedStartDate).toBe('1970-01-01');
  });
});
