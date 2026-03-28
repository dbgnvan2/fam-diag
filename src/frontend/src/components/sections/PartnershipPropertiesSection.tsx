/**
 * PartnershipPropertiesSection — type, status, status dates, and notes for a partnership.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup via compactMode).
 * Pass showNotes=false in compact/popup mode to omit the notes textarea.
 */
import React from 'react';
import type { Partnership } from '../../types';
import DatePickerField from '../DatePickerField';

const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };

const PRESET_LINE_COLORS = ['#000000', '#FF1744', '#2979FF', '#00C853', '#FF9100', '#E040FB'];
const PRESET_BG_COLORS = ['#ffffff', '#fff3e0', '#e8f5e9', '#e3f2fd', '#fce4ec', '#f3e5f5'];

interface PartnershipPropertiesSectionProps {
  partnershipDraft: Partnership;
  computedFamilyName?: string;
  typeOptions: string[];
  statusOptions: string[];
  statusDateRows: Array<{ status: string; dateLabel: string }>;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  onColorPresetSelect: (field: 'color' | 'backgroundColor', value: string) => void;
  formatOptionLabel: (value: string) => string;
  normalizeStatusKey: (value: string) => string;
  readStatusDate: (partnership: Partnership, status: string) => string;
  showNotes?: boolean;
  fieldIdPrefix?: string;
}

const PartnershipPropertiesSection = ({
  partnershipDraft,
  computedFamilyName = '',
  typeOptions,
  statusOptions,
  statusDateRows,
  onChange,
  onColorPresetSelect,
  formatOptionLabel,
  normalizeStatusKey,
  readStatusDate,
  showNotes = true,
  fieldIdPrefix = '',
}: PartnershipPropertiesSectionProps) => (
  <div>
    <div style={rowStyle}>
      <label htmlFor={`${fieldIdPrefix}relationshipType`} style={labelStyle}>Type:</label>
      <select
        id={`${fieldIdPrefix}relationshipType`}
        name="relationshipType"
        value={partnershipDraft.relationshipType}
        onChange={onChange}
        style={{ width: 180 }}
      >
        {typeOptions.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
    <div style={rowStyle}>
      <label htmlFor={`${fieldIdPrefix}relationshipStatus`} style={labelStyle}>Status:</label>
      <select
        id={`${fieldIdPrefix}relationshipStatus`}
        name="relationshipStatus"
        value={partnershipDraft.relationshipStatus}
        onChange={onChange}
        style={{ width: 180 }}
      >
        {statusOptions.map((option) => (
          <option key={`${partnershipDraft.relationshipType}-${option}`} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
    {statusDateRows.map(({ status, dateLabel }) => {
      const statusKey = normalizeStatusKey(status);
      const fieldId = `${fieldIdPrefix}statusDate-${statusKey.replace(/[^a-z0-9]+/g, '-')}`;
      return (
        <div key={`${fieldIdPrefix}${partnershipDraft.relationshipType}-${statusKey}`} style={rowStyle}>
          <label htmlFor={fieldId} style={labelStyle}>{dateLabel}:</label>
          <DatePickerField
            id={fieldId}
            name={`statusDate:${status}`}
            value={readStatusDate(partnershipDraft, status)}
            placeholder="YYYY-MM-DD"
            onChange={onChange}
            pickerLabel={`Select ${dateLabel.toLowerCase()} date`}
          />
        </div>
      );
    })}
    <div style={rowStyle}>
      <label htmlFor={`${fieldIdPrefix}familyName`} style={labelStyle}>Family Name:</label>
      <input
        id={`${fieldIdPrefix}familyName`}
        name="familyName"
        type="text"
        value={partnershipDraft.familyName ?? ''}
        placeholder={computedFamilyName || 'e.g. Smith-Johnson'}
        onChange={onChange}
        style={{ width: '100%' }}
      />
    </div>
    <div style={{ ...rowStyle, alignItems: 'center' }}>
      <label htmlFor={`${fieldIdPrefix}partnershipColor`} style={labelStyle}>Line Color:</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          id={`${fieldIdPrefix}partnershipColor`}
          name="color"
          value={partnershipDraft.color || '#000000'}
          onChange={onChange}
          style={{ width: 60 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESET_LINE_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onColorPresetSelect('color', hex)}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: hex === '#ffffff' ? '2px solid #ccc' : '1px solid #ccc',
                background: hex,
                cursor: 'pointer',
              }}
              aria-label={`Set line color ${hex}`}
            />
          ))}
        </div>
      </div>
    </div>
    <div style={{ ...rowStyle, alignItems: 'center' }}>
      <label htmlFor={`${fieldIdPrefix}partnershipBgColor`} style={labelStyle}>Background:</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          id={`${fieldIdPrefix}partnershipBgColor`}
          name="backgroundColor"
          value={partnershipDraft.backgroundColor || '#ffffff'}
          onChange={onChange}
          style={{ width: 60 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESET_BG_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onColorPresetSelect('backgroundColor', hex)}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: hex === '#ffffff' ? '2px solid #ccc' : '1px solid #ccc',
                background: hex,
                cursor: 'pointer',
              }}
              aria-label={`Set background color ${hex}`}
            />
          ))}
        </div>
      </div>
    </div>
    {showNotes && (
      <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
        <label htmlFor={`${fieldIdPrefix}partnershipNotes`} style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
        <textarea
          id={`${fieldIdPrefix}partnershipNotes`}
          name="notes"
          value={partnershipDraft.notes || ''}
          onChange={onChange}
          rows={5}
          style={{ width: '100%', minHeight: '6rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
        />
      </div>
    )}
  </div>
);

export default PartnershipPropertiesSection;
