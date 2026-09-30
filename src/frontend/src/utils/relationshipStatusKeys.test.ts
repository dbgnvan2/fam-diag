import { describe, it, expect } from 'vitest';
import type { Partnership } from '../types';
import {
  canonicalRelationshipStatusKey,
  relationshipEndingForStatus,
  legacyFieldForStatus,
  readPartnershipStatusDate,
  withPartnershipStatusDate,
} from './relationshipStatusKeys';

const partnership = (overrides: Partial<Partnership> = {}): Partnership => ({
  id: 'pr1',
  partner1_id: 'a',
  partner2_id: 'b',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: [],
  ...overrides,
});

describe('relationshipStatusKeys', () => {
  it('canonicalises the spellings the app has written', () => {
    expect(canonicalRelationshipStatusKey(' Started ')).toBe('start');
    expect(canonicalRelationshipStatusKey('divorced')).toBe('divorce');
    expect(canonicalRelationshipStatusKey('Widowed')).toBe('widowed');
  });

  it('maps each status to its legacy field', () => {
    expect(legacyFieldForStatus('ongoing')).toBe('relationshipStartDate');
    expect(legacyFieldForStatus('divorced')).toBe('divorceDate');
    expect(legacyFieldForStatus('widowed')).toBeUndefined();
  });

  it('reads an alias key and falls back to the legacy field', () => {
    expect(readPartnershipStatusDate(partnership({ statusDates: { divorced: '1999-01-01' } }), 'divorce')).toBe('1999-01-01');
    expect(readPartnershipStatusDate(partnership({ marriedStartDate: '1990-01-01' }), 'married')).toBe('1990-01-01');
  });

  it('writing a status replaces every alias spelling and mirrors the legacy field', () => {
    const next = withPartnershipStatusDate(partnership({ statusDates: { divorced: '1999-01-01' } }), 'divorce', '2000-02-02');
    expect(next.statusDates).toEqual({ divorce: '2000-02-02' });
    expect(next.divorceDate).toBe('2000-02-02');
  });

  it('clearing a status removes it and its legacy field', () => {
    const next = withPartnershipStatusDate(partnership({ statusDates: { married: '1990-01-01' }, marriedStartDate: '1990-01-01' }), 'married', '');
    expect(next.statusDates).toBeUndefined();
    expect(next.marriedStartDate).toBeUndefined();
  });
});

describe('relationshipEndingForStatus', () => {
  it('classifies every spelling of divorce and separation, and nothing else', () => {
    expect(relationshipEndingForStatus('Divorced')).toBe('divorce');
    expect(relationshipEndingForStatus('divorce')).toBe('divorce');
    expect(relationshipEndingForStatus('separated')).toBe('separation');
    expect(relationshipEndingForStatus('Separation')).toBe('separation');
    expect(relationshipEndingForStatus('ended')).toBe('separation');
    expect(relationshipEndingForStatus('married')).toBeNull();
    expect(relationshipEndingForStatus('widowed')).toBeNull();
  });
});
