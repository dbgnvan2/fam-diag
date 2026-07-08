/**
 * Tests for the PHASE 1 genogram data rules (R1–R6) in genogramRules.ts.
 *
 * These rules fact-check + auto-fix VLM-extracted FactsImportData before it is
 * converted to a diagram. They are the heart of the active image-import path and
 * were previously untested.
 */
import { describe, it, expect } from 'vitest';
import { applyDataRules } from './genogramRules';
import type { FactsImportData } from '../../types/diagramEditor';

/** Minimal people[] entry builder. */
const person = (name: string, extra: Partial<NonNullable<FactsImportData['people']>[number]> = {}) => ({
  name,
  ...extra,
});

describe('applyDataRules', () => {
  describe('R1 — triangles are pregnancy markers, not people', () => {
    it('removes any person whose name contains "triangle"', () => {
      const facts: FactsImportData = {
        people: [person('Wayne'), person('Triangle 1'), person('Jennie')],
      };
      const result = applyDataRules(facts);
      expect(facts.people!.map((p) => p.name)).toEqual(['Wayne', 'Jennie']);
      expect(result.fixes.some((f) => f.startsWith('R1'))).toBe(true);
    });

    it('is case-insensitive', () => {
      const facts: FactsImportData = { people: [person('TRIANGLE marker')] };
      applyDataRules(facts);
      expect(facts.people).toHaveLength(0);
    });
  });

  describe('R2 — stars/asterisks are miscarriages, not people', () => {
    it('removes people named star, asterisk, or miscarriage', () => {
      const facts: FactsImportData = {
        people: [person('Star 1'), person('asterisk'), person('Miscarriage 2'), person('Real Person')],
      };
      applyDataRules(facts);
      expect(facts.people!.map((p) => p.name)).toEqual(['Real Person']);
    });
  });

  describe('R3 — names must be unique', () => {
    it('suffixes duplicate names, leaving the first occurrence untouched', () => {
      const facts: FactsImportData = {
        people: [person('M'), person('M'), person('M')],
      };
      const result = applyDataRules(facts);
      expect(facts.people!.map((p) => p.name)).toEqual(['M', 'M (dup 2)', 'M (dup 3)']);
      expect(result.fixes.filter((f) => f.startsWith('R3'))).toHaveLength(2);
    });

    it('leaves already-unique names alone', () => {
      const facts: FactsImportData = { people: [person('A'), person('B')] };
      applyDataRules(facts);
      expect(facts.people!.map((p) => p.name)).toEqual(['A', 'B']);
    });
  });

  describe('R4 — sex/name consistency', () => {
    it('warns when name says female but sex=male', () => {
      const facts: FactsImportData = { people: [person('female cousin', { sex: 'male' })] };
      const result = applyDataRules(facts);
      expect(result.warnings.some((w) => w.startsWith('R4'))).toBe(true);
    });

    it('does not warn when name and sex agree', () => {
      const facts: FactsImportData = { people: [person('male cousin', { sex: 'male' })] };
      const result = applyDataRules(facts);
      expect(result.warnings.some((w) => w.startsWith('R4'))).toBe(false);
    });

    it('does not treat the substring "male" inside "female" as a male hint', () => {
      // Adversarial: "female" contains "male" — the \bmale\b word boundary must not fire.
      const facts: FactsImportData = { people: [person('female', { sex: 'female' })] };
      const result = applyDataRules(facts);
      expect(result.warnings.some((w) => w.startsWith('R4'))).toBe(false);
    });
  });

  describe('R5 — clean dangling relationship references', () => {
    it('drops relationships whose partner was filtered out by an earlier rule', () => {
      const facts: FactsImportData = {
        people: [person('Wayne'), person('Triangle 1')],
        relationships: [{ a: 'Wayne', b: 'Triangle 1', type: 'married' }],
      };
      applyDataRules(facts); // R1 removes Triangle 1, then R5 removes the dangling rel
      expect(facts.relationships).toHaveLength(0);
    });

    it('strips invalid child references but keeps the relationship', () => {
      const facts: FactsImportData = {
        people: [person('Wayne'), person('Jennie'), person('Kid A')],
        relationships: [{ a: 'Wayne', b: 'Jennie', children: ['Kid A', 'Ghost Kid'] }],
      };
      applyDataRules(facts);
      expect(facts.relationships).toHaveLength(1);
      expect(facts.relationships![0].children).toEqual(['Kid A']);
    });
  });

  describe('R6 — siblings cannot be married to each other', () => {
    it('removes a marriage between two people who share the same parents', () => {
      const facts: FactsImportData = {
        people: [person('Dad'), person('Mom'), person('Sib A'), person('Sib B')],
        relationships: [
          { a: 'Dad', b: 'Mom', children: ['Sib A', 'Sib B'] },
          { a: 'Sib A', b: 'Sib B', type: 'married' }, // incest — must be removed
        ],
      };
      const result = applyDataRules(facts);
      const marriages = facts.relationships!.filter((r) => r.a === 'Sib A' && r.b === 'Sib B');
      expect(marriages).toHaveLength(0);
      expect(result.warnings.some((w) => w.startsWith('R6'))).toBe(true);
    });

    it('keeps a marriage between people from different sibling groups', () => {
      const facts: FactsImportData = {
        people: [person('Dad1'), person('Mom1'), person('Dad2'), person('Mom2'), person('A'), person('B')],
        relationships: [
          { a: 'Dad1', b: 'Mom1', children: ['A'] },
          { a: 'Dad2', b: 'Mom2', children: ['B'] },
          { a: 'A', b: 'B', type: 'married' }, // unrelated — must survive
        ],
      };
      applyDataRules(facts);
      expect(facts.relationships!.some((r) => r.a === 'A' && r.b === 'B')).toBe(true);
    });
  });

  describe('robustness', () => {
    it('handles empty / absent facts without throwing', () => {
      expect(() => applyDataRules({})).not.toThrow();
      const result = applyDataRules({});
      expect(result).toEqual({ warnings: [], fixes: [] });
    });
  });
});
