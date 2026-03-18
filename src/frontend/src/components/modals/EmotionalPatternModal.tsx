import type { EmotionalLine } from '../../types';
import type { EmotionalPatternDraft } from '../../types/diagramEditor';
import { LINE_STYLE_VALUES, intensityValueForLineStyle } from '../../utils/emotionalPatternOptions';
import EPLPropertiesSection from '../sections/EPLPropertiesSection';

interface EmotionalPatternModalProps {
  open: boolean;
  draft: EmotionalPatternDraft | null;
  onUpdate: (updates: Partial<EmotionalPatternDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}

const EmotionalPatternModal = ({ open, draft, onUpdate, onCancel, onSave }: EmotionalPatternModalProps) => {
  if (!open || !draft) return null;

  // Bridge draft → EmotionalLine shape for EPLPropertiesSection
  const emotionalDraft: EmotionalLine = {
    id: '',
    person1_id: draft.person1Id,
    person2_id: draft.person2Id,
    relationshipType: draft.relationshipType,
    status: draft.status,
    lineStyle: draft.lineStyle,
    lineEnding: 'none',
    startDate: draft.startDate,
    endDate: draft.endDate || undefined,
    notes: draft.notes || undefined,
    color: draft.color,
    events: [],
  };

  const handleSelectChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const { name, value } = e.target;
    if (name === 'relationshipType') {
      const relationshipType = value as EmotionalLine['relationshipType'];
      const validStyles = LINE_STYLE_VALUES[relationshipType] || [];
      const nextStyle = validStyles.includes(draft.lineStyle) ? draft.lineStyle : validStyles[0];
      onUpdate({ relationshipType, lineStyle: nextStyle });
    } else if (name === 'lineStyle') {
      const lineStyle = value as EmotionalLine['lineStyle'];
      onUpdate({ lineStyle, intensityLevel: intensityValueForLineStyle(lineStyle) });
    } else if (name === 'status') {
      onUpdate({ status: value as NonNullable<EmotionalLine['status']> });
    }
  };

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (e) => {
    const { name, value } = e.target;
    if (name === 'startDate') onUpdate({ startDate: value });
    else if (name === 'endDate') onUpdate({ endDate: value });
    else if (name === 'notes') onUpdate({ notes: value });
    else if (name === 'color') onUpdate({ color: value });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2075,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 16,
          width: 560,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Add Emotional Pattern</h4>
        <EPLPropertiesSection
          emotionalDraft={emotionalDraft}
          emotionalIntensityDraft={draft.intensityLevel}
          emotionalImpactDraft={draft.impact}
          emotionalFrequencyDraft={draft.frequency}
          onSelectChange={handleSelectChange}
          onInputChange={handleInputChange}
          onIntensityLevelChange={(level) => onUpdate({ intensityLevel: level })}
          onImpactChange={(impact) => onUpdate({ impact })}
          onFrequencyChange={(frequency) => onUpdate({ frequency })}
          onColorPresetSelect={(color) => onUpdate({ color })}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default EmotionalPatternModal;
