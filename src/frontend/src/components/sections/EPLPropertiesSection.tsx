/**
 * EPLPropertiesSection — Emotional Pattern Line properties:
 * type, status, line style, intensity, impact, frequency, dates, notes, color, triangle controls.
 * Rendered inside PropertiesPanel (full panel).
 */
import React, { useState } from 'react';
import type { EmotionalLine } from '../../types';
import {
  FREQUENCY_OPTIONS,
  IMPACT_OPTIONS,
} from '../../constants/functionalIndicatorScales';
import { emotionalPatternIntensityOptions } from '../../utils/emotionalPatternOptions';
import DatePickerField from '../DatePickerField';

const FUSION_INTENSITY_HELP = [
  'Minimal – The amount of loss of self to one’s spouse is minimal. Whatever symptom occurs is easily managed, without limitation in functioning, and appears only during periods of heightened anxiety.',
  'Mild –Some loss of self that can result in more frequent but still mild symptoms that cause distress and occasionally interfere with functioning.',
  'Moderate – A greater sensitivity to conflict and greater readiness to go along with the other to avoid it. More frequent or moderate symptoms that reduce the ability to function but can be managed by the person unless anxiety gets too high.',
  'Major – Considerable loss of self to the other such that most important decisions are made by the other spouse. Serious or chronic symptoms that require substantial alteration in the life of the person and/or family',
  'Severe – Person has become almost a complete no self in the relationship and extremely vulnerable to very serious symptoms that essentially dictate all of life’s choices.',
];
const FUSION_INTENSITY_LEVEL_LABELS = ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'];
const CONFLICT_INTENSITY_HELP = [
  'Minimum – very occasional bickering, little or no arguments.',
  'Mild – frequent bickering, short-lived or infrequent quarelling.',
  'Moderate – frequent arguments, high irritability of partners, raised voices.',
  'Major – frequent arguments, physical contact (pushing, shoving, occasional slapping), involvement of others.',
  'Maximal – frequent arguments and striking one another, involvement of outside agencies to restore order.',
];
const CONFLICT_INTENSITY_LEVEL_LABELS = ['Minimum', 'Mild', 'Moderate', 'Major', 'Maximal'];
const DISTANCE_INTENSITY_HELP = [
  'Minimal – Occasional use of distance to manage tension (superficial contact, seeking out other relationships and/or activities).',
  'Mild – regular use of distance to manage tension.',
  'Moderate – Use of emotional distance even during calmer times; little ability to discuss personal issues.',
  'Major – chronic distance maintained with tense periods of silence or frequent absences; large / frequent geographic distance.',
  'Severe – Distance is structured into separate lifestyles or living arrangements.',
];
const DISTANCE_INTENSITY_LEVEL_LABELS = ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'];
const PROJECTION_INTENSITY_HELP = [
  'Minimal – Parental worry/anxiety about the child is very occasional; child is asymptomatic. Parents meet the reality needs of the child without significantly incorporating the child into parental problems or emotionally overinvesting either positively or negative in the child.',
  'Mild – Parents\' worry is episodic. Symptoms of the child tend to be occasional and easily managed with no serious impairment of the child\'s functioning. Sporadic anxious focus on the child.',
  'Moderate – Parental worry about the child may be episodic or more constant. There is some impairment of the child\'s functioning that becomes more acute during periods of heightened parental anxiety. More of the parent\'s self is invested in the child and can play out in either an over positive or an over negative way.',
  'Major – Anxious parental focus on the child is more intense contributing to serious impairment of the child\'s functioning. This may not become evident until adolescence or until the child attempts to leave home. The life of the family is frequently oriented around the child and symptoms in the child.',
  'Severe – The intensity of the attachment between child and parents is so severe the child fails to lift off from parents or substitute institution. A chronic fixed triangle with the parents contributes to a schizophrenic level of impairment.',
];
const PROJECTION_INTENSITY_LEVEL_LABELS = ['Minimal', 'Mild', 'Moderate', 'Major', 'Severe'];
const CUTOFF_INTENSITY_HELP = [
  '0–20: Extreme to Vulnerable — Total or near-total isolation. Contact is rare, strictly superficial, and highly reactive. Any stress may trigger a complete cut-off.',
  '20–40: Distanced Connectivity — Personal topics are avoided; triangling is the primary coping mechanism. Families drift apart and only rally briefly during crises.',
  '40–60: Intentional to Principled — Members make deliberate choices about contact and topics. Some triangling persists under moderate stress but principles begin to govern participation.',
  '60–80: Resilient to Transparent — Regular, significant contact is maintained easily. Relationships are grounded in reality, guided by strong principles, and tolerate high anxiety without collapsing.',
];
const CUTOFF_INTENSITY_LEVEL_LABELS = ['0–20', '20–40', '40–60', '60–80'];

const PRESET_COLORS = ['#444444', '#FF1744', '#2979FF', '#00C853', '#FF9100', '#E040FB'];

const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };
const helpBadgeStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: '1px solid #8ba1bd',
  background: '#fff',
  color: '#38557a',
  fontWeight: 700,
  fontSize: 12,
  lineHeight: '18px',
  padding: 0,
  cursor: 'pointer',
};

const getIntensityChooserConfig = (relationshipType: EmotionalLine['relationshipType']) => {
  if (relationshipType === 'fusion') {
    return {
      title: '+ / - Adequate Intensity Level',
      helpLines: FUSION_INTENSITY_HELP,
      labels: FUSION_INTENSITY_LEVEL_LABELS,
      buttonLabel: '+ / - Adequate intensity level help',
    };
  }
  if (relationshipType === 'conflict') {
    return {
      title: 'Conflict Intensity Level',
      helpLines: CONFLICT_INTENSITY_HELP,
      labels: CONFLICT_INTENSITY_LEVEL_LABELS,
      buttonLabel: 'Conflict intensity level help',
    };
  }
  if (relationshipType === 'distance') {
    return {
      title: 'Distance Intensity Level',
      helpLines: DISTANCE_INTENSITY_HELP,
      labels: DISTANCE_INTENSITY_LEVEL_LABELS,
      buttonLabel: 'Distance intensity level help',
    };
  }
  if (relationshipType === 'cutoff') {
    return {
      title: 'Cutoff / Differentiation Scale',
      helpLines: CUTOFF_INTENSITY_HELP,
      labels: CUTOFF_INTENSITY_LEVEL_LABELS,
      buttonLabel: 'Cutoff intensity level help',
    };
  }
  if (relationshipType === 'projection') {
    return {
      title: 'Family Projection Intensity Scale',
      helpLines: PROJECTION_INTENSITY_HELP,
      labels: PROJECTION_INTENSITY_LEVEL_LABELS,
      buttonLabel: 'Family projection intensity level help',
    };
  }
  return null;
};

interface EPLPropertiesSectionProps {
  emotionalDraft: EmotionalLine;
  emotionalIntensityDraft: number;
  emotionalImpactDraft: number;
  emotionalFrequencyDraft: number;
  onSelectChange: React.ChangeEventHandler<HTMLSelectElement>;
  onInputChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onIntensityLevelChange: (level: number) => void;
  onImpactChange: (impact: number) => void;
  onFrequencyChange: (frequency: number) => void;
  onColorPresetSelect: (color: string) => void;
  triangleId?: string;
  triangleColorDraft?: string;
  triangleIntensityDraft?: 'low' | 'medium' | 'high';
  onTriangleColorChange?: (color: string) => void;
  onTriangleIntensityChange?: (intensity: 'low' | 'medium' | 'high') => void;
}

const EPLPropertiesSection = ({
  emotionalDraft,
  emotionalIntensityDraft,
  emotionalImpactDraft,
  emotionalFrequencyDraft,
  onSelectChange,
  onInputChange,
  onIntensityLevelChange,
  onImpactChange,
  onFrequencyChange,
  onColorPresetSelect,
  triangleId,
  triangleColorDraft,
  triangleIntensityDraft,
  onTriangleColorChange,
  onTriangleIntensityChange,
}: EPLPropertiesSectionProps) => {
  const [intensityHelpOpen, setIntensityHelpOpen] = useState(false);

  const styleOptions = emotionalPatternIntensityOptions(emotionalDraft.relationshipType);
  const intensityChooserConfig = getIntensityChooserConfig(emotionalDraft.relationshipType);
  const intensityLevelOptions = intensityChooserConfig
    ? intensityChooserConfig.labels.map((label, i) => ({ value: i + 1, label }))
    : [];

  return (
    <div>
      <div style={rowStyle}>
        <label htmlFor="relationshipType" style={labelStyle}>Type:</label>
        <select
          id="relationshipType"
          name="relationshipType"
          value={emotionalDraft.relationshipType}
          onChange={onSelectChange}
          style={{ width: 180 }}
        >
          <option value="fusion">+ / - Adequate</option>
          <option value="distance">Distance</option>
          <option value="cutoff">Cutoff</option>
          <option value="conflict">Conflict</option>
          <option value="projection">Projection</option>
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="status" style={labelStyle}>Status:</label>
        <select
          id="status"
          name="status"
          value={emotionalDraft.status || 'ongoing'}
          onChange={onSelectChange}
          style={{ width: 160 }}
        >
          <option value="ongoing">Ongoing</option>
          <option value="ended">Ended</option>
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="lineStyle" style={labelStyle}>Intensity:</label>
        <select
          id="lineStyle"
          name="lineStyle"
          value={emotionalDraft.lineStyle}
          onChange={onSelectChange}
          style={{ width: 180 }}
        >
          {styleOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="startDate" style={labelStyle}>Start:</label>
        <DatePickerField
          id="startDate"
          name="startDate"
          value={emotionalDraft.startDate}
          placeholder="YYYY-MM-DD"
          onChange={onInputChange}
          pickerLabel="Select emotional line start date"
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="emotionalIntensityLevel" style={labelStyle}>Intensity Level:</label>
        <select
          id="emotionalIntensityLevel"
          value={emotionalIntensityDraft}
          onChange={(e) => onIntensityLevelChange(Number(e.target.value))}
          style={{ width: 180 }}
        >
          {intensityLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {intensityChooserConfig && (
          <button
            type="button"
            aria-label={intensityChooserConfig.buttonLabel}
            onClick={() => setIntensityHelpOpen(true)}
            style={helpBadgeStyle}
          >
            ?
          </button>
        )}
      </div>
      {intensityChooserConfig && intensityHelpOpen && (
        <div
          role="dialog"
          aria-label={intensityChooserConfig.title}
          style={{
            marginTop: 8,
            width: '100%',
            maxWidth: '100%',
            border: '1px solid #c6cfde',
            borderRadius: 10,
            background: '#fff',
            padding: '12px 14px',
            boxShadow: '0 10px 28px rgba(28, 41, 61, 0.16)',
            position: 'relative',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <strong>{intensityChooserConfig.title}</strong>
            <button type="button" onClick={() => setIntensityHelpOpen(false)} style={{ padding: '4px 10px' }}>
              Cancel
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {intensityChooserConfig.helpLines.map((line, index) => {
              const level = index + 1;
              const isActive = emotionalIntensityDraft === level;
              return (
                <button
                  key={line}
                  type="button"
                  onClick={() => {
                    onIntensityLevelChange(level);
                    setIntensityHelpOpen(false);
                  }}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${isActive ? '#4b68a6' : '#d4dae5'}`,
                    borderRadius: 8,
                    background: isActive ? '#eef3ff' : '#fff',
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#23324a' }}>
                    {intensityChooserConfig.labels[index]}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>{line}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={rowStyle}>
        <label htmlFor="emotionalImpact" style={labelStyle}>Impact:</label>
        <select
          id="emotionalImpact"
          value={emotionalImpactDraft}
          onChange={(e) => onImpactChange(Number(e.target.value))}
          style={{ width: 180 }}
        >
          {IMPACT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="emotionalFrequency" style={labelStyle}>Frequency:</label>
        <select
          id="emotionalFrequency"
          value={emotionalFrequencyDraft}
          onChange={(e) => onFrequencyChange(Number(e.target.value))}
          style={{ width: 180 }}
        >
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="endDate" style={labelStyle}>End Date:</label>
        <DatePickerField
          id="endDate"
          name="endDate"
          value={emotionalDraft.endDate}
          placeholder="YYYY-MM-DD"
          onChange={onInputChange}
          pickerLabel="Select emotional line end date"
        />
      </div>
      <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
        <label htmlFor="emotionalNotes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
        <textarea
          id="emotionalNotes"
          name="notes"
          value={emotionalDraft.notes || ''}
          onChange={onInputChange}
          rows={5}
          style={{ width: '100%', minHeight: '6rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
        />
      </div>
      <div style={{ ...rowStyle, alignItems: 'center' }}>
        <label htmlFor="lineColor" style={labelStyle}>Color:</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            id="lineColor"
            name="color"
            value={emotionalDraft.color || '#444444'}
            onChange={onInputChange}
            style={{ width: 60 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => onColorPresetSelect(hex)}
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
      {triangleId && (
        <>
          <div style={rowStyle}>
            <label htmlFor="triangleIntensity" style={labelStyle}>Triangle Intensity:</label>
            <select
              id="triangleIntensity"
              value={triangleIntensityDraft || 'medium'}
              onChange={(e) => onTriangleIntensityChange?.(e.target.value as 'low' | 'medium' | 'high')}
              style={{ width: 180 }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ ...rowStyle, alignItems: 'center' }}>
            <label htmlFor="triangleColor" style={labelStyle}>Triangle Color:</label>
            <input
              type="color"
              id="triangleColor"
              value={triangleColorDraft || '#8a5a00'}
              onChange={(e) => onTriangleColorChange?.(e.target.value)}
              style={{ width: 60 }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default EPLPropertiesSection;
