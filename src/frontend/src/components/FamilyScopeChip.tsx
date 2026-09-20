/**
 * Purpose: show the active family-scope focus next to the timeline-year
 *          slider, with steppers for N up / N down, the visible/total count,
 *          and a control to clear it.
 * Spec:    docs/implementation_plan_2026-09-19.md#M3.A.2
 * Tests:   src/frontend/src/components/FamilyScopeChip.test.tsx
 *
 * It sits beside the year slider on purpose (D9): both filters AND together,
 * so a user must be able to see both at once rather than wondering why people
 * vanished.
 */
import React from 'react';
import type { FamilyScopeExclusions, FamilyScopeFocus } from '../utils/familyScope';

interface FamilyScopeChipProps {
  focus: FamilyScopeFocus | null;
  rootName: string;
  exclusions: FamilyScopeExclusions;
  depth: { maxUp: number; maxDown: number };
  onAdjustUp: (delta: number) => void;
  onAdjustDown: (delta: number) => void;
  onClear: () => void;
  onHelp?: () => void;
  onCenter?: () => void;
}

const stepperStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  lineHeight: '18px',
  padding: 0,
  borderRadius: 4,
  border: '1px solid #8ba1bd',
  background: '#fff',
  color: '#23324a',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

export default function FamilyScopeChip({
  focus,
  rootName,
  exclusions,
  depth,
  onAdjustUp,
  onAdjustDown,
  onClear,
  onHelp,
  onCenter,
}: FamilyScopeChipProps) {
  if (!focus) return null;

  const hiddenNotes: string[] = [];
  if (exclusions.hiddenEmotionalLines > 0) {
    hiddenNotes.push(
      `${exclusions.hiddenEmotionalLines} pattern${exclusions.hiddenEmotionalLines === 1 ? '' : 's'}`
    );
  }
  if (exclusions.hiddenTriangles > 0) {
    hiddenNotes.push(
      `${exclusions.hiddenTriangles} triangle${exclusions.hiddenTriangles === 1 ? '' : 's'}`
    );
  }
  if (exclusions.boundaryEvents > 0) {
    hiddenNotes.push(
      `${exclusions.boundaryEvents} boundary event${exclusions.boundaryEvents === 1 ? '' : 's'}`
    );
  }

  const stepper = (
    label: string,
    value: number,
    max: number,
    onAdjust: (delta: number) => void,
    testId: string
  ) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 11, color: '#38557a' }}>{label}</span>
      <button
        type="button"
        onClick={() => onAdjust(-1)}
        disabled={value <= 0}
        aria-label={`Fewer generations ${label}`}
        data-testid={`${testId}-down`}
        style={{ ...stepperStyle, cursor: value <= 0 ? 'not-allowed' : 'pointer' }}
      >
        −
      </button>
      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 10, textAlign: 'center' }}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onAdjust(1)}
        disabled={value >= max}
        aria-label={`More generations ${label}`}
        data-testid={`${testId}-up`}
        style={{ ...stepperStyle, cursor: value >= max ? 'not-allowed' : 'pointer' }}
      >
        +
      </button>
    </span>
  );

  return (
    <div
      data-testid="family-scope-chip"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        maxWidth: '100%',
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid #4b68a6',
        background: '#f0f4ff',
        color: '#23324a',
        fontSize: 12,
      }}
    >
      <span style={{ fontWeight: 700 }}>Focus: {rootName || 'Unnamed'}</span>
      {stepper('up', focus.up, depth.maxUp, onAdjustUp, 'family-scope-up')}
      {stepper('down', focus.down, depth.maxDown, onAdjustDown, 'family-scope-down')}
      <span data-testid="family-scope-count">
        showing {exclusions.visiblePeople} of {exclusions.totalPeople}
      </span>
      {hiddenNotes.length > 0 && (
        <span data-testid="family-scope-hidden" style={{ color: '#7a4b00' }}>
          {hiddenNotes.join(' · ')} hidden
        </span>
      )}
      {onCenter && (
        <button
          type="button"
          onClick={onCenter}
          aria-label="Center view on this family"
          style={{ ...stepperStyle, width: 'auto', padding: '0 6px' }}
        >
          Center
        </button>
      )}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear family focus"
        data-testid="family-scope-clear"
        style={{ ...stepperStyle, width: 'auto', padding: '0 6px' }}
      >
        ✕
      </button>
      {onHelp && (
        <button
          type="button"
          onClick={onHelp}
          aria-label="Family focus help"
          style={stepperStyle}
        >
          ?
        </button>
      )}
    </div>
  );
}
