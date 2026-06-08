/**
 * Tests for imageAnalysis.ts (VISION_PROMPT shape).
 *
 * Spec: docs/implementation_plan_2026-06-06.md — M2.A.1
 *
 * The VISION_PROMPT constant is not exported; we test by reading the file
 * source so the test is a pure compile-time check on the prompt content.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeImageToDiagramData, DEFAULT_VISION_MODEL, stripCodeFences, extractFirstJsonObject } from './imageAnalysis';

const promptSource = readFileSync(
  join(__dirname, 'imageAnalysis.ts'),
  'utf8'
);

describe('VISION_PROMPT', () => {
  it('test_m2a1_prompt_lists_note_categories', () => {
    // Categories the prompt MUST enumerate so the model returns rich notes.
    expect(promptSource).toMatch(/occupation/i);
    expect(promptSource).toMatch(/character traits/i);
    expect(promptSource).toMatch(/health/i);
    expect(promptSource).toMatch(/deceased/i);
  });

  it('asks for relationship.notes and speculative fields', () => {
    expect(promptSource).toMatch(/relationship\.speculative|"speculative"/);
    // The relationships block must include a notes field for partnership-level descriptors.
    expect(promptSource).toMatch(/Relationship notes|relationship\.notes|relationship line/i);
  });
});

describe('analyzeImageToDiagramData', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockSuccessResponse() {
    // Include one person — an empty persons array now (correctly) trips the
    // "0 persons" error. These tests only care about the request body shape.
    const validBody = JSON.stringify({
      persons: [{ id: 'p1', extractedName: 'A', gender: 'female', confidence: 0.9 }],
      relationships: [],
      annotations: [],
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: validBody }] }), { status: 200 })
    );
  }

  it('test_m4a1_uses_supplied_model', async () => {
    mockSuccessResponse();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    await analyzeImageToDiagramData(blob, 'sk-ant-x', 'claude-opus-4-7');
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe('claude-opus-4-7');
  });

  it('falls back to DEFAULT_VISION_MODEL when no model is supplied', async () => {
    mockSuccessResponse();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    await analyzeImageToDiagramData(blob, 'sk-ant-x');
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe(DEFAULT_VISION_MODEL);
  });

  it('accepts a response missing rawAnalysis (regression: the model never returns it)', async () => {
    const inner = JSON.stringify({
      persons: [{ id: 'p1', extractedName: 'A', gender: 'female', confidence: 0.9 }],
      relationships: [],
      // annotations and rawAnalysis intentionally omitted
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: inner }] }), { status: 200 })
    );
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const result = await analyzeImageToDiagramData(blob, 'sk-ant-x');
    expect(result.persons).toHaveLength(1);
    expect(result.annotations).toEqual([]);
  });

  it('coerces capitalised gender values to lowercase', async () => {
    const inner = JSON.stringify({
      persons: [{ id: 'p1', extractedName: 'A', gender: 'Female', confidence: 0.9 }],
      relationships: [],
      annotations: [],
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: inner }] }), { status: 200 })
    );
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const result = await analyzeImageToDiagramData(blob, 'sk-ant-x');
    expect(result.persons[0].gender).toBe('female');
  });

  it('throws a specific error when the model returns an empty persons array', async () => {
    const inner = JSON.stringify({ persons: [], relationships: [], annotations: [] });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: inner }] }), { status: 200 })
    );
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    // Suppress the intentional console.warn for this test.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(analyzeImageToDiagramData(blob, 'sk-ant-x')).rejects.toThrow(/0 people|Opus 4\.7/);
    warnSpy.mockRestore();
  });

  it('throws an informative error when a person has a bad gender value', async () => {
    const inner = JSON.stringify({
      persons: [{ id: 'p1', extractedName: 'A', gender: 'unicorn', confidence: 0.9 }],
      relationships: [],
      annotations: [],
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: inner }] }), { status: 200 })
    );
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    await expect(analyzeImageToDiagramData(blob, 'sk-ant-x')).rejects.toThrow(/unicorn/);
  });

  it('parses a response wrapped in a ```json fence (regression for the 2026-06-07 alert)', async () => {
    const inner = JSON.stringify({
      persons: [{ id: 'p1', extractedName: 'A', gender: 'female', confidence: 0.9 }],
      relationships: [],
      annotations: [],
      rawAnalysis: '',
    });
    const fenced = '```json\n' + inner + '\n```';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: fenced }] }), { status: 200 })
    );
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const result = await analyzeImageToDiagramData(blob, 'sk-ant-x');
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].id).toBe('p1');
  });
});

describe('stripCodeFences', () => {
  it('strips ```json … ``` fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips plain ``` … ``` fences', () => {
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('returns the input unchanged when no fences are present', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });

  it('trims surrounding whitespace', () => {
    expect(stripCodeFences('   \n{"a":1}\n   ')).toBe('{"a":1}');
  });

  it('handles an opened-but-not-closed fence', () => {
    // Drop the leading fence line and keep the rest. The result still won't
    // be valid JSON, but at least the parser sees a real attempt instead of
    // dying on the backticks.
    expect(stripCodeFences('```json\n{"a":1}')).toBe('{"a":1}');
  });
});

describe('extractFirstJsonObject', () => {
  it('returns null when no { is present', () => {
    expect(extractFirstJsonObject('no json here')).toBeNull();
  });

  it('extracts a flat object', () => {
    expect(extractFirstJsonObject('Here you go: {"a":1} thanks!')).toBe('{"a":1}');
  });

  it('handles nested braces correctly', () => {
    const src = 'preface {"a":{"b":{"c":1}}, "d":2} suffix';
    expect(extractFirstJsonObject(src)).toBe('{"a":{"b":{"c":1}}, "d":2}');
  });

  it('ignores braces inside strings', () => {
    const src = '{"name":"a {weird} name", "n":1}';
    expect(extractFirstJsonObject(src)).toBe('{"name":"a {weird} name", "n":1}');
  });

  it('returns null when the object is never closed', () => {
    expect(extractFirstJsonObject('{"a":1, "b":[')).toBeNull();
  });
});
