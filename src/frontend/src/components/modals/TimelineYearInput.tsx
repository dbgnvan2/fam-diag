/**
 * A year box that can be typed into. The Timeline's Start / End Year inputs
 * clamped on every keystroke, so typing "1" of "1975" snapped straight to the
 * lowest year and a year could never be entered digit by digit. This keeps
 * the typed text and commits it — clamped — on blur or Enter.
 */
import React, { useEffect, useState } from 'react';

interface TimelineYearInputProps {
  value: number | null;
  min: number;
  max: number;
  ariaLabel: string;
  onCommit: (year: number) => void;
  onFocus?: () => void;
  style?: React.CSSProperties;
}

const TimelineYearInput = ({ value, min, max, ariaLabel, onCommit, onFocus, style }: TimelineYearInputProps) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text.trim());
    if (!text.trim() || !Number.isFinite(parsed)) {
      setText(value == null ? '' : String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="number"
      aria-label={ariaLabel}
      value={text}
      min={min}
      max={max}
      onFocus={onFocus}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      style={style}
    />
  );
};

export default TimelineYearInput;
