/**
 * Tests for parseVLMResponse — the robust JSON parser that turns Claude Vision's
 * raw text reply into FactsImportData. Covers the formatting quirks the model
 * actually produces (markdown fences) and malformed-input handling.
 *
 * The network/image parts of vlmImport() (fetch, canvas, createImageBitmap) are
 * browser-only and are exercised via the browser smoke test, not here.
 */
import { describe, it, expect } from 'vitest';
import { parseVLMResponse, factCheckVLMFacts } from './vlmImport';
import { applyDataRules } from './genogramRules';

describe('parseVLMResponse', () => {
  it('parses a bare JSON object', () => {
    const facts = parseVLMResponse('{"people":[{"name":"Wayne","sex":"male"}]}');
    expect(facts.people).toEqual([{ name: 'Wayne', sex: 'male' }]);
  });

  it('strips ```json fences', () => {
    const facts = parseVLMResponse('```json\n{"people":[{"name":"Jennie"}]}\n```');
    expect(facts.people).toEqual([{ name: 'Jennie' }]);
  });

  it('strips bare ``` fences', () => {
    const facts = parseVLMResponse('```\n{"relationships":[]}\n```');
    expect(facts.relationships).toEqual([]);
  });

  it('tolerates leading/trailing whitespace', () => {
    const facts = parseVLMResponse('   \n {"people":[]}  \n ');
    expect(facts.people).toEqual([]);
  });

  it('throws a descriptive error on malformed JSON', () => {
    expect(() => parseVLMResponse('not json at all')).toThrow(/Failed to parse VLM response as JSON/);
  });

  it('throws when the JSON is a primitive or null (not an object)', () => {
    expect(() => parseVLMResponse('42')).toThrow(/not a JSON object/);
    expect(() => parseVLMResponse('"just a string"')).toThrow(/not a JSON object/);
    expect(() => parseVLMResponse('null')).toThrow(/not a JSON object/);
  });

  it('coerces a non-array people field back to an empty array', () => {
    const facts = parseVLMResponse('{"people":{"oops":true}}');
    expect(facts.people).toEqual([]);
  });

  it('coerces a non-array relationships field back to an empty array', () => {
    const facts = parseVLMResponse('{"relationships":"nope"}');
    expect(facts.relationships).toEqual([]);
  });
});

describe('factCheckVLMFacts re-export', () => {
  it('is the same function as applyDataRules', () => {
    expect(factCheckVLMFacts).toBe(applyDataRules);
  });
});
