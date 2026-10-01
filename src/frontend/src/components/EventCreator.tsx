import React, { useMemo, useRef, useState } from 'react';
import type { EmotionalProcessEvent } from '../types';
import type { PersonEventBundle, TimelineJson } from '../utils/personEventBundle';
import {
  isPersonEventBundle,
  isTimelineJson,
  sanitizeBundlePeople,
} from '../utils/personEventBundle';
import {
  anchorTypeForOwner,
  applyEventDraftFieldChange,
  buildNewEventDraft,
  eventClassForOwner,
} from '../utils/eventDraft';

/**
 * A new lane event, built by the shared save path (bundle-03 / struct-05):
 * date and startDate both empty, no rating, no category chosen for the user
 * (author decision 2026-09-30), and the person lane as its owner. A lane
 * added here has no diagram id yet; the import fills the anchor from the
 * person it matches.
 */
const newLaneEvent = (personId: string | undefined, personName: string): EmotionalProcessEvent =>
  buildNewEventDraft({
    eventType: 'NODAL',
    anchorType: anchorTypeForOwner('person'),
    anchorId: personId || '',
    eventClass: eventClassForOwner('person'),
    primaryPersonName: personName,
  });

const bundleToTimeline = (bundle: PersonEventBundle, sourceName?: string): TimelineJson => ({
  kind: 'fam-diag-timeline',
  version: 1,
  timelineName: `${(sourceName || 'timeline').replace(/\.[^.]+$/, '')} - timeline`,
  exportedAt: new Date().toISOString(),
  sourceFileName: bundle.sourceFileName || sourceName,
  people: bundle.people,
});

const EventCreator = () => {
  const [timeline, setTimeline] = useState<TimelineJson | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [selected, setSelected] = useState<{ personIndex: number; eventIndex: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalEvents = useMemo(
    () => timeline?.people.reduce((sum, person) => sum + person.events.length, 0) || 0,
    [timeline]
  );

  const selectedEvent = useMemo(() => {
    if (!timeline || !selected) return null;
    const person = timeline.people[selected.personIndex];
    if (!person) return null;
    return person.events[selected.eventIndex] || null;
  }, [timeline, selected]);

  const selectedPerson = useMemo(() => {
    if (!timeline || !selected) return null;
    return timeline.people[selected.personIndex] || null;
  }, [timeline, selected]);

  const handleOpen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || ''));
        const nextTimeline = isTimelineJson(parsed)
          ? parsed
          : isPersonEventBundle(parsed)
          ? bundleToTimeline(parsed, file.name)
          : null;
        if (!nextTimeline) throw new Error('Invalid file');
        // bundle-04: each event is checked before it is shown. An entry
        // that cannot be read (null, object-valued notes) is dropped and
        // counted, instead of crashing the editor.
        const checked = sanitizeBundlePeople(nextTimeline.people);
        setTimeline({ ...nextTimeline, people: checked.people });
        setSelected(null);
        setSourceName(file.name);
        const problems = [
          checked.droppedEvents > 0 ? `Unreadable events skipped: ${checked.droppedEvents}` : '',
          checked.unreadableRatings > 0
            ? `Ratings that were not numbers, left unset: ${checked.unreadableRatings}`
            : '',
        ].filter(Boolean);
        if (problems.length > 0) alert(problems.join('\n'));
      } catch {
        alert('Invalid JSON. Expected timeline JSON or person-event JSON.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSave = () => {
    if (!timeline) return;
    const output: TimelineJson = { ...timeline, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const cleanName = (output.timelineName || 'timeline').replace(/[\\/:*?"<>|]/g, '-');
    anchor.download = `${cleanName}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Field edits go through the shared draft rule, so a Date edit sets date
  // and startDate together (bundle-03): editing only `date` let the old
  // startDate win on import and the edit was lost.
  const setSelectedEventField = (field: keyof EmotionalProcessEvent, value: string) => {
    setTimeline((prev) => {
      if (!prev || !selected) return prev;
      const people = [...prev.people];
      const person = { ...people[selected.personIndex] };
      const events = [...person.events];
      if (!events[selected.eventIndex]) return prev;
      events[selected.eventIndex] = applyEventDraftFieldChange(events[selected.eventIndex], field, value);
      person.events = events;
      people[selected.personIndex] = person;
      return { ...prev, people };
    });
  };

  const addPersonLane = () => {
    const personName = prompt('Person/Lane name:', 'New Person');
    if (!personName) return;
    setTimeline((prev) => {
      const base: TimelineJson =
        prev ||
        ({
          kind: 'fam-diag-timeline',
          version: 1,
          timelineName: 'timeline',
          exportedAt: new Date().toISOString(),
          people: [],
        } as TimelineJson);
      return {
        ...base,
        people: [...base.people, { personName: personName.trim(), events: [], baselineEventIds: [] }],
      };
    });
  };

  const addEvent = (personIndex: number) => {
    setTimeline((prev) => {
      if (!prev) return prev;
      const people = [...prev.people];
      const person = { ...people[personIndex] };
      const nextEvent = newLaneEvent(person.personId, person.personName);
      person.events = [...person.events, nextEvent];
      people[personIndex] = person;
      return { ...prev, people };
    });
    setSelected((prev) =>
      prev && prev.personIndex === personIndex
        ? { personIndex, eventIndex: (timeline?.people[personIndex].events.length || 0) }
        : prev
    );
  };

  const removeSelectedEvent = () => {
    if (!timeline || !selected) return;
    setTimeline((prev) => {
      if (!prev) return prev;
      const people = [...prev.people];
      const person = { ...people[selected.personIndex] };
      person.events = person.events.filter((_, index) => index !== selected.eventIndex);
      people[selected.personIndex] = person;
      return { ...prev, people };
    });
    setSelected(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#edf1f8', padding: 16 }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div
          style={{
            background: '#3f5577',
            color: '#fff',
            borderRadius: 10,
            padding: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>Timeline Event Creator</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Standalone editor for client-friendly timeline JSON (`name - timeline.json`).
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileInputRef.current?.click()}>Open JSON</button>
            <button onClick={handleSave} disabled={!timeline}>
              Save JSON
            </button>
            <button onClick={addPersonLane}>Add Person Lane</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleOpen}
            />
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 14, color: '#334' }}>
          Source: <strong>{sourceName || 'Not loaded'}</strong>
          {' · '}
          People: <strong>{timeline?.people.length || 0}</strong>
          {' · '}
          Events: <strong>{totalEvents}</strong>
        </div>

        {timeline ? (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid #c5d3ea', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              {timeline.people.map((person, personIndex) => (
                <div key={`${person.personId || person.personName}-${personIndex}`} style={{ borderTop: '1px solid #dbe6f8' }}>
                  <div
                    style={{
                      background: '#6886b3',
                      color: '#fff',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <strong>{person.personName}</strong>
                    <button onClick={() => addEvent(personIndex)}>Add Event</button>
                  </div>
                  {person.events.length === 0 ? (
                    <div style={{ padding: 10, color: '#667' }}>No events</div>
                  ) : (
                    person.events.map((event, eventIndex) => {
                      const isSelected =
                        selected?.personIndex === personIndex && selected?.eventIndex === eventIndex;
                      return (
                        <div
                          key={event.id || `${personIndex}-${eventIndex}`}
                          onClick={() => setSelected({ personIndex, eventIndex })}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '150px 1fr',
                            gap: 8,
                            padding: '8px 10px',
                            borderTop: '1px solid #eef3fb',
                            background: isSelected ? '#e8f0ff' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{event.startDate || event.date || 'No date'}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>{event.category || 'Event'}</strong>
                            {event.observations ? ` · ${event.observations}` : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>

            <div style={{ border: '1px solid #c5d3ea', borderRadius: 10, background: '#fff', padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>Event Properties</h4>
              {!selectedEvent || !selectedPerson ? (
                <div style={{ color: '#667' }}>Select an event from the left panel.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label>
                    Person
                    <input type="text" value={selectedPerson.personName} readOnly style={{ width: '100%' }} />
                  </label>
                  <label>
                    Event ID
                    <input type="text" value={selectedEvent.id} readOnly style={{ width: '100%' }} />
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={selectedEvent.startDate || selectedEvent.date || ''}
                      onChange={(e) => setSelectedEventField('date', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      type="text"
                      value={selectedEvent.category || ''}
                      onChange={(e) => setSelectedEventField('category', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={selectedEvent.observations || ''}
                      onChange={(e) => setSelectedEventField('observations', e.target.value)}
                      rows={8}
                      style={{ width: '100%', fontFamily: 'inherit' }}
                    />
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button
                      aria-label="Delete"
                      title="Delete"
                      onClick={removeSelectedEvent}
                      style={{ color: '#b00020' }}
                    >
                      🗑
                    </button>
                    <button onClick={handleSave}>Save JSON</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, border: '1px solid #c5d3ea', borderRadius: 10, background: '#fff', padding: 16 }}>
            Open a timeline JSON file, or click <strong>Add Person Lane</strong> to start a fresh standalone timeline.
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCreator;
