import React, { useEffect, useMemo, useState } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  PersonFunctionalIndicator,
} from '../types';

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';

interface PropertiesPanelProps {
  selectedItem: Person | Partnership | EmotionalLine;
  people: Person[];
  eventCategories: string[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  onUpdatePartnership: (partnershipId: string, updatedProps: Partial<Partnership>) => void;
  onUpdateEmotionalLine: (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => void;
  onClose: () => void;
}

const PropertiesPanel = ({
  selectedItem,
  people,
  eventCategories,
  functionalIndicatorDefinitions,
  onUpdatePerson,
  onUpdatePartnership,
  onUpdateEmotionalLine,
  onClose,
}: PropertiesPanelProps) => {
  const isPerson = 'name' in selectedItem;
  const isPartnership = 'partner1_id' in selectedItem && 'children' in selectedItem;
  const isEmotionalLine = 'lineStyle' in selectedItem;
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<EmotionalProcessEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'properties' | 'functional' | 'events'>('properties');
  const selectedPerson = isPerson ? (selectedItem as Person) : null;
  const selectedPartnership = isPartnership ? (selectedItem as Partnership) : null;
  const selectedEmotionalLine = isEmotionalLine ? (selectedItem as EmotionalLine) : null;
  const nameFallbackParts = useMemo(() => {
    if (!selectedPerson) {
      return { first: '', last: '' };
    }
    const base = (selectedPerson.name || '').trim();
    if (!base) return { first: '', last: '' };
    const segments = base.split(/\s+/).filter(Boolean);
    const first = segments.shift() || '';
    const last = segments.join(' ');
    return { first, last };
  }, [selectedPerson]);
  const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };

  useEffect(() => {
    setEventModalOpen(false);
    setEventDraft(null);
    setActiveTab('properties');
  }, [selectedItem.id]);

  const composeDisplayName = (overrides: Partial<Person> = {}) => {
    if (!selectedPerson) return '';
    const first =
      overrides.firstName !== undefined
        ? overrides.firstName
        : selectedPerson.firstName ?? nameFallbackParts.first;
    const last =
      overrides.lastName !== undefined
        ? overrides.lastName
        : selectedPerson.lastName ?? nameFallbackParts.last;
    const fallback =
      overrides.name !== undefined ? overrides.name : selectedPerson.name || '';
    const combined = [first?.trim(), last?.trim()].filter(Boolean).join(' ').trim();
    return combined || fallback;
  };

  const sanitizePersonIndicators = (
    indicators: PersonFunctionalIndicator[] | undefined,
    definitionId: string,
    next: PersonFunctionalIndicator | null
  ) => {
    const existing = indicators || [];
    const remaining = existing.filter((entry) => entry.definitionId !== definitionId);
    if (!next) {
      return remaining.length ? remaining : undefined;
    }
    return [...remaining, next];
  };

  const handleIndicatorStatusChange = (
    definitionId: string,
    status: 'past' | 'current' | 'none'
  ) => {
    const person = selectedItem as Person;
    if (status === 'none') {
      const nextIndicators = sanitizePersonIndicators(person.functionalIndicators, definitionId, null);
      onUpdatePerson(person.id, { functionalIndicators: nextIndicators });
      return;
    }
    const existing = person.functionalIndicators?.find((entry) => entry.definitionId === definitionId);
    const nextEntry: PersonFunctionalIndicator = {
      definitionId,
      status,
      impact: existing?.impact ?? 1,
    };
    const nextIndicators = sanitizePersonIndicators(person.functionalIndicators, definitionId, nextEntry);
    onUpdatePerson(person.id, { functionalIndicators: nextIndicators });
  };

  const handleIndicatorImpactChange = (definitionId: string, impactValue: number) => {
    const person = selectedItem as Person;
    if (Number.isNaN(impactValue)) return;
    const clamped = Math.max(0, Math.min(9, impactValue));
    const existing = person.functionalIndicators?.find((entry) => entry.definitionId === definitionId);
    const baseEntry: PersonFunctionalIndicator =
      existing ?? { definitionId, status: 'current', impact: 1 };
    const nextEntry = { ...baseEntry, impact: clamped };
    const nextIndicators = sanitizePersonIndicators(person.functionalIndicators, definitionId, nextEntry);
    onUpdatePerson(person.id, { functionalIndicators: nextIndicators });
  };

  const handlePersonChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    let nextValue: any = value;
    if (isCheckbox) {
      nextValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'size') {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) {
        return;
      }
      nextValue = Math.max(20, Math.min(400, numericValue));
    }
    let updates: Partial<Person> = { [name]: nextValue };
    if (name === 'firstName' || name === 'lastName') {
      updates = { ...updates, name: composeDisplayName({ ...updates }) };
    }
    onUpdatePerson(selectedItem.id, updates);
  };

  const handlePartnershipChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onUpdatePartnership(selectedItem.id, { [e.target.name]: e.target.value as any });
  };

  const lineStyleValues: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle'][]> = {
    fusion: ['low', 'medium', 'high'],
    distance: ['dotted', 'dashed', 'long-dash'],
    cutoff: ['cutoff'],
    conflict: ['solid-saw-tooth', 'dotted-saw-tooth', 'double-saw-tooth'],
  };

  const styleOptionMeta = (relationshipType: EmotionalLine['relationshipType']) => {
    switch (relationshipType) {
      case 'fusion':
        return [
          { value: 'low', label: 'Low (dotted)' },
          { value: 'medium', label: 'Medium (short dash)' },
          { value: 'high', label: 'High (bold dash)' },
        ];
      case 'distance':
        return [
          { value: 'dotted', label: 'Low (dotted)' },
          { value: 'dashed', label: 'Medium (short dash)' },
          { value: 'long-dash', label: 'High (long dash)' },
        ];
      case 'conflict':
        return [
          { value: 'solid-saw-tooth', label: 'Low (solid sawtooth)' },
          { value: 'dotted-saw-tooth', label: 'Medium (dotted sawtooth)' },
          { value: 'double-saw-tooth', label: 'High (double sawtooth)' },
        ];
      default:
        return [{ value: 'cutoff', label: 'Cutoff' }];
    }
  };

  const handleEmotionalLineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'relationshipType') {
      const newRelationshipType = value as EmotionalLine['relationshipType'];
      const newLineStyle = lineStyleValues[newRelationshipType]?.[0] || 'low';
      onUpdateEmotionalLine(selectedItem.id, { 
        relationshipType: newRelationshipType,
        lineStyle: newLineStyle as EmotionalLine['lineStyle']
      });
    } else {
      switch (name) {
        case 'lineStyle':
          onUpdateEmotionalLine(selectedItem.id, { [name]: value as EmotionalLine['lineStyle'] });
          break;
        case 'lineEnding':
          onUpdateEmotionalLine(selectedItem.id, { [name]: value as EmotionalLine['lineEnding'] });
          break;
      }
    }
  };

  const handleEmotionalLineInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onUpdateEmotionalLine(selectedItem.id, { [e.target.name]: e.target.value });
  };

  const termLabel = () => {
    if (isPerson) return 'Person (Person Node)';
    if (isPartnership) return 'Partner Relationship Line (PRL)';
    if (isEmotionalLine) return 'Emotional Process Line (EPL)';
    return '';
  };

  const getEvents = () => {
    if (isPerson) return (selectedItem as Person).events || [];
    if (isPartnership) return (selectedItem as Partnership).events || [];
    return (selectedItem as EmotionalLine).events || [];
  };
  const emotionalLinePeople = useMemo(() => {
    if (!isEmotionalLine) return { person1Name: '', person2Name: '' };
    const line = selectedItem as EmotionalLine;
    const person1 = people.find((person) => person.id === line.person1_id);
    const person2 = people.find((person) => person.id === line.person2_id);
    return { person1Name: person1?.name || '', person2Name: person2?.name || '' };
  }, [isEmotionalLine, selectedItem, people]);
  const otherPersonOptions = useMemo(() => {
    if (isEmotionalLine) {
      return [emotionalLinePeople.person1Name, emotionalLinePeople.person2Name].filter(Boolean);
    }
    if (isPartnership) {
      const partnership = selectedItem as Partnership;
      const partner1 = people.find((person) => person.id === partnership.partner1_id);
      const partner2 = people.find((person) => person.id === partnership.partner2_id);
      return [partner1?.name || '', partner2?.name || ''].filter(Boolean);
    }
    if (isPerson) {
      const person = selectedItem as Person;
      return people.filter((p) => p.id !== person.id).map((p) => p.name).filter(Boolean);
    }
    return people.map((person) => person.name).filter(Boolean);
  }, [isEmotionalLine, isPartnership, selectedItem, people, emotionalLinePeople]);
  const primaryPersonOptions = useMemo(() => {
    if (isPerson) {
      const person = selectedItem as Person;
      return [person.name || ''].filter(Boolean);
    }
    if (isPartnership) {
      const partnership = selectedItem as Partnership;
      const partner1 = people.find((person) => person.id === partnership.partner1_id);
      const partner2 = people.find((person) => person.id === partnership.partner2_id);
      return [partner1?.name || '', partner2?.name || ''].filter(Boolean);
    }
    if (isEmotionalLine) {
      return [emotionalLinePeople.person1Name, emotionalLinePeople.person2Name].filter(Boolean);
    }
    return [];
  }, [isPerson, isPartnership, isEmotionalLine, selectedItem, people, emotionalLinePeople]);
  const sortedEvents = useMemo(() => {
    const events = [...getEvents()];
    const direction = eventSortOrder === 'asc' ? 1 : -1;
    events.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      if (aTime === bTime) return 0;
      return aTime > bTime ? direction : -direction;
    });
    return events;
  }, [selectedItem, eventSortOrder]);

  const createEventId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const openNewEvent = () => {
    setEventDraft({
      id: createEventId(),
      date: '',
      category: eventCategories[0] || '',
      intensity: 5,
      howWell: 5,
      otherPersonName: otherPersonOptions[0] || '',
      primaryPersonName: primaryPersonOptions[0] || '',
      wwwwh: '',
      observations: '',
      isNodalEvent: false,
    });
    setEventModalOpen(true);
  };

  const openEditEvent = (event: EmotionalProcessEvent) => {
    setEventDraft({
      ...event,
      category: event.category || eventCategories[0] || '',
      otherPersonName: event.otherPersonName || otherPersonOptions[0] || '',
      primaryPersonName: event.primaryPersonName || primaryPersonOptions[0] || '',
    });
    setEventModalOpen(true);
  };

  const handleEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    if (!eventDraft) return;
    if (field === 'intensity' || field === 'howWell') {
      const numeric = Number(value);
      setEventDraft({ ...eventDraft, [field]: Number.isNaN(numeric) ? 0 : numeric });
      return;
    }
    if (field === 'isNodalEvent') {
      setEventDraft({ ...eventDraft, isNodalEvent: value === 'true' });
      return;
    }
    setEventDraft({ ...eventDraft, [field]: value });
  };

  const saveEvent = () => {
    if (!eventDraft) return;
    const cleanedDraft = {
      ...eventDraft,
      otherPersonName: eventDraft.otherPersonName || otherPersonOptions[0] || '',
      primaryPersonName: eventDraft.primaryPersonName || primaryPersonOptions[0] || '',
    };
    const events = getEvents();
    const existingIndex = events.findIndex((evt) => evt.id === eventDraft.id);
    const nextEvents = existingIndex === -1
      ? [...events, cleanedDraft]
      : events.map((evt) => (evt.id === eventDraft.id ? cleanedDraft : evt));
    if (isPerson) {
      onUpdatePerson(selectedItem.id, { events: nextEvents });
    } else if (isPartnership) {
      onUpdatePartnership(selectedItem.id, { events: nextEvents });
    } else {
      onUpdateEmotionalLine(selectedItem.id, { events: nextEvents });
    }
    setEventModalOpen(false);
    setEventDraft(null);
  };

  const deleteEvent = (eventId: string) => {
    const nextEvents = getEvents().filter((evt) => evt.id !== eventId);
    if (isPerson) {
      onUpdatePerson(selectedItem.id, { events: nextEvents });
    } else if (isPartnership) {
      onUpdatePartnership(selectedItem.id, { events: nextEvents });
    } else {
      onUpdateEmotionalLine(selectedItem.id, { events: nextEvents });
    }
  };

  return (
    <div
      style={{
        background: '#f0f0f0',
        padding: '10px 20px 12px 12px',
        border: '1px solid #ccc',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>X</button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Functional Facts</div>
          <div style={{ fontSize: 11, color: '#555' }}>{termLabel()}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {(['properties', 'functional', 'events'] as const).map((tab) => {
          const disabled = tab === 'functional' && (!isPerson || functionalIndicatorDefinitions.length === 0);
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              disabled={disabled}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 6,
                border: isActive ? '2px solid #3f51b5' : '1px solid #bdbdbd',
                background: isActive ? '#e8eaf6' : '#fff',
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {tab === 'properties' && 'Person'}
              {tab === 'functional' && 'Indicators'}
              {tab === 'events' && 'Events'}
            </button>
          );
        })}
      </div>
      {activeTab === 'properties' && (
        <>
        {isPerson && selectedPerson && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={rowStyle}>
              <label htmlFor="firstName" style={labelStyle}>First Name:</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={selectedPerson.firstName ?? nameFallbackParts.first}
                onChange={handlePersonChange}
                style={{ width: '25ch', textAlign: 'left' }}
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="lastName" style={labelStyle}>Last Name:</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={selectedPerson.lastName ?? nameFallbackParts.last}
                onChange={handlePersonChange}
                style={{ width: '25ch', textAlign: 'left' }}
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="maidenName" style={labelStyle}>Maiden Name:</label>
              <input
                type="text"
                id="maidenName"
                name="maidenName"
                value={selectedPerson.maidenName ?? ''}
                onChange={handlePersonChange}
                style={{ width: '25ch', textAlign: 'left' }}
              />
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="size" style={labelStyle}>Size:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() =>
                  onUpdatePerson(selectedItem.id, {
                    size: Math.max(20, (selectedPerson.size ?? 60) - 1),
                  })
                }
                style={{ padding: '0 6px' }}
              >
                −
              </button>
              <input
                type="number"
                id="size"
                name="size"
                min={20}
                max={200}
                value={selectedPerson.size ?? 60}
                onChange={handlePersonChange}
                style={{ width: 60, textAlign: 'center' }}
              />
              <button
                type="button"
                onClick={() =>
                  onUpdatePerson(selectedItem.id, {
                    size: Math.min(200, (selectedPerson.size ?? 60) + 1),
                  })
                }
                style={{ padding: '0 6px' }}
              >
                +
              </button>
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="borderColor" style={labelStyle}>Border Color:</label>
            <input
              type="color"
              id="borderColor"
              name="borderColor"
              value={selectedPerson.borderColor ?? DEFAULT_BORDER_COLOR}
              onChange={handlePersonChange}
              style={{ width: 80 }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="backgroundEnabled" style={labelStyle}>Shaded Background:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="backgroundEnabled"
                name="backgroundEnabled"
                checked={selectedPerson.backgroundEnabled ?? false}
                onChange={handlePersonChange}
              />
              <span>Enabled</span>
            </div>
          </div>
          <div style={rowStyle}>
            <label htmlFor="backgroundColor" style={labelStyle}>Background Color:</label>
            <input
              type="color"
              id="backgroundColor"
              name="backgroundColor"
              value={selectedPerson.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
              onChange={handlePersonChange}
              disabled={!(selectedPerson.backgroundEnabled ?? false)}
              style={{ width: 80 }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="birthDate" style={labelStyle}>Birth Date:</label>
            <input
              type="text"
              id="birthDate"
              name="birthDate"
              placeholder="YYYY-MM-DD"
              value={selectedPerson.birthDate || ''}
              onChange={handlePersonChange}
              style={{ width: '11ch', textAlign: 'left' }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="deathDate" style={labelStyle}>Death Date:</label>
            <input
              type="text"
              id="deathDate"
              name="deathDate"
              placeholder="YYYY-MM-DD"
              value={selectedPerson.deathDate || ''}
              onChange={handlePersonChange}
              style={{ width: '11ch', textAlign: 'left' }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="adoptionStatus" style={labelStyle}>Adoption Status:</label>
            <select
              id="adoptionStatus"
              name="adoptionStatus"
              value={selectedPerson.adoptionStatus || 'biological'}
              onChange={handlePersonChange}
              style={{ width: 160 }}
            >
              <option value="biological">Biological</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <label htmlFor="notes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
            <textarea
              id="notes"
              name="notes"
              value={selectedPerson.notes || ''}
              onChange={handlePersonChange}
              rows={6}
              style={{ width: '100%', minHeight: '8rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="notesEnabled" style={labelStyle}>Notes Enabled:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="notesEnabled"
                name="notesEnabled"
                checked={selectedPerson.notesEnabled ?? false}
                onChange={handlePersonChange}
              />
            </div>
          </div>
        </div>
        )}
        {isPartnership && selectedPartnership && (
        <div>
          <div style={rowStyle}>
            <label htmlFor="relationshipType" style={labelStyle}>Relationship Type:</label>
            <select
              id="relationshipType" 
              name="relationshipType" 
              value={selectedPartnership.relationshipType} 
              onChange={handlePartnershipChange}
              style={{ width: 180 }}
            >
              <option value="married">Married</option>
              <option value="common-law">Common-law</option>
              <option value="living-together">Living Together</option>
              <option value="dating">Dating</option>
              <option value="affair">Affair</option>
              <option value="friendship">Friendship</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="relationshipStatus" style={labelStyle}>Relationship Status:</label>
            <select
              id="relationshipStatus" 
              name="relationshipStatus" 
              value={selectedPartnership.relationshipStatus} 
              onChange={handlePartnershipChange}
              style={{ width: 180 }}
            >
              <option value="married">Married</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
              <option value="started">Started</option>
              <option value="ended">Ended</option>
              <option value="ongoing">Ongoing</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label htmlFor="relationshipStartDate" style={labelStyle}>Relationship Start:</label>
            <input
              type="text"
              id="relationshipStartDate"
              name="relationshipStartDate"
              placeholder="YYYY-MM-DD"
              value={selectedPartnership.relationshipStartDate || ''}
              onChange={handlePartnershipChange}
              style={{ width: '11ch', textAlign: 'left' }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="marriedStartDate" style={labelStyle}>Married Start:</label>
            <input
              type="text"
              id="marriedStartDate"
              name="marriedStartDate"
              placeholder="YYYY-MM-DD"
              value={selectedPartnership.marriedStartDate || ''}
              onChange={handlePartnershipChange}
              style={{ width: '11ch', textAlign: 'left' }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="separationDate" style={labelStyle}>Separation Date:</label>
            <input
              type="text"
              id="separationDate"
              name="separationDate"
              placeholder="YYYY-MM-DD"
              value={selectedPartnership.separationDate || ''}
              onChange={handlePartnershipChange}
              style={{ width: '11ch', textAlign: 'left' }}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="divorceDate" style={labelStyle}>Divorce Date:</label>
            <input
              type="text"
              id="divorceDate"
              name="divorceDate"
              placeholder="YYYY-MM-DD"
              value={selectedPartnership.divorceDate || ''}
              onChange={handlePartnershipChange}
              style={{ width: '11ch', textAlign: 'left' }}
            />
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <label htmlFor="partnershipNotes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
            <textarea
              id="partnershipNotes"
              name="notes"
              value={selectedPartnership.notes || ''}
              onChange={handlePartnershipChange}
              rows={5}
              style={{ width: '100%', minHeight: '6rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
            />
          </div>
        </div>
        )}
        {isEmotionalLine && selectedEmotionalLine && (() => {
        const relationshipType = selectedEmotionalLine.relationshipType;
        const styleOptions = styleOptionMeta(relationshipType);
        const intensityTypes: EmotionalLine['relationshipType'][] = ['fusion', 'distance', 'conflict'];
        const lineStyleLabel = intensityTypes.includes(relationshipType) ? 'Intensity' : 'Line Style';

        const presetColors = ['#444444', '#FF1744', '#2979FF', '#00C853', '#FF9100', '#E040FB'];

        return (
          <div>
            <div style={rowStyle}>
              <label htmlFor="startDate" style={labelStyle}>Start Date:</label>
              <input
                type="text"
                id="startDate"
                name="startDate"
                placeholder="YYYY-MM-DD"
                value={selectedEmotionalLine.startDate || ''}
                onChange={handleEmotionalLineInputChange}
                style={{ width: '11ch', textAlign: 'left' }}
              />
            </div>
            <div style={rowStyle}>
              <label htmlFor="relationshipType" style={labelStyle}>Relationship Type:</label>
              <select
                id="relationshipType"
                name="relationshipType"
                value={selectedEmotionalLine.relationshipType}
                onChange={handleEmotionalLineChange}
                style={{ width: 180 }}
              >
                <option value="fusion">Fusion</option>
                <option value="distance">Distance</option>
                <option value="cutoff">Cutoff</option>
                <option value="conflict">Conflict</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label htmlFor="lineStyle" style={labelStyle}>{lineStyleLabel}:</label>
              <select
                id="lineStyle"
                name="lineStyle"
                value={selectedEmotionalLine.lineStyle}
                onChange={handleEmotionalLineChange}
                style={{ width: 180 }}
              >
                {styleOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div style={rowStyle}>
              <label htmlFor="lineEnding" style={labelStyle}>Line Ending:</label>
              <select
                id="lineEnding"
                name="lineEnding"
                value={selectedEmotionalLine.lineEnding}
                onChange={handleEmotionalLineChange}
                style={{ width: 220 }}
              >
                <option value="none">None</option>
                <option value="arrow-p1-to-p2">Arrow (Person 1 to 2)</option>
                <option value="arrow-p2-to-p1">Arrow (Person 2 to 1)</option>
                <option value="arrow-bidirectional">Arrow (Bidirectional)</option>
                <option value="perpendicular-p1">Perpendicular (Person 1)</option>
                <option value="perpendicular-p2">Perpendicular (Person 2)</option>
                <option value="double-perpendicular-p1">Double Perpendicular (Person 1)</option>
                <option value="double-perpendicular-p2">Double Perpendicular (Person 2)</option>
              </select>
            </div>
            <div style={{ ...rowStyle, alignItems: 'center' }}>
              <label htmlFor="lineColor" style={labelStyle}>Color:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  id="lineColor"
                  name="color"
                  value={selectedEmotionalLine.color || '#444444'}
                  onChange={handleEmotionalLineInputChange}
                  style={{ width: 60 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  {presetColors.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => onUpdateEmotionalLine(selectedItem.id, { color: hex })}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '1px solid #ccc',
                        background: hex,
                        cursor: 'pointer',
                      }}
                      aria-label={`Set color ${hex}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <label htmlFor="emotionalNotes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
              <textarea
                id="emotionalNotes"
                name="notes"
                value={selectedEmotionalLine.notes || ''}
                onChange={handleEmotionalLineInputChange}
                rows={5}
                style={{ width: '100%', minHeight: '6rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
              />
            </div>
          </div>
        );
        })()}
        </>
      )}
      {activeTab === 'functional' && (
        isPerson && selectedPerson ? (
          functionalIndicatorDefinitions.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <strong>Functional Indicators</strong>
              {functionalIndicatorDefinitions.map((definition) => {
                const entry = selectedPerson.functionalIndicators?.find((fi) => fi.definitionId === definition.id);
                const statusValue = entry?.status ?? 'none';
                const impactValue = entry?.impact ?? 0;
                return (
                  <div
                    key={definition.id}
                    style={{
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      padding: 8,
                      marginTop: 6,
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{definition.label}</span>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        {statusValue === 'none' ? 'Not tracked' : `${statusValue === 'current' ? 'Current' : 'Past'} · Impact ${impactValue}`}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <label htmlFor={`indicator-status-${definition.id}`} style={{ fontSize: 12 }}>
                        Status:
                      </label>
                      <select
                        id={`indicator-status-${definition.id}`}
                        value={statusValue}
                        onChange={(e) =>
                          handleIndicatorStatusChange(
                            definition.id,
                            e.target.value as 'past' | 'current' | 'none'
                          )
                        }
                        style={{ width: 110 }}
                      >
                        <option value="none">None</option>
                        <option value="current">Current</option>
                        <option value="past">Past</option>
                      </select>
                      <label htmlFor={`indicator-impact-${definition.id}`} style={{ fontSize: 12 }}>
                        Impact:
                      </label>
                      <input
                        type="number"
                        id={`indicator-impact-${definition.id}`}
                        min={0}
                        max={9}
                        value={impactValue}
                        disabled={statusValue === 'none'}
                        onChange={(e) => handleIndicatorImpactChange(definition.id, Number(e.target.value))}
                        style={{ width: 60 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>No functional indicators defined. Use the settings dialog to add some.</div>
          )
        ) : (
          <div style={{ marginTop: 12 }}>Functional indicators apply only to Person nodes.</div>
        )
      )}
      {activeTab === 'events' && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <strong>Emotional Process Events</strong>
            <button onClick={openNewEvent}>Add Event</button>
          </div>
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="eventSortOrder">Sort: </label>
            <select
              id="eventSortOrder"
              value={eventSortOrder}
              onChange={(e) => setEventSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="asc">Date Asc</option>
              <option value="desc">Date Desc</option>
            </select>
          </div>
          {sortedEvents.length === 0 ? (
            <div style={{ marginTop: 6, fontStyle: 'italic' }}>No events yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
              {sortedEvents.map((event) => (
                <li
                  key={event.id}
                  style={{
                    borderBottom: '1px solid #ddd',
                    padding: '10px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600 }}>
                      {event.category || 'Event'} · {event.date || 'No date'}
                    </span>
                    {event.isNodalEvent && <span style={{ fontSize: 12, color: '#b00020' }}>Nodal Event</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#444', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span>Primary: {event.primaryPersonName || '—'}</span>
                    <span>Other: {event.otherPersonName || '—'}</span>
                    <span>Intensity {event.intensity}</span>
                    <span>How well {event.howWell}</span>
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                    <button onClick={() => openEditEvent(event)} style={{ marginRight: 6 }}>Edit</button>
                    <button onClick={() => deleteEvent(event.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {eventModalOpen && eventDraft && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <div style={{ background: 'white', padding: 20, borderRadius: 10, width: 420 }}>
            <h4 style={{ marginTop: 0 }}>{eventDraft.date ? 'Edit Event' : 'New Event'}</h4>
            {(() => {
              const rowStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 8,
              };
              const labelStyle: React.CSSProperties = { width: 170, textAlign: 'right', fontWeight: 600 };
              const controlStyle: React.CSSProperties = { width: '60%' };
              return (
                <>
                  <div style={rowStyle}>
                    <label htmlFor="eventPrimaryPerson" style={labelStyle}>Primary Person:</label>
                    <div style={controlStyle}>
                      <input
                        type="text"
                        id="eventPrimaryPerson"
                        list="eventPrimaryPersonOptions"
                        value={eventDraft.primaryPersonName || ''}
                        onChange={(e) => handleEventDraftChange('primaryPersonName', e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <datalist id="eventPrimaryPersonOptions">
                        {primaryPersonOptions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventDate" style={labelStyle}>Date:</label>
                    <input
                      type="date"
                      id="eventDate"
                      value={eventDraft.date}
                      onChange={(e) => handleEventDraftChange('date', e.target.value)}
                      style={controlStyle}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventCategory" style={labelStyle}>Category:</label>
                    <select
                      id="eventCategory"
                      value={eventDraft.category}
                      onChange={(e) => handleEventDraftChange('category', e.target.value)}
                      style={controlStyle}
                    >
                      {eventCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventIntensity" style={labelStyle}>Intensity (1-10):</label>
                    <input
                      type="number"
                      id="eventIntensity"
                      min={1}
                      max={10}
                      value={eventDraft.intensity}
                      onChange={(e) => handleEventDraftChange('intensity', e.target.value)}
                      style={controlStyle}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventHowWell" style={labelStyle}>How well (1-9):</label>
                    <input
                      type="number"
                      id="eventHowWell"
                      min={1}
                      max={9}
                      value={eventDraft.howWell}
                      onChange={(e) => handleEventDraftChange('howWell', e.target.value)}
                      style={controlStyle}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventOtherPerson" style={labelStyle}>Other Person:</label>
                    <div style={controlStyle}>
                      <input
                        type="text"
                        id="eventOtherPerson"
                        list="eventOtherPersonOptions"
                        value={eventDraft.otherPersonName}
                        onChange={(e) => handleEventDraftChange('otherPersonName', e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <datalist id="eventOtherPersonOptions">
                        {otherPersonOptions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventWwwwh" style={labelStyle}>WWWWH:</label>
                    <textarea
                      id="eventWwwwh"
                      value={eventDraft.wwwwh}
                      onChange={(e) => handleEventDraftChange('wwwwh', e.target.value)}
                      rows={3}
                      style={{ ...controlStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventObservations" style={labelStyle}>Observations:</label>
                    <textarea
                      id="eventObservations"
                      value={eventDraft.observations}
                      onChange={(e) => handleEventDraftChange('observations', e.target.value)}
                      rows={3}
                      style={{ ...controlStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="eventIsNodal" style={labelStyle}>Nodal Event:</label>
                    <input
                      type="checkbox"
                      id="eventIsNodal"
                      checked={!!eventDraft.isNodalEvent}
                      onChange={(e) => handleEventDraftChange('isNodalEvent', e.target.checked ? 'true' : 'false')}
                      style={{ marginRight: 'auto' }}
                    />
                  </div>
                </>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
              <button
                onClick={() => {
                  setEventModalOpen(false);
                  setEventDraft(null);
                }}
              >
                Cancel
              </button>
              <button onClick={saveEvent}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default PropertiesPanel;
