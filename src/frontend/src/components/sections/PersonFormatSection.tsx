/**
 * PersonFormatSection — person size and color (foreground, border, background) controls.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup).
 */
import React, { useState, useEffect, useRef } from 'react';
import type { Person } from '../../types';

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';
const DEFAULT_FOREGROUND_COLOR = '#000000';

const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };
const sectionCardStyle: React.CSSProperties = {
  marginTop: 12,
  border: '1px solid #d4dae5',
  borderRadius: 8,
  background: '#fff',
  padding: '10px 12px 12px',
};
const formatColorRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 10,
};

interface ColorInputRefs {
  foreground: { current: HTMLInputElement | null };
  border: { current: HTMLInputElement | null };
  background: { current: HTMLInputElement | null };
}

interface PersonFormatSectionProps {
  personDraft: Person;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  onAdjustSize: (delta: number) => void;
  onSizeSet: (value: number) => void;
  colorInputRefs: ColorInputRefs;
}

const PersonFormatSection = ({
  personDraft,
  onChange,
  onAdjustSize,
  onSizeSet,
  colorInputRefs,
}: PersonFormatSectionProps) => {
  const committedSize = personDraft.size ?? 60;
  const [sizeText, setSizeText] = useState(String(committedSize));
  const prevCommittedRef = useRef(committedSize);

  // Sync local text when size changes externally (e.g. +/- buttons)
  useEffect(() => {
    if (committedSize !== prevCommittedRef.current) {
      prevCommittedRef.current = committedSize;
      setSizeText(String(committedSize));
    }
  }, [committedSize]);

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setSizeText(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 9) {
      onSizeSet(Math.min(400, num));
    }
  };

  const handleSizeBlur = () => {
    const num = parseInt(sizeText, 10);
    if (!isNaN(num) && num > 9) {
      const clamped = Math.min(400, num);
      setSizeText(String(clamped));
      onSizeSet(clamped);
    } else {
      setSizeText(String(committedSize));
    }
  };

  const renderColorControl = (
    key: 'foreground' | 'border' | 'background',
    label: string,
    enabled: boolean,
    color: string
  ) => (
    <div style={formatColorRowStyle}>
      <div style={{ fontWeight: 600, minWidth: 120 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label={`${label} color`}
          title={`Choose ${label.toLowerCase()}`}
          onClick={() => colorInputRefs[key].current?.click()}
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1px solid #7b8ba5',
            background: color,
            cursor: 'pointer',
            padding: 0,
            boxShadow: enabled ? '0 0 0 2px rgba(75, 104, 166, 0.18)' : 'none',
          }}
        />
        <input
          ref={colorInputRefs[key] as React.RefObject<HTMLInputElement>}
          type="color"
          name={`${key}Color`}
          value={color}
          onChange={onChange}
          aria-label={`${label} color picker`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
          tabIndex={-1}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            name={`${key}Enabled`}
            checked={enabled}
            onChange={onChange}
          />
          Enabled
        </label>
      </div>
    </div>
  );

  return (
    <div
      role="tabpanel"
      id="person-section-panel-format"
      aria-labelledby="person-section-tab-format"
      style={sectionCardStyle}
    >
      <div style={{ fontWeight: 700, color: '#23324a' }}>Format</div>
      <div style={rowStyle}>
        <label htmlFor="size" style={labelStyle}>Size:</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => onAdjustSize(-1)} style={{ padding: '0 6px' }}>−</button>
          <input
            type="text"
            id="size"
            name="size"
            value={sizeText}
            onChange={handleSizeChange}
            onBlur={handleSizeBlur}
            style={{ width: '4ch', textAlign: 'center' }}
          />
          <button type="button" onClick={() => onAdjustSize(1)} style={{ padding: '0 6px' }}>+</button>
        </div>
      </div>
      {renderColorControl(
        'foreground',
        'Foreground Color',
        personDraft.foregroundEnabled ?? !!personDraft.foregroundColor,
        personDraft.foregroundColor ?? DEFAULT_FOREGROUND_COLOR
      )}
      {renderColorControl(
        'border',
        'Border Color',
        personDraft.borderEnabled ?? !!personDraft.borderColor,
        personDraft.borderColor ?? DEFAULT_BORDER_COLOR
      )}
      {renderColorControl(
        'background',
        'Background Color',
        personDraft.backgroundEnabled ?? false,
        personDraft.backgroundColor ?? DEFAULT_BACKGROUND_COLOR
      )}
    </div>
  );
};

export default PersonFormatSection;
