import React from 'react';
import type { Person, Partnership, EmotionalLine } from '../types';

interface PropertiesPanelProps {
  selectedItem: Person | Partnership | EmotionalLine;
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  onUpdatePartnership: (partnershipId: string, updatedProps: Partial<Partnership>) => void;
  onUpdateEmotionalLine: (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => void;
  onClose: () => void;
}

const PropertiesPanel = ({ selectedItem, onUpdatePerson, onUpdatePartnership, onUpdateEmotionalLine, onClose }: PropertiesPanelProps) => {
  const isPerson = 'name' in selectedItem;
  const isPartnership = 'partner1_id' in selectedItem && 'children' in selectedItem;
  const isEmotionalLine = 'lineStyle' in selectedItem;

  const handlePersonChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onUpdatePerson(selectedItem.id, { [e.target.name]: e.target.value });
  };

  const handlePartnershipChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onUpdatePartnership(selectedItem.id, { [e.target.name]: e.target.value as any });
  };

  const handleEmotionalLineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const lineStyleOptions: { [key: string]: string[] } = {
      fusion: ['single', 'double', 'triple'],
      distance: ['dotted', 'dashed', 'cutoff'],
      conflict: ['solid-saw-tooth', 'dotted-saw-tooth', 'double-saw-tooth'],
    };

    if (name === 'relationshipType') {
      const newRelationshipType = value as EmotionalLine['relationshipType'];
      const newLineStyle = lineStyleOptions[newRelationshipType]?.[0] || 'single';
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

  return (
    <div style={{ background: '#f0f0f0', padding: 10, border: '1px solid #ccc', height: '100vh' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 5, right: 5, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>X</button>
      <h3>Properties</h3>
      {isPerson && (
        <div>
          <div>
            <label>Name: </label>
            <input
              type="text"
              name="name"
              value={(selectedItem as Person).name}
              onChange={handlePersonChange}
            />
          </div>
          <div>
            <label>Birth Date: </label>
            <input
              type="text"
              name="birthDate"
              value={(selectedItem as Person).birthDate || ''}
              onChange={handlePersonChange}
            />
          </div>
          <div>
            <label>Death Date: </label>
            <input
              type="text"
              name="deathDate"
              value={(selectedItem as Person).deathDate || ''}
              onChange={handlePersonChange}
            />
          </div>
          <div>
            <label>Adoption Status: </label>
            <select
              name="adoptionStatus"
              value={(selectedItem as Person).adoptionStatus || 'biological'}
              onChange={handlePersonChange}
            >
              <option value="biological">Biological</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div>
            <label>Notes: </label>
            <textarea
              name="notes"
              value={(selectedItem as Person).notes || ''}
              onChange={handlePersonChange}
            />
          </div>
        </div>
      )}
      {isPartnership && (
        <div>
          <div>
            <label>Relationship Type: </label>
            <select 
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
            <label>Relationship Status: </label>
            <select 
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
            <label>Relationship Start Date: </label>
            <input
              type="text"
              name="relationshipStartDate"
              value={(selectedItem as Partnership).relationshipStartDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label>Married Start Date: </label>
            <input
              type="text"
              name="marriedStartDate"
              value={(selectedItem as Partnership).marriedStartDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label>Separation Date: </label>
            <input
              type="text"
              name="separationDate"
              value={(selectedItem as Partnership).separationDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label>Divorce Date: </label>
            <input
              type="text"
              name="divorceDate"
              value={(selectedItem as Partnership).divorceDate || ''}
              onChange={handlePartnershipChange}
            />
          </div>
          <div>
            <label>Notes: </label>
            <textarea
              name="notes"
              value={(selectedItem as Partnership).notes || ''}
              onChange={handlePartnershipChange}
            />
          </div>
        </div>
      )}
      {isEmotionalLine && (() => {
        const lineStyleOptions: { [key: string]: string[] } = {
          fusion: ['single', 'double', 'triple'],
          distance: ['dotted', 'dashed', 'cutoff'],
          conflict: ['solid-saw-tooth', 'dotted-saw-tooth', 'double-saw-tooth'],
        };
        const currentLineStyles = lineStyleOptions[(selectedItem as EmotionalLine).relationshipType] || [];

        return (
          <div>
            <div>
              <label>Start Date: </label>
              <input
                type="text"
                name="startDate"
                value={(selectedItem as EmotionalLine).startDate || ''}
                onChange={handleEmotionalLineInputChange}
              />
            </div>
            <div>
              <label>Relationship Type: </label>
              <select
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
              <label>Line Style: </label>
              <select
                name="lineStyle"
                value={(selectedItem as EmotionalLine).lineStyle}
                onChange={handleEmotionalLineChange}
              >
                {currentLineStyles.map(style => (
                  <option key={style} value={style}>{style.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Line Ending: </label>
              <select
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
            <div>
              <label>Notes: </label>
              <textarea
                name="notes"
                value={(selectedItem as EmotionalLine).notes || ''}
                onChange={handleEmotionalLineInputChange}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};


export default PropertiesPanel;
