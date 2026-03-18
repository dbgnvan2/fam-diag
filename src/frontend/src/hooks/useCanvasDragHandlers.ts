import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { Person, Partnership, EmotionalLine, Triangle, PageNote } from '../types';

type DragGroupRef = MutableRefObject<{
  personId: string;
  startX: number;
  startY: number;
  selectedIds: string[];
  people: Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>;
  partnerships: Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>;
  emotionalLines: Map<string, { notesPosition?: { x: number; y: number } }>;
  pageNotes: Map<string, { x: number; y: number }>;
} | null>;

interface UseCanvasDragHandlersDeps {
  selectedPeopleIds: string[];
  selectedPageNoteIds: string[];
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines: EmotionalLine[];
  pageNotes: PageNote[];
  dragGroupRef: DragGroupRef;
  setPeopleAligned: (updater: (prev: Person[]) => Person[]) => void;
  setPartnerships: Dispatch<SetStateAction<Partnership[]>>;
  setEmotionalLines: Dispatch<SetStateAction<EmotionalLine[]>>;
  setTriangles: Dispatch<SetStateAction<Triangle[]>>;
  setPageNotes: Dispatch<SetStateAction<PageNote[]>>;
}

export function useCanvasDragHandlers({
  selectedPeopleIds,
  selectedPageNoteIds,
  people,
  partnerships,
  allEmotionalLines,
  pageNotes,
  dragGroupRef,
  setPeopleAligned,
  setPartnerships,
  setEmotionalLines,
  setTriangles,
  setPageNotes,
}: UseCanvasDragHandlersDeps) {
  const handlePersonDragStart = (personId: string, x: number, y: number) => {
    if (!selectedPeopleIds.includes(personId) || selectedPeopleIds.length < 2) {
      dragGroupRef.current = null;
      return;
    }

    const selectedIds = [...selectedPeopleIds];
    const peopleMap = new Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>();
    for (const person of people) {
      if (selectedIds.includes(person.id)) {
        peopleMap.set(person.id, {
          x: person.x,
          y: person.y,
          notesPosition: person.notesPosition ? { ...person.notesPosition } : undefined,
        });
      }
    }

    const partnershipsMap = new Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>();
    for (const partnership of partnerships) {
      if (selectedIds.includes(partnership.partner1_id) && selectedIds.includes(partnership.partner2_id)) {
        partnershipsMap.set(partnership.id, {
          horizontalConnectorY: partnership.horizontalConnectorY,
          notesPosition: partnership.notesPosition ? { ...partnership.notesPosition } : undefined,
        });
      }
    }

    const emotionalLinesMap = new Map<string, { notesPosition?: { x: number; y: number } }>();
    for (const emotionalLine of allEmotionalLines) {
      if (selectedIds.includes(emotionalLine.person1_id) && selectedIds.includes(emotionalLine.person2_id)) {
        emotionalLinesMap.set(emotionalLine.id, {
          notesPosition: emotionalLine.notesPosition ? { ...emotionalLine.notesPosition } : undefined,
        });
      }
    }

    const pageNotesMap = new Map<string, { x: number; y: number }>();
    for (const note of pageNotes) {
      if (selectedPageNoteIds.includes(note.id)) {
        pageNotesMap.set(note.id, { x: note.x, y: note.y });
      }
    }

    dragGroupRef.current = {
      personId,
      startX: x,
      startY: y,
      selectedIds,
      people: peopleMap,
      partnerships: partnershipsMap,
      emotionalLines: emotionalLinesMap,
      pageNotes: pageNotesMap,
    };
  };

  const handlePersonDrag = (personId: string, x: number, y: number) => {
    const dragGroup = dragGroupRef.current;
    if (dragGroup && dragGroup.personId === personId) {
      const dx = x - dragGroup.startX;
      const dy = y - dragGroup.startY;

      setPeopleAligned((prev) =>
        prev.map((person) => {
          const base = dragGroup.people.get(person.id);
          if (!base) return person;
          return {
            ...person,
            x: base.x + dx,
            y: base.y + dy,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : person.notesPosition,
          };
        })
      );

      setPartnerships((prev) =>
        prev.map((partnership) => {
          const base = dragGroup.partnerships.get(partnership.id);
          if (!base) return partnership;
          return {
            ...partnership,
            horizontalConnectorY: base.horizontalConnectorY + dy,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : partnership.notesPosition,
          };
        })
      );

      setEmotionalLines((prev) =>
        prev.map((line) => {
          const base = dragGroup.emotionalLines.get(line.id);
          if (!base) return line;
          return {
            ...line,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : line.notesPosition,
          };
        })
      );
      setTriangles((prev) =>
        prev.map((triangle) => {
          if (!triangle.tpls?.length) return triangle;
          let changed = false;
          const nextTpls = triangle.tpls.map((tpl) => {
            const base = dragGroup.emotionalLines.get(tpl.id);
            if (!base) return tpl;
            changed = true;
            return {
              ...tpl,
              notesPosition: base.notesPosition
                ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
                : tpl.notesPosition,
            };
          });
          return changed ? { ...triangle, tpls: nextTpls } : triangle;
        })
      );

      if (dragGroup.pageNotes.size > 0) {
        setPageNotes((prev) =>
          prev.map((note) => {
            const base = dragGroup.pageNotes.get(note.id);
            if (!base) return note;
            return { ...note, x: base.x + dx, y: base.y + dy };
          })
        );
      }
      return;
    }

    setPeopleAligned((prev) =>
      prev.map((person) => (person.id === personId ? { ...person, x, y } : person))
    );
  };

  const handleHorizontalConnectorDragEnd = (partnershipId: string, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, horizontalConnectorY: y } : p
      )
    );
  };

  const handlePersonNoteDragEnd = (personId: string, x: number, y: number) => {
    setPeopleAligned((prev) =>
      prev.map((person) =>
        person.id === personId ? { ...person, notesPosition: { x, y } } : person
      )
    );
  };

  const handlePersonNoteResizeEnd = (personId: string, width: number, height: number) => {
    setPeopleAligned((prev) =>
      prev.map((person) =>
        person.id === personId ? { ...person, notesSize: { width, height } } : person
      )
    );
  };

  const handlePartnershipNoteDragEnd = (partnershipId: string, x: number, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, notesPosition: { x, y } } : p
      )
    );
  };

  const handlePartnershipNoteResizeEnd = (partnershipId: string, width: number, height: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, notesSize: { width, height } } : p
      )
    );
  };

  const handleEmotionalLineNoteDragEnd = (emotionalLineId: string, x: number, y: number) => {
    setEmotionalLines((prev) =>
      prev.map((el) => (el.id === emotionalLineId ? { ...el, notesPosition: { x, y } } : el))
    );
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          if (tpl.id !== emotionalLineId) return tpl;
          changed = true;
          return { ...tpl, notesPosition: { x, y } };
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
  };

  const handleEmotionalLineNoteResizeEnd = (emotionalLineId: string, width: number, height: number) => {
    setEmotionalLines((prev) =>
      prev.map((el) => (el.id === emotionalLineId ? { ...el, notesSize: { width, height } } : el))
    );
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          if (tpl.id !== emotionalLineId) return tpl;
          changed = true;
          return { ...tpl, notesSize: { width, height } };
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
  };

  return {
    handlePersonDragStart,
    handlePersonDrag,
    handleHorizontalConnectorDragEnd,
    handlePersonNoteDragEnd,
    handlePersonNoteResizeEnd,
    handlePartnershipNoteDragEnd,
    handlePartnershipNoteResizeEnd,
    handleEmotionalLineNoteDragEnd,
    handleEmotionalLineNoteResizeEnd,
  };
}
