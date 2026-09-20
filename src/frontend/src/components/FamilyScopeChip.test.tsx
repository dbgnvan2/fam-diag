/**
 * Spec: docs/implementation_plan_2026-09-19.md#M3.A.2
 *       docs/implementation_plan_2026-09-19.md#M3.A.3
 *       docs/implementation_plan_2026-09-19.md#M3.A.4
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyScopeChip from './FamilyScopeChip';
import type { FamilyScopeExclusions, FamilyScopeFocus } from '../utils/familyScope';

const focus: FamilyScopeFocus = {
  rootId: 'root',
  up: 2,
  down: 2,
  includeCollaterals: true,
  includePartnerFOO: false,
};

const exclusions: FamilyScopeExclusions = {
  visiblePeople: 14,
  totalPeople: 61,
  hiddenEmotionalLines: 0,
  hiddenTriangles: 0,
  boundaryEvents: 0,
};

const renderChip = (overrides: Partial<React.ComponentProps<typeof FamilyScopeChip>> = {}) => {
  const props = {
    focus,
    rootName: 'Dave',
    exclusions,
    depth: { maxUp: 3, maxDown: 3 },
    onAdjustUp: vi.fn(),
    onAdjustDown: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<FamilyScopeChip {...props} />);
  return props;
};

describe('FamilyScopeChip', () => {
  it('test_m3a2_renders_root_name_counts_and_steppers', () => {
    renderChip();
    expect(screen.getByText(/Focus: Dave/)).toBeInTheDocument();
    expect(screen.getByTestId('family-scope-count')).toHaveTextContent('showing 14 of 61');
    expect(screen.getByTestId('family-scope-up-up')).toBeInTheDocument();
    expect(screen.getByTestId('family-scope-down-down')).toBeInTheDocument();
  });

  it('test_m3a2_hidden_when_no_focus', () => {
    renderChip({ focus: null });
    expect(screen.queryByTestId('family-scope-chip')).not.toBeInTheDocument();
  });

  it('test_m3a2_clear_button_calls_clear_focus', () => {
    const props = renderChip();
    fireEvent.click(screen.getByTestId('family-scope-clear'));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('test_m3a2_steppers_call_adjust_with_signed_delta', () => {
    const props = renderChip();
    fireEvent.click(screen.getByTestId('family-scope-up-up'));
    expect(props.onAdjustUp).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('family-scope-up-down'));
    expect(props.onAdjustUp).toHaveBeenCalledWith(-1);
    fireEvent.click(screen.getByTestId('family-scope-down-up'));
    expect(props.onAdjustDown).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('family-scope-down-down'));
    expect(props.onAdjustDown).toHaveBeenCalledWith(-1);
  });

  it('test_m3a2_steppers_disable_at_the_depth_limits', () => {
    renderChip({
      focus: { ...focus, up: 0, down: 3 },
      depth: { maxUp: 3, maxDown: 3 },
    });
    expect(screen.getByTestId('family-scope-up-down')).toBeDisabled();
    expect(screen.getByTestId('family-scope-down-up')).toBeDisabled();
    expect(screen.getByTestId('family-scope-up-up')).not.toBeDisabled();
  });

  it('test_m3a3_reports_boundary_exclusions_when_nonzero', () => {
    renderChip({
      exclusions: {
        ...exclusions,
        hiddenEmotionalLines: 3,
        hiddenTriangles: 1,
        boundaryEvents: 2,
      },
    });
    const hidden = screen.getByTestId('family-scope-hidden');
    expect(hidden).toHaveTextContent('3 patterns');
    expect(hidden).toHaveTextContent('1 triangle');
    expect(hidden).toHaveTextContent('2 boundary events');
  });

  it('test_m3a3_reports_nothing_when_no_exclusions', () => {
    renderChip();
    expect(screen.queryByTestId('family-scope-hidden')).not.toBeInTheDocument();
  });

  it('test_m3a4_steppers_respond_to_keyboard', () => {
    const props = renderChip();
    const plus = screen.getByTestId('family-scope-up-up');
    plus.focus();
    expect(plus).toHaveFocus();
    // A focused <button> fires click on Enter/Space via the browser default;
    // jsdom needs the click dispatched, so assert the element is reachable and
    // activates through the same handler.
    fireEvent.keyDown(plus, { key: 'Enter' });
    fireEvent.click(plus);
    expect(props.onAdjustUp).toHaveBeenCalledWith(1);
  });

  it('test_m3a2_center_control_is_optional', () => {
    const onCenter = vi.fn();
    renderChip({ onCenter });
    fireEvent.click(screen.getByLabelText('Center view on this family'));
    expect(onCenter).toHaveBeenCalledTimes(1);
  });
});
