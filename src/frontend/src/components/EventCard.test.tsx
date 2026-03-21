import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventCard from './EventCard';

describe('EventCard', () => {
  it('displays dash for intensity 0 (unset)', () => {
    render(
      <EventCard
        date="2026-03-21"
        type="Symptom"
        category="Physical"
        status="discrete"
        intensity={0}
      />,
    );
    // intensity 0 means "not set" — dropdown options start at 1
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('displays dash when intensity is null', () => {
    render(
      <EventCard
        date="2026-03-21"
        type="Symptom"
        category="Physical"
        status="discrete"
        intensity={null}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('displays dash when intensity is undefined', () => {
    render(
      <EventCard
        date="2026-03-21"
        type="Symptom"
        category="Physical"
        status="discrete"
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('displays positive intensity values', () => {
    render(
      <EventCard
        date="2026-03-21"
        type="Nodal"
        category="Birth"
        status="discrete"
        intensity={3}
      />,
    );
    expect(screen.getByText('3')).toBeTruthy();
  });
});
