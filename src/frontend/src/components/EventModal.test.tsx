/**
 * EventModal tests — covers category/subtype dropdown correctness for all event types,
 * including the family event locked-type and stale-category normalization cases.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventModal from './EventModal';
import type { EmotionalProcessEvent } from '../types';

const baseProps = {
  position: null,
  popupLeft: 0,
  popupTop: 0,
  popupMaxHeight: null,
  primaryPersonOptions: ['Alice', 'Bob'],
  otherPersonOptions: ['None', 'Alice', 'Bob'],
  eventCategories: ['Job', 'Health'],
  symptomTypeOptions: ['Anxiety', 'Headache'],
  resolvedEventClass: 'event' as const,
  onChange: vi.fn(),
  onSetDraft: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

const makeDraft = (overrides: Partial<EmotionalProcessEvent> = {}): EmotionalProcessEvent => ({
  id: 'ev1',
  eventType: 'NODAL',
  eventClass: 'event',
  anchorType: 'PERSON',
  anchorId: 'p1',
  category: 'Birth',
  subtype: '',
  status: 'discrete',
  intensity: 1,
  frequency: 1,
  impact: 1,
  howWell: 0,
  date: '2024-01-01',
  startDate: '2024-01-01',
  wwwwh: '',
  observations: '',
  primaryPersonName: 'Alice',
  otherPersonName: 'None',
  ...overrides,
});

describe('EventModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows subtype dropdown with correct options for FAMILY + Triangles', async () => {
    render(
      <EventModal
        {...baseProps}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: 'Triangles', subtype: 'Functioning' })}
      />
    );
    const subtypeSelect = screen.getByLabelText('Type:') as HTMLSelectElement;
    expect(subtypeSelect.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Functioning' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Flexibility' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Stress Response' })).toBeInTheDocument();
  });

  it('shows subtype dropdown with correct options for FAMILY + Stress', () => {
    render(
      <EventModal
        {...baseProps}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: 'Stress', subtype: 'Adaptability' })}
      />
    );
    const subtypeSelect = screen.getByLabelText('Type:') as HTMLSelectElement;
    expect(subtypeSelect.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Emotional Reactivity' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Adaptability' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Family Stressor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chronic Stress' })).toBeInTheDocument();
  });

  it('auto-corrects stale category Triangle → Triangles on mount and shows subtype dropdown', async () => {
    const onSetDraft = vi.fn();
    render(
      <EventModal
        {...baseProps}
        onSetDraft={onSetDraft}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: 'Triangle', subtype: '' })}
      />
    );
    // onSetDraft should be called with corrected category 'Triangles'
    expect(onSetDraft).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Triangles' })
    );
  });

  it('auto-corrects empty category on mount for FAMILY events', () => {
    const onSetDraft = vi.fn();
    render(
      <EventModal
        {...baseProps}
        onSetDraft={onSetDraft}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: '', subtype: '' })}
      />
    );
    expect(onSetDraft).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Triangles' })
    );
  });

  it('shows Type as read-only text when lockEventType is true', () => {
    render(
      <EventModal
        {...baseProps}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: 'Triangles', subtype: 'Functioning' })}
      />
    );
    // Type label row should show "Family" as text, not a select
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.queryByLabelText('Group:')).not.toBeInTheDocument();
  });

  it('shows Type as editable dropdown when lockEventType is false', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth', subtype: '' })}
      />
    );
    expect(screen.getByLabelText('Group:')).toBeInTheDocument();
    expect((screen.getByLabelText('Group:') as HTMLSelectElement).tagName).toBe('SELECT');
  });

  it('resets subtype to first valid option when category changes', () => {
    const onSetDraft = vi.fn();
    render(
      <EventModal
        {...baseProps}
        onSetDraft={onSetDraft}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: 'Triangles', subtype: 'Functioning' })}
      />
    );
    const catSelect = screen.getByLabelText('Category:');
    fireEvent.change(catSelect, { target: { value: 'Stress' } });
    expect(onSetDraft).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Stress', subtype: 'Emotional Reactivity' })
    );
  });

  it('calls onSave when Save button is clicked', () => {
    const onSave = vi.fn();
    render(
      <EventModal
        {...baseProps}
        onSave={onSave}
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <EventModal
        {...baseProps}
        onCancel={onCancel}
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows text input for subtype when no predefined options (NODAL)', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth', subtype: '' })}
      />
    );
    const subtypeInput = screen.getByLabelText('Type:') as HTMLInputElement;
    expect(subtypeInput.tagName).toBe('INPUT');
  });

  // ── SYMPTOM ──────────────────────────────────────────────────────────────────

  it('SYMPTOM: shows Notes label (not Observations)', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'SYMPTOM', category: 'Physical', subtype: 'Headache' })}
      />
    );
    expect(screen.getByLabelText('Notes:')).toBeInTheDocument();
    expect(screen.queryByLabelText('Observations:')).not.toBeInTheDocument();
  });

  it('SYMPTOM: shows text input with datalist for subtype', () => {
    const { container } = render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'SYMPTOM', category: 'Physical', subtype: '' })}
      />
    );
    const subtypeInput = screen.getByLabelText('Type:') as HTMLInputElement;
    expect(subtypeInput.tagName).toBe('INPUT');
    expect(subtypeInput.getAttribute('list')).toBe('eventSubtypeOptions');
    // datalist options are not accessible via getByRole — query the datalist directly
    const datalist = container.querySelector('#eventSubtypeOptions');
    expect(datalist).not.toBeNull();
    expect(datalist!.querySelector('option[value="Anxiety"]')).not.toBeNull();
    expect(datalist!.querySelector('option[value="Headache"]')).not.toBeNull();
  });

  it('SYMPTOM: category dropdown shows Physical / Emotional / Social', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'SYMPTOM', category: 'Emotional', subtype: '' })}
      />
    );
    const catSelect = screen.getByLabelText('Category:') as HTMLSelectElement;
    expect(catSelect.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Physical' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Emotional' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Social' })).toBeInTheDocument();
  });

  it('SYMPTOM: auto-corrects invalid category on mount', () => {
    const onSetDraft = vi.fn();
    render(
      <EventModal
        {...baseProps}
        onSetDraft={onSetDraft}
        eventDraft={makeDraft({ eventType: 'SYMPTOM', category: 'InvalidCat', subtype: '' })}
      />
    );
    expect(onSetDraft).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Physical' })
    );
  });

  // ── EPE ──────────────────────────────────────────────────────────────────────

  it('EPE: category dropdown shows EPE options', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'EPE', category: '+/- Adequate', subtype: '' })}
      />
    );
    const catSelect = screen.getByLabelText('Category:') as HTMLSelectElement;
    expect(catSelect.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: '+/- Adequate' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cutoff' })).toBeInTheDocument();
  });

  it('EPE: subtype is text input (no dropdown)', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'EPE', category: 'Conflict', subtype: '' })}
      />
    );
    expect((screen.getByLabelText('Type:') as HTMLInputElement).tagName).toBe('INPUT');
  });

  // ── EA ───────────────────────────────────────────────────────────────────────

  it('EA: category shows Emotional Autonomy and subtype is text input', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'EA', category: 'Emotional Autonomy', subtype: '' })}
      />
    );
    const catSelect = screen.getByLabelText('Category:') as HTMLSelectElement;
    expect(catSelect.tagName).toBe('SELECT');
    expect(catSelect.value).toBe('Emotional Autonomy');
    expect((screen.getByLabelText('Type:') as HTMLInputElement).tagName).toBe('INPUT');
  });

  // ── FOO ──────────────────────────────────────────────────────────────────────

  it('FOO: category dropdown shows FOO options and subtype is text input', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'FOO', category: 'Family Stability', subtype: '' })}
      />
    );
    expect(screen.getByRole('option', { name: 'Family Stability' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Family Intactness' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Triangle Flexibility' })).toBeInTheDocument();
    expect((screen.getByLabelText('Type:') as HTMLInputElement).tagName).toBe('INPUT');
  });

  // ── TRIANGLE ─────────────────────────────────────────────────────────────────

  it('TRIANGLE: category shows Primary / Secondary and subtype is text input', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'TRIANGLE', category: 'Primary', subtype: '' })}
      />
    );
    expect(screen.getByRole('option', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Secondary' })).toBeInTheDocument();
    expect((screen.getByLabelText('Type:') as HTMLInputElement).tagName).toBe('INPUT');
  });

  // ── PAPERO ─────────────────────────────────────────────────────────────────────

  it('PAPERO: category dropdown shows all 5 Papero categories', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'PAPERO', category: 'Resourceful', subtype: '' })}
      />
    );
    expect(screen.getByRole('option', { name: 'Resourceful' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Connectedness & Integration' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tension Management' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Systems Thinking' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Goal Structure' })).toBeInTheDocument();
  });

  it('PAPERO: shows person fields', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'PAPERO', category: 'Resourceful', subtype: 'Engagement with Issue' })}
      />
    );
    expect(screen.getByLabelText('Primary Person:')).toBeInTheDocument();
  });

  // ── FF (Functional Fact) ─────────────────────────────────────────────────────

  it('FF: category dropdown shows configured functional fact categories', () => {
    render(
      <EventModal
        {...baseProps}
        functionalFactCategoryNames={['Coping', 'Competence', 'Agency']}
        eventDraft={makeDraft({ eventType: 'FF', category: 'Coping', subtype: '' })}
      />
    );
    expect(screen.getByRole('option', { name: 'Coping' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Competence' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Agency' })).toBeInTheDocument();
  });

  it('FF: shows person fields', () => {
    render(
      <EventModal
        {...baseProps}
        functionalFactCategoryNames={['Coping']}
        eventDraft={makeDraft({ eventType: 'FF', category: 'Coping', subtype: 'Self-regulation' })}
      />
    );
    expect(screen.getByLabelText('Primary Person:')).toBeInTheDocument();
    expect(screen.getByLabelText('Other Person:')).toBeInTheDocument();
  });

  it('FF: shows subtype as text input', () => {
    render(
      <EventModal
        {...baseProps}
        functionalFactCategoryNames={['Coping']}
        eventDraft={makeDraft({ eventType: 'FF', category: 'Coping', subtype: 'Mindfulness' })}
      />
    );
    expect((screen.getByLabelText('Type:') as HTMLInputElement).tagName).toBe('INPUT');
  });

  it('FF: falls back to empty categories when no functionalFactCategoryNames provided', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'FF', category: '', subtype: '' })}
      />
    );
    // Should render without errors — no category options but modal still works
    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  // ── Person fields visibility ──────────────────────────────────────────────────

  it('FAMILY: does not show Primary Person or Other Person fields', () => {
    render(
      <EventModal
        {...baseProps}
        lockEventType
        eventDraft={makeDraft({ eventType: 'FAMILY', category: 'Triangles', subtype: 'Functioning' })}
      />
    );
    expect(screen.queryByLabelText('Primary Person:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Other Person:')).not.toBeInTheDocument();
  });

  it('NODAL: shows Primary Person and Other Person fields', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth', subtype: '' })}
      />
    );
    expect(screen.getByLabelText('Primary Person:')).toBeInTheDocument();
    expect(screen.getByLabelText('Other Person:')).toBeInTheDocument();
  });

  it('SYMPTOM: shows Primary Person and Other Person fields', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'SYMPTOM', category: 'Physical', subtype: '' })}
      />
    );
    expect(screen.getByLabelText('Primary Person:')).toBeInTheDocument();
    expect(screen.getByLabelText('Other Person:')).toBeInTheDocument();
  });

  // ── modalTitle (click-path breadcrumb) ───────────────────────────────────────

  it('shows custom modalTitle when provided', () => {
    render(
      <EventModal
        {...baseProps}
        modalTitle="Person Add Symptom Emotional"
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth' })}
      />
    );
    expect(screen.getByText('Person Add Symptom Emotional')).toBeInTheDocument();
  });

  it('falls back to "Event" title when modalTitle is not provided', () => {
    render(
      <EventModal
        {...baseProps}
        eventDraft={makeDraft({ eventType: 'NODAL', category: 'Birth' })}
      />
    );
    expect(screen.getByText('Event')).toBeInTheDocument();
  });
});
