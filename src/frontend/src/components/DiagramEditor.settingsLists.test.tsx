/**
 * DiagramEditor wiring for the Settings lists and Add Family dialog
 * (review 2026-09-30 settings-02, settings-03, settings-09).
 */
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';

const USER_SETTINGS_KEY = 'family-diagram-user-settings';

const openSettingsItem = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Settings ▾' }));
  fireEvent.click(screen.getByRole('button', { name: label }));
};

describe('DiagramEditor — settings lists and Add Family', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('settings-09: emptied relationship categories stay empty after a reload (regression: came back as defaults)', () => {
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({ relationshipTypes: [], relationshipStatuses: [] }));
    render(<DiagramEditor />);
    openSettingsItem('Relationship Categories');
    const dialog = screen.getByRole('dialog', { name: 'Relationship Categories' });
    expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('settings-09: emptied SIR categories stay empty after a reload', () => {
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({ sirCategories: [] }));
    render(<DiagramEditor />);
    openSettingsItem('Self in Relationship Categories');
    const dialog = screen.getByRole('dialog', { name: 'SIR settings' });
    expect(within(dialog).queryByLabelText(/^Delete /)).toBeNull();
  });

  it('settings-03: Add Family opens with no child rows (regression: three preset-sex rows)', () => {
    render(<DiagramEditor />);
    fireEvent.contextMenu(screen.getByRole('presentation'));
    fireEvent.click(screen.getByText('Add Family'));
    const dialog = screen.getByRole('dialog', { name: 'Add family' });
    expect(within(dialog).queryAllByRole('button', { name: 'Remove' })).toHaveLength(0);
  });

  it('settings-02: an unused Nodal category is deleted after a confirmation', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({ nodalCategories: [{ id: 'nodal-x', name: 'Unused Test' }] }));
    render(<DiagramEditor />);
    openSettingsItem('Nodal Event Categories');
    const dialog = screen.getByRole('dialog', { name: 'Nodal category settings' });
    fireEvent.click(within(dialog).getByLabelText('Delete Unused Test'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByLabelText('Delete Unused Test')).toBeNull();
  });

  it('settings-02: an SIR category in use cannot be deleted, and its events follow a rename', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    // The product default diagram has one SIR event in 'Systems Perspective'.
    localStorage.setItem(
      USER_SETTINGS_KEY,
      JSON.stringify({ sirCategories: [{ id: 'sir-sp', name: 'Systems Perspective', levels: ['1', '2', '3', '4', '5'] }] }),
    );
    render(<DiagramEditor />);
    openSettingsItem('Self in Relationship Categories');
    const dialog = screen.getByRole('dialog', { name: 'SIR settings' });

    fireEvent.click(within(dialog).getByLabelText('Delete Systems Perspective'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(String(alertSpy.mock.calls[0][0])).toContain('is still used by 1 event');
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByLabelText('Edit Systems Perspective'));
    fireEvent.change(within(dialog).getByLabelText('Category name'), { target: { value: 'Wider View' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    // The event moved to the new name, so the renamed category is still in use.
    fireEvent.click(within(dialog).getByLabelText('Delete Wider View'));
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(String(alertSpy.mock.calls[1][0])).toContain('"Wider View" is still used by 1 event');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('settings-09: an imported file with an empty relationship list replaces the list with an empty one', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<DiagramEditor />);
    const file = new File(
      [JSON.stringify({ people: [{ id: 'p', name: 'P', x: 0, y: 0, partnerships: [] }], partnerships: [], emotionalLines: [], relationshipTypes: [] })],
      'empty-lists.json',
      { type: 'application/json' },
    );
    // AppRibbon renders the hidden inputs in order: load, import, person events, transcript.
    const importInput = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".json"]')[1];
    await act(async () => {
      fireEvent.change(importInput, { target: { files: [file] } });
    });
    await waitFor(() => expect(screen.getByText('Create New Family')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create New Family'));
    await waitFor(() => expect(screen.queryByText('Create New Family')).not.toBeInTheDocument());
    openSettingsItem('Relationship Categories');
    const dialog = screen.getByRole('dialog', { name: 'Relationship Categories' });
    expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('settings-10: Help › Help Demo asks before replacing unsaved work (regression: opened the tour over the open diagram)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DiagramEditor />);
    fireEvent.contextMenu(screen.getByRole('presentation'));
    fireEvent.click(screen.getByText('Add Person'));
    confirmSpy.mockClear();
    confirmSpy.mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: /^Help$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Help Demo' }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0][0])).toContain('interactive demo');
  });
});
