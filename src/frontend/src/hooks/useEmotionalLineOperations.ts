import type { Dispatch, SetStateAction } from 'react';
import type { Person, Partnership, EmotionalLine, Triangle, EmotionalProcessEvent } from '../types';
import type { EmotionalPatternDraft } from '../types/diagramEditor';
import { nanoid } from 'nanoid';
import { normalizeEmotionalLine, buildDefaultTpl } from '../utils/emotionalLineNormalization';
import { DEFAULT_LINE_COLOR, intensityValueForLineStyle } from '../utils/emotionalPatternOptions';

interface UseEmotionalLineOperationsDeps {
  people: Person[];
  triangles: Triangle[];
  emotionalLines: EmotionalLine[];
  emotionalPatternDraft: EmotionalPatternDraft | null;
  setEmotionalLines: Dispatch<SetStateAction<EmotionalLine[]>>;
  setTriangles: Dispatch<SetStateAction<Triangle[]>>;
  setEmotionalPatternDraft: Dispatch<SetStateAction<EmotionalPatternDraft | null>>;
  setEmotionalPatternModalOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; items: any[] } | null>>;
}

export function useEmotionalLineOperations({
  people,
  triangles,
  emotionalLines,
  emotionalPatternDraft,
  setEmotionalLines,
  setTriangles,
  setEmotionalPatternDraft,
  setEmotionalPatternModalOpen,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
  setPropertiesPanelItem,
  setContextMenu,
}: UseEmotionalLineOperationsDeps) {
  const addEmotionalLine = (
    person1_id: string,
    person2_id: string,
    relationshipType: EmotionalLine['relationshipType'],
    lineStyle: EmotionalLine['lineStyle'],
    lineEnding: EmotionalLine['lineEnding']
  ) => {
    const newEmotionalLine: EmotionalLine = {
      id: nanoid(),
      person1_id,
      person2_id,
      status: 'ongoing',
      relationshipType,
      lineStyle,
      lineEnding,
      startDate: new Date().toISOString().slice(0, 10),
      color: DEFAULT_LINE_COLOR,
      events: [],
    };
    setEmotionalLines((prev) => [...prev, newEmotionalLine]);
    return newEmotionalLine;
  };

  const openAddEmotionalPatternModal = (person1Id: string, person2Id: string) => {
    setEmotionalPatternDraft({
      person1Id,
      person2Id,
      relationshipType: 'fusion',
      status: 'ongoing',
      lineStyle: 'fusion-dotted-wide',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      intensityLevel: intensityValueForLineStyle('fusion-dotted-wide'),
      frequency: 0,
      impact: 0,
      notes: '',
      color: DEFAULT_LINE_COLOR,
      adequatePersonId: '',
    });
    setEmotionalPatternModalOpen(true);
  };

  const updateEmotionalPatternDraft = (updates: Partial<EmotionalPatternDraft>) => {
    setEmotionalPatternDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const saveAddEmotionalPattern = () => {
    if (!emotionalPatternDraft) return;
    const {
      person1Id,
      person2Id,
      relationshipType,
      status,
      lineStyle,
      startDate,
      endDate,
      intensityLevel,
      frequency,
      impact,
      notes,
      color,
      adequatePersonId,
    } = emotionalPatternDraft;
    const newEmotionalLine = addEmotionalLine(person1Id, person2Id, relationshipType, lineStyle, 'none');
    const person1 = people.find((person) => person.id === person1Id);
    const person2 = people.find((person) => person.id === person2Id);
    const start = startDate || new Date().toISOString().slice(0, 10);
    const seededEvent: EmotionalProcessEvent = {
      id: nanoid(),
      date: start,
      startDate: start,
      endDate: endDate || undefined,
      category: 'Emotional Pattern',
      eventType: 'EPE',
      anchorType: 'EMOTIONAL_PROCESS_EP',
      anchorId: newEmotionalLine.id,
      status: (status as any) || 'ongoing',
      intensity: intensityLevel,
      frequency,
      impact,
      howWell: 5,
      otherPersonName: person2?.name || '',
      primaryPersonName: person1?.name || '',
      wwwwh: '',
      observations: notes || '',
      eventClass: 'emotional-pattern',
      createdAt: Date.now(),
    };
    const updatedLine: EmotionalLine = normalizeEmotionalLine({
      ...newEmotionalLine,
      status,
      startDate: start,
      endDate: endDate || undefined,
      notes: notes || undefined,
      color: color || DEFAULT_LINE_COLOR,
      adequatePersonId: adequatePersonId || undefined,
      events: [seededEvent],
    });
    setEmotionalLines((prev) =>
      prev.map((line) => (line.id === updatedLine.id ? updatedLine : line))
    );
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(updatedLine.id);
    setSelectedChildId(null);
    setPropertiesPanelItem(updatedLine);
    setEmotionalPatternModalOpen(false);
    setEmotionalPatternDraft(null);
    setContextMenu(null);
  };

  const removeEmotionalLine = (emotionalLineId: string) => {
    setEmotionalLines(emotionalLines.filter((el) => el.id !== emotionalLineId));
    setContextMenu(null);
  };

  const addTriangle = (personIds: string[]) => {
    if (personIds.length !== 3) return;
    const uniqueIds = [...new Set(personIds)];
    if (uniqueIds.length !== 3) return;
    const key = [...uniqueIds].sort().join('::');
    const existing = triangles.find(
      (triangle) =>
        [triangle.person1_id, triangle.person2_id, triangle.person3_id].sort().join('::') === key
    );
    if (existing) {
      setSelectedPeopleIds([]);
      return;
    }
    const [person1_id, person2_id, person3_id] = uniqueIds;
    const newTriangle: Triangle = {
      id: nanoid(),
      person1_id,
      person2_id,
      person3_id,
      color: '#8a5a00',
      intensity: 'medium',
      tpls: [
        buildDefaultTpl(person1_id, person2_id, '#8a5a00'),
        buildDefaultTpl(person2_id, person3_id, '#8a5a00'),
        buildDefaultTpl(person3_id, person1_id, '#8a5a00'),
      ],
    };
    setTriangles((prev) => [...prev, newTriangle]);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
  };

  const removeTriangle = (triangleId: string) => {
    setTriangles((prev) => prev.filter((triangle) => triangle.id !== triangleId));
    setContextMenu(null);
  };

  const updateTriangle = (triangleId: string, updates: Partial<import('../types').Triangle>) => {
    setTriangles((prev) =>
      prev.map((t) => (t.id === triangleId ? { ...t, ...updates } : t))
    );
  };

  const updateTriangleColor = (triangleId: string, color: string) => {
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (triangle.id !== triangleId) return triangle;
        return { ...triangle, color };
      })
    );
  };

  const updateTriangleIntensity = (
    triangleId: string,
    intensity: 'low' | 'medium' | 'high'
  ) => {
    setTriangles((prev) =>
      prev.map((triangle) =>
        triangle.id === triangleId ? { ...triangle, intensity } : triangle
      )
    );
  };

  return {
    addEmotionalLine,
    openAddEmotionalPatternModal,
    updateEmotionalPatternDraft,
    saveAddEmotionalPattern,
    removeEmotionalLine,
    addTriangle,
    removeTriangle,
    updateTriangle,
    updateTriangleColor,
    updateTriangleIntensity,
  };
}
