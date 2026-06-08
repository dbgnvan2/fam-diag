/**
 * Tests for importLog.ts
 */

import { describe, it, expect } from 'vitest';
import { ImportLog, maskSecret } from './importLog';

describe('ImportLog', () => {
  it('records entries with timestamp and level', () => {
    const log = new ImportLog();
    log.info('starting');
    log.warn('something odd');
    log.error('failed');
    const text = log.serialize();
    expect(text).toContain('[INFO]');
    expect(text).toContain('[WARN]');
    expect(text).toContain('[ERROR]');
    expect(text).toContain('starting');
    expect(text).toContain('something odd');
    expect(text).toContain('failed');
  });

  it('serialize includes a header with the entry count', () => {
    const log = new ImportLog();
    log.info('a');
    log.info('b');
    expect(log.serialize()).toMatch(/Entries: 2/);
  });

  it('emits entries with ISO timestamps', () => {
    const log = new ImportLog();
    log.info('x');
    const text = log.serialize();
    // Loose match — any ISO 8601 timestamp should appear.
    expect(text).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });
});

describe('maskSecret', () => {
  it('masks long secrets but reveals length', () => {
    const masked = maskSecret('sk-ant-api03-abcdefghijklmnop');
    expect(masked).not.toContain('abcdefghij');
    expect(masked).toContain('sk-ant-');
    expect(masked).toContain('mnop');
    expect(masked).toContain('length=');
  });

  it('returns *** for short secrets', () => {
    expect(maskSecret('short')).toBe('***');
  });

  it('handles empty input', () => {
    expect(maskSecret('')).toBe('(empty)');
  });
});
