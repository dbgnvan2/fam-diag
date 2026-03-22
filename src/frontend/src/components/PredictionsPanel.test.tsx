import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PredictionsPanel from './PredictionsPanel';
import type { Person, Prediction, SIRCategoryDefinition } from '../types';

const makePerson = (id: string, name: string, events: Person['events'] = []): Person =>
  ({ id, name, x: 0, y: 0, gender: 'male', events } as unknown as Person);

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

const noop = vi.fn();
const noopReturn = vi.fn(() => 'new-id');

const defaultProps = () => ({
  isOpen: true,
  predictions: [] as Prediction[],
  people,
  sirCategories: defaultSirCategories,
  onClose: vi.fn(),
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

  it('shows empty state when no predictions', () => {
    render(<PredictionsPanel {...defaultProps()} />);
    expect(screen.getByText(/No predictions yet/)).toBeTruthy();
  });

  it('calls onAddPrediction when + New is clicked', () => {
    const onAdd = vi.fn(() => 'new-id');
    render(<PredictionsPanel {...defaultProps()} onAddPrediction={onAdd} />);
    fireEvent.click(screen.getByText('+ New'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders active prediction cards', () => {
    const pred = makePrediction();
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
    expect(screen.getByText('Test Hypothesis')).toBeTruthy();
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('separates active and resolved predictions', () => {
    const active = makePrediction({ id: 'a1', title: 'Active One', status: 'active' });
    const resolved = makePrediction({ id: 'r1', title: 'Resolved One', status: 'supported' });
    render(<PredictionsPanel {...defaultProps()} predictions={[active, resolved]} />);
    expect(screen.getByText('Active (1)')).toBeTruthy();
    expect(screen.getByText('Resolved (1)')).toBeTruthy();
  });

  it('expands a prediction card to show conditions and outcomes sections', () => {
    const pred = makePrediction();
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
    // Click to expand
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('IF (Conditions)')).toBeTruthy();
    expect(screen.getByText('THEN (Outcomes)')).toBeTruthy();
    expect(screen.getByText('+ Add Condition')).toBeTruthy();
    expect(screen.getByText('+ Add Outcome')).toBeTruthy();
  });

  it('calls onAddCondition when + Add Condition is clicked', () => {
    const onAddCondition = vi.fn();
    const pred = makePrediction();
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} onAddCondition={onAddCondition} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    fireEvent.click(screen.getByText('+ Add Condition'));
    expect(onAddCondition).toHaveBeenCalledWith('pred-1');
  });

  it('calls onAddOutcome when + Add Outcome is clicked', () => {
    const onAddOutcome = vi.fn();
    const pred = makePrediction();
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} onAddOutcome={onAddOutcome} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    fireEvent.click(screen.getByText('+ Add Outcome'));
    expect(onAddOutcome).toHaveBeenCalledWith('pred-1');
  });

  it('calls onDeletePrediction when Delete is clicked', () => {
    const onDelete = vi.fn();
    const pred = makePrediction();
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} onDeletePrediction={onDelete} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    fireEvent.click(screen.getByLabelText('Delete prediction'));
    expect(onDelete).toHaveBeenCalledWith('pred-1');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PredictionsPanel {...defaultProps()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close predictions panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders conditions with type and description', () => {
    const pred = makePrediction({
      conditions: [
        { id: 'c1', type: 'sir', personId: 'p1', description: 'Stay calm', evidence: [], linkedPaperoKey: undefined, linkedSIRCategory: undefined },
      ],
    });
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    // The description should appear as input value
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
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    const inputs = document.querySelectorAll('input[type="text"]');
    const descInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === 'Reconciliation');
    expect(descInput).toBeTruthy();
    // Person tag
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
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
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
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('SIR Category:')).toBeTruthy();
    expect(screen.getByText('— Select Category —')).toBeTruthy();
    // Categories from sirCategories should appear as options
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
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} people={peopleWithEvents} />);
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
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText('Papero Topic:')).toBeTruthy();
    expect(screen.getByText('— Select Topic —')).toBeTruthy();
    // Should list Papero topics
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
    render(<PredictionsPanel {...defaultProps()} predictions={[pred]} people={[personWithPapero, makePerson('p2', 'Bob')]} />);
    fireEvent.click(screen.getByText('Test Hypothesis'));
    expect(screen.getByText(/current score = 3\/5/)).toBeTruthy();
  });
});
