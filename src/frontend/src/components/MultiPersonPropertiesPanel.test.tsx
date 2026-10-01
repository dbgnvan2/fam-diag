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
      <MultiPersonPropertiesPanel selectedPeople={people} onBatchUpdate={onBatchUpdate} onAddEmotionalPattern={() => {}} onClose={() => {}} />
    );
    const sizeInput = getByLabelText(/Size/i) as HTMLInputElement;
    fireEvent.change(sizeInput, { target: { value: '80' } });
    expect(onBatchUpdate).toHaveBeenCalledWith(['a', 'b'], { size: 80 });
  });

  it('updates colors and background toggles for all selected people', () => {
    const onBatchUpdate = vi.fn();
    const { getByLabelText } = render(
      <MultiPersonPropertiesPanel selectedPeople={people} onBatchUpdate={onBatchUpdate} onAddEmotionalPattern={() => {}} onClose={() => {}} />
    );
    const borderColorInput = getByLabelText(/Border Color/i) as HTMLInputElement;
    fireEvent.change(borderColorInput, { target: { value: '#ff0000' } });
    expect(onBatchUpdate).toHaveBeenCalledWith(['a', 'b'], { borderColor: '#ff0000', borderEnabled: true });

    const backgroundToggle = getByLabelText(/Shaded Background Enabled/i) as HTMLInputElement;
    fireEvent.click(backgroundToggle);
    expect(onBatchUpdate).toHaveBeenCalledWith(['a', 'b'], { backgroundEnabled: true });
  });

  // Review nodes-04: with mixed sizes, blurring the empty Size field twice
  // used to restore "60" and then apply 60 to everyone.
  it('nodes-04: blurring the empty Size field with mixed sizes changes nobody', () => {
    const onBatchUpdate = vi.fn();
    const mixed: Person[] = [
      { id: 'a', name: 'A', x: 0, y: 0, partnerships: [], size: 40 },
      { id: 'b', name: 'B', x: 10, y: 10, partnerships: [], size: 90 },
    ];
    const { getByLabelText } = render(
      <MultiPersonPropertiesPanel selectedPeople={mixed} onBatchUpdate={onBatchUpdate} onAddEmotionalPattern={() => {}} onClose={() => {}} />
    );
    const sizeInput = getByLabelText(/Size/i) as HTMLInputElement;
    expect(sizeInput.value).toBe('');
    fireEvent.blur(sizeInput);
    expect(sizeInput.value).toBe('');
    fireEvent.blur(sizeInput);
    expect(onBatchUpdate).not.toHaveBeenCalled();
  });

  it('nodes-04: blurring an unchanged shared size sends no update', () => {
    const onBatchUpdate = vi.fn();
    const { getByLabelText } = render(
      <MultiPersonPropertiesPanel selectedPeople={people} onBatchUpdate={onBatchUpdate} onAddEmotionalPattern={() => {}} onClose={() => {}} />
    );
    const sizeInput = getByLabelText(/Size/i) as HTMLInputElement;
    fireEvent.blur(sizeInput);
    expect(onBatchUpdate).not.toHaveBeenCalled();
  });

  // Review nodes-05: a person with a stored red colour but the border
  // switched off is drawn black, so a red + black pair is not "Mixed" and a
  // pair of the same stored colour with one switched off is.
  it('nodes-05: compares the border colour each person is drawn with', () => {
    const offRed: Person = { id: 'a', name: 'A', x: 0, y: 0, partnerships: [], borderColor: '#ff0000', borderEnabled: false };
    const plain: Person = { id: 'b', name: 'B', x: 0, y: 0, partnerships: [] };
    const onRed: Person = { id: 'c', name: 'C', x: 0, y: 0, partnerships: [], borderColor: '#ff0000', borderEnabled: true };

    const same = render(
      <MultiPersonPropertiesPanel selectedPeople={[offRed, plain]} onBatchUpdate={() => {}} onAddEmotionalPattern={() => {}} onClose={() => {}} />
    );
    expect((same.getByLabelText(/Border Color/i) as HTMLInputElement).value).toBe('#000000');
    expect(same.queryByText('Mixed values')).toBeNull();
    same.unmount();

    const differ = render(
      <MultiPersonPropertiesPanel selectedPeople={[offRed, onRed]} onBatchUpdate={() => {}} onAddEmotionalPattern={() => {}} onClose={() => {}} />
    );
    expect(differ.getAllByText('Mixed values').length).toBeGreaterThan(0);
  });
});
