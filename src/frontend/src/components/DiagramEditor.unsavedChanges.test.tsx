/**
 * Regression test: import in "replace" mode ("Create New Family") must ask
 * before discarding unsaved changes, like File > New does.
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import DiagramEditor from './DiagramEditor';

const IMPORT_JSON = JSON.stringify({
  people: [{ id: 'imp-1', name: 'Imported Person', x: 100, y: 100, partnerships: [] }],
  partnerships: [],
  emotionalLines: [],
});

const importInput = (container: HTMLElement) => {
  // AppRibbon renders the hidden inputs in order: load, import, person events, transcript.
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".json"]');
  return inputs[1];
};

const openImportDialog = async (container: HTMLElement) => {
  const file = new File([IMPORT_JSON], 'incoming.json', { type: 'application/json' });
  await act(async () => {
    fireEvent.change(importInput(container), { target: { files: [file] } });
  });
  await waitFor(() => expect(screen.getByText('Create New Family')).toBeInTheDocument());
};

describe('DiagramEditor — import replace with unsaved changes', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    localStorage.clear();
    confirmSpy = vi.spyOn(window, 'confirm');
  });
  afterEach(() => confirmSpy.mockRestore());

  const makeDirty = () => {
    confirmSpy.mockReturnValue(true);
    fireEvent.contextMenu(screen.getByRole('presentation'));
    fireEvent.click(screen.getByText('Add Person'));
    confirmSpy.mockClear();
  };

  it('declining keeps the dialog open and the diagram unchanged', async () => {
    const { container } = render(<DiagramEditor />);
    makeDirty();
    await openImportDialog(container);
    confirmSpy.mockReturnValue(false);
    fireEvent.click(screen.getByText('Create New Family'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0][0])).toContain('incoming.json');
    expect(screen.getByText('Create New Family')).toBeInTheDocument();
  });

  it('confirming replaces the diagram and closes the dialog', async () => {
    const { container } = render(<DiagramEditor />);
    makeDirty();
    await openImportDialog(container);
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('Create New Family'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Create New Family')).not.toBeInTheDocument());
  });
});

describe('DiagramEditor — Build Demo with unsaved changes', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    localStorage.clear();
    confirmSpy = vi.spyOn(window, 'confirm');
  });
  afterEach(() => confirmSpy.mockRestore());

  const openBuildDemoFromHelpMenu = () => {
    fireEvent.click(screen.getByRole('button', { name: /^Help$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Build Demo$/i }));
  };

  it('declining keeps the diagram and does not open the demo (regression: ribbon bypassed the guard)', () => {
    render(<DiagramEditor />);
    confirmSpy.mockReturnValue(true);
    fireEvent.contextMenu(screen.getByRole('presentation'));
    fireEvent.click(screen.getByText('Add Person'));
    confirmSpy.mockClear();

    confirmSpy.mockReturnValue(false);
    openBuildDemoFromHelpMenu();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // One wording for every whole-diagram replace (utils/unsavedChanges.ts).
    expect(String(confirmSpy.mock.calls[0][0])).toBe(
      'Start the build demo? Unsaved changes to the current diagram will be lost.'
    );
    expect(screen.queryByRole('dialog', { name: /build demo walkthrough/i })).not.toBeInTheDocument();
  });

  it('confirming opens the demo at step 1', () => {
    render(<DiagramEditor />);
    confirmSpy.mockReturnValue(true);
    fireEvent.contextMenu(screen.getByRole('presentation'));
    fireEvent.click(screen.getByText('Add Person'));
    openBuildDemoFromHelpMenu();
    expect(screen.getByText(/Build Step 1 of/i)).toBeInTheDocument();
  });
});
