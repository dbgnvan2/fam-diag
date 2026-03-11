import { describe, expect, it } from 'vitest';
import { normalizeCommandName, parseVoiceCommands } from './voiceCommands';

describe('voiceCommands', () => {
  it('normalizes person names for commands', () => {
    expect(normalizeCommandName('  hArRy   jOnEs ')).toBe('Harry Jones');
  });

  it('parses add-person, partnership, and children commands', () => {
    const result = parseVoiceCommands(
      "Add a male named Harry. Harry's partner is Betty. Harry and Betty's children are tom, dick and jane."
    );

    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      { type: 'add_person', name: 'Harry', gender: 'male' },
      { type: 'add_partnership', personName: 'Harry', partnerName: 'Betty' },
      {
        type: 'add_children',
        parent1Name: 'Harry',
        parent2Name: 'Betty',
        childNames: ['Tom', 'Dick', 'Jane'],
      },
    ]);
  });

  it('parses person updates, relationship status, and emotional line commands', () => {
    const result = parseVoiceCommands(
      "Harry was born in 1950. Betty died in 2010. Tom is adopted. Harry and Betty are married in 1972. Harry and Betty divorced in 1991. Harry and Betty have an emotional cutoff."
    );

    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      { type: 'set_person_birth_year', name: 'Harry', year: 1950 },
      { type: 'set_person_death_year', name: 'Betty', year: 2010 },
      { type: 'set_person_adoption_status', name: 'Tom', adoptionStatus: 'adopted' },
      {
        type: 'set_partnership_status',
        person1Name: 'Harry',
        person2Name: 'Betty',
        relationshipType: 'married',
        relationshipStatus: 'married',
        year: 1972,
      },
      {
        type: 'set_partnership_status',
        person1Name: 'Harry',
        person2Name: 'Betty',
        relationshipType: 'married',
        relationshipStatus: 'divorced',
        year: 1991,
      },
      {
        type: 'add_emotional_line',
        person1Name: 'Harry',
        person2Name: 'Betty',
        relationshipType: 'cutoff',
      },
    ]);
  });

  it('parses voice-transcribed commands without punctuation or apostrophes', () => {
    const result = parseVoiceCommands(
      'add a male named harry harrys partner is betty harry and bettys children are tom dick and jane'
    );

    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      { type: 'add_person', name: 'Harry', gender: 'male' },
      { type: 'add_partnership', personName: 'Harry', partnerName: 'Betty' },
      {
        type: 'add_children',
        parent1Name: 'Harry',
        parent2Name: 'Betty',
        childNames: ['Tom', 'Dick', 'Jane'],
      },
    ]);
  });

  it('parses adopted-child creation phrasing', () => {
    const result = parseVoiceCommands('Add an adopted child named Sam');

    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      { type: 'set_person_adoption_status', name: 'Sam', adoptionStatus: 'adopted' },
    ]);
  });

  it('parses partner name phrasing and pronoun partnership follow-up', () => {
    const result = parseVoiceCommands(
      "Harry's partner name is Susan. They were married in 1972."
    );

    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      { type: 'add_partnership', personName: 'Harry', partnerName: 'Susan' },
      {
        type: 'set_partnership_status',
        person1Name: 'Harry',
        person2Name: 'Susan',
        relationshipType: 'married',
        relationshipStatus: 'married',
        year: 1972,
      },
    ]);
  });

  it('returns an error for unsupported commands', () => {
    const result = parseVoiceCommands('Tell me about Harry');
    expect(result.operations).toEqual([]);
    expect(result.errors).toEqual(['Could not parse "Tell me about Harry".']);
  });
});
