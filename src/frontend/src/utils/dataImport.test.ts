/**
 * Tests for factsToDiagramImportData — the converter that turns VLM-extracted
 * FactsImportData into a loadable DiagramImportData. Focuses on the image-import
 * path (facts.people present): sex/date/coordinate mapping and layout rules
 * R13/R16/R17. Previously untested.
 */
import { describe, it, expect } from 'vitest';
import { factsToDiagramImportData } from './dataImport';
import type { FactsImportData } from '../types/diagramEditor';
import type { Person } from '../types';

const find = (people: Person[], name: string) => {
  const p = people.find((person) => person.name === name);
  if (!p) throw new Error(`person "${name}" not found in [${people.map((x) => x.name).join(', ')}]`);
  return p;
};

describe('factsToDiagramImportData — VLM image-import path', () => {
  describe('per-person metadata mapping', () => {
    it('maps sex → gender', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
        ],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').gender).toBe('male');
      expect(find(people, 'Jennie Boyd').gender).toBe('female');
    });

    it('maps birthYear → birthDate (Jan 1 of that year)', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male', birthYear: 1968 }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').birthDate).toBe('1968-01-01');
    });

    it('maps deceased + deathYear → deathDate', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: 2014 }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Charlie Cole').deathDate).toBe('2014-01-01');
    });

    it('marks deceased-with-unknown-year using a placeholder death date', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: null }],
      };
      const { people } = factsToDiagramImportData(facts);
      // Placeholder so the person renders as deceased; user can correct the year.
      expect(find(people, 'Charlie Cole').deathDate).toBe('1900-01-01');
    });

    it('does not set a death date for a living person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').deathDate).toBeUndefined();
    });

    it('converts an image X percentage to a canvas X pixel', () => {
      // CANVAS width 1200, padding 100 → x%=50 → 100 + 0.5*(1200-200) = 600.
      // NOTE: Y is intentionally NOT asserted here — for image imports the layout
      // rules (R7–R10) re-snap Y by generation after this conversion, so only the
      // horizontal position from the image survives (R12 preserve X sequence).
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male', x: 50, y: 50 }] };
      const { people } = factsToDiagramImportData(facts);
      const wayne = find(people, 'Wayne Adams');
      expect(wayne.x).toBe(600);
      expect(Number.isFinite(wayne.y)).toBe(true);
    });
  });

  describe('relationships → partnerships', () => {
    it('creates a partnership and links explicit children via parentPartnership', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Kid One', sex: 'male' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', type: 'married', children: ['Kid One'] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      expect(partnerships).toHaveLength(1);
      const kid = find(people, 'Kid One');
      expect(kid.parentPartnership).toBe(partnerships[0].id);
      expect(partnerships[0].children).toContain(kid.id);
    });
  });

  describe('R16 — unknown-sex symbols render at reduced size', () => {
    it('sets size to 15 for an unknown-sex person', () => {
      const facts: FactsImportData = { people: [{ name: 'Mystery X', sex: 'unknown' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Mystery X').size).toBe(15);
    });

    it('does not shrink a known-sex person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').size).toBeUndefined();
    });
  });

  describe('R17 — stillbirth detection', () => {
    it('flags lifeStatus=stillbirth when notes contain "stillbirth"', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Baby X', sex: 'unknown', deceased: true, notes: 'small X — stillbirth' }],
      };
      const { people } = factsToDiagramImportData(facts);
      const baby = find(people, 'Baby X');
      expect(baby.lifeStatus).toBe('stillbirth');
      expect(baby.size).toBe(15);
    });

    it('infers stillbirth from unknown-sex + deceased + no birth year + child of a partnership', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Baby X', sex: 'unknown', deceased: true, birthYear: null },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Baby X'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Baby X').lifeStatus).toBe('stillbirth');
    });

    it('does not flag a living unknown-sex person as stillbirth', () => {
      const facts: FactsImportData = { people: [{ name: 'Mystery X', sex: 'unknown' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Mystery X').lifeStatus).toBeUndefined();
    });
  });

  describe('backward compatibility — non-image facts (no people[])', () => {
    it('still builds people and a partnership from family.parents without applying R16/R17', () => {
      const facts: FactsImportData = {
        family: { parents: ['Wayne Adams', 'Jennie Boyd'], childrenMentionedByName: ['Kid One'] },
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      expect(people.map((p) => p.name).sort()).toEqual(['Jennie Boyd', 'Kid One', 'Wayne Adams']);
      expect(partnerships).toHaveLength(1);
      // R17 (stillbirth) is image-import only — nobody is flagged here.
      // (size is NOT asserted: the non-image path runs normalizeImportedChildLayout,
      // which may legitimately set a size for dense-family auto-resize.)
      expect(people.every((p) => p.lifeStatus === undefined)).toBe(true);
    });
  });
});
