import type { Dispatch, SetStateAction } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  EmotionalProcessEvent,
  EventClass,
} from '../types';
import type {
  PropertiesPanelIntent,
  PersonSectionPopupState,
  PartnershipSectionPopupState,
  ClientProfileDraft,
  CoachThinkingDraft,
} from '../types/diagramEditor';
import { nanoid } from 'nanoid';
import { normalizeEmotionalLine } from '../utils/emotionalLineNormalization';

const STYLE_ONLY_FIELDS = new Set<keyof Person>([
  'size',
  'borderColor',
  'borderEnabled',
  'foregroundColor',
  'foregroundEnabled',
  'backgroundColor',
  'backgroundEnabled',
  'functionalIndicators',
]);

const isStyleOnlyUpdate = (updates: Partial<Person>) => {
  const keys = Object.keys(updates) as (keyof Person)[];
  if (!keys.length) return false;
  return keys.every((key) => STYLE_ONLY_FIELDS.has(key));
};

interface UseUpdateHandlersDeps {
  people: Person[];
  coachThinkingDraft: CoachThinkingDraft | null;
  clientProfileDraft: ClientProfileDraft | null;
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPeopleAligned: (updater: (prev: Person[]) => Person[]) => void;
  setPartnerships: Dispatch<SetStateAction<Partnership[]>>;
  setEmotionalLines: Dispatch<SetStateAction<EmotionalLine[]>>;
  setTriangles: Dispatch<SetStateAction<Triangle[]>>;
  setCoachThinkingDraft: Dispatch<SetStateAction<CoachThinkingDraft | null>>;
  setClientProfileDraft: Dispatch<SetStateAction<ClientProfileDraft | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
  setPropertiesPanelIntent: Dispatch<SetStateAction<PropertiesPanelIntent>>;
  setPersonSectionPopup: Dispatch<SetStateAction<PersonSectionPopupState>>;
  setPartnershipSectionPopup: Dispatch<SetStateAction<PartnershipSectionPopupState>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
}

export function useUpdateHandlers({
  people,
  coachThinkingDraft,
  clientProfileDraft,
  setPeople,
  setPeopleAligned,
  setPartnerships,
  setEmotionalLines,
  setTriangles,
  setCoachThinkingDraft,
  setClientProfileDraft,
  setPropertiesPanelItem,
  setPropertiesPanelIntent,
  setPersonSectionPopup,
  setPartnershipSectionPopup,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
}: UseUpdateHandlersDeps) {
  const handleUpdatePerson = (personId: string, updatedProps: Partial<Person>) => {
    console.log('Updating person:', personId, updatedProps);
    const updater = (prev: Person[]) =>
      prev.map((p) => (p.id === personId ? { ...p, ...updatedProps } : p));
    if (isStyleOnlyUpdate(updatedProps)) {
      setPeople((prev) => updater(prev));
    } else {
      setPeopleAligned((prev) => updater(prev));
    }
    setPropertiesPanelItem((prev) => {
      if (prev && prev.id === personId && 'name' in prev) {
        return { ...prev, ...updatedProps };
      }
      return prev;
    });
  };

  const openClientProfileModal = (person: Person) => {
    setClientProfileDraft({
      personId: person.id,
      personName: person.name || '',
      clientColor: person.backgroundColor || '#FFF7C2',
      presentingIssue1: person.clientProfile?.presentingIssue1 || '',
      presentingIssue2: person.clientProfile?.presentingIssue2 || '',
      presentingIssue3: person.clientProfile?.presentingIssue3 || '',
      desiredOutcome1: person.clientProfile?.desiredOutcome1 || '',
      desiredOutcome2: person.clientProfile?.desiredOutcome2 || '',
      desiredOutcome3: person.clientProfile?.desiredOutcome3 || '',
      conceptualization: person.clientProfile?.conceptualization || '',
    });
  };

  const openCoachThinkingModal = (person: Person) => {
    setCoachThinkingDraft({
      personId: person.id,
      personName: person.name || '',
      thinking: person.coachThinking?.thinking || '',
      notes: person.coachThinking?.notes || '',
    });
  };

  const updateCoachThinkingField = (field: 'thinking' | 'notes', value: string) => {
    setCoachThinkingDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveCoachThinkingDraft = () => {
    if (!coachThinkingDraft) return;
    handleUpdatePerson(coachThinkingDraft.personId, {
      coachThinking: {
        thinking: coachThinkingDraft.thinking.trim(),
        notes: coachThinkingDraft.notes.trim(),
        updatedAt: Date.now(),
      },
    });
    setCoachThinkingDraft(null);
  };

  const updateClientProfileDraftField = (
    field: keyof Omit<ClientProfileDraft, 'personId' | 'personName'>,
    value: string
  ) => {
    setClientProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveClientProfileDraft = () => {
    if (!clientProfileDraft) return;
    handleUpdatePerson(clientProfileDraft.personId, {
      isClient: true,
      backgroundEnabled: true,
      backgroundColor: clientProfileDraft.clientColor || '#FFF7C2',
      clientProfile: {
        presentingIssue1: clientProfileDraft.presentingIssue1.trim(),
        presentingIssue2: clientProfileDraft.presentingIssue2.trim(),
        presentingIssue3: clientProfileDraft.presentingIssue3.trim(),
        desiredOutcome1: clientProfileDraft.desiredOutcome1.trim(),
        desiredOutcome2: clientProfileDraft.desiredOutcome2.trim(),
        desiredOutcome3: clientProfileDraft.desiredOutcome3.trim(),
        conceptualization: clientProfileDraft.conceptualization.trim(),
      },
    });
    setClientProfileDraft(null);
  };

  const handleBatchUpdatePersons = (personIds: string[], updatedProps: Partial<Person>) => {
    if (!personIds.length) return;
    const updater = (prev: Person[]) =>
      prev.map((person) =>
        personIds.includes(person.id) ? { ...person, ...updatedProps } : person
      );
    if (isStyleOnlyUpdate(updatedProps)) {
      setPeople((prev) => updater(prev));
    } else {
      setPeopleAligned((prev) => updater(prev));
    }
    setPropertiesPanelItem((prev) => {
      if (prev && 'name' in prev && personIds.includes(prev.id)) {
        return { ...prev, ...updatedProps };
      }
      return prev;
    });
  };

  const handleUpdatePartnership = (partnershipId: string, updatedProps: Partial<Partnership>) => {
    setPartnerships((prev) =>
      prev.map((p) => (p.id === partnershipId ? { ...p, ...updatedProps } : p))
    );
    setPropertiesPanelItem((prev) => {
      if (prev && prev.id === partnershipId && 'partner1_id' in prev) {
        return { ...prev, ...updatedProps };
      }
      return prev;
    });
  };

  const handleUpdateEmotionalLine = (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => {
    console.log('Updating emotional line:', emotionalLineId, updatedProps);
    setEmotionalLines((prev) =>
      prev.map((el) => (el.id !== emotionalLineId ? el : normalizeEmotionalLine({ ...el, ...updatedProps })))
    );
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          if (tpl.id !== emotionalLineId) return tpl;
          changed = true;
          return normalizeEmotionalLine({ ...tpl, ...updatedProps });
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
    setPropertiesPanelItem((prev) => {
      if (prev && prev.id === emotionalLineId && 'lineStyle' in prev) {
        return normalizeEmotionalLine({ ...prev, ...updatedProps });
      }
      return prev;
    });
  };

  const getEventClassForTargetType = (type: 'person' | 'partnership' | 'emotional'): EventClass =>
    type === 'person' ? 'individual' : type === 'partnership' ? 'relationship' : 'emotional-pattern';

  const focusItemInPropertiesPanel = (
    item: Person | Partnership | EmotionalLine,
    intent?: {
      tab?: 'properties' | 'functional' | 'events';
      personSection?: 'name' | 'dates' | 'format' | 'sibling' | 'foo';
      focusEventId?: string;
      openNewEventRequestId?: string;
      newEventSeed?: Partial<EmotionalProcessEvent>;
      openNewEventPosition?: { x: number; y: number };
    }
  ) => {
    setPropertiesPanelItem(item);
    if (intent) {
      setPropertiesPanelIntent({
        targetId: item.id,
        tab: intent.tab,
        personSection: intent.personSection,
        focusEventId: intent.focusEventId,
        openNewEventRequestId: intent.openNewEventRequestId,
        newEventSeed: intent.newEventSeed,
        openNewEventPosition: intent.openNewEventPosition,
      });
    } else {
      setPropertiesPanelIntent(null);
    }
  };

  const openPersonSectionPopup = (
    person: Person,
    section: 'name' | 'dates' | 'format' | 'sibling' | 'foo',
    x: number,
    y: number
  ) => {
    setPropertiesPanelItem(null);
    setPropertiesPanelIntent(null);
    setPersonSectionPopup({ personId: person.id, section, x, y });
  };

  const openPartnershipSectionPopup = (
    partnership: Partnership,
    relationshipType: string,
    x: number,
    y: number
  ) => {
    setPersonSectionPopup(null);
    setPropertiesPanelItem(null);
    setPropertiesPanelIntent(null);
    setPartnershipSectionPopup({ partnershipId: partnership.id, relationshipType, x, y });
  };

  const openContextualEventCreator = (
    target: { type: 'person' | 'partnership' | 'emotional'; id: string },
    targetItem: Person | Partnership | EmotionalLine,
    seed?: Partial<EmotionalProcessEvent>,
    popupPosition?: { x: number; y: number }
  ) => {
    const anchorType =
      target.type === 'person'
        ? 'PERSON'
        : target.type === 'partnership'
        ? 'RELATIONSHIP_PRL'
        : 'EMOTIONAL_PROCESS_EP';
    const eventType = seed?.eventType || (target.type === 'emotional' ? 'EPE' : 'NODAL');
    const baseSeed: Partial<EmotionalProcessEvent> = {
      ...seed,
      eventType,
      anchorType,
      anchorId: target.id,
      eventClass: getEventClassForTargetType(target.type),
      date: seed?.date || new Date().toISOString().slice(0, 10),
      startDate: seed?.startDate || seed?.date || new Date().toISOString().slice(0, 10),
    };
    if (target.type === 'person') {
      const person = targetItem as Person;
      setSelectedPeopleIds([person.id]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      focusItemInPropertiesPanel(person, {
        tab: 'events',
        openNewEventRequestId: nanoid(),
        openNewEventPosition: popupPosition,
        newEventSeed: {
          ...baseSeed,
          primaryPersonName: person.name || '',
        },
      });
      return;
    }
    if (target.type === 'partnership') {
      const partnership = targetItem as Partnership;
      const partner1 = people.find((p) => p.id === partnership.partner1_id);
      const partner2 = people.find((p) => p.id === partnership.partner2_id);
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(partnership.id);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      focusItemInPropertiesPanel(partnership, {
        tab: 'events',
        openNewEventRequestId: nanoid(),
        openNewEventPosition: popupPosition,
        newEventSeed: {
          ...baseSeed,
          category: seed?.category || 'Relationship',
          primaryPersonName: partner1?.name || '',
          otherPersonName: partner2?.name || '',
        },
      });
      return;
    }
    const line = targetItem as EmotionalLine;
    const person1 = people.find((p) => p.id === line.person1_id);
    const person2 = people.find((p) => p.id === line.person2_id);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(line.id);
    setSelectedChildId(null);
    focusItemInPropertiesPanel(line, {
      tab: 'events',
      openNewEventRequestId: nanoid(),
      openNewEventPosition: popupPosition,
      newEventSeed: {
        ...baseSeed,
        eventType: 'EPE',
        category: seed?.category || 'Emotional Pattern',
        primaryPersonName: person1?.name || '',
        otherPersonName: person2?.name || '',
      },
    });
  };

  return {
    handleUpdatePerson,
    handleBatchUpdatePersons,
    handleUpdatePartnership,
    handleUpdateEmotionalLine,
    getEventClassForTargetType,
    focusItemInPropertiesPanel,
    openPersonSectionPopup,
    openPartnershipSectionPopup,
    openContextualEventCreator,
    openClientProfileModal,
    openCoachThinkingModal,
    updateCoachThinkingField,
    saveCoachThinkingDraft,
    updateClientProfileDraftField,
    saveClientProfileDraft,
  };
}
