import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

const Throws = () => {
  throw new Error('QuotaExceededError');
};

describe('ErrorBoundary (review 2026-09-30 DE1-05)', () => {
  it('shows the error and a reload button instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('QuotaExceededError');
    expect(screen.getByText('Reload')).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>diagram</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('diagram')).toBeTruthy();
  });
});
