/**
 * What the Sibling section writes, and to whom (gap review F-6). The existing
 * PropertiesPanel tests only checked that its labels render.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PropertiesPanel from '../PropertiesPanel';
import type { Partnership, Person } from '../../types';

const dad: Person = { id: 'dad', name: 'Dad', x: 0, y: 0, birthSex: 'male', partnerships: ['parents'] };
const mom: Person = { id: 'mom', name: 'Mom', x: 0, y: 0, birthSex: 'female', partnerships: ['parents'] };
const harry: Person = {
  id: 'harry',
  name: 'Harry',
  x: 0,
  y: 0,
  birthSex: 'male',
  birthDate: '1980-01-01',
  parentPartnership: 'parents',
  siblingsComplete: true,
  partnerships: [],
};
const orphan: Person = { id: 'orphan', name: 'Orphan', x: 0, y: 0, birthSex: 'male', partnerships: [] };
const parents: Partnership = {
  id: 'parents',
  partner1_id: 'dad',
  partner2_id: 'mom',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: ['harry'],
};

const renderSibling = (selected: Person, onUpdatePerson = vi.fn()) => {
  render(
    <PropertiesPanel
      selectedItem={selected}
      people={[dad, mom, harry, orphan]}
      partnerships={[parents]}
      eventCategories={[]}
      functionalIndicatorDefinitions={[]}
      sirCategories={[]}
      functionalFactCategories={[]}
      onUpdatePerson={onUpdatePerson}
      onUpdatePartnership={() => {}}
      onUpdateEmotionalLine={() => {}}
      initialPersonSection="sibling"
      onClose={() => {}}
    />
  );
  return onUpdatePerson;
};

const firstPositionValue = (select: HTMLSelectElement) =>
  Array.from(select.options).find((option) => option.value)!.value;

describe('PersonSiblingSection — writes', () => {
  it("setting the father's position writes it on the father, not on the person", () => {
    const onUpdatePerson = renderSibling(harry);
    fireEvent.click(screen.getByRole('tab', { name: /Compatibility/i }));
    fireEvent.click(screen.getByText('Person vs Father'));
    const select = document.getElementById('other-pos-father') as HTMLSelectElement;
    const value = firstPositionValue(select);
    fireEvent.change(select, { target: { value } });
    expect(onUpdatePerson).toHaveBeenCalledWith('dad', { siblingPositionOverride: value });
    expect(onUpdatePerson).not.toHaveBeenCalledWith('harry', expect.anything());
  });

  it("with no father on the diagram, the manual position is stored on the person", () => {
    const onUpdatePerson = renderSibling(orphan);
    fireEvent.click(screen.getByRole('tab', { name: /Compatibility/i }));
    fireEvent.click(screen.getByText('Person vs Father'));
    const select = document.getElementById('manual-pos-father') as HTMLSelectElement;
    const value = firstPositionValue(select);
    fireEvent.change(select, { target: { value } });
    expect(onUpdatePerson).toHaveBeenCalledWith('orphan', { fatherPositionOverride: value });
  });

  it('birth order override: 0 is refused, 2.7 is stored as 2, empty clears it', () => {
    const onUpdatePerson = renderSibling(harry);
    fireEvent.click(screen.getByRole('tab', { name: /^Override$/i }));
    const input = screen.getByLabelText('Birth Order Override:');
    fireEvent.change(input, { target: { value: '0' } });
    expect(onUpdatePerson).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '2.7' } });
    expect(onUpdatePerson).toHaveBeenLastCalledWith('harry', { birthOrderOverride: 2 });
    fireEvent.change(input, { target: { value: '' } });
    expect(onUpdatePerson).toHaveBeenLastCalledWith('harry', { birthOrderOverride: undefined });
  });

  it('choosing a maturity level from its help stores the number', () => {
    const onUpdatePerson = renderSibling(harry);
    fireEvent.click(screen.getByRole('tab', { name: /^Override$/i }));
    fireEvent.click(screen.getByLabelText('Maturity level help'));
    const scale = screen.getByRole('dialog', { name: 'Maturity Level Scale' });
    const levelButtons = Array.from(scale.querySelectorAll('button')).filter((b) => b.textContent !== 'Cancel');
    fireEvent.click(levelButtons[2]);
    expect(onUpdatePerson).toHaveBeenLastCalledWith('harry', { siblingMaturityLevel: 3 });
  });
});
