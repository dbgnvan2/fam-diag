import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiPersonPropertiesPanel from './MultiPersonPropertiesPanel';
import type { Person } from '../types';

describe('MultiPersonPropertiesPanel', () => {
  const people: Person[] = [
    { id: 'a', name: 'A', x: 0, y: 0, partnerships: [], size: 60 },
    { id: 'b', name: 'B', x: 10, y: 10, partnerships: [], size: 60 },
  ];

  it('updates size for all selected people', () => {
    const onBatchUpdate = vi.fn();
    const { getByLabelText } = render(
      <MultiPersonPropertiesPanel selectedPeople={people} onBatchUpdate={onBatchUpdate} onClose={() => {}} />
    );
    const sizeInput = getByLabelText(/Size/i) as HTMLInputElement;
    fireEvent.change(sizeInput, { target: { value: '80' } });
    expect(onBatchUpdate).toHaveBeenCalledWith(['a', 'b'], { size: 80 });
  });

  it('updates colors and background toggles for all selected people', () => {
    const onBatchUpdate = vi.fn();
    const { getByLabelText } = render(
      <MultiPersonPropertiesPanel selectedPeople={people} onBatchUpdate={onBatchUpdate} onClose={() => {}} />
    );
    const borderColorInput = getByLabelText(/Border Color/i) as HTMLInputElement;
    fireEvent.change(borderColorInput, { target: { value: '#ff0000' } });
    expect(onBatchUpdate).toHaveBeenCalledWith(['a', 'b'], { borderColor: '#ff0000' });

    const backgroundToggle = getByLabelText(/Shaded Background Enabled/i) as HTMLInputElement;
    fireEvent.click(backgroundToggle);
    expect(onBatchUpdate).toHaveBeenCalledWith(['a', 'b'], { backgroundEnabled: true });
  });
});
