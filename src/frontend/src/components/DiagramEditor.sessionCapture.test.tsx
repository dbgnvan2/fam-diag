/**
 * Session-capture import must not invent a sex for the people it creates
 * (upsert_person, add_person_event fallback, upsert_partnership partners).
 * Regression: they defaulted to female, and synthetic partners to male then
 * female by position. People are read back from what autosave writes.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';
import { STORAGE_KEYS } from '../utils/storage';
import type { Person } from '../types';

const CAPTURE = {
  kind: 'fam-diag-session-capture',
  version: 1,
  operations: [
    { id: 'op1', type: 'upsert_person', confidence: 0.9, payload: { name: 'Quinlan Ray' } },
    { id: 'op2', type: 'upsert_person', confidence: 0.9, payload: { name: 'Pat Ray', gender: 'male' } },
    {
      id: 'op3',
      type: 'add_person_event',
      confidence: 0.9,
      matchHints: { personName: 'Tavi Ray' },
      payload: { category: 'Session Event', date: '2020-05-01' },
    },
    {
      id: 'op4',
      type: 'upsert_partnership',
      confidence: 0.9,
      payload: { partner1Name: 'Rowan Lee', partner2Name: 'Sky Lee' },
    },
  ],
};

describe('DiagramEditor — session-capture import', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const key of ['people', 'partnerships', 'emotionalLines', 'triangles', 'pageNotes'] as const) {
      localStorage.setItem(STORAGE_KEYS[key], '[]');
    }
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates people with the sex the capture gives, or none', async () => {
    const { container } = render(<DiagramEditor />);
    const importInput = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".json"]')[1];
    const file = new File([JSON.stringify(CAPTURE)], 'capture.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(importInput, { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(50);
    });
    fireEvent.click(screen.getByText('Apply Selected'));
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
    }

    const people = JSON.parse(localStorage.getItem(STORAGE_KEYS.people) as string) as Person[];
    const gender = (name: string) => {
      const match = people.find((p) => p.name === name);
      expect(match, `${name} created`).toBeDefined();
      return match!.gender;
    };
    expect(gender('Quinlan Ray')).toBeUndefined();
    expect(gender('Pat Ray')).toBe('male');
    expect(gender('Tavi Ray')).toBeUndefined();
    expect(gender('Rowan Lee')).toBeUndefined();
    expect(gender('Sky Lee')).toBeUndefined();
  }, 30_000);
});
