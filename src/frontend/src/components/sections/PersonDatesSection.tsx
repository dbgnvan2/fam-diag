/**
 * PersonDatesSection — birth/death/gender dates, birth sex, gender identity, adoption, parent connection.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup).
 */
import React from 'react';
import type { Person } from '../../types';
import DatePickerField from '../DatePickerField';

const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };
const sectionCardStyle: React.CSSProperties = {
  marginTop: 12,
  border: '1px solid #d4dae5',
  borderRadius: 8,
  background: '#fff',
  padding: '10px 12px 12px',
};

const defaultGenderIdentityForBirthSex = (birthSex?: Person['birthSex']): Person['genderIdentity'] =>
  birthSex === 'male' ? 'masculine' : birthSex === 'intersex' ? 'nonbinary' : 'feminine';

interface PersonDatesSectionProps {
  personDraft: Person;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
}

const PersonDatesSection = ({ personDraft, onChange }: PersonDatesSectionProps) => {
  const birthSex =
    personDraft.birthSex ||
    (personDraft.gender === 'male' ? 'male' : personDraft.gender === 'intersex' ? 'intersex' : 'female');
  const genderIdentity =
    personDraft.genderIdentity || defaultGenderIdentityForBirthSex(birthSex as Person['birthSex']);

  return (
    <div
      role="tabpanel"
      id="person-section-panel-dates"
      aria-labelledby="person-section-tab-dates"
      style={sectionCardStyle}
    >
      <div style={{ fontWeight: 700, color: '#23324a' }}>Dates</div>
      <div style={rowStyle}>
        <label htmlFor="birthDate" style={labelStyle}>Birth Date:</label>
        <DatePickerField
          id="birthDate"
          name="birthDate"
          value={personDraft.birthDate}
          placeholder="YYYY-MM-DD"
          onChange={onChange}
          pickerLabel="Select birth date"
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="deathDate" style={labelStyle}>Death Date:</label>
        <DatePickerField
          id="deathDate"
          name="deathDate"
          value={personDraft.deathDate}
          placeholder="YYYY-MM-DD"
          onChange={onChange}
          pickerLabel="Select death date"
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="birthSex" style={labelStyle}>Birth Sex:</label>
        <select
          id="birthSex"
          name="birthSex"
          value={birthSex}
          onChange={onChange}
          style={{ width: 160 }}
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="intersex">Intersex</option>
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="genderIdentity" style={labelStyle}>Gender:</label>
        <select
          id="genderIdentity"
          name="genderIdentity"
          value={genderIdentity}
          onChange={onChange}
          style={{ width: 180 }}
        >
          <option value="feminine">Feminine</option>
          <option value="masculine">Masculine</option>
          <option value="nonbinary">Non-Binary</option>
          <option value="agender">Agender</option>
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="genderDate" style={labelStyle}>Gender Date:</label>
        <DatePickerField
          id="genderDate"
          name="genderDate"
          value={personDraft.genderDate}
          placeholder="YYYY-MM-DD"
          onChange={onChange}
          pickerLabel="Select gender date"
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="adoptionStatus" style={labelStyle}>Adoption Status:</label>
        <select
          id="adoptionStatus"
          name="adoptionStatus"
          value={personDraft.adoptionStatus || 'biological'}
          onChange={onChange}
          style={{ width: 160 }}
        >
          <option value="biological">Biological</option>
          <option value="adopted">Adopted</option>
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="adoptionDate" style={labelStyle}>Adoption Date:</label>
        <DatePickerField
          id="adoptionDate"
          name="adoptionDate"
          value={personDraft.adoptionDate}
          placeholder="YYYY-MM-DD"
          onChange={onChange}
          pickerLabel="Select adoption date"
        />
      </div>
      {(personDraft.parentPartnership || personDraft.birthParentPartnership) && (
        <div style={rowStyle}>
          <label htmlFor="parentConnectionPattern" style={labelStyle}>Parent Line Pattern:</label>
          <select
            id="parentConnectionPattern"
            name="parentConnectionPattern"
            value={personDraft.parentConnectionPattern || 'none'}
            onChange={onChange}
            style={{ width: 180 }}
          >
            <option value="none">None</option>
            <option value="family-cutoff">Family Cutoff</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default PersonDatesSection;
