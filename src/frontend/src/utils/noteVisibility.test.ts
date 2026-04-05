import { describe, expect, it } from 'vitest';
import type { EmotionalLine, Partnership, Person, Triangle } from '../types';
import {
  shouldShowEmotionalNote,
  shouldShowFamilyNote,
  shouldShowPartnershipNote,
  shouldShowPersonNote,
  shouldShowTriangleNote,
} from './noteVisibility';

describe('noteVisibility', () => {
  it('shows person note when notes layer is on', () => {
    const person: Person = { id: 'p1', name: 'P', x: 0, y: 0, partnerships: [], notes: 'hello' };
    expect(shouldShowPersonNote(person, true, null)).toBe(true);
  });

  it('shows person note on hover when notes layer is off', () => {
    const person: Person = { id: 'p2', name: 'P', x: 0, y: 0, partnerships: [], notes: 'hover' };
    expect(shouldShowPersonNote(person, false, 'p2')).toBe(true);
    expect(shouldShowPersonNote(person, false, null)).toBe(false);
  });

  it('shows person note when explicitly enabled even if notes layer is off', () => {
    const person: Person = {
      id: 'p3',
      name: 'P',
      x: 0,
      y: 0,
      partnerships: [],
      notes: 'pinned',
      notesEnabled: true,
    };
    expect(shouldShowPersonNote(person, false, null)).toBe(true);
  });

  it('shows partnership and emotional notes when explicitly enabled while layer is off', () => {
    const partnership: Partnership = {
      id: 'r1',
      partner1_id: 'a',
      partner2_id: 'b',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
      notes: 'prl',
      notesEnabled: true,
    };
    const line: EmotionalLine = {
      id: 'e1',
      person1_id: 'a',
      person2_id: 'b',
      relationshipType: 'fusion',
      lineStyle: 'low',
      lineEnding: 'none',
      notes: 'epl',
      notesEnabled: true,
    };
    expect(shouldShowPartnershipNote(partnership, false)).toBe(true);
    expect(shouldShowEmotionalNote(line, false)).toBe(true);
  });

  it('shows triangle note when explicitly enabled while layer is off', () => {
    const triangle: Triangle = {
      id: 't1',
      person1_id: 'a',
      person2_id: 'b',
      person3_id: 'c',
      notes: 'triangle note',
      notesEnabled: true,
    };
    expect(shouldShowTriangleNote(triangle, false)).toBe(true);
  });

  it('shows family note when explicitly enabled while layer is off', () => {
    const partnership: Partnership = {
      id: 'r3',
      partner1_id: 'a',
      partner2_id: 'b',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
      familyNotes: 'family note',
      familyNotesEnabled: true,
    };
    expect(shouldShowFamilyNote(partnership, false)).toBe(true);
  });

  it('hides triangle note when no notes text even if layer is on', () => {
    const triangle: Triangle = {
      id: 't2',
      person1_id: 'a',
      person2_id: 'b',
      person3_id: 'c',
    };
    expect(shouldShowTriangleNote(triangle, true)).toBe(false);
  });

  it('hides family note when no familyNotes text even if layer is on', () => {
    const partnership: Partnership = {
      id: 'r4',
      partner1_id: 'a',
      partner2_id: 'b',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
    };
    expect(shouldShowFamilyNote(partnership, true)).toBe(false);
  });

  it('hides family note when familyNotesEnabled is false even if layer is on', () => {
    const partnership: Partnership = {
      id: 'r5',
      partner1_id: 'a',
      partner2_id: 'b',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
      familyNotes: 'hidden',
      familyNotesEnabled: false,
    };
    expect(shouldShowFamilyNote(partnership, true)).toBe(false);
  });

  it('PRL note and family note are independent on the same partnership', () => {
    const partnership: Partnership = {
      id: 'r6',
      partner1_id: 'a',
      partner2_id: 'b',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
      notes: 'prl note',
      notesEnabled: true,
      familyNotes: 'family note',
      familyNotesEnabled: false,
    };
    // PRL note is enabled, family note is disabled
    expect(shouldShowPartnershipNote(partnership, false)).toBe(true);
    expect(shouldShowFamilyNote(partnership, false)).toBe(false);
  });

  it('hides notes when explicitly disabled even if the notes layer is on', () => {
    const person: Person = {
      id: 'p4',
      name: 'P',
      x: 0,
      y: 0,
      partnerships: [],
      notes: 'hidden',
      notesEnabled: false,
    };
    const partnership: Partnership = {
      id: 'r2',
      partner1_id: 'a',
      partner2_id: 'b',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
      notes: 'hidden prl',
      notesEnabled: false,
    };
    const line: EmotionalLine = {
      id: 'e2',
      person1_id: 'a',
      person2_id: 'b',
      relationshipType: 'fusion',
      lineStyle: 'low',
      lineEnding: 'none',
      notes: 'hidden epl',
      notesEnabled: false,
    };
    expect(shouldShowPersonNote(person, true, 'p4')).toBe(false);
    expect(shouldShowPartnershipNote(partnership, true)).toBe(false);
    expect(shouldShowEmotionalNote(line, true)).toBe(false);
  });
});
