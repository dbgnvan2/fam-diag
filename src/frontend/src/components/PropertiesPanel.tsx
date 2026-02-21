import React, { useEffect, useMemo, useState } from 'react';
import type { Person, Partnership, EmotionalLine, EmotionalProcessEvent } from '../types';

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';

interface PropertiesPanelProps {
  selectedItem: Person | Partnership | EmotionalLine;
  people: Person[];
  eventCategories: string[];
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  onUpdatePartnership: (partnershipId: string, updatedProps: Partial<Partnership>) => void;
  onUpdateEmotionalLine: (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => void;
  onClose: () => void;
}

const PropertiesPanel = ({ selectedItem, people, eventCategories, onUpdatePerson, onUpdatePartnership, onUpdateEmotionalLine, onClose }: PropertiesPanelProps) => {
  const isPerson = 'name' in selectedItem;
  const isPartnership = 'partner1_id' in selectedItem && 'children' in selectedItem;
  const isEmotionalLine = 'lineStyle' in selectedItem;
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<EmotionalProcessEvent | null>(null);

  useEffect(() => {
    setEventModalOpen(false);
    setEventDraft(null);
  }, [selectedItem.id]);

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
    onUpdatePerson(selectedItem.id, { [name]: nextValue });
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
      wwwwh: '',
      observations: '',
    });
    setEventModalOpen(true);
  };

  const openEditEvent = (event: EmotionalProcessEvent) => {
    setEventDraft({
      ...event,
      category: event.category || eventCategories[0] || '',
      otherPersonName: event.otherPersonName || otherPersonOptions[0] || '',
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
    setEventDraft({ ...eventDraft, [field]: value });
  };

  const saveEvent = () => {
    if (!eventDraft) return;
    const cleanedDraft = {
      ...eventDraft,
      otherPersonName: eventDraft.otherPersonName || otherPersonOptions[0] || '',
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
    <div style={{ background: '#f0f0f0', padding: 10, border: '1px solid #ccc', height: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>X</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{termLabel()}</span>
      </div>
      <h3 style={{ marginTop: 8 }}>Properties</h3>
      {isPerson && (
        <div>
          <div>
            <label htmlFor="name">Name: </label>
            <input
              type="text"
              id="name"
              name="name"
              value={(selectedItem as Person).name}
              onChange={handlePersonChange}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="size">Size: </label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() =>
                  onUpdatePerson(selectedItem.id, {
                    size: Math.max(20, ((selectedItem as Person).size ?? 60) - 1),
                  })
                }
                style={{ padding: '0 6px', marginRight: 4 }}
              >
                −
              </button>
              <input
                type="number"
                id="size"
                name="size"
                min={20}
                max={200}
                value={(selectedItem as Person).size ?? 60}
                onChange={handlePersonChange}
                style={{ width: 60, textAlign: 'center' }}
              />
              <button
                type="button"
                onClick={() =>
                  onUpdatePerson(selectedItem.id, {
                    size: Math.min(200, ((selectedItem as Person).size ?? 60) + 1),
                  })
                }
                style={{ padding: '0 6px', marginLeft: 4 }}
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="borderColor">Border Color: </label>
            <input
              type="color"
              id="borderColor"
              name="borderColor"
              value={(selectedItem as Person).borderColor ?? DEFAULT_BORDER_COLOR}
              onChange={handlePersonChange}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="backgroundEnabled" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="backgroundEnabled"
                name="backgroundEnabled"
                checked={(selectedItem as Person).backgroundEnabled ?? false}
                onChange={handlePersonChange}
              />
              Shaded Background Enabled
            </label>
          </div>
          <div>
            <label htmlFor="backgroundColor">Background Color: </label>
            <input
              type="color"
              id="backgroundColor"
              name="backgroundColor"
              value={(selectedItem as Person).backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
              onChange={handlePersonChange}
              disabled={!((selectedItem as Person).backgroundEnabled ?? false)}
            />
          </div>
          <div>
            <label htmlFor="birthDate">Birth Date: </label>
            <input
              type="text"
              id="birthDate"
              name="birthDate"
              value={(selectedItem as Person).birthDate || ''}
              onChange={handlePersonChange}
            />
          </div>
          <div>
            <label htmlFor="deathDate">Death Date: </label>
            <input
              type="text"
              id="deathDate"
              name="deathDate"
              value={(selectedItem as Person).deathDate || ''}
              onChange={handlePersonChange}
            />
          </div>
          <div>
            <label htmlFor="adoptionStatus">Adoption Status: </label>
            <select
              id="adoptionStatus"
              name="adoptionStatus"
              value={(selectedItem as Person).adoptionStatus || 'biological'}
              onChange={handlePersonChange}
            >
              <option value="biological">Biological</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div>
            <label htmlFor="notes">Notes: </label>
            <textarea
              id="notes"
              name="notes"
              value={(selectedItem as Person).notes || ''}
              onChange={handlePersonChange}
            />
          </div>
          <div>
            <label htmlFor="notesEnabled">Notes Enabled: </label>
            <input
              type="checkbox"
              id="notesEnabled"
              name="notesEnabled"
              checked={(selectedItem as Person).notesEnabled}
              onChange={handlePersonChange}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Emotional Process Events</strong>
              <button onClick={openNewEvent}>Add Event</button>
            </div>
            <div style={{ marginTop: 6 }}>
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
                  <li key={event.id} style={{ borderBottom: '1px solid #ddd', padding: '6px 0' }}>
                    <div><strong>{event.date || 'No date'}</strong></div>
                    <div>Category: {event.category || '—'}</div>
                    <div>Intensity: {event.intensity} | How well: {event.howWell}</div>
                    <div>Other: {event.otherPersonName || '—'}</div>
                    <div style={{ marginTop: 4 }}>
                      <button onClick={() => openEditEvent(event)} style={{ marginRight: 6 }}>Edit</button>
                      <button onClick={() => deleteEvent(event.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {isPartnership && (
        <div>
          <div>
            <label htmlFor="relationshipType">Relationship Type: </label>
            <select
              id="relationshipType" 
              name="relationshipType" 
              value={(selectedItem as Partnership).relationshipType} 
              onChange={handlePartnershipChange}
            >
              <option value="married">Married</option>
              <option value="common-law">Common-law</option>
              <option value="living-together">Living Together</option>
              <option value="dating">Dating</option>
            </select>
          </div>
          <div>
            <label htmlFor="relationshipStatus">Relationship Status: </label>
            <select
              id="relationshipStatus" 
              name="relationshipStatus" 
              value={(selectedItem as Partnership).relationshipStatus} 
              onChange={handlePartnershipChange}
            >
              <option value="married">Married</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
            </select>
          </div>
          <div>
            <label htmlFor="relationshipStartDate">Relationship Start Date: </label>
            <input
              type="text"
              id="relationshipStartDate"
              name="relationshipStartDate"
              value={(selectedItem as Partnership).relationshipStartDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label htmlFor="marriedStartDate">Married Start Date: </label>
            <input
              type="text"
              id="marriedStartDate"
              name="marriedStartDate"
              value={(selectedItem as Partnership).marriedStartDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label htmlFor="separationDate">Separation Date: </label>
            <input
              type="text"
              id="separationDate"
              name="separationDate"
              value={(selectedItem as Partnership).separationDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label htmlFor="divorceDate">Divorce Date: </label>
            <input
              type="text"
              id="divorceDate"
              name="divorceDate"
              value={(selectedItem as Partnership).divorceDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label htmlFor="notes">Notes: </label>
            <textarea
              id="notes"
              name="notes"
              value={(selectedItem as Partnership).notes || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Emotional Process Events</strong>
              <button onClick={openNewEvent}>Add Event</button>
            </div>
            <div style={{ marginTop: 6 }}>
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
                  <li key={event.id} style={{ borderBottom: '1px solid #ddd', padding: '6px 0' }}>
                    <div><strong>{event.date || 'No date'}</strong></div>
                    <div>Category: {event.category || '—'}</div>
                    <div>Intensity: {event.intensity} | How well: {event.howWell}</div>
                    <div>Other: {event.otherPersonName || '—'}</div>
                    <div style={{ marginTop: 4 }}>
                      <button onClick={() => openEditEvent(event)} style={{ marginRight: 6 }}>Edit</button>
                      <button onClick={() => deleteEvent(event.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {isEmotionalLine && (() => {
        const relationshipType = (selectedItem as EmotionalLine).relationshipType;
        const styleOptions = styleOptionMeta(relationshipType);
        const intensityTypes: EmotionalLine['relationshipType'][] = ['fusion', 'distance', 'conflict'];
        const lineStyleLabel = intensityTypes.includes(relationshipType) ? 'Intensity' : 'Line Style';

        const presetColors = ['#444444', '#FF1744', '#2979FF', '#00C853', '#FF9100', '#E040FB'];

        return (
          <div>
            <div>
              <label htmlFor="startDate">Start Date: </label>
              <input
                type="text"
                id="startDate"
                name="startDate"
                value={(selectedItem as EmotionalLine).startDate || ''}
                onChange={handleEmotionalLineInputChange}
              />
            </div>
            <div>
              <label htmlFor="relationshipType">Relationship Type: </label>
              <select
                id="relationshipType"
                name="relationshipType"
                value={(selectedItem as EmotionalLine).relationshipType}
                onChange={handleEmotionalLineChange}
              >
                <option value="fusion">Fusion</option>
                <option value="distance">Distance</option>
                <option value="cutoff">Cutoff</option>
                <option value="conflict">Conflict</option>
              </select>
            </div>
            <div>
              <label htmlFor="lineStyle">{lineStyleLabel}: </label>
              <select
                id="lineStyle"
                name="lineStyle"
                value={(selectedItem as EmotionalLine).lineStyle}
                onChange={handleEmotionalLineChange}
              >
                {styleOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lineEnding">Line Ending: </label>
              <select
                id="lineEnding"
                name="lineEnding"
                value={(selectedItem as EmotionalLine).lineEnding}
                onChange={handleEmotionalLineChange}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="lineColor">Color: </label>
              <input
                type="color"
                id="lineColor"
                name="color"
                value={(selectedItem as EmotionalLine).color || '#444444'}
                onChange={handleEmotionalLineInputChange}
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
            <div>
              <label htmlFor="notes">Notes: </label>
              <textarea
                id="notes"
                name="notes"
                value={(selectedItem as EmotionalLine).notes || ''}
                onChange={handleEmotionalLineInputChange}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>Emotional Process Events</strong>
                <button onClick={openNewEvent}>Add Event</button>
              </div>
              <div style={{ marginTop: 6 }}>
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
                    <li key={event.id} style={{ borderBottom: '1px solid #ddd', padding: '6px 0' }}>
                      <div><strong>{event.date || 'No date'}</strong></div>
                      <div>Category: {event.category || '—'}</div>
                      <div>Intensity: {event.intensity} | How well: {event.howWell}</div>
                      <div>Other: {event.otherPersonName || '—'}</div>
                      <div style={{ marginTop: 4 }}>
                        <button onClick={() => openEditEvent(event)} style={{ marginRight: 6 }}>Edit</button>
                        <button onClick={() => deleteEvent(event.id)}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })()}
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
          <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 360 }}>
            <h4>{eventDraft.date ? 'Edit Event' : 'New Event'}</h4>
            <div>
              <label htmlFor="eventDate">Date: </label>
              <input
                type="date"
                id="eventDate"
                value={eventDraft.date}
                onChange={(e) => handleEventDraftChange('date', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="eventIntensity">Intensity (1-10): </label>
              <input
                type="number"
                id="eventIntensity"
                min={1}
                max={10}
                value={eventDraft.intensity}
                onChange={(e) => handleEventDraftChange('intensity', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="eventHowWell">How well (1-9): </label>
              <input
                type="number"
                id="eventHowWell"
                min={1}
                max={9}
                value={eventDraft.howWell}
                onChange={(e) => handleEventDraftChange('howWell', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="eventCategory">Category: </label>
              <select
                id="eventCategory"
                value={eventDraft.category}
                onChange={(e) => handleEventDraftChange('category', e.target.value)}
              >
                {eventCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="eventOtherPerson">Other Person: </label>
              <input
                type="text"
                id="eventOtherPerson"
                list="eventOtherPersonOptions"
                value={eventDraft.otherPersonName}
                onChange={(e) => handleEventDraftChange('otherPersonName', e.target.value)}
              />
              <datalist id="eventOtherPersonOptions">
                {otherPersonOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="eventWwwwh">WWWWH: </label>
              <textarea
                id="eventWwwwh"
                value={eventDraft.wwwwh}
                onChange={(e) => handleEventDraftChange('wwwwh', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="eventObservations">Observations: </label>
              <textarea
                id="eventObservations"
                value={eventDraft.observations}
                onChange={(e) => handleEventDraftChange('observations', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={() => { setEventModalOpen(false); setEventDraft(null); }} style={{ marginRight: 8 }}>Cancel</button>
              <button onClick={saveEvent}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default PropertiesPanel;
