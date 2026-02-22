import React, { useRef } from 'react';

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
  const normalizedValue =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

  const openNativePicker = () => {
    const node = nativePickerRef.current;
    if (!node) return;
    if (typeof (node as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      (node as HTMLInputElement & { showPicker?: () => void }).showPicker!();
    } else {
      node.click();
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
        placeholder={placeholder}
        value={value ?? ''}
        onChange={onChange}
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
