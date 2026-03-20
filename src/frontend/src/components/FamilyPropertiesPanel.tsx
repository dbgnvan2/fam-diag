import React, { useState } from 'react';
import type { Partnership, Person, EmotionalProcessEvent } from '../types';

interface FamilyPropertiesPanelProps {
  partnership: Partnership;
  people: Person[];
  onAddProperty: (processType: string, position: { x: number; y: number }) => void;
  onEditEvent: (eventId: string, position: { x: number; y: number }) => void;
  onAddEvent: (position: { x: number; y: number }) => void;
  onClose: () => void;
}

// New category/subtype values matching the hierarchy
const TRIANGLE_SUBTYPES = [
  { subtype: 'Functioning', label: 'Triangle Functioning', letter: 'V' },
  { subtype: 'Flexibility', label: 'Triangle Flexibility', letter: 'F' },
  { subtype: 'Stress Response', label: 'Triangle Stress Response', letter: 'R' },
] as const;

const STRESS_SUBTYPES = [
  { subtype: 'Emotional Reactivity', label: 'Emotional Reactivity' },
  { subtype: 'Adaptability', label: 'Family Adaptability' },
  { subtype: 'Family Stressor', label: 'Family Stressor' },
  { subtype: 'Chronic Stress', label: 'Chronic Stress' },
] as const;

const addBtnStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#4b68a6',
  border: '1px solid #c0ccdf',
  borderRadius: 4,
  background: '#f0f4fb',
  padding: '1px 7px',
  cursor: 'pointer',
};

const eventCardStyle: React.CSSProperties = {
  cursor: 'pointer',
  padding: '5px 8px',
  border: '1px solid #d0d8ea',
  borderLeft: '3px solid #4b68a6',
  borderRadius: 6,
  marginBottom: 4,
  background: '#f7f9fd',
  fontSize: 12,
};

const renderEventCards = (
  events: EmotionalProcessEvent[],
  onEditEvent: FamilyPropertiesPanelProps['onEditEvent']
) =>
  events.map((ev) => (
    <div
      key={ev.id}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onEditEvent(ev.id, { x: rect.left, y: rect.bottom + 4 });
      }}
      style={eventCardStyle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#23324a' }}>Intensity: {ev.intensity ?? '—'}</span>
        <span
          style={{
            fontSize: 11,
            color: ev.status === 'ongoing' ? '#2a7a4a' : '#a08060',
            background: ev.status === 'ongoing' ? '#edfbf2' : '#fdf3e3',
            border: `1px solid ${ev.status === 'ongoing' ? '#a8e0c0' : '#e0c090'}`,
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          {ev.status}
        </span>
      </div>
      <div style={{ color: '#5a6a88', marginTop: 2 }}>{ev.date}</div>
    </div>
  ));

const FamilyPropertiesPanel = ({ partnership, people, onAddProperty, onEditEvent, onAddEvent, onClose }: FamilyPropertiesPanelProps) => {
  const [activeTab, setActiveTab] = useState<'family' | 'triangles' | 'stressors' | 'events'>('family');

  const partner1 = people.find((p) => p.id === partnership.partner1_id);
  const partner2 = people.find((p) => p.id === partnership.partner2_id);
  const partnerNames = [partner1?.name, partner2?.name].filter(Boolean).join(' & ');
  const familyName =
    partnership.familyName ||
    [partner1?.name, partner2?.name].filter(Boolean).join(' / ') ||
    'Family';

  const allFamilyEvents = partnership.familyEvents || [];
  // Filter by category+subtype instead of emotionalProcessType
  const triangleEvents = allFamilyEvents.filter(
    (e) => e.eventType === 'FAMILY' && e.category === 'Triangles'
  );
  const stressorEvents = allFamilyEvents.filter(
    (e) => e.eventType === 'FAMILY' && e.category === 'Stress'
  );
  const otherEvents = allFamilyEvents.filter(
    (e) => !(e.eventType === 'FAMILY' && (e.category === 'Triangles' || e.category === 'Stress'))
  );

  const tabs = [
    { id: 'family', label: 'Family' },
    { id: 'triangles', label: 'Triangles' },
    { id: 'stressors', label: 'Stressors' },
    { id: 'events', label: 'Events' },
  ] as const;

  return (
    <div
      style={{
        background: '#f0f0f0',
        padding: '10px 12px 12px 12px',
        border: '1px solid #ccc',
        height: '100vh',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>
          X
        </button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Family Function Facts</div>
          <div style={{ fontSize: 11, color: '#555' }}>Family</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 12 }}>
        <div
          role="tablist"
          aria-label="Family properties tabs"
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            border: '1px solid #b8c2d3',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 10px',
                  border: 'none',
                  borderLeft: index === 0 ? 'none' : '1px solid #d0d6e2',
                  background: isActive ? '#dfe7f7' : '#fff',
                  color: isActive ? '#1f3f78' : '#23324a',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Family tab */}
      {activeTab === 'family' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#23324a', marginBottom: 6 }}>{familyName}</div>
          <div style={{ fontSize: 12, color: '#6b7a93' }}>
            {partnerNames ? `Partners: ${partnerNames}` : 'No partners recorded'}
          </div>
        </div>
      )}

      {/* Triangles tab */}
      {activeTab === 'triangles' && (
        <div style={{ marginTop: 14 }}>
          {TRIANGLE_SUBTYPES.map((pt) => {
            const events = triangleEvents.filter((e) => e.subtype === pt.subtype);
            return (
              <div key={pt.subtype} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4b68a6' }}>
                    [{pt.letter}] {pt.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onAddProperty(pt.subtype, { x: rect.left, y: rect.bottom + 4 });
                    }}
                    style={addBtnStyle}
                  >
                    +
                  </button>
                </div>
                {events.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9aaac4', fontStyle: 'italic', paddingLeft: 4 }}>None recorded</div>
                ) : (
                  renderEventCards(events, onEditEvent)
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stressors tab */}
      {activeTab === 'stressors' && (
        <div style={{ marginTop: 14 }}>
          {STRESS_SUBTYPES.map((st) => {
            const events = stressorEvents.filter((e) => e.subtype === st.subtype);
            return (
              <div key={st.subtype} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#7a5a9e' }}>{st.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onAddProperty(st.subtype, { x: rect.left, y: rect.bottom + 4 });
                    }}
                    style={{ ...addBtnStyle, color: '#7a5a9e', border: '1px solid #c8b8df', background: '#f6f0fb' }}
                  >
                    +
                  </button>
                </div>
                {events.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9aaac4', fontStyle: 'italic', paddingLeft: 4 }}>None recorded</div>
                ) : (
                  renderEventCards(events, onEditEvent)
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Events tab */}
      {activeTab === 'events' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onAddEvent({ x: rect.left, y: rect.bottom + 4 });
              }}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#4b68a6',
                border: '1px solid #c0ccdf',
                borderRadius: 4,
                background: '#f0f4fb',
                padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              + Add Family Event
            </button>
          </div>
          {otherEvents.length === 0 ? (
            <div style={{ fontSize: 11, color: '#9aaac4', fontStyle: 'italic' }}>No events recorded</div>
          ) : (
            otherEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onEditEvent(ev.id, { x: rect.left, y: rect.bottom + 4 });
                }}
                style={{
                  cursor: 'pointer',
                  padding: '5px 8px',
                  border: '1px solid #d0d8ea',
                  borderLeft: '3px solid #8b9cba',
                  borderRadius: 6,
                  marginBottom: 4,
                  background: '#f7f9fd',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: '#23324a' }}>{ev.category}</div>
                <div style={{ color: '#5a6a88', marginTop: 2 }}>{ev.date}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default FamilyPropertiesPanel;
