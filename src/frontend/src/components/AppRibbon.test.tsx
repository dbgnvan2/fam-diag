/**
 * Render tests for AppRibbon menus (G-TEST-12). The earlier test read the
 * component source and matched a regular expression; it passed whatever the
 * menu actually did. These render the ribbon, open the menu and click the item.
 */
import { createRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppRibbon, { type AppRibbonProps } from './AppRibbon';

const baseProps = (): AppRibbonProps => ({
  ribbonRef: createRef<HTMLDivElement>(),
  fileMenuRef: createRef<HTMLDivElement>(),
  settingsMenuRef: createRef<HTMLDivElement>(),
  optionsMenuRef: createRef<HTMLDivElement>(),
  helpMenuRef: createRef<HTMLDivElement>(),
  loadInputRef: createRef<HTMLInputElement>(),
  importInputRef: createRef<HTMLInputElement>(),
  importPersonEventsInputRef: createRef<HTMLInputElement>(),
  transcriptInputRef: createRef<HTMLInputElement>(),
  imageDiagramInputRef: createRef<HTMLInputElement>(),
  fileMenuOpen: false,
  settingsMenuOpen: false,
  optionsMenuOpen: false,
  helpMenuOpen: false,
  isDirty: false,
  lastDirtyTimestamp: null,
  demoBlinkVisible: false,
  ribbonHelpKey: null,
  notesLayerEnabled: true,
  autoSaveMinutes: 1,
  backupCount: 5,
  timelineYear: null,
  timelinePlaying: false,
  timelineSliderDisabled: false,
  timelineYearBounds: { min: 1900, max: 2026 },
  familyScopeFocus: null,
  familyScopeRootName: '',
  familyScopeExclusions: {
    visiblePeople: 0,
    totalPeople: 0,
    hiddenEmotionalLines: 0,
    hiddenTriangles: 0,
    boundaryEvents: 0,
    unresolvedBoundaryRefs: 0,
  },
  familyScopeDepth: { maxUp: 0, maxDown: 0 },
  onFamilyScopeAdjustUp: vi.fn(),
  onFamilyScopeAdjustDown: vi.fn(),
  onFamilyScopeClear: vi.fn(),
  displayTimelineYear: 2026,
  zoom: 1,
  helpOpen: false,
  fileName: 'Untitled',
  demoTourOpen: false,
  demoTourStepIndex: 0,
  demoTourSteps: [],
  imageDiagramModalOpen: false,
  imageDiagramAnalyzing: false,
  setFileMenuOpen: vi.fn(),
  setSettingsMenuOpen: vi.fn(),
  setOptionsMenuOpen: vi.fn(),
  setHelpMenuOpen: vi.fn(),
  setRibbonHelpKey: vi.fn(),
  setZoom: vi.fn(),
  setTimelineYear: vi.fn(),
  setVoiceInputOpen: vi.fn(),
  setSettingsOpen: vi.fn(),
  setRelationshipTypeSettingsOpen: vi.fn(),
  setRelationshipStatusSettingsOpen: vi.fn(),
  setIndicatorSettingsOpen: vi.fn(),
  setSirSettingsOpen: vi.fn(),
  setFfSettingsOpen: vi.fn(),
  setNodalSettingsOpen: vi.fn(),
  setAiSettingsOpen: vi.fn(),
  setIdeasOpen: vi.fn(),
  setPredictionsOpen: vi.fn(),
  setSessionNotesOpen: vi.fn(),
  handleStartDemoTour: vi.fn(),
  handleStartBuildDemo: vi.fn(),
  setTrainingVideosOpen: vi.fn(),
  setReadmeViewerOpen: vi.fn(),
  setNotesLayerEnabled: vi.fn(),
  showSiblingConflicts: false,
  setShowSiblingConflicts: vi.fn(),
  handleNewFile: vi.fn(),
  handleLoadDemoDiagram: vi.fn(),
  handleOpenFilePicker: vi.fn(),
  handleImportDataPicker: vi.fn(),
  handleImportPersonEventsPicker: vi.fn(),
  handleSave: vi.fn(),
  handleSaveAs: vi.fn(),
  handleOpenBackupRestore: vi.fn(async () => undefined),
  handleExportPersonEvents: vi.fn(),
  handleExportPNG: vi.fn(),
  handleQuit: vi.fn(),
  handleProcessTranscriptPicker: vi.fn(),
  handleOpenEventCreator: vi.fn(),
  handleLoad: vi.fn(),
  handleImportLoad: vi.fn(),
  handleImportPersonEventsLoad: vi.fn(),
  handleProcessTranscriptLoad: vi.fn(),
  handleTimelinePlayToggle: vi.fn(),
  adjustTimelineYear: vi.fn(),
  handleAutoSaveMinutesInput: vi.fn(),
  handleBackupCountInput: vi.fn(),
  handleSetBackupFolder: vi.fn(),
  handleOpenFileBackupRestore: vi.fn(),
  handleCenterDiagramView: vi.fn(),
  handleImageDiagramPicker: vi.fn(),
  handleImageDiagramLoad: vi.fn(),
});

/** The ribbon with real open/closed state for its File and Help menus. */
const Harness = ({ props }: { props: AppRibbonProps }) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  return (
    <AppRibbon
      {...props}
      fileMenuOpen={fileMenuOpen}
      setFileMenuOpen={setFileMenuOpen}
      helpMenuOpen={helpMenuOpen}
      setHelpMenuOpen={setHelpMenuOpen}
    />
  );
};

describe('AppRibbon — File menu (G-TEST-12)', () => {
  it('File › Import Family Diagram calls the image-import handler', () => {
    const props = baseProps();
    render(<Harness props={props} />);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Family Diagram' }));
    expect(props.handleImageDiagramPicker).toHaveBeenCalledTimes(1);
    expect(props.handleImportDataPicker).not.toHaveBeenCalled();
  });

  it('has no "Export SVG" — it saved a PNG under a .svg name (review DE2-10)', () => {
    render(<Harness props={baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    expect(screen.queryByText('Export SVG')).toBeNull();
    expect(screen.getByText('Export PNG')).toBeTruthy();
  });

  it('no longer has the old "Image Diagram" entry', () => {
    render(<Harness props={baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    expect(screen.queryByRole('button', { name: 'Image Diagram' })).toBeNull();
  });
});

describe('AppRibbon — Help menu (settings-10)', () => {
  it('Help › Help Demo goes through the guarded demo-tour start (regression: opened the tour directly)', () => {
    const props = baseProps();
    render(<Harness props={props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help Demo' }));
    expect(props.handleStartDemoTour).toHaveBeenCalledTimes(1);
  });
});
