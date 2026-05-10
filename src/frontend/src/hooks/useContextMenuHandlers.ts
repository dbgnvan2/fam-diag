import type { Dispatch, SetStateAction } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  Person,
  Partnership,
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalFactCategoryDefinition,
} from '../types';
import type { PropertiesPanelIntent } from '../types/diagramEditor';
import { GENDER_SYMBOL_OPTIONS } from '../utils/dataNormalization';

interface UseContextMenuHandlersDeps {
  // State data
  people: Person[];
  partnerships: Partnership[];
  selectedPeopleIds: string[];
  selectedPartnershipId: string | null;
  selectedFamilyIds: string[];
  relationshipTypes: string[];
  functionalFactCategories: FunctionalFactCategoryDefinition[];
  // State setters
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; items: any[] } | null>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  setSelectedPageNoteId: Dispatch<SetStateAction<string | null>>;
  setPageNoteDraft: Dispatch<SetStateAction<{ title: string; text: string; fillColor: string } | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
  setPropertiesPanelIntent: Dispatch<SetStateAction<PropertiesPanelIntent>>;
  setTimelineSelectionIds: Dispatch<SetStateAction<string[]>>;
  setTimelineFamilySelectionIds: Dispatch<SetStateAction<string[]>>;
  // From usePersonOperations
  addPerson: (x: number, y: number, overrides?: Partial<Person>) => Person;
  addCoach: (x: number, y: number) => Person;
  addAIAgent: (x: number, y: number) => Person;
  addParentsForPerson: (person: Person, options?: { forceBirthParents?: boolean; parentLabelPrefix?: string; parentSize?: number }) => void;
  createChildrenForPartnership: (partnershipId: string, variant: 'male' | 'female' | 'twins' | 'triplets' | 'miscarriage' | 'stillbirth') => void;
  createAdoptedChildForPartnership: (partnershipId: string) => void;
  removePartnership: (partnershipId: string) => void;
  removePerson: (personId: string) => void;
  removeChildFromPartnership: (childId: string, partnershipId: string) => void;
  // Other passed functions
  addPartnerForPerson: (person: Person) => void;
  openAddEmotionalPatternModal: (person1Id: string, person2Id: string) => void;
  handleUpdatePerson: (id: string, updates: Partial<Person>) => void;
  handleUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  openContextualEventCreator: (
    target: { type: 'person' | 'partnership' | 'emotional'; id: string },
    targetItem: Person | Partnership | EmotionalLine,
    seed?: Partial<EmotionalProcessEvent>,
    popupPosition?: { x: number; y: number },
    modalTitle?: string
  ) => void;
  openClientProfileModal: (person: Person) => void;
  openCoachThinkingModal: (person: Person) => void;
  addTriangle: (personIds: string[]) => void;
  changeSex: (personId: string) => void;
  addChildToPartnership: (childIdOverride?: string, partnershipIdOverride?: string) => void;
  openPersonSectionPopup: (person: Person, section: 'name' | 'dates' | 'format' | 'sibling' | 'foo', x: number, y: number) => void;
  openPartnershipSectionPopup: (partnership: Partnership, relationshipType: string, x: number, y: number) => void;
  addGeneralNote: (x: number, y: number) => void;
  openAddFamilyModal: (position: { x: number; y: number }) => void;
  addEmotionalLine: (person1_id: string, person2_id: string, relationshipType: EmotionalLine['relationshipType'], lineStyle: EmotionalLine['lineStyle'], lineEnding: EmotionalLine['lineEnding']) => EmotionalLine;
  removeEmotionalLine: (emotionalLineId: string) => void;
  // Canvas geometry
  zoom: number;
  viewport: { width: number; height: number };
  panelWidth: number;
  ribbonHeight: number;
}

export function useContextMenuHandlers({
  people,
  partnerships,
  selectedPeopleIds,
  selectedPartnershipId,
  selectedFamilyIds,
  relationshipTypes,
  functionalFactCategories,
  setContextMenu,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
  setSelectedPageNoteId,
  setPageNoteDraft,
  setPropertiesPanelItem,
  setPropertiesPanelIntent,
  setTimelineSelectionIds,
  setTimelineFamilySelectionIds,
  addPerson,
  addCoach,
  addAIAgent,
  addParentsForPerson,
  createChildrenForPartnership,
  createAdoptedChildForPartnership,
  removePartnership,
  removePerson,
  removeChildFromPartnership,
  addPartnerForPerson,
  openAddEmotionalPatternModal,
  handleUpdatePerson,
  handleUpdatePartnership,
  openContextualEventCreator,
  openClientProfileModal,
  openCoachThinkingModal,
  addTriangle,
  changeSex,
  addChildToPartnership,
  openPersonSectionPopup,
  openPartnershipSectionPopup,
  addGeneralNote,
  openAddFamilyModal,
  addEmotionalLine,
  removeEmotionalLine,
  zoom,
  viewport,
  panelWidth,
  ribbonHeight,
}: UseContextMenuHandlersDeps) {
  const toCanvasPoint = (pointer: { x: number; y: number }) => {
    const canvasWidth = Math.max(0, viewport.width - panelWidth);
    const canvasHeight = Math.max(0, viewport.height - ribbonHeight);
    const stageOffset = {
      x: ((1 - zoom) * canvasWidth) / 2,
      y: ((1 - zoom) * canvasHeight) / 2,
    };
    return {
      x: (pointer.x - stageOffset.x) / zoom,
      y: (pointer.y - stageOffset.y) / zoom,
    };
  };

  const handlePersonContextMenu = (e: KonvaEventObject<PointerEvent>, person: Person) => {
      e.evt.preventDefault();
      const isCoachPerson = !!person.isCoach || /^coach(?:\s+\d+)?$/i.test((person.name || '').trim());
      if (!selectedPeopleIds.includes(person.id) || selectedPeopleIds.length === 0) {
        setSelectedPeopleIds([person.id]);
        setPropertiesPanelItem(person);
      }
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setSelectedPageNoteId(null);
      setPageNoteDraft(null);

      if (selectedPeopleIds.length >= 2 && selectedPeopleIds.includes(person.id)) {
        showGroupContextMenu(e.evt.clientX, e.evt.clientY);
        return;
      }

      const menuItems = [
          {
            label: 'Properties',
            children: [
              {
                label: 'Name',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'name', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Dates',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'dates', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Format',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'format', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Sibling',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'sibling', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'FOO',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'foo', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
            ],
          },
          {
            label: 'Add',
            children: [
              {
                label: 'Event',
                onClick: () => {
                  openContextualEventCreator(
                    { type: 'person', id: person.id },
                    person,
                    undefined,
                    { x: e.evt.clientX, y: e.evt.clientY },
                    'Person Add Event'
                  );
                  setContextMenu(null);
                },
              },
              {
                label: 'Symptom',
                children: (['physical', 'emotional', 'social'] as const).map((group) => ({
                  label: group.charAt(0).toUpperCase() + group.slice(1),
                  onClick: () => {
                    openContextualEventCreator(
                      { type: 'person', id: person.id },
                      person,
                      {
                        eventType: 'SYMPTOM',
                        category: group,
                      },
                      { x: e.evt.clientX, y: e.evt.clientY },
                      `Person Add Symptom ${group.charAt(0).toUpperCase() + group.slice(1)}`
                    );
                    setContextMenu(null);
                  },
                })),
              },
              ...(functionalFactCategories.length > 0
                ? [
                    {
                      label: 'Functional Fact',
                      children: functionalFactCategories.map((cat) => ({
                        label: cat.name,
                        onClick: () => {
                          openContextualEventCreator(
                            { type: 'person', id: person.id },
                            person,
                            {
                              eventType: 'FF' as const,
                              category: cat.name,
                              eventClass: 'individual' as const,
                              status: 'discrete' as const,
                              intensity: 1,
                              frequency: 1,
                              impact: 1,
                              primaryPersonName: person.name || '',
                              otherPersonName: 'None',
                            },
                            { x: e.evt.clientX, y: e.evt.clientY },
                            `Person Add Functional Fact ${cat.name}`
                          );
                          setContextMenu(null);
                        },
                      })),
                    },
                  ]
                : []),
              {
                label: 'Emotional Autonomy',
                onClick: () => {
                  openContextualEventCreator(
                    { type: 'person', id: person.id },
                    person,
                    {
                      eventType: 'EA',
                      category: 'Emotional Autonomy',
                      eventClass: 'emotional-pattern',
                      status: 'ongoing',
                      intensity: 1,
                      frequency: 1,
                      impact: 1,
                      primaryPersonName: person.name || '',
                      otherPersonName: 'None',
                    },
                    { x: e.evt.clientX, y: e.evt.clientY },
                    'Person Add Emotional Autonomy'
                  );
                  setContextMenu(null);
                },
              },
              {
                label: 'FoO',
                children: [
                  {
                    label: 'Extended FoO',
                    onClick: () => {
                      openContextualEventCreator(
                        { type: 'person', id: person.id },
                        person,
                        {
                          eventType: 'FOO',
                          category: 'Family Stability',
                          eventClass: 'emotional-pattern',
                          status: 'ongoing',
                          intensity: 1,
                          frequency: 1,
                          impact: 1,
                          primaryPersonName: person.name || '',
                          otherPersonName: 'None',
                        },
                        { x: e.evt.clientX, y: e.evt.clientY },
                        'Person Add FoO Extended FoO'
                      );
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'FoO Triangle',
                    onClick: () => {
                      openContextualEventCreator(
                        { type: 'person', id: person.id },
                        person,
                        {
                          eventType: 'FOO',
                          category: 'Triangle Functioning',
                          eventClass: 'emotional-pattern',
                          status: 'ongoing',
                          intensity: 1,
                          frequency: 1,
                          impact: 1,
                          primaryPersonName: person.name || '',
                          otherPersonName: 'None',
                        },
                        { x: e.evt.clientX, y: e.evt.clientY },
                        'Person Add FoO FoO Triangle'
                      );
                      setContextMenu(null);
                    },
                  },
                ],
              },
              ...(isCoachPerson
                ? [
                    {
                      label: 'Coach Event',
                      onClick: () => {
                        openContextualEventCreator(
                          { type: 'person', id: person.id },
                          person,
                          {
                            eventType: 'EPE',
                            category: 'Coaching',
                            eventClass: 'emotional-pattern',
                            status: 'ongoing',
                            intensity: 1,
                            frequency: 1,
                            impact: 1,
                            primaryPersonName: person.name || 'Coach',
                            otherPersonName: 'None',
                          },
                          { x: e.evt.clientX, y: e.evt.clientY },
                          'Person Add Coach Event'
                        );
                        setContextMenu(null);
                      },
                    },
                  ]
                : []),
              {
                label: 'Partner',
                onClick: () => {
                  addPartnerForPerson(person);
                  setContextMenu(null);
                },
              },
              {
                label: 'Parents',
                onClick: () => {
                  addParentsForPerson(person);
                  setContextMenu(null);
                },
              },
              {
                label: 'As Child',
                onClick: () => {
                  if (selectedPartnershipId) {
                    addChildToPartnership(person.id, selectedPartnershipId);
                    setContextMenu(null);
                  } else {
                    alert('Select a partnership first (click a PRL) before adding this child.');
                  }
                },
              },
            ],
          },
          {
            label: person.notes
              ? person.notesEnabled
                ? 'Hide Note'
                : 'Show Note'
              : 'No Note',
            onClick: () => {
              if (!person.notes) return;
              handleUpdatePerson(person.id, { notesEnabled: person.notesEnabled ? false : true });
              setContextMenu(null);
            }
          },
          {
            label: 'Sex/Gender',
            children: [
              {
                label: `Change Sex to ${person.gender === 'male' ? 'female' : 'male'}`,
                onClick: () => {
                  changeSex(person.id);
                  setContextMenu(null);
                },
              },
              ...GENDER_SYMBOL_OPTIONS.map((option) => ({
                label: option.label,
                onClick: () => {
                  handleUpdatePerson(person.id, {
                    gender: option.birthSex,
                    birthSex: option.birthSex,
                    genderIdentity: option.genderIdentity,
                    genderSymbol: option.symbol,
                  });
                  setContextMenu(null);
                },
              })),
            ],
          },
          {
            label: 'Timeline',
            onClick: () => {
                const nextIds =
                  selectedPeopleIds.length > 1 && selectedPeopleIds.includes(person.id)
                    ? selectedPeopleIds
                    : [person.id];
                setTimelineSelectionIds(nextIds);
                // Carry over any currently-selected families so the user
                // gets person + family lanes in the same Timeline view.
                setTimelineFamilySelectionIds([...selectedFamilyIds]);
                setContextMenu(null);
            }
          },
          {
            label: 'Make Client',
            onClick: () => {
              setSelectedPeopleIds([person.id]);
              setSelectedPartnershipId(null);
              setSelectedEmotionalLineId(null);
              setSelectedChildId(null);
              setPropertiesPanelItem(person);
              setPropertiesPanelIntent(null);
              openClientProfileModal(person);
              setContextMenu(null);
            }
          },
          ...(isCoachPerson
            ? [
                {
                  label: 'Coach Thinking',
                  onClick: () => {
                    openCoachThinkingModal(person);
                    setContextMenu(null);
                  },
                },
              ]
            : [])
      ];

      if (selectedPeopleIds.length === 3) {
        menuItems.push({
          label: 'Add Triangle',
          onClick: () => {
            addTriangle(selectedPeopleIds);
            setContextMenu(null);
          },
        });
      }
      setContextMenu({
          x: e.evt.clientX,
          y: e.evt.clientY,
          items: [
            ...menuItems,
            {
              label: 'Remove/Delete',
              children: [
                {
                  label: 'Remove as Child',
                  onClick: () => {
                    if (person.parentPartnership || person.birthParentPartnership) {
                      removeChildFromPartnership(
                        person.id,
                        person.parentPartnership || person.birthParentPartnership!
                      );
                      setContextMenu(null);
                    } else {
                      alert('This person is not currently linked as a child.');
                    }
                  },
                },
                {
                  label: 'Delete Person',
                  onClick: () => removePerson(person.id),
                },
              ],
            },
          ],
      });
  };


  const handleChildLineContextMenu = (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => {
    e.evt.preventDefault();
    const child = people.find((person) => person.id === childId);
    if (!child) return;
    setSelectedChildId(childId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setPropertiesPanelItem(null);
    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: child.familyCutoffLineId ? 'Remove Cutoff' : 'Add Cutoff',
                onClick: () => {
                    if (child.familyCutoffLineId) {
                        removeEmotionalLine(child.familyCutoffLineId);
                        handleUpdatePerson(childId, { familyCutoffLineId: undefined });
                    } else {
                        const partnership = partnerships.find((p) => p.id === partnershipId);
                        const parentId = partnership?.partner1_id || childId;
                        const newLine = addEmotionalLine(childId, parentId, 'cutoff', 'cutoff', 'none');
                        handleUpdatePerson(childId, { familyCutoffLineId: newLine.id });
                    }
                    setContextMenu(null);
                }
            },
            {
                label: 'Child Properties',
                onClick: () => {
                    setPropertiesPanelItem(child);
                    setContextMenu(null);
                }
            },
            {
                label: 'Remove as Child',
                onClick: () => {
                    removeChildFromPartnership(childId, partnershipId);
                    setContextMenu(null);
                }
            },
            {
                label: 'Delete Child',
                onClick: () => {
                    removeChildFromPartnership(childId, partnershipId);
                    removePerson(childId);
                }
            },
        ]
    });
  };

  const handlePartnershipContextMenu = (e: KonvaEventObject<PointerEvent>, partnershipId: string) => {
    e.evt.preventDefault();
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;

    setSelectedPartnershipId(partnershipId);
    setSelectedPeopleIds([]);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setPropertiesPanelItem(partnership);

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Add Child',
                children: [
                  {
                    label: 'Add Male',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'male');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Add Female',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'female');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Twins',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'twins');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Triplets',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'triplets');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Miscarriage',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'miscarriage');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Stillbirth',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'stillbirth');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Adopted',
                    onClick: () => {
                      createAdoptedChildForPartnership(partnershipId);
                      setContextMenu(null);
                    },
                  },
                ]
            },
            {
              label: partnership.notes
                ? partnership.notesEnabled
                  ? 'Hide PRL Note'
                  : 'Show PRL Note'
                : 'No PRL Note',
              onClick: () => {
                  if (!partnership.notes) return;
                  handleUpdatePartnership(partnershipId, { notesEnabled: partnership.notesEnabled ? false : true });
                  setContextMenu(null);
              }
            },
            {
              label: partnership.familyNotes
                ? partnership.familyNotesEnabled
                  ? 'Hide Family Note'
                  : 'Show Family Note'
                : 'No Family Note',
              onClick: () => {
                  if (!partnership.familyNotes) return;
                  handleUpdatePartnership(partnershipId, { familyNotesEnabled: partnership.familyNotesEnabled ? false : true });
                  setContextMenu(null);
              }
            },
            {
              label: 'Relationship Properties',
              children: relationshipTypes.map((relationshipType) => ({
                label: relationshipType.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
                onClick: () => {
                  openPartnershipSectionPopup(
                    partnership,
                    relationshipType,
                    e.evt.clientX,
                    e.evt.clientY
                  );
                  setContextMenu(null);
                },
              })),
            },
            {
              label: 'Add Relationship Event',
              onClick: () => {
                openContextualEventCreator(
                  { type: 'partnership', id: partnershipId },
                  partnership,
                  undefined,
                  { x: e.evt.clientX, y: e.evt.clientY },
                  'Partnership Add Relationship Event'
                );
                setContextMenu(null);
              }
            },
            {
              label: 'Delete Partnership',
              onClick: () => removePartnership(partnershipId)
            },
        ]
    });
  };

  const handleStageContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (e.target !== e.target.getStage()) {
        return;
    }
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    const canvasPoint = toCanvasPoint(pointerPosition);

    const baseItems = [
        {
            label: 'Add Person',
            onClick: () => {
                addPerson(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
        {
            label: 'Add Coach',
            onClick: () => {
                addCoach(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
        {
            label: 'Add AI Agent',
            onClick: () => {
                addAIAgent(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
        {
            label: 'Add General Note',
            onClick: () => {
                addGeneralNote(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
        {
            label: 'Add Family',
            onClick: () => {
                openAddFamilyModal(canvasPoint);
                setContextMenu(null);
            }
        },
    ];

    if (selectedPeopleIds.length === 1) {
      const selectedPerson = people.find((person) => person.id === selectedPeopleIds[0]);
      if (selectedPerson) {
        baseItems.push({
          label: 'Add Partner',
          onClick: () => {
            addPartnerForPerson(selectedPerson);
            setContextMenu(null);
          },
        });
      }
    }

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: baseItems
    });
  };

  const showGroupContextMenu = (clientX: number, clientY: number) => {
    const items: { label: string; onClick: () => void }[] = [
      {
        label: 'Timeline',
        onClick: () => {
          setTimelineSelectionIds(selectedPeopleIds);
          setTimelineFamilySelectionIds([...selectedFamilyIds]);
          setContextMenu(null);
        },
      },
    ];
    if (selectedPeopleIds.length === 2) {
      const [p1_id, p2_id] = selectedPeopleIds;
      items.push({
        label: 'Add Emotional Pattern',
        onClick: () => {
          openAddEmotionalPatternModal(p1_id, p2_id);
          setContextMenu(null);
        },
      });
    }
    setContextMenu({ x: clientX, y: clientY, items });
  };

  const handleGroupContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    if (selectedPeopleIds.length < 2) return;
    showGroupContextMenu(e.evt.clientX, e.evt.clientY);
  };

  return {
    handlePersonContextMenu,
    handleChildLineContextMenu,
    handlePartnershipContextMenu,
    handleStageContextMenu,
    handleGroupContextMenu,
  };
}
