import React from 'react';
import { getSaveButtonState } from '../utils/saveButtonState';
import { isDemoDiagramFileName } from '../utils/demoTour';
import { type RibbonHelpKey } from '../data/helpContent';
import type { DemoTourStep } from '../types/diagramEditor';

export interface AppRibbonProps {
  // Refs
  ribbonRef: React.RefObject<HTMLDivElement>;
  fileMenuRef: React.RefObject<HTMLDivElement>;
  settingsMenuRef: React.RefObject<HTMLDivElement>;
  optionsMenuRef: React.RefObject<HTMLDivElement>;
  helpMenuRef: React.RefObject<HTMLDivElement>;
  loadInputRef: React.RefObject<HTMLInputElement>;
  importInputRef: React.RefObject<HTMLInputElement>;
  importPersonEventsInputRef: React.RefObject<HTMLInputElement>;
  transcriptInputRef: React.RefObject<HTMLInputElement>;

  // State values
  fileMenuOpen: boolean;
  settingsMenuOpen: boolean;
  optionsMenuOpen: boolean;
  helpMenuOpen: boolean;
  isDirty: boolean;
  lastDirtyTimestamp: number | null;
  demoBlinkVisible: boolean;
  ribbonHelpKey: RibbonHelpKey | null;
  notesLayerEnabled: boolean;
  autoSaveMinutes: number;
  timelineYear: number | null;
  timelinePlaying: boolean;
  timelineSliderDisabled: boolean;
  timelineYearBounds: { min: number; max: number };
  displayTimelineYear: number;
  zoom: number;
  helpOpen: boolean;
  fileName: string;
  demoTourOpen: boolean;
  demoTourStepIndex: number;
  demoTourSteps: DemoTourStep[];

  // Setters
  setFileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSettingsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOptionsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHelpMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRibbonHelpKey: React.Dispatch<React.SetStateAction<RibbonHelpKey | null>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setTimelineYear: React.Dispatch<React.SetStateAction<number | null>>;
  setVoiceInputOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRelationshipTypeSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRelationshipStatusSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIndicatorSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIdeasOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionNotesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDemoTourStepIndex: React.Dispatch<React.SetStateAction<number>>;
  setDemoTourOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBuildDemoStepIndex: React.Dispatch<React.SetStateAction<number>>;
  setBuildDemoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingVideosOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReadmeViewerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNotesLayerEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showSiblingConflicts: boolean;
  setShowSiblingConflicts: React.Dispatch<React.SetStateAction<boolean>>;

  // Handlers
  handleNewFile: () => void;
  handleLoadDemoDiagram: () => void;
  handleOpenFilePicker: () => void;
  handleImportDataPicker: () => void;
  handleImportPersonEventsPicker: () => void;
  handleSave: (forcePrompt?: boolean) => void;
  handleSaveAs: () => void;
  handleOpenBackupRestore: () => Promise<void>;
  handleExportPersonEvents: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleQuit: () => void;
  handleProcessTranscriptPicker: () => void;
  handleOpenEventCreator: () => void;
  handleLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportPersonEventsLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleProcessTranscriptLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTimelinePlayToggle: () => void;
  adjustTimelineYear: (delta: number) => void;
  handleAutoSaveMinutesInput: (value: number) => void;
  handleCenterDiagramView: () => void;
}

const AppRibbon: React.FC<AppRibbonProps> = ({
  ribbonRef,
  fileMenuRef,
  settingsMenuRef,
  optionsMenuRef,
  helpMenuRef,
  loadInputRef,
  importInputRef,
  importPersonEventsInputRef,
  transcriptInputRef,
  fileMenuOpen,
  settingsMenuOpen,
  optionsMenuOpen,
  helpMenuOpen,
  isDirty,
  lastDirtyTimestamp,
  demoBlinkVisible,
  notesLayerEnabled,
  autoSaveMinutes,
  timelinePlaying,
  timelineSliderDisabled,
  timelineYearBounds,
  displayTimelineYear,
  zoom,
  helpOpen,
  fileName,
  demoTourOpen,
  demoTourStepIndex,
  demoTourSteps,
  setFileMenuOpen,
  setSettingsMenuOpen,
  setOptionsMenuOpen,
  setHelpMenuOpen,
  setRibbonHelpKey,
  setZoom,
  setTimelineYear,
  setVoiceInputOpen,
  setSettingsOpen,
  setRelationshipTypeSettingsOpen,
  setRelationshipStatusSettingsOpen,
  setIndicatorSettingsOpen,
  setIdeasOpen,
  setSessionNotesOpen,
  setDemoTourStepIndex,
  setDemoTourOpen,
  setBuildDemoStepIndex,
  setBuildDemoOpen,
  setTrainingVideosOpen,
  setReadmeViewerOpen,
  setNotesLayerEnabled,
  showSiblingConflicts,
  setShowSiblingConflicts,
  handleNewFile,
  handleLoadDemoDiagram,
  handleOpenFilePicker,
  handleImportDataPicker,
  handleImportPersonEventsPicker,
  handleSave,
  handleSaveAs,
  handleOpenBackupRestore,
  handleExportPersonEvents,
  handleExportPNG,
  handleExportSVG,
  handleQuit,
  handleProcessTranscriptPicker,
  handleOpenEventCreator,
  handleLoad,
  handleImportLoad,
  handleImportPersonEventsLoad,
  handleProcessTranscriptLoad,
  handleTimelinePlayToggle,
  adjustTimelineYear,
  handleAutoSaveMinutesInput,
  handleCenterDiagramView,
}) => {
  const now = Date.now();
  const saveVisualState = getSaveButtonState(isDirty, lastDirtyTimestamp, now);
  const shouldBlinkSave = saveVisualState === 'critical';
  const blinkOn = shouldBlinkSave ? Math.floor(now / 600) % 2 === 0 : false;
  const isSaveDirty = saveVisualState !== 'clean';
  const ribbonButtonHeight = 40;
  const saveButtonStyle: React.CSSProperties = {
    backgroundColor: isSaveDirty
      ? blinkOn
        ? '#ff5252'
        : '#c62828'
      : '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    minHeight: ribbonButtonHeight,
    padding: '4px 10px',
    fontWeight: 600,
    boxShadow: isSaveDirty ? '0 0 0 2px rgba(198,40,40,0.35)' : 'none',
    cursor: 'pointer',
  };
  const ribbonButtonStyle: React.CSSProperties = {
    minHeight: ribbonButtonHeight,
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid #b0b0b0',
    background: '#fff',
    cursor: 'pointer',
  };
  const fileMenuItems = [
    { label: 'New', action: handleNewFile },
    { label: 'Load Demo Diagram', action: handleLoadDemoDiagram },
    { label: 'Open', action: handleOpenFilePicker },
    { label: 'Import Data', action: handleImportDataPicker },
    { label: 'Import Person Events', action: handleImportPersonEventsPicker },
    { label: 'Save', action: () => handleSave(false) },
    { label: 'Save As', action: handleSaveAs },
    { label: 'Restore Backup', action: () => void handleOpenBackupRestore() },
    { label: 'Export Person Events', action: handleExportPersonEvents },
    { label: 'Export PNG', action: handleExportPNG },
    { label: 'Export SVG', action: handleExportSVG },
    { label: 'Quit', action: handleQuit },
  ];
  const optionsMenuItems = [
    { label: 'Transcripts', action: handleProcessTranscriptPicker },
    { label: 'Voice Input', action: () => setVoiceInputOpen(true) },
    { label: 'Timeline Event Creator', action: handleOpenEventCreator },
    { label: 'Ideas', action: () => setIdeasOpen(true) },
    { label: 'Session Notes', action: () => setSessionNotesOpen(true) },
  ];
  const settingsMenuItems = [
    { label: 'Event Categories', action: () => setSettingsOpen(true) },
    { label: 'Relationship Categories', action: () => setRelationshipTypeSettingsOpen(true) },
    { label: 'Relationship Statuses', action: () => setRelationshipStatusSettingsOpen(true) },
    { label: 'Symptom Categories', action: () => setIndicatorSettingsOpen(true) },
    {
      label: `Notes Layer: ${notesLayerEnabled ? 'On' : 'Off'}`,
      action: () => setNotesLayerEnabled((prev) => !prev),
    },
    {
      label: `Sibling Conflicts: ${showSiblingConflicts ? 'On' : 'Off'}`,
      action: () => setShowSiblingConflicts((prev) => !prev),
    },
    {
      label: `Auto-Save: ${autoSaveMinutes} min`,
      action: () => {
        const entered = window.prompt('Auto-save minutes:', String(autoSaveMinutes));
        if (entered == null) return;
        const next = Number(entered);
        if (Number.isNaN(next)) return;
        handleAutoSaveMinutesInput(next);
      },
    },
  ];
  const helpMenuItems = [
    { label: 'Help Video', action: () => setTrainingVideosOpen(true) },
    {
      label: 'Help Demo',
      action: () => {
        setDemoTourStepIndex(0);
        setDemoTourOpen(true);
      },
    },
    {
      label: 'Build Demo',
      action: () => {
        setBuildDemoStepIndex(0);
        setBuildDemoOpen(true);
      },
    },
    { label: 'Help Docs', action: () => setReadmeViewerOpen(true) },
  ];
  const isDemoFamilyLoaded = isDemoDiagramFileName(fileName);
  const shouldBlinkHelpOnDemo = isDemoFamilyLoaded && !helpOpen;
  const helpBlinkOn = shouldBlinkHelpOnDemo ? Math.floor(now / 500) % 2 === 0 : false;
  const currentDemoStep = demoTourSteps[demoTourStepIndex] || demoTourSteps[0];
  const isDemoFocusedToolbar = (target: string) =>
    demoTourOpen &&
    currentDemoStep?.focus.kind === 'toolbar' &&
    currentDemoStep.focus.target === target;
  const toolbarHighlightStyle = (...targets: string[]): React.CSSProperties =>
    targets.some((target) => isDemoFocusedToolbar(target))
      ? {
          outline: demoBlinkVisible ? '3px solid #ff9800' : '3px solid transparent',
          borderRadius: 6,
          boxShadow: demoBlinkVisible ? '0 0 0 2px rgba(255,152,0,0.25)' : 'none',
        }
      : {};
  const helpBadgeStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1px solid #8ba1bd',
    background: '#fff',
    color: '#38557a',
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '18px',
    padding: 0,
    cursor: 'pointer',
  };
  const handleFileMenuAction = (action: () => void) => {
    setFileMenuOpen(false);
    setSettingsMenuOpen(false);
    setOptionsMenuOpen(false);
    setHelpMenuOpen(false);
    action();
  };

  return (
    <div
      ref={ribbonRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        padding: '4px 8px 6px',
        borderBottom: '1px solid #ccc',
        background: '#f6f7fb',
        ...(isDemoFocusedToolbar('menu-ribbon')
          ? {
              outline: demoBlinkVisible ? '3px solid #ff9800' : '3px solid transparent',
              boxShadow: demoBlinkVisible ? '0 0 0 2px rgba(255,152,0,0.25)' : 'none',
            }
          : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            width: 180,
            padding: '2px 4px',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: ribbonButtonHeight }}
          >
            <div
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, ...toolbarHighlightStyle('file-menu') }}
              ref={fileMenuRef}
            >
              <button
                onClick={() => {
                  setFileMenuOpen((prev) => !prev);
                  setSettingsMenuOpen(false);
                  setOptionsMenuOpen(false);
                  setHelpMenuOpen(false);
                }}
                style={ribbonButtonStyle}
                aria-haspopup="menu"
                aria-expanded={fileMenuOpen}
              >
                File ▾
              </button>
              <button
                onClick={() => setRibbonHelpKey('file-menu')}
                aria-label="File help"
                style={helpBadgeStyle}
              >
                ?
              </button>
              {fileMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                    minWidth: 180,
                    zIndex: 1000,
                  }}
                >
                  {fileMenuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleFileMenuAction(item.action)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...toolbarHighlightStyle('save') }}>
              <button
                onClick={() => handleFileMenuAction(() => handleSave(false))}
                style={saveButtonStyle}
              >
                Save
              </button>
              <button
                onClick={() => setRibbonHelpKey('save')}
                aria-label="Save help"
                style={helpBadgeStyle}
              >
                ?
              </button>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            width: 300,
            padding: '2px 4px',
            ...toolbarHighlightStyle('timeline-controls'),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minHeight: ribbonButtonHeight }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, width: 'max-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => adjustTimelineYear(-1)}
                  disabled={timelineSliderDisabled}
                  style={{
                    ...ribbonButtonStyle,
                    cursor: timelineSliderDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  -1 yr
                </button>
                <button
                  onClick={() => adjustTimelineYear(1)}
                  disabled={timelineSliderDisabled}
                  style={{
                    ...ribbonButtonStyle,
                    cursor: timelineSliderDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  +1 yr
                </button>
                <button
                  onClick={handleTimelinePlayToggle}
                  disabled={timelineSliderDisabled}
                  style={{
                    ...ribbonButtonStyle,
                    borderColor: '#1976d2',
                    color: timelinePlaying ? '#fff' : '#1976d2',
                    background: timelinePlaying ? '#1976d2' : '#fff',
                    fontWeight: 700,
                    cursor: timelineSliderDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {timelinePlaying ? 'Pause' : 'Play'}
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  width: '100%',
                }}
              >
                <input
                  type="range"
                  min={timelineYearBounds.min}
                  max={timelineYearBounds.max}
                  step={1}
                  value={displayTimelineYear}
                  onChange={(e) => setTimelineYear(Number(e.target.value))}
                  disabled={timelineSliderDisabled}
                  style={{ display: 'block', width: '100%' }}
                />
                <div style={{ fontSize: 12, color: '#333', width: '100%', textAlign: 'center' }}>
                  Timeline {timelineSliderDisabled ? '(All Dates)' : `(${displayTimelineYear})`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setRibbonHelpKey('timeline-controls')}
              aria-label="Timeline controls help"
              style={{ ...helpBadgeStyle, marginTop: 10 }}
            >
              ?
            </button>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            width: 330,
            padding: '2px 4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minHeight: ribbonButtonHeight }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, width: 'max-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    ...toolbarHighlightStyle('event-categories', 'functional-indicators'),
                  }}
                  ref={settingsMenuRef}
                >
                  <button
                    onClick={() => {
                      setSettingsMenuOpen((prev) => !prev);
                      setFileMenuOpen(false);
                      setOptionsMenuOpen(false);
                      setHelpMenuOpen(false);
                    }}
                    style={ribbonButtonStyle}
                    aria-haspopup="menu"
                    aria-expanded={settingsMenuOpen}
                  >
                    Settings ▾
                  </button>
                  <button
                    onClick={() => setRibbonHelpKey('event-categories')}
                    aria-label="Settings menu help"
                    style={helpBadgeStyle}
                  >
                    ?
                  </button>
                  {settingsMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 6,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                        minWidth: 200,
                        zIndex: 1000,
                      }}
                    >
                      {settingsMenuItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => handleFileMenuAction(item.action)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, ...toolbarHighlightStyle('transcripts-menu', 'event-creator', 'ideas', 'session-notes') }}
                  ref={optionsMenuRef}
                >
                  <button
                    onClick={() => {
                      setOptionsMenuOpen((prev) => !prev);
                      setFileMenuOpen(false);
                      setSettingsMenuOpen(false);
                      setHelpMenuOpen(false);
                    }}
                    style={ribbonButtonStyle}
                    aria-haspopup="menu"
                    aria-expanded={optionsMenuOpen}
                  >
                    Options ▾
                  </button>
                  <button
                    onClick={() => setRibbonHelpKey('transcripts-menu')}
                    aria-label="Options help"
                    style={helpBadgeStyle}
                  >
                    ?
                  </button>
                  {optionsMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 6,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                        minWidth: 170,
                        zIndex: 1000,
                      }}
                    >
                      {optionsMenuItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => handleFileMenuAction(item.action)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  width: 'calc(100% - 26px)',
                }}
              >
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ display: 'block', width: '100%' }}
                />
                <div style={{ fontSize: 12, color: '#333', width: '100%', textAlign: 'center' }}>
                  Zoom ({Math.round(zoom * 100)}%)
                </div>
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                ...toolbarHighlightStyle('help'),
              }}
              ref={helpMenuRef}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    setHelpMenuOpen((prev) => !prev);
                    setFileMenuOpen(false);
                    setSettingsMenuOpen(false);
                    setOptionsMenuOpen(false);
                  }}
                  style={{
                    ...ribbonButtonStyle,
                    borderColor: shouldBlinkHelpOnDemo ? '#1976d2' : '#b0b0b0',
                    boxShadow:
                      shouldBlinkHelpOnDemo && helpBlinkOn
                        ? '0 0 0 3px rgba(25,118,210,0.35)'
                        : 'none',
                  }}
                >
                  Help
                </button>
                <button
                  onClick={() => setRibbonHelpKey('help')}
                  aria-label="Help button help"
                  style={helpBadgeStyle}
                >
                  ?
                </button>
              </div>
              <button
                onClick={handleCenterDiagramView}
                aria-label="Center diagram"
                title="Center diagram at 50% zoom"
                style={{
                  ...ribbonButtonStyle,
                  minHeight: 28,
                  padding: '2px 8px',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                &#8853;
              </button>
              {helpMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                    minWidth: 180,
                    zIndex: 1000,
                  }}
                >
                  {helpMenuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleFileMenuAction(item.action)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <input
        ref={loadInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoad}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportLoad}
      />
      <input
        ref={importPersonEventsInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportPersonEventsLoad}
      />
      <input
        ref={transcriptInputRef}
        type="file"
        accept=".txt,.md,.rtf,.pdf"
        style={{ display: 'none' }}
        onChange={handleProcessTranscriptLoad}
      />
    </div>
  );
};

export default AppRibbon;
