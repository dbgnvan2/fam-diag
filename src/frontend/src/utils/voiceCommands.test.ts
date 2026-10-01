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
    // voice-07: with no apostrophe the spoken form ("Harrys") is kept beside
    // the stripped name so the apply step can choose between them.
    expect(result.operations).toEqual([
      { type: 'add_person', name: 'Harry', gender: 'male' },
      {
        type: 'add_partnership',
        personName: 'Harry',
        partnerName: 'Betty',
        possessiveForms: { Harry: 'Harrys' },
      },
      {
        type: 'add_children',
        parent1Name: 'Harry',
        parent2Name: 'Betty',
        childNames: ['Tom', 'Dick', 'Jane'],
        possessiveForms: { Betty: 'Bettys' },
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

  it('voice-03: "man", "woman", "son" and similar nouns set the sex and stay out of the name', () => {
    const result = parseVoiceCommands(
      'Add a man named Taylor. Add a woman named Alex. Add a son named Bob. Add a daughter named Jo. Add a person named Sam. Add a boy Max.'
    );
    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      { type: 'add_person', name: 'Taylor', gender: 'male' },
      { type: 'add_person', name: 'Alex', gender: 'female' },
      { type: 'add_person', name: 'Bob', gender: 'male' },
      { type: 'add_person', name: 'Jo', gender: 'female' },
      { type: 'add_person', name: 'Sam' },
      { type: 'add_person', name: 'Max', gender: 'male' },
    ]);
  });

  it('voice-03: a command that states two different sexes is an error', () => {
    const result = parseVoiceCommands('Add a female son named Bob');
    expect(result.operations).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it('voice-04: a comma- or multi-"and"-separated child list keeps multi-word names whole', () => {
    const withCommas = parseVoiceCommands("Harry and Betty's children are Mary Ann, Tom and Billy Joe.");
    expect(withCommas.errors).toEqual([]);
    expect(withCommas.operations[0]).toMatchObject({
      type: 'add_children',
      childNames: ['Mary Ann', 'Tom', 'Billy Joe'],
    });

    const withAnds = parseVoiceCommands("Harry and Betty's children are Mary Ann and Tom and Sue");
    expect(withAnds.operations[0]).toMatchObject({ childNames: ['Mary Ann', 'Tom', 'Sue'] });
  });

  it('voice-07: a bare possessive "s" keeps the spoken name; an apostrophe does not', () => {
    const bare = parseVoiceCommands('Doris partner is Tom');
    expect(bare.operations).toEqual([
      {
        type: 'add_partnership',
        personName: 'Dori',
        partnerName: 'Tom',
        possessiveForms: { Dori: 'Doris' },
      },
    ]);

    const apostrophe = parseVoiceCommands("Doris's partner is Tom");
    expect(apostrophe.operations).toEqual([
      { type: 'add_partnership', personName: 'Doris', partnerName: 'Tom' },
    ]);

    const children = parseVoiceCommands('James and Doris children are Ann');
    expect(children.operations[0]).toMatchObject({
      parent2Name: 'Dori',
      possessiveForms: { Dori: 'Doris' },
    });
  });

  it('voice-07: "they were married" keeps the spoken name from the partnership it refers to', () => {
    const result = parseVoiceCommands('Doris partner is Tom. They were married in 1970.');
    expect(result.operations[1]).toMatchObject({
      type: 'set_partnership_status',
      person1Name: 'Dori',
      possessiveForms: { Dori: 'Doris' },
    });
  });

  it('returns an error for unsupported commands', () => {
    const result = parseVoiceCommands('Tell me about Harry');
    expect(result.operations).toEqual([]);
    expect(result.errors).toEqual(['Could not parse "Tell me about Harry".']);
  });
});
