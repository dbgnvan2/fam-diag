import type { Dispatch, SetStateAction } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  PageNote,
  EmotionalProcessEvent,
} from '../types';

interface UseSelectionHandlersDeps {
  // State data
  pageNotes: PageNote[];
  selectedPageNoteId: string | null;
  pageNoteDraft: { title: string; text: string; fillColor: string } | null;
  selectedEmotionalLineId: string | null;
  selectedPeopleIds: string[];
  selectedPartnershipId: string | null;
  people: Person[];
  partnerships: Partnership[];
  triangles: Triangle[];
  allEmotionalLines: EmotionalLine[];
  triangleByTplLineId: Map<string, string>;
  // State setters
  setPageNotes: Dispatch<SetStateAction<PageNote[]>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  setSelectedPageNoteId: Dispatch<SetStateAction<string | null>>;
  setPageNoteDraft: Dispatch<SetStateAction<{ title: string; text: string; fillColor: string } | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
  setSelectedFamilyId: Dispatch<SetStateAction<string | null>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; items: any[] } | null>>;
  // Passed functions
  addChildToPartnership: (childIdOverride?: string, partnershipIdOverride?: string) => void;
  handleUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
  openContextualEventCreator: (
    target: { type: 'person' | 'partnership' | 'emotional'; id: string },
    targetItem: Person | Partnership | EmotionalLine,
    seed?: Partial<EmotionalProcessEvent>,
    popupPosition?: { x: number; y: number },
    modalTitle?: string
  ) => void;
  openTrianglePropertyModal: (
    triangleId: string,
    seed: Partial<EmotionalProcessEvent>,
    position: { x: number; y: number },
    modalTitle?: string
  ) => void;
  removeTriangle: (triangleId: string) => void;
  removeEmotionalLine: (emotionalLineId: string) => void;
  updateTriangle: (triangleId: string, updates: Partial<import('../types').Triangle>) => void;
}

export function useSelectionHandlers({
  pageNotes,
  selectedPageNoteId,
  pageNoteDraft,
  selectedEmotionalLineId,
  selectedPeopleIds,
  selectedPartnershipId,
  people,
  partnerships,
  triangles,
  allEmotionalLines,
  triangleByTplLineId,
  setPageNotes,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
  setSelectedPageNoteId,
  setPageNoteDraft,
  setPropertiesPanelItem,
  setSelectedFamilyId,
  setContextMenu,
  addChildToPartnership,
  handleUpdateEmotionalLine,
  openContextualEventCreator,
  openTrianglePropertyModal,
  removeTriangle,
  removeEmotionalLine,
  updateTriangle,
}: UseSelectionHandlersDeps) {
  const handlePageNoteSelect = (noteId: string) => {
    const note = pageNotes.find((entry) => entry.id === noteId);
    if (!note) return;
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedFamilyId(null);
    setPropertiesPanelItem(null);
    setSelectedPageNoteId(noteId);
    setPageNoteDraft({
      title: note.title,
      text: note.text,
      fillColor: note.fillColor || '#fff8c6',
    });
  };

  const handlePageNoteDraftChange = (
    field: 'title' | 'text' | 'fillColor',
    value: string
  ) => {
    setPageNoteDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handlePageNoteSave = () => {
    if (!selectedPageNoteId || !pageNoteDraft) return;
    setPageNotes((prev) =>
      prev.map((note) =>
        note.id === selectedPageNoteId
          ? {
              ...note,
              title: pageNoteDraft.title || 'General Note',
              text: pageNoteDraft.text,
              fillColor: pageNoteDraft.fillColor,
            }
          : note
      )
    );
  };

  const handlePageNoteDelete = (noteId: string) => {
    setPageNotes((prev) => prev.filter((note) => note.id !== noteId));
    if (selectedPageNoteId === noteId) {
      setSelectedPageNoteId(null);
      setPageNoteDraft(null);
    }
  };

  const handlePageNoteDragEnd = (noteId: string, x: number, y: number) => {
    setPageNotes((prev) =>
      prev.map((note) => (note.id === noteId ? { ...note, x, y } : note))
    );
  };

  const handlePageNoteResizeEnd = (noteId: string, width: number, height: number) => {
    setPageNotes((prev) =>
      prev.map((note) => (note.id === noteId ? { ...note, width, height } : note))
    );
  };

  const handleChildLineSelect = (childId: string) => {
    setSelectedChildId(childId);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedFamilyId(null);
    const child = people.find((p) => p.id === childId) || null;
    setPropertiesPanelItem(child);
  };

  const handleEmotionalLineSelect = (emotionalLineId: string) => {
    if (selectedEmotionalLineId === emotionalLineId) {
        setSelectedEmotionalLineId(null);
        setPropertiesPanelItem(null);
        return;
    }

    if (selectedPeopleIds.length > 0 || selectedPartnershipId) {
        setSelectedPeopleIds([]);
        setSelectedPartnershipId(null);
    }
    setSelectedEmotionalLineId(emotionalLineId);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedFamilyId(null);

    const selectedLine = allEmotionalLines.find(el => el.id === emotionalLineId);
    if (selectedLine) {
        setPropertiesPanelItem(selectedLine);
    }
  };

  const handleEmotionalLineContextMenu = (e: KonvaEventObject<PointerEvent>, emotionalLineId: string) => {
    e.evt.preventDefault();
    setSelectedEmotionalLineId(emotionalLineId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedFamilyId(null);
    const emotionalLine = allEmotionalLines.find(el => el.id === emotionalLineId);
    if (!emotionalLine) return;
    const parentTriangleId = triangleByTplLineId.get(emotionalLineId);
    const items = [
      {
        label: emotionalLine.notes
          ? emotionalLine.notesEnabled
            ? 'Hide Note'
            : 'Show Note'
          : 'No Note',
        onClick: () => {
            if (!emotionalLine.notes) return;
            handleUpdateEmotionalLine(emotionalLineId, { notesEnabled: emotionalLine.notesEnabled ? false : true });
            setContextMenu(null);
        }
      },
      {
        label: 'Properties',
        onClick: () => {
            setPropertiesPanelItem(emotionalLine);
            setContextMenu(null);
        }
      },
      {
        label: 'Add Event...',
        onClick: () => {
          openContextualEventCreator(
            { type: 'emotional', id: emotionalLineId },
            emotionalLine,
            {
              eventType: 'EPE',
              category: 'Emotional Pattern',
            },
            { x: e.evt.clientX, y: e.evt.clientY },
            'Emotional Pattern Add Event'
          );
          setContextMenu(null);
        }
      },
    ];

    items.push({
      label: parentTriangleId ? 'Delete Triangle' : 'Delete Emotional Line',
      onClick: () =>
        parentTriangleId ? removeTriangle(parentTriangleId) : removeEmotionalLine(emotionalLineId),
    });

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items
    });
  };

  const handleTriangleAreaSelect = (triangleId: string) => {
    const triangle = triangles.find((item) => item.id === triangleId);
    const firstTpl = triangle?.tpls?.[0];
    if (!firstTpl) return;
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedFamilyId(null);
    setSelectedEmotionalLineId(firstTpl.id);
    setPropertiesPanelItem(firstTpl);
  };

  const handleTriangleAreaContextMenu = (
    e: KonvaEventObject<PointerEvent>,
    triangleId: string
  ) => {
    e.evt.preventDefault();
    const triangle = triangles.find((item) => item.id === triangleId);
    if (!triangle) return;
    const firstTpl = triangle.tpls?.[0];
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedFamilyId(null);
    if (firstTpl) {
      setSelectedEmotionalLineId(firstTpl.id);
      setPropertiesPanelItem(firstTpl);
    }
    const pos = { x: e.evt.clientX, y: e.evt.clientY };
    const makeTrianglePropertyItem = (label: string, processType: string) => ({
      label,
      onClick: () => {
        openTrianglePropertyModal(
          triangleId,
          {
            eventType: 'TRIANGLE',
            subtype: processType,
            category: 'Triangle',
            eventClass: 'triangle',
            status: 'ongoing',
            intensity: 1,
            frequency: 1,
            impact: 1,
          },
          pos,
          `Triangle ${label}`
        );
        setContextMenu(null);
      },
    });
    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      items: [
        ...(firstTpl ? [{
          label: 'Properties',
          onClick: () => {
            setPropertiesPanelItem(firstTpl);
            setContextMenu(null);
          },
        }] : []),
        makeTrianglePropertyItem('Triangle Functioning', 'triangle-functioning'),
        makeTrianglePropertyItem('Triangle Flexibility', 'triangle-flexibility'),
        makeTrianglePropertyItem('Triangle Stress Response', 'triangle-stress-response'),
        {
          label: triangle.notes
            ? triangle.notesEnabled
              ? 'Hide Note'
              : 'Show Note'
            : 'No Note',
          onClick: () => {
            if (!triangle.notes) return;
            updateTriangle(triangleId, { notesEnabled: triangle.notesEnabled ? false : true });
            setContextMenu(null);
          },
        },
        {
          label: 'Delete Triangle',
          onClick: () => removeTriangle(triangleId),
        },
      ],
    });
  };

  const handleSelect = (personId: string, additive: boolean) => {
    const selectedPerson = people.find((person) => person.id === personId);
    if (!selectedPerson) return;

    if (!additive && selectedPartnershipId) {
      const selectedPartnership = partnerships.find((p) => p.id === selectedPartnershipId);
      if (selectedPartnership) {
        const isPartner =
          selectedPartnership.partner1_id === personId ||
          selectedPartnership.partner2_id === personId;
        if (!isPartner) {
          addChildToPartnership(personId, selectedPartnershipId);
          return;
        }
      }
    }

    if (additive) {
      const alreadySelected = selectedPeopleIds.includes(personId);
      const next = alreadySelected
        ? selectedPeopleIds.filter((id) => id !== personId)
        : [...selectedPeopleIds, personId];
      setSelectedPeopleIds(next);
      setSelectedEmotionalLineId(null);
      setSelectedPartnershipId(null);
      setSelectedChildId(null);
      setSelectedPageNoteId(null);
      setPageNoteDraft(null);
      setSelectedFamilyId(null);
      setPropertiesPanelItem(next.length === 1 ? selectedPerson : null);
      return;
    }

    setSelectedEmotionalLineId(null);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedFamilyId(null);
    setSelectedPeopleIds([personId]);
    setPropertiesPanelItem(selectedPerson);
  };

  const handlePartnershipSelect = (partnershipId: string) => {
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedFamilyId(null);
    if (selectedPartnershipId === partnershipId) {
        setSelectedPartnershipId(null);
        setPropertiesPanelItem(null);
    } else {
        setSelectedPartnershipId(partnershipId);
        setSelectedPeopleIds([]);
        const selectedPartnership = partnerships.find((p) => p.id === partnershipId);
        if (selectedPartnership) {
          setPropertiesPanelItem(selectedPartnership);
        }
    }
  };

  return {
    handlePageNoteSelect,
    handlePageNoteDraftChange,
    handlePageNoteSave,
    handlePageNoteDelete,
    handlePageNoteDragEnd,
    handlePageNoteResizeEnd,
    handleChildLineSelect,
    handleEmotionalLineSelect,
    handleEmotionalLineContextMenu,
    handleTriangleAreaSelect,
    handleTriangleAreaContextMenu,
    handleSelect,
    handlePartnershipSelect,
  };
}
