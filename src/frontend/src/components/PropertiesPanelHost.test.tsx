/**
 * The Properties panels moved out of DiagramCanvas into one host (review
 * 2026-09-30 struct-10). Which panel shows, and that the section popup
 * closes from its backdrop.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Person } from '../types';
import PropertiesPanelHost, { type PropertiesPanelHostProps } from './PropertiesPanelHost';

const ann: Person = { id: 'ann', name: 'Ann', x: 0, y: 0, partnerships: [] };
const bob: Person = { id: 'bob', name: 'Bob', x: 100, y: 0, partnerships: [] };

const baseProps = (overrides: Partial<PropertiesPanelHostProps> = {}): PropertiesPanelHostProps => ({
  people: [ann, bob],
  partnerships: [],
  allEmotionalLines: [],
  eventCategories: [],
  relationshipTypes: [],
  relationshipStatuses: [],
  functionalIndicatorDefinitions: [],
  sirCategories: [],
  functionalFactCategories: [],
  nodalCategories: [],
  handleUpdatePerson: vi.fn(),
  handleUpdatePartnership: vi.fn(),
  handleUpdateEmotionalLine: vi.fn(),
  ensureSymptomDefinition: vi.fn(() => null),
  personSectionPopup: null,
  personSectionPopupPerson: null,
  setPersonSectionPopup: vi.fn(),
  partnershipSectionPopup: null,
  partnershipSectionPopupPartnership: null,
  setPartnershipSectionPopup: vi.fn(),
  showMultiPersonPanel: false,
  multiSelectedPeople: [],
  handleBatchUpdatePersons: vi.fn(),
  openAddEmotionalPatternModal: vi.fn(),
  propertiesPanelItem: null,
  setPropertiesPanelItem: vi.fn(),
  setSelectedPeopleIds: vi.fn(),
  propertiesPanelIntent: null,
  setPropertiesPanelIntent: vi.fn(),
  panelTriangleContext: null,
  updateTriangleColor: vi.fn(),
  updateTriangleIntensity: vi.fn(),
  updateTriangle: vi.fn(),
  familyScope: null,
  selectedFamilyId: null,
  onFamilyIndicatorClick: vi.fn(),
  onOpenFamilyProperty: vi.fn(),
  onAddFamilyEvent: vi.fn(),
  onDeleteFamilyEvent: vi.fn(),
  onCloseFamilyPanel: vi.fn(),
  onSelectSystemEventOwner: vi.fn(),
  onSelectEmotionalLine: vi.fn(),
  onRemoveEmotionalLine: vi.fn(),
  ...overrides,
});

describe('PropertiesPanelHost (struct-10)', () => {
  it('renders nothing with no selection', () => {
    const { container } = render(<PropertiesPanelHost {...baseProps()} />);
    expect(container.textContent).toBe('');
  });

  it('shows the multi-person panel for a multi-selection', () => {
    render(<PropertiesPanelHost {...baseProps({ showMultiPersonPanel: true, multiSelectedPeople: [ann, bob] })} />);
    expect(screen.getByText('Multiple People (2)')).toBeTruthy();
  });

  it('shows the single panel for one selected person', () => {
    render(<PropertiesPanelHost {...baseProps({ propertiesPanelItem: ann })} />);
    expect(screen.getByLabelText('Properties tabs')).toBeTruthy();
    expect(screen.queryByText(/Multiple People/)).toBeNull();
  });

  it('closes a person section popup from its backdrop', () => {
    const setPersonSectionPopup = vi.fn();
    const { container } = render(
      <PropertiesPanelHost
        {...baseProps({
          personSectionPopup: { personId: 'ann', section: 'sibling', x: 10, y: 10 },
          personSectionPopupPerson: ann,
          setPersonSectionPopup,
        })}
      />
    );
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(setPersonSectionPopup).toHaveBeenCalledWith(null);
  });
});
