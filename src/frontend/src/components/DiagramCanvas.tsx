import React, { useRef } from 'react';
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
  PageNote,
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
import { deriveSiblingPositionResult } from '../utils/siblingPosition';
import {
  shouldShowPersonNote,
  shouldShowPartnershipNote,
  shouldShowEmotionalNote,
} from '../utils/noteVisibility';
import { FALLBACK_FILE_NAME } from '../data/defaultDiagramState';

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
  stageRef: RefObject<StageType | null>;

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

  // Child connection handlers
  handleChildLineSelect: (childId: string) => void;
  handleChildLineContextMenu: (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => void;

  // Person handlers
  handleSelect: (personId: string, additive: boolean) => void;
  handlePersonDragStart: (personId: string, x: number, y: number) => void;
  handlePersonDrag: (personId: string, x: number, y: number) => void;
  dragGroupRef: DragGroupRef;
  handlePersonContextMenu: (e: KonvaEventObject<PointerEvent>, person: Person) => void;
  setHoveredPersonId: Dispatch<SetStateAction<string | null>>;
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];

  // Group resize
  selectedGroupBounds: { x: number; y: number; width: number; height: number } | null;
  beginGroupResize: () => void;
  applyGroupResize: (nextBounds: { width: number; height: number }) => void;
  endGroupResize: () => void;

  // Notes layer
  notesLayerEnabled: boolean;
  showSiblingConflicts: boolean;
  hoveredPersonId: string | null;

  // Note drag/resize handlers
  handlePersonNoteDragEnd: (personId: string, x: number, y: number) => void;
  handlePersonNoteResizeEnd: (personId: string, width: number, height: number) => void;
  handlePartnershipNoteDragEnd: (partnershipId: string, x: number, y: number) => void;
  handlePartnershipNoteResizeEnd: (partnershipId: string, width: number, height: number) => void;
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
  panelRef: RefObject<HTMLDivElement | null>;
  panelWidth: number;
  resizeStateRef: MutableRefObject<{ startX: number; startWidth: number } | null>;

  // Multi-person panel
  showMultiPersonPanel: boolean;
  multiSelectedPeople: Person[];
  handleBatchUpdatePersons: (personIds: string[], updates: Partial<Person>) => void;

  // Properties panel
  propertiesPanelItem: Person | Partnership | EmotionalLine | null;
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  handleUpdatePerson: (id: string, updates: Partial<Person>) => void;
  handleUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  handleUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
  panelTriangleContext: { id: string; color: string; intensity: number } | null;
  updateTriangleColor: (triangleId: string, color: string) => void;
  updateTriangleIntensity: (triangleId: string, intensity: number) => void;
  propertiesPanelIntent: PropertiesPanelIntent;
  setPropertiesPanelIntent: Dispatch<SetStateAction<PropertiesPanelIntent>>;
  ensureSymptomDefinition: (group: string, name: string) => void;
  onSiblingSquareClick: (person: Person, clientX: number, clientY: number) => void;
  onAutonomySquareClick: (person: Person) => void;
  onSymptomBadgeClick: (person: Person, group: import('../types').SymptomGroup, clientX: number, clientY: number) => void;
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
  handleChildLineSelect,
  handleChildLineContextMenu,
  handleSelect,
  handlePersonDragStart,
  handlePersonDrag,
  dragGroupRef,
  handlePersonContextMenu,
  setHoveredPersonId,
  functionalIndicatorDefinitions,
  selectedGroupBounds,
  beginGroupResize,
  applyGroupResize,
  endGroupResize,
  notesLayerEnabled,
  showSiblingConflicts,
  hoveredPersonId,
  handlePersonNoteDragEnd,
  handlePersonNoteResizeEnd,
  handlePartnershipNoteDragEnd,
  handlePartnershipNoteResizeEnd,
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
  propertiesPanelIntent,
  setPropertiesPanelIntent,
  ensureSymptomDefinition,
  onSiblingSquareClick,
  onAutonomySquareClick,
  onSymptomBadgeClick,
}: DiagramCanvasProps) {
  const prevScrollTopRef = useRef<number>(0);


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
        <div style={{ flex: 1, position: 'relative' }}>
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
            Family Diagram Maker
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

            {/* Render Emotional Lines */}
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
                            onSelect={handlePartnershipSelect}
                            onHorizontalConnectorDragEnd={handleHorizontalConnectorDragEnd}
                            onFamilyNameOffsetChange={(id, offsetX) => handleUpdatePartnership(id, { familyNameOffsetX: offsetX })}
                            onContextMenu={handlePartnershipContextMenu}
                        />
                        {childConnections}
                    </React.Fragment>
                )
            })}

            {/* Render People */}
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
          Properties Panel
        </div>
        {(showMultiPersonPanel || propertiesPanelItem) && (
          showMultiPersonPanel ? (
            <MultiPersonPropertiesPanel
              selectedPeople={multiSelectedPeople}
              onBatchUpdate={handleBatchUpdatePersons}
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
                onUpdatePerson={handleUpdatePerson}
                onUpdatePartnership={handleUpdatePartnership}
                onUpdateEmotionalLine={handleUpdateEmotionalLine}
                triangleId={panelTriangleContext?.id}
                triangleColor={panelTriangleContext?.color}
                triangleIntensity={panelTriangleContext?.intensity}
                onUpdateTriangleColor={updateTriangleColor}
                onUpdateTriangleIntensity={updateTriangleIntensity}
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
                allEmotionalLines={allEmotionalLines}
                onSelectEmotionalLine={(line) => {
                  setPropertiesPanelItem(line);
                  setSelectedEmotionalLineId(line.id);
                  setSelectedPeopleIds([]);
                }}
                onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
                onClose={() => {
                  setPropertiesPanelItem(null);
                  setPropertiesPanelIntent(null);
                }}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
