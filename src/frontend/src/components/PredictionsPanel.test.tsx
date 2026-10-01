import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PredictionsPanel from './PredictionsPanel';
import type { Person, Prediction, PredictionSet, SIRCategoryDefinition } from '../types';

const makePerson = (id: string, name: string, events: Person['events'] = []): Person =>
  ({ id, name, x: 0, y: 0, gender: 'male', partnerships: [], events } as unknown as Person);

const people: Person[] = [makePerson('p1', 'Alice'), makePerson('p2', 'Bob')];

const defaultSirCategories: SIRCategoryDefinition[] = [
  { id: 'sir-1', name: 'Resource to Other', levels: ['L1', 'L2', 'L3', 'L4', 'L5'] },
  { id: 'sir-2', name: 'Managing Reactivity', levels: ['L1', 'L2', 'L3', 'L4', 'L5'] },
];

const makePrediction = (overrides?: Partial<Prediction>): Prediction => ({
  id: 'pred-1',
  title: 'Test Hypothesis',
  status: 'active',
  createdDate: '2026-03-22',
  conditions: [],
  outcomes: [],
  notes: '',
  ...overrides,
});

const makeSet = (overrides?: Partial<PredictionSet>): PredictionSet => ({
  id: 'set-1',
  name: 'My Set',
  createdDate: '2026-03-22',
  predictions: [],
  ...overrides,
});

const noop = vi.fn();
const noopReturn = vi.fn(() => 'new-id');

const defaultProps = () => ({
  isOpen: true,
  predictionSets: [] as PredictionSet[],
  people,
  sirCategories: defaultSirCategories,
  onClose: vi.fn(),
  onAddSet: noopReturn,
  onRenameSet: noop,
  onDeleteSet: noop,
  onAddPrediction: noopReturn,
  onUpdatePrediction: noop,
  onDeletePrediction: noop,
  onResolvePrediction: noop,
  onAddCondition: noop,
  onUpdateCondition: noop,
  onRemoveCondition: noop,
  onAddOutcome: noop,
  onUpdateOutcome: noop,
  onRemoveOutcome: noop,
  onAddEvidence: noop,
  onRemoveEvidence: noop,
});

describe('PredictionsPanel', () => {
  it('returns null when not open', () => {
    const { container } = render(<PredictionsPanel {...defaultProps()} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows set list view when no active set', () => {
    render(<PredictionsPanel {...defaultProps()} />);
    expect(screen.getByText('Prediction Sets')).toBeTruthy();
  });

  it('shows empty state when no sets exist', () => {
    render(<PredictionsPanel {...defaultProps()} />);
    expect(screen.getByText(/No prediction sets yet/)).toBeTruthy();
  });

  it('lists existing sets', () => {
    const sets = [makeSet(), makeSet({ id: 'set-2', name: 'Another Set' })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    expect(screen.getByText('My Set')).toBeTruthy();
    expect(screen.getByText('Another Set')).toBeTruthy();
  });

  it('calls onAddSet when Create is clicked', () => {
    const onAddSet = vi.fn(() => 'new-set-id');
    render(<PredictionsPanel {...defaultProps()} onAddSet={onAddSet} />);
    // Type a name and click Create
    const input = screen.getByPlaceholderText('New set name...');
    fireEvent.change(input, { target: { value: 'Test Set' } });
    fireEvent.click(screen.getByText('+ Create'));
    expect(onAddSet).toHaveBeenCalledWith('Test Set');
  });

  it('calls onDeleteSet when delete is clicked on a set', () => {
    const onDeleteSet = vi.fn(() => true);
    const sets = [makeSet()];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} onDeleteSet={onDeleteSet} />);
    fireEvent.click(screen.getByLabelText('Delete set'));
    expect(onDeleteSet).toHaveBeenCalledWith('set-1');
  });

  it('opens set view when a set is clicked', () => {
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    // Should now show prediction content, not set list
    expect(screen.getByText('Test Hypothesis')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PredictionsPanel {...defaultProps()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close predictions panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows active and resolved sections in set view', () => {
    const active = makePrediction({ id: 'a1', title: 'Active One', status: 'active' });
    const resolved = makePrediction({ id: 'r1', title: 'Resolved One', status: 'supported' });
    const sets = [makeSet({ predictions: [active, resolved] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    expect(screen.getByText('Active (1)')).toBeTruthy();
    expect(screen.getByText('Resolved (1)')).toBeTruthy();
  });

  it('expands a prediction card to show conditions and outcomes', () => {
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('IF (Conditions)')).toBeTruthy();
    expect(screen.getByText('THEN (Outcomes)')).toBeTruthy();
    expect(screen.getByText('+ Add Condition')).toBeTruthy();
    expect(screen.getByText('+ Add Outcome')).toBeTruthy();
  });

  it('calls onAddCondition with setId and predId', () => {
    const onAddCondition = vi.fn();
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} onAddCondition={onAddCondition} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    fireEvent.click(screen.getByText('+ Add Condition'));
    expect(onAddCondition).toHaveBeenCalledWith('set-1', 'pred-1');
  });

  it('calls onAddOutcome with setId and predId', () => {
    const onAddOutcome = vi.fn();
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} onAddOutcome={onAddOutcome} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    fireEvent.click(screen.getByText('+ Add Outcome'));
    expect(onAddOutcome).toHaveBeenCalledWith('set-1', 'pred-1');
  });

  it('calls onDeletePrediction with setId and predId', () => {
    const onDelete = vi.fn();
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} onDeletePrediction={onDelete} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    fireEvent.click(screen.getByLabelText('Delete prediction'));
    expect(onDelete).toHaveBeenCalledWith('set-1', 'pred-1');
  });

  it('renders conditions with type and description', () => {
    const pred = makePrediction({
      conditions: [
        { id: 'c1', type: 'sir', personId: 'p1', description: 'Stay calm', evidence: [], linkedPaperoKey: undefined, linkedSIRCategory: undefined },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    const inputs = document.querySelectorAll('input[type="text"]');
    const descInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === 'Stay calm');
    expect(descInput).toBeTruthy();
  });

  it('renders outcomes with description', () => {
    const pred = makePrediction({
      outcomes: [
        { id: 'o1', description: 'Reconciliation', personIds: ['p2'], evidence: [] },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    const inputs = document.querySelectorAll('input[type="text"]');
    const descInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === 'Reconciliation');
    expect(descInput).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders evidence rows with direction indicator', () => {
    const pred = makePrediction({
      conditions: [
        {
          id: 'c1',
          type: 'custom',
          description: 'Test condition',
          evidence: [
            { id: 'ev1', date: '2026-03-20', type: 'observation', direction: 'supports', notes: 'Good progress seen' },
          ],
        },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('Good progress seen')).toBeTruthy();
    expect(screen.getByText('2026-03-20')).toBeTruthy();
  });

  it('shows SIR category dropdown when condition type is sir and person selected', () => {
    const pred = makePrediction({
      conditions: [
        { id: 'c1', type: 'sir', personId: 'p1', description: '', evidence: [] },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('SIR Category:')).toBeTruthy();
    expect(screen.getByText('— Select Category —')).toBeTruthy();
    const selects = document.querySelectorAll('select');
    const categorySelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === 'Resource to Other'),
    );
    expect(categorySelect).toBeTruthy();
  });

  it('shows existing SIR events for linking when category is selected', () => {
    const sirEvent = {
      id: 'sir-ev-1',
      date: '2026-03-15',
      startDate: '2026-03-15',
      category: 'Resource to Other',
      eventType: 'SIR' as const,
      subtype: 'Stayed helpful',
      intensity: 3,
      frequency: 2,
      howWell: 4,
      otherPersonName: 'Bob',
      primaryPersonName: 'Alice',
      anchorType: 'PERSON' as const,
      anchorId: 'p1',
      status: 'discrete' as const,
      wwwwh: '',
      observations: '',
      eventClass: 'individual' as const,
      impact: 0,
      createdAt: Date.now(),
    };
    const peopleWithEvents = [
      makePerson('p1', 'Alice', [sirEvent]),
      makePerson('p2', 'Bob'),
    ];
    const pred = makePrediction({
      conditions: [
        { id: 'c1', type: 'sir', personId: 'p1', linkedSIRCategory: 'Resource to Other', description: '', evidence: [] },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} people={peopleWithEvents} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('Link existing SIR entry:')).toBeTruthy();
    expect(screen.getByText('Stayed helpful')).toBeTruthy();
  });

  it('shows Papero topic dropdown when condition type is papero and person selected', () => {
    const pred = makePrediction({
      conditions: [
        { id: 'c1', type: 'papero', personId: 'p1', description: '', evidence: [] },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('Papero Topic:')).toBeTruthy();
    expect(screen.getByText('— Select Topic —')).toBeTruthy();
    const selects = document.querySelectorAll('select');
    const topicSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === 'Engagement with Issue'),
    );
    expect(topicSelect).toBeTruthy();
  });

  it('shows current Papero score when topic is selected', () => {
    const personWithPapero = {
      ...makePerson('p1', 'Alice'),
      paperoScores: { resourceful_engagement: 3 },
    } as unknown as Person;
    const pred = makePrediction({
      conditions: [
        { id: 'c1', type: 'papero', personId: 'p1', linkedPaperoKey: 'resourceful_engagement', description: '', evidence: [] },
      ],
    });
    const sets = [makeSet({ predictions: [pred] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} people={[personWithPapero, makePerson('p2', 'Bob')]} />);
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText(/current score = 3\/5/)).toBeTruthy();
  });

  it('navigates back to set list when back button clicked', () => {
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} />);
    fireEvent.click(screen.getByText('My Set'));
    // Should be in set view
    expect(screen.getByText('Test Hypothesis')).toBeTruthy();
    // Click back
    fireEvent.click(screen.getByText('← Back'));
    // Should be back in set list
    expect(screen.getByText('Prediction Sets')).toBeTruthy();
  });

  it('shows Close button in set list view and calls onClose', () => {
    const onClose = vi.fn();
    render(<PredictionsPanel {...defaultProps()} onClose={onClose} />);
    const saveBtn = screen.getByText('Close');
    expect(saveBtn).toBeTruthy();
    fireEvent.click(saveBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Close button in active set view and calls onClose', () => {
    const onClose = vi.fn();
    const sets = [makeSet({ predictions: [makePrediction()] })];
    render(<PredictionsPanel {...defaultProps()} predictionSets={sets} onClose={onClose} />);
    fireEvent.click(screen.getByText('My Set'));
    const saveBtn = screen.getByText('Close');
    expect(saveBtn).toBeTruthy();
    fireEvent.click(saveBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── REVIEW-gap-areas-2026-09-30 ────────────────────────────────────────────

  const openFirstPrediction = () => {
    fireEvent.click(screen.getByText('My Set'));
    fireEvent.click(screen.getByText('Test Hypothesis'));
  };

  it('evidence starts with no date and no direction, and needs both notes and a direction (GTEST-07)', () => {
    const onAddEvidence = vi.fn();
    const pred = makePrediction({ conditions: [{ id: 'c1', type: 'custom', description: 'x', evidence: [] }] });
    render(<PredictionsPanel {...defaultProps()} predictionSets={[makeSet({ predictions: [pred] })]} onAddEvidence={onAddEvidence} />);
    openFirstPrediction();
    fireEvent.click(screen.getByText('+ Evidence'));
    expect((screen.getByLabelText('Evidence date') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Evidence direction') as HTMLSelectElement).value).toBe('');
    const add = screen.getByText('Add') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Observation...'), { target: { value: 'seen' } });
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Evidence direction'), { target: { value: 'contradicts' } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(onAddEvidence).toHaveBeenCalledWith('set-1', 'pred-1', 'condition', 'c1', {
      date: '',
      type: 'observation',
      direction: 'contradicts',
      notes: 'seen',
    });
  });

  it('linking a SIR entry writes only the link, never description text (F-14)', () => {
    const onUpdateCondition = vi.fn();
    const sirEvent = {
      id: 'sir-ev-1', date: '2026-03-15', startDate: '2026-03-15', category: 'Resource to Other',
      eventType: 'SIR' as const, subtype: 'Stayed helpful', intensity: 3, frequency: 2, howWell: 4,
      otherPersonName: 'Bob', primaryPersonName: 'Alice', anchorType: 'PERSON' as const, anchorId: 'p1',
      status: 'discrete' as const, wwwwh: '', observations: '', eventClass: 'individual' as const, impact: 0, createdAt: 1,
    };
    const pred = makePrediction({
      conditions: [{ id: 'c1', type: 'sir', personId: 'p1', linkedSIRCategory: 'Resource to Other', description: '', evidence: [] }],
    });
    render(
      <PredictionsPanel
        {...defaultProps()}
        predictionSets={[makeSet({ predictions: [pred] })]}
        people={[makePerson('p1', 'Alice', [sirEvent]), makePerson('p2', 'Bob')]}
        onUpdateCondition={onUpdateCondition}
      />
    );
    openFirstPrediction();
    fireEvent.click(screen.getByText('Stayed helpful'));
    expect(onUpdateCondition).toHaveBeenCalledWith('set-1', 'pred-1', 'c1', { linkedEventId: 'sir-ev-1' });
  });

  it('choosing a Papero topic writes no description; the suggestion is a placeholder (F-14)', () => {
    const onUpdateCondition = vi.fn();
    const pred = makePrediction({ conditions: [{ id: 'c1', type: 'papero', personId: 'p1', description: '', evidence: [] }] });
    const { rerender } = render(
      <PredictionsPanel {...defaultProps()} predictionSets={[makeSet({ predictions: [pred] })]} onUpdateCondition={onUpdateCondition} />
    );
    openFirstPrediction();
    const topicSelect = Array.from(document.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.text === 'Engagement with Issue')
    ) as HTMLSelectElement;
    fireEvent.change(topicSelect, { target: { value: 'resourceful_engagement' } });
    expect(onUpdateCondition).toHaveBeenCalledWith('set-1', 'pred-1', 'c1', {
      linkedPaperoKey: 'resourceful_engagement',
      linkedEventId: undefined,
    });
    const linked = makePrediction({
      conditions: [{ id: 'c1', type: 'papero', personId: 'p1', linkedPaperoKey: 'resourceful_engagement', description: '', evidence: [] }],
    });
    rerender(<PredictionsPanel {...defaultProps()} predictionSets={[makeSet({ predictions: [linked] })]} onUpdateCondition={onUpdateCondition} />);
    expect(screen.getByPlaceholderText('e.g. Improve Engagement with Issue')).toBeTruthy();
  });

  it('an unsaved evidence draft survives a status change (F-16)', () => {
    const pred = makePrediction({ conditions: [{ id: 'c1', type: 'custom', description: 'x', evidence: [] }] });
    const { rerender } = render(<PredictionsPanel {...defaultProps()} predictionSets={[makeSet({ predictions: [pred] })]} />);
    openFirstPrediction();
    fireEvent.click(screen.getByText('+ Evidence'));
    fireEvent.change(screen.getByPlaceholderText('Observation...'), { target: { value: 'half typed' } });
    const resolved = { ...pred, status: 'supported' as const };
    rerender(<PredictionsPanel {...defaultProps()} predictionSets={[makeSet({ predictions: [resolved] })]} />);
    expect((screen.getByPlaceholderText('Observation...') as HTMLInputElement).value).toBe('half typed');
  });

  it('a cancelled set delete keeps the set list unchanged (F-3)', () => {
    const onDeleteSet = vi.fn(() => false);
    render(<PredictionsPanel {...defaultProps()} predictionSets={[makeSet()]} onDeleteSet={onDeleteSet} />);
    fireEvent.click(screen.getByLabelText('Delete set'));
    expect(onDeleteSet).toHaveBeenCalledWith('set-1');
    expect(screen.getByText('My Set')).toBeTruthy();
  });
});
