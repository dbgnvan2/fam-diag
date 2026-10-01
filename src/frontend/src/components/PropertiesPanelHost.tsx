/**
 * The Properties panels: the side panel (single or multi-person) and the two
 * section popups opened from badges on the canvas.
 *
 * Rendered by DiagramEditor and handed to DiagramCanvas as its
 * `propertiesPanel` slot. These props used to be drilled through the canvas,
 * which only places the panel (review 2026-09-30 struct-10). The three
 * PropertiesPanel instances share one props object.
 */
import { Z_INDEX } from '../constants/zIndex';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  FunctionalIndicatorDefinition,
  SIRCategoryDefinition,
  FunctionalFactCategoryDefinition,
  NodalCategoryDefinition,
  SymptomGroup,
} from '../types';
import type {
  PersonSectionPopupState,
  PartnershipSectionPopupState,
  PropertiesPanelIntent,
} from '../types/diagramEditor';
import type { FamilyScope } from '../utils/familyScope';
import PropertiesPanel from './PropertiesPanel';
import MultiPersonPropertiesPanel from './MultiPersonPropertiesPanel';

type PanelItem = Person | Partnership | EmotionalLine;

export interface PropertiesPanelHostProps {
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines: EmotionalLine[];
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  sirCategories: SIRCategoryDefinition[];
  functionalFactCategories: FunctionalFactCategoryDefinition[];
  nodalCategories: NodalCategoryDefinition[];
  handleUpdatePerson: (id: string, updates: Partial<Person>) => void;
  handleUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  handleUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
  ensureSymptomDefinition: (label: string, group: SymptomGroup) => string | null;
  // Section popups
  personSectionPopup: PersonSectionPopupState;
  personSectionPopupPerson: Person | null;
  setPersonSectionPopup: Dispatch<SetStateAction<PersonSectionPopupState>>;
  partnershipSectionPopup: PartnershipSectionPopupState;
  partnershipSectionPopupPartnership: Partnership | null;
  setPartnershipSectionPopup: Dispatch<SetStateAction<PartnershipSectionPopupState>>;
  // Side panel
  showMultiPersonPanel: boolean;
  multiSelectedPeople: Person[];
  handleBatchUpdatePersons: (personIds: string[], updates: Partial<Person>) => void;
  openAddEmotionalPatternModal: (person1Id: string, person2Id: string) => void;
  propertiesPanelItem: PanelItem | null;
  setPropertiesPanelItem: Dispatch<SetStateAction<PanelItem | null>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  propertiesPanelIntent: PropertiesPanelIntent;
  setPropertiesPanelIntent: Dispatch<SetStateAction<PropertiesPanelIntent>>;
  panelTriangleContext: { id: string; color: string; intensity: 'low' | 'medium' | 'high'; notes: string } | null;
  updateTriangleColor: (triangleId: string, color: string) => void;
  updateTriangleIntensity: (triangleId: string, intensity: 'low' | 'medium' | 'high') => void;
  updateTriangle: (triangleId: string, updates: Partial<Triangle>) => void;
  familyScope: FamilyScope | null;
  selectedFamilyId: string | null;
  onFamilyIndicatorClick: (partnershipId: string, eventId: string, position: { x: number; y: number }) => void;
  onOpenFamilyProperty: (partnershipId: string, category: string, subtype: string, position: { x: number; y: number }) => void;
  onAddFamilyEvent: (partnershipId: string, position: { x: number; y: number }) => void;
  onDeleteFamilyEvent: (partnershipId: string, eventId: string) => void;
  onCloseFamilyPanel: () => void;
  onSelectSystemEventOwner: (owner: { type: 'person' | 'partnership' | 'emotional'; id: string }) => void;
  onSelectEmotionalLine: (line: EmotionalLine) => void;
  onRemoveEmotionalLine: (id: string) => void;
}

export default function PropertiesPanelHost({
  people,
  partnerships,
  allEmotionalLines,
  eventCategories,
  relationshipTypes,
  relationshipStatuses,
  functionalIndicatorDefinitions,
  sirCategories,
  functionalFactCategories,
  nodalCategories,
  handleUpdatePerson,
  handleUpdatePartnership,
  handleUpdateEmotionalLine,
  ensureSymptomDefinition,
  personSectionPopup,
  personSectionPopupPerson,
  setPersonSectionPopup,
  partnershipSectionPopup,
  partnershipSectionPopupPartnership,
  setPartnershipSectionPopup,
  showMultiPersonPanel,
  multiSelectedPeople,
  handleBatchUpdatePersons,
  openAddEmotionalPatternModal,
  propertiesPanelItem,
  setPropertiesPanelItem,
  setSelectedPeopleIds,
  propertiesPanelIntent,
  setPropertiesPanelIntent,
  panelTriangleContext,
  updateTriangleColor,
  updateTriangleIntensity,
  updateTriangle,
  familyScope,
  selectedFamilyId,
  onFamilyIndicatorClick,
  onOpenFamilyProperty,
  onAddFamilyEvent,
  onDeleteFamilyEvent,
  onCloseFamilyPanel,
  onSelectSystemEventOwner,
  onSelectEmotionalLine,
  onRemoveEmotionalLine,
}: PropertiesPanelHostProps) {
  const sharedPanelProps = {
    people,
    partnerships,
    eventCategories,
    relationshipTypes,
    relationshipStatuses,
    functionalIndicatorDefinitions,
    sirCategories,
    functionalFactCategories,
    nodalCategories,
    onUpdatePerson: handleUpdatePerson,
    onUpdatePartnership: handleUpdatePartnership,
    onUpdateEmotionalLine: handleUpdateEmotionalLine,
    onEnsureSymptomCategoryDefinition: ensureSymptomDefinition,
  };

  return (
    <>
    {personSectionPopup && personSectionPopupPerson && (
      <div
        onClick={() => setPersonSectionPopup(null)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: Z_INDEX.SECTION_POPUP,
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
            {...sharedPanelProps}
            initialActiveTab="properties"
            initialPersonSection={personSectionPopup.section}
            compactPersonSectionMode
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
          zIndex: Z_INDEX.SECTION_POPUP,
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
            {...sharedPanelProps}
            initialActiveTab="properties"
            initialPartnershipType={partnershipSectionPopup.relationshipType}
            compactPartnershipSectionMode
            onClose={() => setPartnershipSectionPopup(null)}
          />
        </div>
      </div>
    )}
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
                {...sharedPanelProps}
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
                familyScope={familyScope}
                onSelectSystemEventOwner={onSelectSystemEventOwner}
                onSelectEmotionalLine={onSelectEmotionalLine}
                onRemoveEmotionalLine={onRemoveEmotionalLine}
                onAddEmotionalPattern={openAddEmotionalPatternModal}
                onClose={() => {
                  setPropertiesPanelItem(null);
                  setPropertiesPanelIntent(null);
                  if (selectedFamilyId) onCloseFamilyPanel();
                }}
              />
            )
          )
        )}
    </>
  );
}
