import React, { useRef, useState } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject, RefObject } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as StageType } from 'konva/lib/Stage';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  FunctionalIndicatorDefinition,
  SIRCategoryDefinition,
  FunctionalFactCategoryDefinition,
  NodalCategoryDefinition,
  PageNote,
  SymptomGroup,
} from '../types';
import type {
  PersonSectionPopupState,
  PartnershipSectionPopupState,
  PropertiesPanelIntent,
} from '../types/diagramEditor';
import ContextMenu from './ContextMenu';
import PropertiesPanel from './PropertiesPanel';
import MultiPersonPropertiesPanel from './MultiPersonPropertiesPanel';
import PersonNode from './PersonNode';
import PartnershipNode from './PartnershipNode';
import ChildConnection from './ChildConnection';
import FamilyCutoffArc from './FamilyCutoffArc';
import EmotionalLineNode from './EmotionalLineNode';
import TriangleFillNode from './TriangleFillNode';
import NoteNode from './NoteNode';
import SiblingConflictOverlay from './SiblingConflictOverlay';
import type { SiblingConflictHoverInfo, SiblingConflictClickInfo } from './SiblingConflictOverlay';
import { deriveSiblingPositionResult } from '../utils/siblingPosition';
import {
  shouldShowPersonNote,
  shouldShowPartnershipNote,
  shouldShowFamilyNote,
  shouldShowEmotionalNote,
  shouldShowTriangleNote,
} from '../utils/noteVisibility';
import { FALLBACK_FILE_NAME } from '../data/defaultDiagramState';
import { APP_VERSION } from '../data/version';

type MarqueeSelection = {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;

type DragGroupRef = MutableRefObject<{
  personId: string;
  startX: number;
  startY: number;
  selectedIds: string[];
  people: Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>;
  partnerships: Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>;
  emotionalLines: Map<string, { notesPosition?: { x: number; y: number } }>;
} | null>;

interface DiagramCanvasProps {
  // Context menu
  contextMenu: { x: number; y: number; items: any[] } | null;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; items: any[] } | null>>;

  // Person section popup
  personSectionPopup: PersonSectionPopupState;
  personSectionPopupPerson: Person | null;
  setPersonSectionPopup: Dispatch<SetStateAction<PersonSectionPopupState>>;

  // Partnership section popup
  partnershipSectionPopup: PartnershipSectionPopupState;
  partnershipSectionPopupPartnership: Partnership | null;
  setPartnershipSectionPopup: Dispatch<SetStateAction<PartnershipSectionPopupState>>;

  // Demo tour
  isDemoFocusedCanvas: boolean;
  demoBlinkVisible: boolean;
  isDemoFocusedPerson: (personId: string) => boolean;
  isDemoFocusedPartnership: (partnershipId: string) => boolean;
  isDemoFocusedEmotionalLine: (lineId: string) => boolean;

  // File name
  fileName: string | null;

  // Canvas geometry
  canvasWidth: number;
  canvasHeight: number;
  stageOffset: { x: number; y: number };
  zoom: number;
  stageRef: RefObject<StageType>;

  // Panning / scroll
  spacePanActive: boolean;
  isPanning: boolean;
  setIsPanning: Dispatch<SetStateAction<boolean>>;
  panStartRef: MutableRefObject<{ x: number; y: number } | null>;
  toCanvasPoint: (pointer: { x: number; y: number }) => { x: number; y: number };
  translateDiagram: (dx: number, dy: number) => void;

  // Marquee selection
  marqueeSelection: MarqueeSelection;
  setMarqueeSelection: Dispatch<SetStateAction<MarqueeSelection>>;
  marqueeDidDragRef: MutableRefObject<boolean>;
  suppressStageClickRef: MutableRefObject<boolean>;
  selectPeopleByMarquee: (rect: { x: number; y: number; width: number; height: number }) => void;

  // Stage context menu
  handleStageContextMenu: (e: KonvaEventObject<PointerEvent>) => void;

  // Click-to-clear selection
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  setSelectedFamilyId: Dispatch<SetStateAction<string | null>>;
  setSelectedPageNoteId: Dispatch<SetStateAction<string | null>>;
  setPageNoteDraft: Dispatch<SetStateAction<{ title: string; text: string; fillColor: string } | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;

  // Data
  triangles: Triangle[];
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines: EmotionalLine[];

  // Visibility maps
  personVisibility: Map<string, boolean>;
  emotionalVisibility: Map<string, boolean>;
  partnershipVisibility: Map<string, boolean>;
  emotionalSiblingMeta: Map<string, { index: number; count: number }>;

  // Selection state
  selectedEmotionalLineId: string | null;
  selectedChildId: string | null;
  selectedPartnershipId: string | null;
  selectedPeopleIds: string[];

  // Triangle handlers
  handleTriangleAreaSelect: (triangleId: string) => void;
  handleTriangleAreaContextMenu: (e: KonvaEventObject<PointerEvent>, triangleId: string) => void;

  // Emotional line handlers
  handleEmotionalLineSelect: (emotionalLineId: string) => void;
  handleEmotionalLineContextMenu: (e: KonvaEventObject<PointerEvent>, emotionalLineId: string) => void;

  // Partnership handlers
  handlePartnershipSelect: (partnershipId: string) => void;
  handleHorizontalConnectorDragEnd: (partnershipId: string, y: number) => void;
  handlePartnershipContextMenu: (e: KonvaEventObject<PointerEvent>, partnershipId: string) => void;

  // Family object handlers
  selectedFamilyId: string | null;
  handleFamilyClick: (partnershipId: string) => void;
  handleFamilyContextMenu: (e: KonvaEventObject<PointerEvent>, partnershipId: string) => void;
  onFamilyIndicatorClick: (partnershipId: string, eventId: string, position: { x: number; y: number }) => void;
  onOpenFamilyProperty: (partnershipId: string, category: string, subtype: string, position: { x: number; y: number }) => void;
  onAddFamilyEvent: (partnershipId: string, position: { x: number; y: number }) => void;
  onDeleteFamilyEvent: (partnershipId: string, eventId: string) => void;
  onCloseFamilyPanel: () => void;

  // Child connection handlers
  handleChildLineSelect: (childId: string) => void;
  handleChildLineContextMenu: (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => void;

  // Person handlers
  handleSelect: (personId: string, additive: boolean) => void;
  handlePersonDragStart: (personId: string, x: number, y: number) => void;
  handlePersonDrag: (personId: string, x: number, y: number) => void;
  dragGroupRef: DragGroupRef;
  handlePersonContextMenu: (e: KonvaEventObject<PointerEvent>, person: Person) => void;
  handleGroupContextMenu: (e: KonvaEventObject<PointerEvent>) => void;
  setHoveredPersonId: Dispatch<SetStateAction<string | null>>;
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  sirCategories: SIRCategoryDefinition[];
  functionalFactCategories: FunctionalFactCategoryDefinition[];
  nodalCategories: NodalCategoryDefinition[];

  // Group resize
  selectedGroupBounds: { x: number; y: number; width: number; height: number } | null;
  beginGroupResize: () => void;
  applyGroupResize: (nextBounds: { width: number; height: number }) => void;
  endGroupResize: () => void;
  handleGroupBoxDragStart: (x: number, y: number) => void;
  handleGroupBoxDragMove: (x: number, y: number) => void;

  // Notes layer
  notesLayerEnabled: boolean;
  showSiblingConflicts: boolean;
  hoveredPersonId: string | null;

  // Note drag/resize handlers
  handlePersonNoteDragEnd: (personId: string, x: number, y: number) => void;
  handlePersonNoteResizeEnd: (personId: string, width: number, height: number) => void;
  handlePartnershipNoteDragEnd: (partnershipId: string, x: number, y: number) => void;
  handlePartnershipNoteResizeEnd: (partnershipId: string, width: number, height: number) => void;
  handleFamilyNoteDragEnd: (partnershipId: string, x: number, y: number) => void;
  handleFamilyNoteResizeEnd: (partnershipId: string, width: number, height: number) => void;
  handleEmotionalLineNoteDragEnd: (emotionalLineId: string, x: number, y: number) => void;
  handleEmotionalLineNoteResizeEnd: (emotionalLineId: string, width: number, height: number) => void;

  // Page notes
  pageNotes: PageNote[];
  selectedPageNoteId: string | null;
  handlePageNoteDragEnd: (noteId: string, x: number, y: number) => void;
  handlePageNoteResizeEnd: (noteId: string, width: number, height: number) => void;
  handlePageNoteSelect: (noteId: string) => void;

  // Page note editor
  selectedPageNote: PageNote | null;
  pageNoteDraft: { title: string; text: string; fillColor: string } | null;
  handlePageNoteDraftChange: (field: 'title' | 'text' | 'fillColor', value: string) => void;
  handlePageNoteDelete: (noteId: string) => void;
  handlePageNoteSave: () => void;

  // Canvas scroll hint
  canvasScrollHintOpen: boolean;
  setCanvasScrollHintOpen: Dispatch<SetStateAction<boolean>>;
  handleCanvasScrollHint: () => void;

  // Panel
  panelRef: RefObject<HTMLDivElement>;
  panelWidth: number;
  resizeStateRef: MutableRefObject<{ startX: number; startWidth: number } | null>;

  // Multi-person panel
  showMultiPersonPanel: boolean;
  multiSelectedPeople: Person[];
  handleBatchUpdatePersons: (personIds: string[], updates: Partial<Person>) => void;
  openAddEmotionalPatternModal: (person1Id: string, person2Id: string) => void;

  // Properties panel
  propertiesPanelItem: Person | Partnership | EmotionalLine | null;
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  handleUpdatePerson: (id: string, updates: Partial<Person>) => void;
  handleUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  handleUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
  panelTriangleContext: { id: string; color: string; intensity: 'low' | 'medium' | 'high'; notes: string } | null;
  updateTriangleColor: (triangleId: string, color: string) => void;
  updateTriangleIntensity: (triangleId: string, intensity: 'low' | 'medium' | 'high') => void;
  updateTriangle: (triangleId: string, updates: Partial<import('../types').Triangle>) => void;
  handleTriangleNoteDragEnd: (triangleId: string, x: number, y: number) => void;
  handleTriangleNoteResizeEnd: (triangleId: string, width: number, height: number) => void;
  propertiesPanelIntent: PropertiesPanelIntent;
  setPropertiesPanelIntent: Dispatch<SetStateAction<PropertiesPanelIntent>>;
  ensureSymptomDefinition: (label: string, group: SymptomGroup) => string | null;
  onRemoveEmotionalLine: (id: string) => void;
  onSiblingSquareClick: (person: Person, clientX: number, clientY: number) => void;
  onAutonomySquareClick: (person: Person) => void;
  onSymptomBadgeClick: (person: Person, group: SymptomGroup, clientX: number, clientY: number) => void;
}

export default function DiagramCanvas({
  contextMenu,
  setContextMenu,
  personSectionPopup,
  personSectionPopupPerson,
  setPersonSectionPopup,
  partnershipSectionPopup,
  partnershipSectionPopupPartnership,
  setPartnershipSectionPopup,
  isDemoFocusedCanvas,
  demoBlinkVisible,
  isDemoFocusedPerson,
  isDemoFocusedPartnership,
  isDemoFocusedEmotionalLine,
  fileName,
  canvasWidth,
  canvasHeight,
  stageOffset,
  zoom,
  stageRef,
  spacePanActive,
  isPanning,
  setIsPanning,
  panStartRef,
  toCanvasPoint,
  translateDiagram,
  marqueeSelection,
  setMarqueeSelection,
  marqueeDidDragRef,
  suppressStageClickRef,
  selectPeopleByMarquee,
  handleStageContextMenu,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
  setSelectedFamilyId,
  setSelectedPageNoteId,
  setPageNoteDraft,
  setPropertiesPanelItem,
  triangles,
  people,
  partnerships,
  allEmotionalLines,
  personVisibility,
  emotionalVisibility,
  partnershipVisibility,
  emotionalSiblingMeta,
  selectedEmotionalLineId,
  selectedChildId,
  selectedPartnershipId,
  selectedPeopleIds,
  handleTriangleAreaSelect,
  handleTriangleAreaContextMenu,
  handleEmotionalLineSelect,
  handleEmotionalLineContextMenu,
  handlePartnershipSelect,
  handleHorizontalConnectorDragEnd,
  handlePartnershipContextMenu,
  selectedFamilyId,
  handleFamilyClick,
  handleFamilyContextMenu,
  onFamilyIndicatorClick,
  onOpenFamilyProperty,
  onAddFamilyEvent,
  onDeleteFamilyEvent,
  onCloseFamilyPanel,
  handleChildLineSelect,
  handleChildLineContextMenu,
  handleSelect,
  handlePersonDragStart,
  handlePersonDrag,
  dragGroupRef,
  handlePersonContextMenu,
  handleGroupContextMenu,
  setHoveredPersonId,
  functionalIndicatorDefinitions,
  sirCategories,
  functionalFactCategories,
  nodalCategories,
  selectedGroupBounds,
  beginGroupResize,
  applyGroupResize,
  endGroupResize,
  handleGroupBoxDragStart,
  handleGroupBoxDragMove,
  notesLayerEnabled,
  showSiblingConflicts,
  hoveredPersonId,
  handlePersonNoteDragEnd,
  handlePersonNoteResizeEnd,
  handlePartnershipNoteDragEnd,
  handlePartnershipNoteResizeEnd,
  handleFamilyNoteDragEnd,
  handleFamilyNoteResizeEnd,
  handleEmotionalLineNoteDragEnd,
  handleEmotionalLineNoteResizeEnd,
  pageNotes,
  selectedPageNoteId,
  handlePageNoteDragEnd,
  handlePageNoteResizeEnd,
  handlePageNoteSelect,
  selectedPageNote,
  pageNoteDraft,
  handlePageNoteDraftChange,
  handlePageNoteDelete,
  handlePageNoteSave,
  canvasScrollHintOpen,
  setCanvasScrollHintOpen,
  handleCanvasScrollHint,
  panelRef,
  panelWidth,
  resizeStateRef,
  showMultiPersonPanel,
  multiSelectedPeople,
  handleBatchUpdatePersons,
  openAddEmotionalPatternModal,
  propertiesPanelItem,
  eventCategories,
  relationshipTypes,
  relationshipStatuses,
  handleUpdatePerson,
  handleUpdatePartnership,
  handleUpdateEmotionalLine,
  panelTriangleContext,
  updateTriangleColor,
  updateTriangleIntensity,
  updateTriangle,
  handleTriangleNoteDragEnd,
  handleTriangleNoteResizeEnd,
  propertiesPanelIntent,
  setPropertiesPanelIntent,
  ensureSymptomDefinition,
  onRemoveEmotionalLine,
  onSiblingSquareClick,
  onAutonomySquareClick,
  onSymptomBadgeClick,
}: DiagramCanvasProps) {
  const prevScrollTopRef = useRef<number>(0);
  const [siblingTooltip, setSiblingTooltip] = useState<SiblingConflictHoverInfo | null>(null);
  const [siblingDetail, setSiblingDetail] = useState<SiblingConflictClickInfo | null>(null);


  const handleScrollbarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    const delta = newScrollTop - prevScrollTopRef.current;
    prevScrollTopRef.current = newScrollTop;
    translateDiagram(0, -delta);
    handleCanvasScrollHint();
  };

  return (
    <div style={{ display: 'flex' }}>
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}

      {/* Sibling conflict line tooltip (hover) */}
      {siblingTooltip && (
        <div
          style={{
            position: 'fixed',
            left: siblingTooltip.x + 14,
            top: siblingTooltip.y - 10,
            zIndex: 3000,
            background: '#23324a',
            color: '#fff',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            maxWidth: 240,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {siblingTooltip.role === 'father' ? 'vs Father' : siblingTooltip.role === 'mother' ? 'vs Mother' : 'vs Partner'}
            {' — '}{siblingTooltip.lineType === 'rank' ? 'Rank' : 'Sex'} line
          </div>
          {siblingTooltip.conflict ? (
            <>
              <div>{siblingTooltip.conflict.category}</div>
              {siblingTooltip.conflict.confidence_note && (
                <div style={{ color: '#f9a825', fontSize: 11 }}>{siblingTooltip.conflict.confidence_note}</div>
              )}
            </>
          ) : (
            <div style={{ color: '#bdbdbd' }}>Insufficient data</div>
          )}
          <div style={{ marginTop: 3, fontSize: 10, color: '#90a4c0' }}>Click for details</div>
        </div>
      )}

      {/* Sibling conflict detail panel (click) */}
      {siblingDetail && (() => {
        const detailPerson = people.find((p) => p.id === siblingDetail.personId);
        const MARGIN = 12;
        const PANEL_W = 260;
        const PANEL_H = 200;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rawLeft = siblingTooltip ? siblingTooltip.x + 14 : vw / 2 - PANEL_W / 2;
        const rawTop  = siblingTooltip ? siblingTooltip.y - 10 : vh / 2 - PANEL_H / 2;
        const left = Math.max(MARGIN, Math.min(rawLeft, vw - PANEL_W - MARGIN));
        const top  = Math.max(MARGIN, Math.min(rawTop, vh - PANEL_H - MARGIN));
        return (
          <div
            style={{
              position: 'fixed',
              left,
              top,
              width: PANEL_W,
              zIndex: 3000,
              background: '#fff',
              border: '1px solid #c6cfde',
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 10px 28px rgba(28,41,61,0.18)',
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ color: '#23324a' }}>
                {detailPerson?.name || 'Person'} — {siblingDetail.role === 'father' ? 'vs Father' : siblingDetail.role === 'mother' ? 'vs Mother' : 'vs Partner'}
              </strong>
              <button
                type="button"
                onClick={() => setSiblingDetail(null)}
                style={{ border: '1px solid #bdbdbd', borderRadius: 5, background: '#f5f5f5', cursor: 'pointer', padding: '2px 7px', fontSize: 12 }}
              >
                ×
              </button>
            </div>
            {siblingDetail.conflict ? (
              <div style={{ display: 'grid', gap: 4, color: '#23324a' }}>
                <div><strong>Category:</strong> {siblingDetail.conflict.category}</div>
                <div><strong>Rank Conflict:</strong> {siblingDetail.conflict.rank_conflict ? 'Yes' : 'No'}</div>
                <div>
                  <strong>Sex Conflict:</strong>{' '}
                  {siblingDetail.conflict.sex_conflict_uncertain
                    ? 'Uncertain'
                    : siblingDetail.conflict.sex_conflict === null
                    ? 'N/A (same-sex pair)'
                    : siblingDetail.conflict.sex_conflict ? 'Yes' : 'No'}
                </div>
                <div><strong>Other Position:</strong> {siblingDetail.conflict.other_effective_position}</div>
                {siblingDetail.conflict.confidence_note && (
                  <div style={{ color: '#6a4b10', fontSize: 12 }}>
                    <strong>Note:</strong> {siblingDetail.conflict.confidence_note}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#5e6d84' }}>Insufficient position data for this relationship.</div>
            )}
          </div>
        );
      })()}
      {personSectionPopup && personSectionPopupPerson && (
        <div
          onClick={() => setPersonSectionPopup(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2200,
            background: 'transparent',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              left:
                typeof window !== 'undefined'
                  ? Math.max(12, Math.min(personSectionPopup.x + 10, window.innerWidth - 480))
                  : personSectionPopup.x,
              top:
                typeof window !== 'undefined'
                  ? Math.max(12, Math.min(personSectionPopup.y + 10, window.innerHeight - 420))
                  : personSectionPopup.y,
              maxWidth: typeof window !== 'undefined' ? window.innerWidth - 24 : undefined,
              maxHeight:
                typeof window !== 'undefined'
                  ? Math.max(200, window.innerHeight - Math.max(12, Math.min(personSectionPopup.y + 10, window.innerHeight - 420)) - 12)
                  : undefined,
              overflowY: 'auto',
            }}
          >
            <PropertiesPanel
              selectedItem={personSectionPopupPerson}
              people={people}
              partnerships={partnerships}
              eventCategories={eventCategories}
              relationshipTypes={relationshipTypes}
              relationshipStatuses={relationshipStatuses}
              functionalIndicatorDefinitions={functionalIndicatorDefinitions}
              sirCategories={sirCategories}
                functionalFactCategories={functionalFactCategories}
                nodalCategories={nodalCategories}
              onUpdatePerson={handleUpdatePerson}
              onUpdatePartnership={handleUpdatePartnership}
              onUpdateEmotionalLine={handleUpdateEmotionalLine}
              initialActiveTab="properties"
              initialPersonSection={personSectionPopup.section}
              compactPersonSectionMode
              onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
              onClose={() => setPersonSectionPopup(null)}
            />
          </div>
        </div>
      )}
      {partnershipSectionPopup && partnershipSectionPopupPartnership && (
        <div
          onClick={() => setPartnershipSectionPopup(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2200,
            background: 'transparent',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              left:
                typeof window !== 'undefined'
                  ? Math.max(12, Math.min(partnershipSectionPopup.x + 10, window.innerWidth - 540))
                  : partnershipSectionPopup.x,
              top:
                typeof window !== 'undefined'
                  ? Math.max(12, Math.min(partnershipSectionPopup.y + 10, window.innerHeight - 420))
                  : partnershipSectionPopup.y,
              maxWidth: typeof window !== 'undefined' ? window.innerWidth - 24 : undefined,
              maxHeight:
                typeof window !== 'undefined'
                  ? Math.max(200, window.innerHeight - Math.max(12, Math.min(partnershipSectionPopup.y + 10, window.innerHeight - 420)) - 12)
                  : undefined,
              overflowY: 'auto',
            }}
          >
            <PropertiesPanel
              selectedItem={partnershipSectionPopupPartnership}
              people={people}
              partnerships={partnerships}
              eventCategories={eventCategories}
              relationshipTypes={relationshipTypes}
              relationshipStatuses={relationshipStatuses}
              functionalIndicatorDefinitions={functionalIndicatorDefinitions}
              sirCategories={sirCategories}
                functionalFactCategories={functionalFactCategories}
                nodalCategories={nodalCategories}
              onUpdatePerson={handleUpdatePerson}
              onUpdatePartnership={handleUpdatePartnership}
              onUpdateEmotionalLine={handleUpdateEmotionalLine}
              initialActiveTab="properties"
              initialPartnershipType={partnershipSectionPopup.relationshipType}
              compactPartnershipSectionMode
              onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
              onClose={() => setPartnershipSectionPopup(null)}
            />
          </div>
        </div>
      )}
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        <div style={{ flex: 1, position: 'relative', background: '#ffffff' }}>
        {isDemoFocusedCanvas && (
          <div
            style={{
              position: 'absolute',
              inset: 8,
              border: demoBlinkVisible ? '3px solid #ff9800' : '3px solid transparent',
              borderRadius: 8,
              boxShadow: demoBlinkVisible ? '0 0 0 2px rgba(255,152,0,0.25)' : 'none',
              pointerEvents: 'none',
              zIndex: 20,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            transformOrigin: 'top center',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 5,
            lineHeight: 1.3,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2f45' }}>
            Family Diagram Maker{' '}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7c93', letterSpacing: '0.01em' }}>{APP_VERSION}</span>
          </div>
          <div style={{ fontSize: 14, color: '#333' }}>
            {fileName || FALLBACK_FILE_NAME}
          </div>
        </div>
        <Stage
          ref={stageRef}
          width={canvasWidth}
          height={canvasHeight}
          x={stageOffset.x}
          y={stageOffset.y}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) {
              const pointer = e.target.getStage()?.getPointerPosition();
              if (pointer) {
                if (spacePanActive || e.evt.altKey || e.evt.button === 1) {
                  setIsPanning(true);
                  panStartRef.current = { x: pointer.x, y: pointer.y };
                  setMarqueeSelection(null);
                  marqueeDidDragRef.current = false;
                  return;
                }
                const canvasPoint = toCanvasPoint(pointer);
                setMarqueeSelection({
                  active: true,
                  startX: canvasPoint.x,
                  startY: canvasPoint.y,
                  currentX: canvasPoint.x,
                  currentY: canvasPoint.y,
                });
                marqueeDidDragRef.current = false;
              }
            }
          }}
          onMouseMove={(e) => {
            const pointer = e.target.getStage()?.getPointerPosition();
            if (!pointer) return;
            if (marqueeSelection?.active) {
              const canvasPoint = toCanvasPoint(pointer);
              const moved =
                Math.abs(canvasPoint.x - marqueeSelection.startX) > 3 ||
                Math.abs(canvasPoint.y - marqueeSelection.startY) > 3;
              if (moved) {
                marqueeDidDragRef.current = true;
              }
              setMarqueeSelection((prev) =>
                prev
                  ? {
                      ...prev,
                      currentX: canvasPoint.x,
                      currentY: canvasPoint.y,
                    }
                  : prev
              );
              return;
            }
            if (!isPanning || !panStartRef.current) return;
            const dx = (pointer.x - panStartRef.current.x) / zoom;
            const dy = (pointer.y - panStartRef.current.y) / zoom;
            translateDiagram(dx, dy);
            panStartRef.current = { x: pointer.x, y: pointer.y };
          }}
          onMouseUp={() => {
            setIsPanning(false);
            panStartRef.current = null;
            if (!marqueeSelection?.active) return;
            const minX = Math.min(marqueeSelection.startX, marqueeSelection.currentX);
            const minY = Math.min(marqueeSelection.startY, marqueeSelection.currentY);
            const width = Math.abs(marqueeSelection.currentX - marqueeSelection.startX);
            const height = Math.abs(marqueeSelection.currentY - marqueeSelection.startY);
            if (marqueeDidDragRef.current && width > 1 && height > 1) {
              selectPeopleByMarquee({ x: minX, y: minY, width, height });
              suppressStageClickRef.current = true;
            }
            setMarqueeSelection(null);
          }}
          onMouseLeave={() => {
            setIsPanning(false);
            panStartRef.current = null;
            setMarqueeSelection(null);
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage()) {
              setIsPanning(true);
              const pointer = e.target.getStage()?.getPointerPosition();
              if (pointer) {
                panStartRef.current = { x: pointer.x, y: pointer.y };
              }
            }
          }}
          onTouchMove={(e) => {
            if (!isPanning || !panStartRef.current) return;
            const pointer = e.target.getStage()?.getPointerPosition();
            if (!pointer) return;
            const dx = (pointer.x - panStartRef.current.x) / zoom;
            const dy = (pointer.y - panStartRef.current.y) / zoom;
            translateDiagram(dx, dy);
            panStartRef.current = { x: pointer.x, y: pointer.y };
          }}
          onTouchEnd={() => {
            setIsPanning(false);
            panStartRef.current = null;
            setMarqueeSelection(null);
          }}
          onClick={(e) => {
            if (suppressStageClickRef.current) {
              suppressStageClickRef.current = false;
              return;
            }
            if (e.target === e.target.getStage()) {
              setSelectedPeopleIds([]);
              setSelectedPartnershipId(null);
              setSelectedEmotionalLineId(null);
              setSelectedChildId(null);
              setSelectedFamilyId(null);
              setSelectedPageNoteId(null);
              setPageNoteDraft(null);
              setPropertiesPanelItem(null);
            }
          }}
          onContextMenu={handleStageContextMenu}
        >
          <Layer>
            {/* Triangle shading */}
            {triangles.map((triangle) => {
              const person1 = people.find((person) => person.id === triangle.person1_id);
              const person2 = people.find((person) => person.id === triangle.person2_id);
              const person3 = people.find((person) => person.id === triangle.person3_id);
              if (!person1 || !person2 || !person3) return null;
              if (
                !personVisibility.get(person1.id) ||
                !personVisibility.get(person2.id) ||
                !personVisibility.get(person3.id)
              ) {
                return null;
              }
              return (
                <TriangleFillNode
                  key={`triangle-fill-${triangle.id}`}
                  triangle={triangle}
                  person1={person1}
                  person2={person2}
                  person3={person3}
                  onSelect={handleTriangleAreaSelect}
                  onContextMenu={handleTriangleAreaContextMenu}
                />
              );
            })}

            {/* Render Connections */}
            {partnerships.map((p) => {
                if (!partnershipVisibility.get(p.id)) return null;
                if (isDemoFocusedPartnership(p.id) && !demoBlinkVisible) {
                  return null;
                }
                const partner1 = people.find(person => person.id === p.partner1_id);
                const partner2 = people.find(person => person.id === p.partner2_id);
                if (!partner1 || !partner2) return null;
                if (!personVisibility.get(partner1.id) || !personVisibility.get(partner2.id)) return null;

                const childConnections = p.children.flatMap(childId => {
                    const child = people.find(c => c.id === childId);
                    if (!child || !personVisibility.get(child.id)) return [];
                    const cutoffLineId = child.familyCutoffLineId;
                    const cutoffLine = cutoffLineId ? allEmotionalLines.find(el => el.id === cutoffLineId) : null;
                    const elements = [
                        <ChildConnection key={`child-conn-${childId}`} child={child} partnership={p} partner1={partner1} partner2={partner2} isSelected={selectedChildId === childId} onSelect={handleChildLineSelect} onContextMenu={handleChildLineContextMenu} />
                    ];
                    if (cutoffLine) {
                        elements.push(
                            <FamilyCutoffArc key={`cutoff-arc-${childId}`} child={child} partnership={p} partner1={partner1} partner2={partner2} emotionalLine={cutoffLine} isSelected={selectedEmotionalLineId === cutoffLine.id} onSelect={handleEmotionalLineSelect} onContextMenu={handleEmotionalLineContextMenu} />
                        );
                    }
                    return elements;
                });

                return (
                    <React.Fragment key={p.id}>
                        <PartnershipNode
                            partnership={p}
                            partner1={partner1}
                            partner2={partner2}
                            isSelected={selectedPartnershipId === p.id}
                            isFamilySelected={selectedFamilyId === p.id}
                            onSelect={handlePartnershipSelect}
                            onHorizontalConnectorDragEnd={handleHorizontalConnectorDragEnd}
                            onFamilyNameOffsetChange={(id, offsetX, offsetY) => handleUpdatePartnership(id, { familyNameOffsetX: offsetX, familyNameOffsetY: offsetY })}
                            onFamilyNameSizeChange={(id, width, height) => handleUpdatePartnership(id, { familyNameWidth: width, familyNameHeight: height })}
                            onContextMenu={handlePartnershipContextMenu}
                            onFamilyClick={handleFamilyClick}
                            onFamilyContextMenu={handleFamilyContextMenu}
                            onFamilyIndicatorClick={onFamilyIndicatorClick}
                        />
                        {childConnections}
                    </React.Fragment>
                )
            })}

            {/* Render Emotional Lines — above partnerships, below people */}
            {(() => {
              const familyCutoffLineIds = new Set(people.map((p) => p.familyCutoffLineId).filter(Boolean) as string[]);
              return allEmotionalLines.map((el) => {
                if (familyCutoffLineIds.has(el.id)) return null; // rendered as arc on child connection
                if (!emotionalVisibility.get(el.id)) return null;
                if (isDemoFocusedEmotionalLine(el.id) && !demoBlinkVisible) {
                  return null;
                }
                const person1 = people.find(person => person.id === el.person1_id);
                const person2 = people.find(person => person.id === el.person2_id);
                if (!person1 || !person2) return null;
                if (!personVisibility.get(person1.id) || !personVisibility.get(person2.id)) return null;
                const sibling = emotionalSiblingMeta.get(el.id);

                return (
                    <EmotionalLineNode
                        key={el.id}
                        emotionalLine={el}
                        person1={person1}
                        person2={person2}
                        isSelected={selectedEmotionalLineId === el.id}
                        onSelect={handleEmotionalLineSelect}
                        onContextMenu={handleEmotionalLineContextMenu}
                        siblingIndex={sibling?.index}
                        siblingCount={sibling?.count}
                    />
                )
              });
            })()}

            {/* Group drag rect — below people so right-click on nodes still works */}
            {selectedGroupBounds && (
              <Rect
                x={selectedGroupBounds.x}
                y={selectedGroupBounds.y}
                width={selectedGroupBounds.width}
                height={selectedGroupBounds.height}
                fill="transparent"
                draggable
                onContextMenu={handleGroupContextMenu}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  handleGroupBoxDragStart(e.target.x(), e.target.y());
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  handleGroupBoxDragMove(e.target.x(), e.target.y());
                  const ref = dragGroupRef.current;
                  if (ref) {
                    e.target.x(ref.startX);
                    e.target.y(ref.startY);
                  }
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  dragGroupRef.current = null;
                }}
              />
            )}

            {/* Render People — top layer */}
            {people.map((person) => {
              if (!personVisibility.get(person.id)) return null;
              if (isDemoFocusedPerson(person.id) && !demoBlinkVisible) {
                return null;
              }
              return (
                <PersonNode
                  key={person.id}
                  person={person}
                  isSelected={selectedPeopleIds.includes(person.id)}
                  onSelect={handleSelect}
                  onDragStart={(e) => handlePersonDragStart(person.id, e.target.x(), e.target.y())}
                  onDragMove={(e) => handlePersonDrag(person.id, e.target.x(), e.target.y())}
                  onDragEnd={(e) => {
                    handlePersonDrag(person.id, e.target.x(), e.target.y());
                    dragGroupRef.current = null;
                  }}
                  onContextMenu={handlePersonContextMenu}
                  onHoverChange={setHoveredPersonId}
                  functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                  siblingEffectivePosition={
                    deriveSiblingPositionResult({ person, people, partnerships }).effective_position
                  }
                  onSymptomBadgeClick={onSymptomBadgeClick}
                  onSiblingSquareClick={onSiblingSquareClick}
                  onAutonomySquareClick={onAutonomySquareClick}
                />
              );
            })}

            {showSiblingConflicts && people.map((person) => (
              personVisibility.get(person.id) ? (
                <SiblingConflictOverlay
                  key={`sc-${person.id}`}
                  person={person}
                  people={people}
                  partnerships={partnerships}
                  onHover={setSiblingTooltip}
                  onHoverLeave={() => setSiblingTooltip(null)}
                  onLineClick={(info) => setSiblingDetail((prev) =>
                    prev?.personId === info.personId && prev?.role === info.role ? null : info
                  )}
                />
              ) : null
            ))}

            {marqueeSelection?.active && (
              <Rect
                x={Math.min(marqueeSelection.startX, marqueeSelection.currentX)}
                y={Math.min(marqueeSelection.startY, marqueeSelection.currentY)}
                width={Math.abs(marqueeSelection.currentX - marqueeSelection.startX)}
                height={Math.abs(marqueeSelection.currentY - marqueeSelection.startY)}
                stroke="#1976d2"
                strokeWidth={1.5}
                dash={[6, 4]}
                fill="rgba(25,118,210,0.12)"
                listening={false}
              />
            )}

            {selectedGroupBounds && (
              <>
                <Rect
                  x={selectedGroupBounds.x}
                  y={selectedGroupBounds.y}
                  width={selectedGroupBounds.width}
                  height={selectedGroupBounds.height}
                  stroke="#1565c0"
                  strokeWidth={1.5}
                  dash={[8, 6]}
                  fillEnabled={false}
                  listening={false}
                />
                <Rect
                  x={selectedGroupBounds.x + selectedGroupBounds.width - 10}
                  y={selectedGroupBounds.y + selectedGroupBounds.height - 10}
                  width={10}
                  height={10}
                  fill="#e3f2fd"
                  stroke="#1565c0"
                  strokeWidth={1.2}
                  draggable
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    beginGroupResize();
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true;
                    const localX = e.target.x() - selectedGroupBounds.x + 10;
                    const localY = e.target.y() - selectedGroupBounds.y + 10;
                    applyGroupResize({
                      width: Math.max(20, localX),
                      height: Math.max(20, localY),
                    });
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    endGroupResize();
                  }}
                />
              </>
            )}

            {/* Render Notes */}
            {people.map((person) => {
              if (!shouldShowPersonNote(person, notesLayerEnabled, hoveredPersonId)) return null;
              if (!personVisibility.get(person.id)) return null;
              if (isDemoFocusedPerson(person.id) && !demoBlinkVisible) return null;
              const x = person.notesPosition?.x || person.x + 50;
              const y = person.notesPosition?.y || person.y;
              const genderFill =
                person.gender === 'male'
                  ? '#d6ecff'
                  : person.gender === 'female'
                    ? '#ffe0ec'
                    : '#fffbe6';
              return (
                <NoteNode
                  key={`note-person-${person.id}`}
                  x={x}
                  y={y}
                  title={person.name}
                  text={person.notes || ''}
                  width={person.notesSize?.width}
                  height={person.notesSize?.height}
                  anchorX={person.x}
                  anchorY={person.y}
                  fillColor={genderFill}
                  onDragEnd={(e) => handlePersonNoteDragEnd(person.id, e.target.x(), e.target.y())}
                  onResizeEnd={(w, h) => handlePersonNoteResizeEnd(person.id, w, h)}
                  onSelect={() => {
                    setSelectedPeopleIds([person.id]);
                    setSelectedPartnershipId(null);
                    setSelectedEmotionalLineId(null);
                    setSelectedChildId(null);
                    setPropertiesPanelItem(person);
                  }}
                />
              );
            })}
            {partnerships.map((p) => {
              if (!shouldShowPartnershipNote(p, notesLayerEnabled)) return null;
              if (!partnershipVisibility.get(p.id)) return null;
              if (isDemoFocusedPartnership(p.id) && !demoBlinkVisible) return null;
              const partner1 = people.find(person => person.id === p.partner1_id);
              const partner2 = people.find(person => person.id === p.partner2_id);
              if (!partner1 || !partner2) return null;
              if (!personVisibility.get(partner1.id) || !personVisibility.get(partner2.id)) return null;
              const x = p.notesPosition?.x || (partner1.x + partner2.x) / 2;
              const y = p.notesPosition?.y || p.horizontalConnectorY + 50;
              return (
                <NoteNode
                  key={`note-partnership-${p.id}`}
                  x={x}
                  y={y}
                  title={`${partner1.name}\n${partner2.name}`}
                  text={p.notes || ''}
                  width={p.notesSize?.width}
                  height={p.notesSize?.height}
                  anchorX={(partner1.x + partner2.x) / 2}
                  anchorY={p.horizontalConnectorY}
                  onDragEnd={(e) => handlePartnershipNoteDragEnd(p.id, e.target.x(), e.target.y())}
                  onResizeEnd={(w, h) => handlePartnershipNoteResizeEnd(p.id, w, h)}
                  onSelect={() => {
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(p.id);
                    setSelectedEmotionalLineId(null);
                    setSelectedChildId(null);
                    setPropertiesPanelItem(p);
                  }}
                />
              );
            })}
            {partnerships.map((p) => {
              if (!shouldShowFamilyNote(p, notesLayerEnabled)) return null;
              if (!partnershipVisibility.get(p.id)) return null;
              const partner1 = people.find(person => person.id === p.partner1_id);
              const partner2 = people.find(person => person.id === p.partner2_id);
              if (!partner1 || !partner2) return null;
              const anchorX = (partner1.x + partner2.x) / 2;
              const anchorY = p.horizontalConnectorY;
              const x = p.familyNotesPosition?.x ?? anchorX + 20;
              const y = p.familyNotesPosition?.y ?? anchorY + 60;
              const familyName = p.familyName || [partner1.name, partner2.name].filter(Boolean).join(' & ') || 'Family';
              return (
                <NoteNode
                  key={`note-family-${p.id}`}
                  x={x}
                  y={y}
                  title={`${familyName}\nFamily`}
                  text={p.familyNotes || ''}
                  width={p.familyNotesSize?.width}
                  height={p.familyNotesSize?.height}
                  anchorX={anchorX}
                  anchorY={anchorY}
                  onDragEnd={(e) => handleFamilyNoteDragEnd(p.id, e.target.x(), e.target.y())}
                  onResizeEnd={(w, h) => handleFamilyNoteResizeEnd(p.id, w, h)}
                  onSelect={() => {
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(p.id);
                    setSelectedEmotionalLineId(null);
                    setSelectedChildId(null);
                    setPropertiesPanelItem(p);
                  }}
                />
              );
            })}
            {allEmotionalLines.map((el) => {
              if (!shouldShowEmotionalNote(el, notesLayerEnabled)) return null;
              if (!emotionalVisibility.get(el.id)) return null;
              if (isDemoFocusedEmotionalLine(el.id) && !demoBlinkVisible) return null;
              const person1 = people.find(person => person.id === el.person1_id);
              const person2 = people.find(person => person.id === el.person2_id);
              if (!person1 || !person2) return null;
              if (!personVisibility.get(person1.id) || !personVisibility.get(person2.id)) return null;
              const x = el.notesPosition?.x || (person1.x + person2.x) / 2;
              const y = el.notesPosition?.y || (person1.y + person2.y) / 2 + 20;
              return (
                <NoteNode
                  key={`note-el-${el.id}`}
                  x={x}
                  y={y}
                  title={`${person1.name}\n${person2.name}`}
                  text={el.notes || ''}
                  width={el.notesSize?.width}
                  height={el.notesSize?.height}
                  anchorX={(person1.x + person2.x) / 2}
                  anchorY={(person1.y + person2.y) / 2}
                  onDragEnd={(e) => handleEmotionalLineNoteDragEnd(el.id, e.target.x(), e.target.y())}
                  onResizeEnd={(w, h) => handleEmotionalLineNoteResizeEnd(el.id, w, h)}
                  onSelect={() => {
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(null);
                    setSelectedEmotionalLineId(el.id);
                    setSelectedChildId(null);
                    setPropertiesPanelItem(el);
                  }}
                />
              );
            })}
            {triangles.map((triangle) => {
              if (!shouldShowTriangleNote(triangle, notesLayerEnabled)) return null;
              const p1 = people.find((p) => p.id === triangle.person1_id);
              const p2 = people.find((p) => p.id === triangle.person2_id);
              const p3 = people.find((p) => p.id === triangle.person3_id);
              if (!p1 || !p2 || !p3) return null;
              const anchorX = (p1.x + p2.x + p3.x) / 3;
              const anchorY = (p1.y + p2.y + p3.y) / 3;
              const x = triangle.notesPosition?.x ?? anchorX + 20;
              const y = triangle.notesPosition?.y ?? anchorY + 20;
              return (
                <NoteNode
                  key={`note-tri-${triangle.id}`}
                  x={x}
                  y={y}
                  title={`${p1.name}\n${p2.name}\n${p3.name}`}
                  text={triangle.notes || ''}
                  width={triangle.notesSize?.width}
                  height={triangle.notesSize?.height}
                  anchorX={anchorX}
                  anchorY={anchorY}
                  onDragEnd={(e) => handleTriangleNoteDragEnd(triangle.id, e.target.x(), e.target.y())}
                  onResizeEnd={(w, h) => handleTriangleNoteResizeEnd(triangle.id, w, h)}
                  onSelect={() => {
                    const firstTpl = triangle.tpls?.[0];
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(null);
                    setSelectedChildId(null);
                    if (firstTpl) {
                      setSelectedEmotionalLineId(firstTpl.id);
                      setPropertiesPanelItem(firstTpl);
                    }
                  }}
                />
              );
            })}
            {pageNotes.map((note) => (
              <NoteNode
                key={`page-note-${note.id}`}
                x={note.x}
                y={note.y}
                title={note.title}
                text={note.text}
                width={note.width}
                height={note.height}
                fillColor={note.fillColor || '#fff8c6'}
                isSelected={selectedPageNoteId === note.id}
                onDragEnd={(e) => handlePageNoteDragEnd(note.id, e.target.x(), e.target.y())}
                onResizeEnd={(w, h) => handlePageNoteResizeEnd(note.id, w, h)}
                onSelect={() => handlePageNoteSelect(note.id)}
              />
            ))}
          </Layer>
        </Stage>
        {selectedPageNote && pageNoteDraft && (
          <div
            style={{
              position: 'absolute',
              left: Math.max(
                8,
                Math.min(
                  stageOffset.x + selectedPageNote.x * zoom + ((selectedPageNote.width || 220) * zoom) + 12,
                  canvasWidth - 260
                )
              ),
              top: Math.max(8, Math.min(stageOffset.y + selectedPageNote.y * zoom, canvasHeight - 220)),
              width: 240,
              background: '#fffdf4',
              border: '1px solid #d6c27a',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              padding: 8,
              zIndex: 25,
            }}
          >
            <input
              aria-label="General note title"
              type="text"
              value={pageNoteDraft.title}
              onChange={(e) => handlePageNoteDraftChange('title', e.target.value)}
              style={{ width: '100%', marginBottom: 6, fontWeight: 600 }}
            />
            <textarea
              aria-label="General note text"
              value={pageNoteDraft.text}
              onChange={(e) => handlePageNoteDraftChange('text', e.target.value)}
              rows={6}
              style={{ width: '100%', resize: 'vertical', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label htmlFor="general-note-color" style={{ fontSize: 12, fontWeight: 600 }}>
                Color
              </label>
              <input
                id="general-note-color"
                aria-label="General note color"
                type="color"
                value={pageNoteDraft.fillColor}
                onChange={(e) => handlePageNoteDraftChange('fillColor', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                aria-label="Delete general note"
                onClick={() => handlePageNoteDelete(selectedPageNote.id)}
                style={{
                  border: '1px solid #caa',
                  background: '#fff1f1',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
              >
                🗑
              </button>
              <button
                aria-label="Save general note"
                onClick={handlePageNoteSave}
                style={{
                  border: '1px solid #7ba37b',
                  background: '#eef9ee',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
        {canvasScrollHintOpen && (
          <div
            role="status"
            style={{
              position: 'absolute',
              right: 28,
              bottom: 16,
              width: 320,
              background: '#fffdf4',
              border: '1px solid #d6c27a',
              borderRadius: 10,
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              padding: '10px 12px',
              zIndex: 30,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: '#4d4320' }}>
                To PAN or SCROLL the canvas, hold down SPACE bar and Click to pan the Canvas in any direction
              </div>
              <button
                onClick={() => setCanvasScrollHintOpen(false)}
                aria-label="Close canvas scroll hint"
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#6a5a26',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        </div>
          <div
            aria-label="Vertical canvas pan"
            onScroll={handleScrollbarScroll}
            style={{
              width: 16,
              height: canvasHeight,
              overflowY: 'scroll',
              overflowX: 'hidden',
              borderLeft: '1px solid #d7dbe4',
              background: '#f3f5fa',
            }}
          >
            <div style={{ height: canvasHeight * 4 }} />
          </div>
        </div>
      <div
        ref={panelRef}
        style={{
          width: panelWidth,
          overflow: 'auto',
          minWidth: 180,
          maxWidth: 600,
          position: 'relative',
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(event) => {
            resizeStateRef.current = { startX: event.clientX, startWidth: panelWidth };
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: 'col-resize',
            background: 'linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0))',
            borderRight: '1px solid #c7c7c7',
          }}
        />
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            marginLeft: 6,
            padding: '10px 12px',
            borderBottom: '1px solid #d5d5d5',
            background: '#f6f7fb',
            fontSize: 18,
            fontWeight: 700,
            color: '#1f3248',
          }}
        >
          {(() => {
            let subjectName = '';
            if (selectedFamilyId) {
              const fp = partnerships.find((p) => p.id === selectedFamilyId);
              if (fp) {
                const p1 = people.find((p) => p.id === fp.partner1_id);
                const p2 = people.find((p) => p.id === fp.partner2_id);
                subjectName = fp.familyName || [p1?.name, p2?.name].filter(Boolean).join(' & ') || 'Family';
              }
            } else if (showMultiPersonPanel && multiSelectedPeople.length > 0) {
              subjectName = multiSelectedPeople.map((p) => p.name).filter(Boolean).join(' & ');
            } else if (propertiesPanelItem) {
              const item = propertiesPanelItem;
              if ('name' in item) {
                subjectName = (item as Person).name || '';
              } else if ('partner1_id' in item) {
                const ps = item as Partnership;
                const p1 = people.find((p) => p.id === ps.partner1_id);
                const p2 = people.find((p) => p.id === ps.partner2_id);
                subjectName = ps.familyName || [p1?.name, p2?.name].filter(Boolean).join(' & ') || '';
              } else if ('lineStyle' in item) {
                const el = item as EmotionalLine;
                const p1 = people.find((p) => p.id === el.person1_id);
                const p2 = people.find((p) => p.id === el.person2_id);
                subjectName = [p1?.name, p2?.name].filter(Boolean).join(' & ');
              }
            }
            return subjectName ? `Properties Panel for ${subjectName}` : 'Properties Panel';
          })()}
        </div>
        {(showMultiPersonPanel || propertiesPanelItem) && (
          showMultiPersonPanel ? (
            <MultiPersonPropertiesPanel
              selectedPeople={multiSelectedPeople}
              onBatchUpdate={handleBatchUpdatePersons}
              onAddEmotionalPattern={openAddEmotionalPatternModal}
              onClose={() => {
                setSelectedPeopleIds([]);
                setPropertiesPanelItem(null);
              }}
            />
          ) : (
            propertiesPanelItem && (
              <PropertiesPanel
                selectedItem={propertiesPanelItem}
                people={people}
                partnerships={partnerships}
                eventCategories={eventCategories}
                relationshipTypes={relationshipTypes}
                relationshipStatuses={relationshipStatuses}
                functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                sirCategories={sirCategories}
                functionalFactCategories={functionalFactCategories}
                nodalCategories={nodalCategories}
                onUpdatePerson={handleUpdatePerson}
                onUpdatePartnership={handleUpdatePartnership}
                onUpdateEmotionalLine={handleUpdateEmotionalLine}
                triangleId={panelTriangleContext?.id}
                triangleColor={panelTriangleContext?.color}
                triangleIntensity={panelTriangleContext?.intensity}
                triangleNotes={panelTriangleContext?.notes}
                onUpdateTriangleColor={updateTriangleColor}
                onUpdateTriangleIntensity={updateTriangleIntensity}
                onUpdateTriangleNotes={(id, n) => updateTriangle(id, { notes: n })}
                isFamilyView={propertiesPanelItem.id === selectedFamilyId}
                onOpenFamilyProperty={(category, subtype, position) =>
                  selectedFamilyId && onOpenFamilyProperty(selectedFamilyId, category, subtype, position)
                }
                onAddFamilyEvent={(position) =>
                  selectedFamilyId && onAddFamilyEvent(selectedFamilyId, position)
                }
                onOpenFamilyEventEdit={(partnershipId, eventId, position) =>
                  onFamilyIndicatorClick(partnershipId, eventId, position)
                }
                onDeleteFamilyEvent={onDeleteFamilyEvent}
                initialActiveTab={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.tab
                    : undefined
                }
                initialPersonSection={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.personSection
                    : undefined
                }
                focusEventId={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.focusEventId
                    : undefined
                }
                openNewEventRequestId={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.openNewEventRequestId
                    : undefined
                }
                newEventSeed={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.newEventSeed
                    : undefined
                }
                openNewEventPosition={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.openNewEventPosition
                    : undefined
                }
                newEventModalTitle={
                  propertiesPanelIntent?.targetId === propertiesPanelItem.id
                    ? propertiesPanelIntent.newEventModalTitle
                    : undefined
                }
                allEmotionalLines={allEmotionalLines}
                onSelectEmotionalLine={(line) => {
                  setPropertiesPanelItem(line);
                  setSelectedEmotionalLineId(line.id);
                  setSelectedPeopleIds([]);
                }}
                onRemoveEmotionalLine={(id) => {
                  onRemoveEmotionalLine(id);
                  setPropertiesPanelItem(null);
                  setSelectedEmotionalLineId(null);
                }}
                onAddEmotionalPattern={openAddEmotionalPatternModal}
                onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
                onClose={() => {
                  setPropertiesPanelItem(null);
                  setPropertiesPanelIntent(null);
                  if (selectedFamilyId) onCloseFamilyPanel();
                }}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
