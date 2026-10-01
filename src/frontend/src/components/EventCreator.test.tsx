/**
 * Tests for the standalone Timeline Event Creator.
 * Review: REVIEW-final-areas-2026-09-30.md bundle-03 / struct-05, bundle-04, G-TEST-05.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventCreator from './EventCreator';
import type { TimelineJson } from '../utils/personEventBundle';

const readBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const timelineFile = (content: unknown) =>
  new File([JSON.stringify(content)], 'Family - timeline.json', { type: 'application/json' });

const baseTimeline = (events: unknown[]): unknown => ({
  kind: 'fam-diag-timeline',
  version: 1,
  timelineName: 'Family - timeline',
  exportedAt: '2026-09-30T00:00:00.000Z',
  people: [{ personId: 'p1', personName: 'Jane Doe', baselineEventIds: ['e1'], events }],
});

const storedEvent = {
  id: 'e1',
  date: '2001-05-01',
  startDate: '2001-05-01',
  category: 'Relocation',
  subtype: 'Moved',
  eventType: 'NODAL',
  anchorType: 'PERSON',
  anchorId: 'p1',
  status: 'discrete',
  intensity: 2,
  howWell: 0,
  otherPersonName: 'None',
  wwwwh: '',
  observations: 'Moved to Leeds',
  eventClass: 'individual',
  createdAt: 1,
};

let blobs: Blob[] = [];

beforeEach(() => {
  blobs = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    blobs.push(blob as Blob);
    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const openFile = async (content: unknown) => {
  const { container } = render(<EventCreator />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [timelineFile(content)] } });
  await screen.findByText('Jane Doe');
  return container;
};

const savedTimeline = async (): Promise<TimelineJson> => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Save JSON' })[0]);
  expect(blobs).toHaveLength(1);
  return JSON.parse(await readBlob(blobs[0])) as TimelineJson;
};

describe('EventCreator', () => {
  it('g_test_05_bundle_03: a Date edit sets date and startDate together', async () => {
    const container = await openFile(baseTimeline([storedEvent]));
    fireEvent.click(screen.getByText('2001-05-01'));
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2003-07-09' } });
    const saved = await savedTimeline();
    const event = saved.people[0].events[0];
    expect(event.date).toBe('2003-07-09');
    expect(event.startDate).toBe('2003-07-09');
  });

  it('g_test_05_struct_05: Add Event builds a complete undated event through eventDraft', async () => {
    await openFile(baseTimeline([]));
    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));
    const saved = await savedTimeline();
    const event = saved.people[0].events[0];
    expect(event.date).toBe('');
    expect(event.startDate).toBe('');
    expect(event.anchorType).toBe('PERSON');
    expect(event.anchorId).toBe('p1');
    expect(event.eventClass).toBe('individual');
    expect(event.eventType).toBe('NODAL');
    expect(event.subtype).toBe('');
    expect(typeof event.createdAt).toBe('number');
    expect(event.intensity).toBe(0);
    // No category is chosen for the user (author decision 2026-09-30).
    expect(event.category).toBe('');
  });

  it('bundle_04: malformed events are dropped and reported, not a crash', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await openFile(
      baseTimeline([null, { ...storedEvent, id: 'bad', observations: { text: 'x' } }, storedEvent]),
    );
    expect(screen.getByText('2001-05-01')).toBeTruthy();
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toContain('Unreadable events skipped: 2');
    const saved = await savedTimeline();
    expect(saved.people[0].events.map((event) => event.id)).toEqual(['e1']);
  });
});
