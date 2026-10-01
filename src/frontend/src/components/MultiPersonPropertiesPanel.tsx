import React, { useMemo, useRef, useEffect, useState } from 'react';
import type { Person } from '../types';
import { DEFAULT_PERSON_BORDER_COLOR, effectivePersonBorderColor } from '../utils/personAppearance';

const DEFAULT_SIZE = 60;
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';

interface MultiPersonPropertiesPanelProps {
  selectedPeople: Person[];
  onBatchUpdate: (personIds: string[], updates: Partial<Person>) => void;
  onAddEmotionalPattern: (person1Id: string, person2Id: string) => void;
  onClose: () => void;
}

const MultiPersonPropertiesPanel = ({ selectedPeople, onBatchUpdate, onAddEmotionalPattern, onClose }: MultiPersonPropertiesPanelProps) => {
  const personIds = selectedPeople.map((person) => person.id);

  const resolveValue = <T,>(person: Person, getter: (p: Person) => T | undefined, fallback: T): T => {
    const value = getter(person);
    return value === undefined ? fallback : value;
  };

  const sharedSize = useMemo(() => {
    if (!selectedPeople.length) return DEFAULT_SIZE;
    const first = resolveValue(selectedPeople[0], (p) => p.size, DEFAULT_SIZE);
    const allMatch = selectedPeople.every(
      (person) => resolveValue(person, (p) => p.size, DEFAULT_SIZE) === first
    );
    return allMatch ? first : undefined;
  }, [selectedPeople]);

  // Compare the colour each person is drawn with, which ignores a stored
  // colour whose border is switched off (review nodes-05).
  const sharedBorderColor = useMemo(() => {
    if (!selectedPeople.length) return DEFAULT_PERSON_BORDER_COLOR;
    const first = effectivePersonBorderColor(selectedPeople[0]);
    const allMatch = selectedPeople.every((person) => effectivePersonBorderColor(person) === first);
    return allMatch ? first : undefined;
  }, [selectedPeople]);

  const sharedBackgroundEnabled = useMemo(() => {
    if (!selectedPeople.length) return false;
    const first = resolveValue(selectedPeople[0], (p) => p.backgroundEnabled, false);
    const allMatch = selectedPeople.every(
      (person) => resolveValue(person, (p) => p.backgroundEnabled, false) === first
    );
    return allMatch ? first : undefined;
  }, [selectedPeople]);

  const sharedBackgroundColor = useMemo(() => {
    if (!selectedPeople.length) return DEFAULT_BACKGROUND_COLOR;
    const first = resolveValue(
      selectedPeople[0],
      (p) => p.backgroundColor,
      DEFAULT_BACKGROUND_COLOR
    );
    const allMatch = selectedPeople.every(
      (person) =>
        resolveValue(person, (p) => p.backgroundColor, DEFAULT_BACKGROUND_COLOR) === first
    );
    return allMatch ? first : undefined;
  }, [selectedPeople]);

  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = sharedBackgroundEnabled === undefined;
    }
  }, [sharedBackgroundEnabled]);

  const [sizeText, setSizeText] = useState(sharedSize !== undefined ? String(sharedSize) : '');
  const prevSharedSizeRef = useRef(sharedSize);
  useEffect(() => {
    if (sharedSize !== prevSharedSizeRef.current) {
      prevSharedSizeRef.current = sharedSize;
      setSizeText(sharedSize !== undefined ? String(sharedSize) : '');
    }
  }, [sharedSize]);

  // A size is sent only when it is valid and differs from the size everyone
  // already shares. An empty or invalid entry goes back to the shared size,
  // or to '' ("Mixed") when sizes differ — never to a default, which a
  // second blur would then apply to everyone (review nodes-04).
  const parseSize = (raw: string): number | null => {
    const num = parseInt(raw, 10);
    return !isNaN(num) && num > 9 ? Math.min(400, num) : null;
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setSizeText(raw);
    const size = parseSize(raw);
    if (size !== null && size !== sharedSize) {
      onBatchUpdate(personIds, { size });
    }
  };

  const handleSizeBlur = () => {
    const size = parseSize(sizeText);
    if (size === null) {
      setSizeText(sharedSize !== undefined ? String(sharedSize) : '');
      return;
    }
    setSizeText(String(size));
    if (size !== sharedSize) {
      onBatchUpdate(personIds, { size });
    }
  };

  // Choosing a colour turns the custom border on; otherwise a person whose
  // border was off keeps drawing the default (review nodes-05).
  const handleBorderColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBatchUpdate(personIds, { borderColor: e.target.value, borderEnabled: true });
  };

  const handleBackgroundToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBatchUpdate(personIds, { backgroundEnabled: e.target.checked });
  };

  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBatchUpdate(personIds, { backgroundColor: e.target.value });
  };

  return (
    <div style={{ background: '#f0f0f0', padding: 12, height: '100vh', borderLeft: '1px solid #ccc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>
          ×
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>
          Multiple People ({selectedPeople.length})
        </span>
      </div>
      <h3 style={{ marginTop: 8 }}>Shared Properties</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label htmlFor="multi-size">Size (px)</label>
        <input
          id="multi-size"
          type="text"
          value={sizeText}
          placeholder={sharedSize === undefined ? 'Mixed' : undefined}
          onChange={handleSizeChange}
          onBlur={handleSizeBlur}
          style={{ width: '4ch', textAlign: 'center' }}
        />
        <label htmlFor="multi-border-color" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Border Color
        </label>
        <input
          id="multi-border-color"
          type="color"
          value={sharedBorderColor ?? DEFAULT_PERSON_BORDER_COLOR}
          onChange={handleBorderColorChange}
        />
        {sharedBorderColor === undefined && (
          <small style={{ color: '#777' }}>Mixed values</small>
        )}
        <label htmlFor="multi-background-enabled" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id="multi-background-enabled"
            ref={checkboxRef}
            type="checkbox"
            checked={sharedBackgroundEnabled ?? false}
            onChange={handleBackgroundToggle}
          />
          Shaded Background Enabled
        </label>
        <label htmlFor="multi-background-color" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Background Color
        </label>
        <input
          id="multi-background-color"
          type="color"
          value={sharedBackgroundColor ?? DEFAULT_BACKGROUND_COLOR}
          onChange={handleBackgroundColorChange}
          disabled={sharedBackgroundEnabled === false}
        />
        {sharedBackgroundColor === undefined && (
          <small style={{ color: '#777' }}>Mixed values</small>
        )}
        <p style={{ fontSize: 12, color: '#666' }}>
          Background squares render at 110% of each person&apos;s size, centered behind the node.
        </p>
        {selectedPeople.length === 2 && (
          <div style={{ marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#23324a', marginBottom: 8 }}>Emotional Pattern</div>
            <button
              type="button"
              onClick={() => onAddEmotionalPattern(selectedPeople[0].id, selectedPeople[1].id)}
              style={{
                width: '100%',
                padding: '7px 12px',
                background: '#1565c0',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Add Emotional Pattern
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiPersonPropertiesPanel;
