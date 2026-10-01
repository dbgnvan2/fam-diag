/**
 * Regression tests: Open and backup restore must not silently discard unsaved
 * work. New/Demo already asked; Open (picker and file-input fallback) and
 * restore replaced the diagram with no prompt.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ChangeEvent } from 'react';
import { useFileOperations } from './useFileOperations';

type Deps = Parameters<typeof useFileOperations>[0];

const VALID_JSON = JSON.stringify({ people: [], partnerships: [], emotionalLines: [] });

const makeDeps = (overrides: Partial<Deps> = {}): Deps => {
  const setter = () => vi.fn();
  return {
    fileName: 'current.json',
    isDirty: true,
    people: [],
    partnerships: [],
    emotionalLines: [],
    pageNotes: [],
    triangles: [],
    backupRestoreVersions: { v1: VALID_JSON, updatedAt: '2026-09-27T00:00:00Z' },
    buildDemoSnapshots: [],
    buildDemoSteps: [],
    diagramFileHandleRef: { current: null },
    loadInputRef: { current: null },
    importInputRef: { current: null },
    importPersonEventsInputRef: { current: null },
    transcriptInputRef: { current: null },
    setPeople: setter(),
    setPartnerships: setter(),
    setEmotionalLines: setter(),
    setPageNotes: setter(),
    setTriangles: setter(),
    setFileName: setter(),
    setSelectedPeopleIds: setter(),
    setSelectedPartnershipId: setter(),
    setSelectedEmotionalLineId: setter(),
    setSelectedChildId: setter(),
    setSelectedPageNoteId: setter(),
    setPageNoteDraft: setter(),
    setPropertiesPanelItem: setter(),
    setPropertiesPanelIntent: setter(),
    setPersonSectionPopup: setter(),
    setContextMenu: setter(),
    closeTimeline: vi.fn(),
    setIdeasText: setter(),
    setPredictionSets: setter(),
    setLastSavedAt: setter(),
    setBackupRestoreOpen: setter(),
    setBackupRestoreVersions: setter(),
    setHelpOpen: setter(),
    setTrainingVideosOpen: setter(),
    setBuildDemoOpen: setter(),
    setBuildDemoStepIndex: setter(),
    setDemoTourStepIndex: setter(),
    setDemoTourOpen: setter(),
    saveDiagramToCurrentTarget: vi.fn(async () => true),
    replaceDiagramState: vi.fn(),
    beginImportFlow: vi.fn(),
    beginSessionCaptureFlow: vi.fn(),
    setDiagramFileHandle: vi.fn(),
    clearTransientEditorState: vi.fn(),
    markSnapshotClean: vi.fn(),
    triggerSaveAs: vi.fn(async () => undefined),
    ...overrides,
  };
};

const fakePickedFile = { name: 'other.json', text: async () => VALID_JSON };

describe('useFileOperations — replacing the diagram with unsaved changes', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm');
  });
  afterEach(() => {
    confirmSpy.mockRestore();
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
  });

  const openViaPicker = async (deps: Deps) => {
    const handle = { name: 'other.json', getFile: async () => fakePickedFile };
    Object.assign(window, { showOpenFilePicker: vi.fn(async () => [handle]) });
    const { result } = renderHook(() => useFileOperations(deps));
    await act(async () => {
      result.current.handleOpenFilePicker();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return handle;
  };

  it('Open (picker): declining keeps the current diagram and its file link', async () => {
    confirmSpy.mockReturnValue(false);
    const deps = makeDeps();
    await openViaPicker(deps);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deps.replaceDiagramState).not.toHaveBeenCalled();
    expect(deps.setDiagramFileHandle).not.toHaveBeenCalled();
  });

  it('Open (picker): confirming replaces the diagram', async () => {
    confirmSpy.mockReturnValue(true);
    const deps = makeDeps();
    const handle = await openViaPicker(deps);
    expect(deps.replaceDiagramState).toHaveBeenCalledTimes(1);
    expect(deps.setDiagramFileHandle).toHaveBeenCalledWith(handle);
  });

  it('Open (picker): a clean diagram opens without a prompt', async () => {
    const deps = makeDeps({ isDirty: false });
    await openViaPicker(deps);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deps.replaceDiagramState).toHaveBeenCalledTimes(1);
  });

  it('Open (file input fallback): declining keeps the current diagram', async () => {
    confirmSpy.mockReturnValue(false);
    const deps = makeDeps();
    const { result } = renderHook(() => useFileOperations(deps));
    const file = new File([VALID_JSON], 'other.json', { type: 'application/json' });
    const target = { files: [file], value: 'C:\\fakepath\\other.json' };
    await act(async () => {
      result.current.handleLoad({ target } as unknown as ChangeEvent<HTMLInputElement>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deps.replaceDiagramState).not.toHaveBeenCalled();
    expect(deps.setDiagramFileHandle).not.toHaveBeenCalled();
  });

  it('Restore backup: declining keeps the current diagram and leaves the dialog open', () => {
    confirmSpy.mockReturnValue(false);
    const deps = makeDeps();
    const { result } = renderHook(() => useFileOperations(deps));
    act(() => result.current.handleRestoreBackupVersion('v1'));
    expect(deps.replaceDiagramState).not.toHaveBeenCalled();
    expect(deps.setBackupRestoreOpen).not.toHaveBeenCalled();
  });

  it('Restore backup: confirming restores it', () => {
    confirmSpy.mockReturnValue(true);
    const deps = makeDeps();
    const { result } = renderHook(() => useFileOperations(deps));
    act(() => result.current.handleRestoreBackupVersion('v1'));
    expect(deps.replaceDiagramState).toHaveBeenCalledTimes(1);
    expect(deps.setBackupRestoreOpen).toHaveBeenCalledWith(false);
  });
});

describe('useFileOperations — File > New starts an empty diagram', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('clears prediction sets and ideas (regression F-2: carried into the next file)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('family-diagram-predictions', JSON.stringify([{ id: 's1', name: 'Old client' }]));
    localStorage.setItem('family-diagram-ideas', 'old client ideas');
    const deps = makeDeps({ isDirty: false });
    const { result } = renderHook(() => useFileOperations(deps));
    act(() => {
      result.current.handleNewFile();
    });
    expect(deps.setPredictionSets).toHaveBeenCalledWith([]);
    // The panel, selections and dialogs are cleared (review DE1-07).
    expect(deps.clearTransientEditorState).toHaveBeenCalled();
    expect(deps.setIdeasText).toHaveBeenCalledWith('');
    expect(deps.markSnapshotClean).toHaveBeenCalledWith(
      expect.objectContaining({ predictionSets: [], ideasText: '', people: [] })
    );
    expect(localStorage.getItem('family-diagram-predictions')).toBe('[]');
    expect(localStorage.getItem('family-diagram-ideas')).toBe('');
  });
});

describe('useFileOperations — a failed save is reported (review 2026-09-30 DE1-10)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('an error from the save is shown, not lost as an unhandled rejection', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const deps = makeDeps({
      fileName: 'family.json',
      saveDiagramToCurrentTarget: vi.fn(async () => {
        throw new Error('disk full');
      }),
    });
    const { result } = renderHook(() => useFileOperations(deps));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(alertSpy).toHaveBeenCalledWith('The diagram could not be saved: disk full.');
  });
});
