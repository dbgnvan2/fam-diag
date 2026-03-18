import React, { useRef, useState, useEffect } from 'react';

interface DatePickerFieldProps {
  id: string;
  name: string;
  value?: string | null;
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  buttonLabel?: string;
  pickerLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DatePickerField = ({
  id,
  name,
  value,
  placeholder,
  onChange,
  inputStyle,
  containerStyle,
  buttonLabel,
  pickerLabel,
  disabled = false,
  autoFocus = false,
}: DatePickerFieldProps) => {
  const nativePickerRef = useRef<HTMLInputElement>(null);
  // Local text buffer so the user can type freely without the parent overwriting mid-edit
  const [localText, setLocalText] = useState<string>(value ?? '');
  const isFocusedRef = useRef(false);

  // Sync external value changes (e.g. picker selection) when the field isn't being typed in
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalText(value ?? '');
    }
  }, [value]);

  const normalizedValue = value && VALID_DATE.test(value) ? value : '';

  const openNativePicker = () => {
    const node = nativePickerRef.current;
    if (!node) return;
    if (typeof (node as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      (node as HTMLInputElement & { showPicker?: () => void }).showPicker!();
    } else {
      node.click();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalText(raw);
    // Commit to parent immediately if it looks like a complete, valid date
    if (VALID_DATE.test(raw)) {
      onChange(e);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // On blur, commit whatever is in the field (including clearing it)
    const text = localText.trim();
    if (text === '' || VALID_DATE.test(text)) {
      // Fire a synthetic change event so the parent stores the final value
      const syntheticEvent = {
        target: { name, value: text },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      // Invalid — restore to last known good value
      setLocalText(value ?? '');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        ...(containerStyle || {}),
      }}
    >
      <input
        type="text"
        id={id}
        name={name}
        placeholder={placeholder || 'YYYY-MM-DD'}
        value={localText}
        onChange={handleTextChange}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={handleBlur}
        style={{ width: '11ch', textAlign: 'left', ...(inputStyle || {}) }}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={openNativePicker}
        aria-label={buttonLabel || pickerLabel || 'Select date'}
        disabled={disabled}
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          border: '1px solid #bbb',
          background: disabled ? '#eee' : '#f5f5f5',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        📅
      </button>
      <input
        ref={nativePickerRef}
        type="date"
        id={`${id}-native`}
        name={name}
        value={normalizedValue}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
};

export default DatePickerField;
