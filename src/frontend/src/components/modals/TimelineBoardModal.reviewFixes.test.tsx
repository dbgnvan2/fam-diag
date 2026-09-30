/**
 * Regression tests for REVIEW-unread-areas-2026-09-30.md: Timeline edits go
 * through the shared event save, family lanes, and the year inputs.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineBoardModal from './TimelineBoardModal';
import TimelineYearInput from './TimelineYearInput';
import type { EmotionalProcessEvent, Partnership, Person } from '../../types';

const conflict: EmotionalProcessEvent = {
  id: 'ev1',
  date: '2001-01-01',
  startDate: '2001-01-01',
  category: 'Relocation',
  eventType: 'NODAL',
  status: 'discrete',
  intensity: 0,
  howWell: 0,
  otherPersonName: 'None',
  wwwwh: '',
  observations: '',
  eventClass: 'individual',
  anchorType: 'PERSON',
  anchorId: 'root',
};
const people: Person[] = [
  { id: 'root', name: 'Root', x: 0, y: 0, partnerships: ['pr'], birthSex: 'male', birthDate: '1970-01-01', events: [conflict] },
  { id: 'wife', name: 'Wife', x: 0, y: 0, partnerships: ['pr'], birthSex: 'female' },
];
const partnerships: Partnership[] = [
  {
    id: 'pr',
    partner1_id: 'root',
    partner2_id: 'wife',
    horizontalConnectorY: 0,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children: [],
    marriedStartDate: '1995-07-07',
  },
];

const renderBoard = (overrides: Partial<React.ComponentProps<typeof TimelineBoardModal>> = {}) => {
  const props: React.ComponentProps<typeof TimelineBoardModal> = {
    people,
    partnerships,
    allEmotionalLines: [],
    eventCategories: [],
    timelineSelectionIds: ['root'],
    timelineFamilySelectionIds: [],
    onUpdatePerson: vi.fn(),
    onUpdatePartnership: vi.fn(),
    onUpdateEmotionalLine: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TimelineBoardModal {...props} />);
  return props;
};

const clickBlock = (text: RegExp) => {
  const block = Array.from(document.querySelectorAll('[data-hover-text]')).find((el) =>
    text.test(el.getAttribute('data-hover-text') || '')
  ) as HTMLElement;
  fireEvent.click(block);
};

describe('Timeline event edits use the shared save', () => {
  it('stores a rating as a number and keeps date equal to startDate (regression: "3" and a stale date)', () => {
    const props = renderBoard();
    clickBlock(/Relocation/);
    fireEvent.change(screen.getByLabelText('Intensity:'), { target: { value: '3' } });
    fireEvent.change(document.getElementById('eventStartDate') as HTMLInputElement, { target: { value: '2002-02-02' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const [, updates] = (props.onUpdatePerson as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(updates.events[0]).toMatchObject({ intensity: 3, date: '2002-02-02', startDate: '2002-02-02' });
  });

  it('editing the marriage block edits the marriage date, not a new event (regression: froze the field)', () => {
    const props = renderBoard();
    clickBlock(/Marriage/);
    expect(screen.queryByLabelText('Category:')).toBeNull();
    fireEvent.change(document.getElementById('eventStartDate') as HTMLInputElement, { target: { value: '1996-08-08' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const [id, updates] = (props.onUpdatePartnership as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('pr');
    expect(updates.marriedStartDate).toBe('1996-08-08');
    expect(updates.events).toHaveLength(1);
    expect(updates.events[0].id).toBe('synth-marriedStartDate-pr');
  });
});

describe('Family lanes', () => {
  it('have no "+ Add Event" button that does nothing (regression: lane.id === "family" never matched)', () => {
    renderBoard({ timelineSelectionIds: [], timelineFamilySelectionIds: ['pr'] });
    expect(screen.getByText(/^Family: Root \+ Wife$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add Event' })).toBeNull();
  });
});

describe('TimelineYearInput', () => {
  it('a year can be typed digit by digit and is committed on blur (regression: clamped per keystroke)', () => {
    const onCommit = vi.fn();
    render(<TimelineYearInput ariaLabel="Start year" value={1950} min={1900} max={2020} onCommit={onCommit} />);
    const input = screen.getByLabelText('Start year') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1');
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '1975' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(1975);
  });

  it('clamps an out-of-range year when committed', () => {
    const onCommit = vi.fn();
    render(<TimelineYearInput ariaLabel="End year" value={2000} min={1900} max={2020} onCommit={onCommit} />);
    const input = screen.getByLabelText('End year');
    fireEvent.change(input, { target: { value: '2999' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(2020);
  });
});

describe('block width floor (needs a ResizeObserver, which jsdom lacks)', () => {
  it('a one-day event over a long range is drawn at least MIN_BLOCK_PX wide, as a share of the measured lane', () => {
    const observers: Array<() => void> = [];
    const originalObserver = globalThis.ResizeObserver;
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    // A 340px lane: the 34px floor is 10% of it.
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { width: 340, height: 100, top: 0, left: 0, right: 340, bottom: 100, x: 0, y: 0, toJSON: () => ({}) };
    };
    try {
      renderBoard();
      const block = Array.from(document.querySelectorAll('[data-hover-text]')).find((el) =>
        /Relocation/.test(el.getAttribute('data-hover-text') || '')
      ) as HTMLElement;
      expect(parseFloat(block.style.width)).toBeGreaterThanOrEqual(10);
    } finally {
      globalThis.ResizeObserver = originalObserver;
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });
});
