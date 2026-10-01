/**
 * Selecting from inside the Properties panel (review 2026-09-30 struct-10:
 * moved here from DiagramCanvas). A system event opens on its owner (M7.F.2).
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Person, Partnership, EmotionalLine } from '../types';
import { useSelectionHandlers } from './useSelectionHandlers';

const ann: Person = { id: 'ann', name: 'Ann', x: 0, y: 0, partnerships: ['p1'] };
const bob: Person = { id: 'bob', name: 'Bob', x: 100, y: 0, partnerships: ['p1'] };
const couple: Partnership = {
  id: 'p1',
  partner1_id: 'ann',
  partner2_id: 'bob',
  horizontalConnectorY: 100,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: [],
};
const line: EmotionalLine = {
  id: 'l1',
  person1_id: 'ann',
  person2_id: 'bob',
  relationshipType: 'conflict',
  lineStyle: 'conflict-solid-wide',
  lineEnding: 'none',
};

const setup = () => {
  const deps = {
    pageNotes: [],
    selectedPageNoteId: null,
    pageNoteDraft: null,
    selectedEmotionalLineId: null,
    selectedPeopleIds: [],
    selectedPartnershipId: null,
    people: [ann, bob],
    partnerships: [couple],
    triangles: [],
    allEmotionalLines: [line],
    triangleByTplLineId: new Map<string, string>(),
    setPageNotes: vi.fn(),
    setSelectedPeopleIds: vi.fn(),
    setSelectedPartnershipId: vi.fn(),
    setSelectedEmotionalLineId: vi.fn(),
    setSelectedChildId: vi.fn(),
    setSelectedPageNoteId: vi.fn(),
    setPageNoteDraft: vi.fn(),
    setPropertiesPanelItem: vi.fn(),
    setSelectedFamilyId: vi.fn(),
    setContextMenu: vi.fn(),
    addChildToPartnership: vi.fn(),
    handleUpdateEmotionalLine: vi.fn(),
    openContextualEventCreator: vi.fn(),
    openTrianglePropertyModal: vi.fn(),
    removeTriangle: vi.fn(),
    removeEmotionalLine: vi.fn(),
    updateTriangle: vi.fn(),
  };
  const { result } = renderHook(() => useSelectionHandlers(deps));
  return { deps, handlers: result.current };
};

describe('useSelectionHandlers — selecting from the Properties panel (struct-10)', () => {
  it('opens a person owner and clears the other selections', () => {
    const { deps, handlers } = setup();
    handlers.selectSystemEventOwner({ type: 'person', id: 'bob' });
    expect(deps.setSelectedPeopleIds).toHaveBeenCalledWith(['bob']);
    expect(deps.setSelectedPartnershipId).toHaveBeenCalledWith(null);
    expect(deps.setSelectedEmotionalLineId).toHaveBeenCalledWith(null);
    expect(deps.setPropertiesPanelItem).toHaveBeenCalledWith(bob);
  });

  it('opens a partnership owner', () => {
    const { deps, handlers } = setup();
    handlers.selectSystemEventOwner({ type: 'partnership', id: 'p1' });
    expect(deps.setSelectedPeopleIds).toHaveBeenCalledWith([]);
    expect(deps.setSelectedPartnershipId).toHaveBeenCalledWith('p1');
    expect(deps.setPropertiesPanelItem).toHaveBeenCalledWith(couple);
  });

  it('opens a pattern-line owner', () => {
    const { deps, handlers } = setup();
    handlers.selectSystemEventOwner({ type: 'emotional', id: 'l1' });
    expect(deps.setSelectedEmotionalLineId).toHaveBeenCalledWith('l1');
    expect(deps.setPropertiesPanelItem).toHaveBeenCalledWith(line);
  });

  it('does nothing for an owner that no longer exists', () => {
    const { deps, handlers } = setup();
    handlers.selectSystemEventOwner({ type: 'person', id: 'gone' });
    handlers.selectSystemEventOwner({ type: 'partnership', id: 'gone' });
    handlers.selectSystemEventOwner({ type: 'emotional', id: 'gone' });
    expect(deps.setPropertiesPanelItem).not.toHaveBeenCalled();
    expect(deps.setSelectedPeopleIds).not.toHaveBeenCalled();
  });

  it('removing a line from the panel removes it and closes the panel', () => {
    const { deps, handlers } = setup();
    handlers.removeEmotionalLineFromPanel('l1');
    expect(deps.removeEmotionalLine).toHaveBeenCalledWith('l1');
    expect(deps.setPropertiesPanelItem).toHaveBeenCalledWith(null);
    expect(deps.setSelectedEmotionalLineId).toHaveBeenCalledWith(null);
  });

  it('picking a line in the panel shows it and clears the people selection', () => {
    const { deps, handlers } = setup();
    handlers.selectEmotionalLineFromPanel(line);
    expect(deps.setPropertiesPanelItem).toHaveBeenCalledWith(line);
    expect(deps.setSelectedEmotionalLineId).toHaveBeenCalledWith('l1');
    expect(deps.setSelectedPeopleIds).toHaveBeenCalledWith([]);
  });
});
