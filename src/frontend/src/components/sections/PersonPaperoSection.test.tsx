/**
 * PersonPaperoSection tests — Papero Assessment tab with 5 categories, 16 topics,
 * Level dropdowns, and ? help dialogs.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PersonPaperoSection from './PersonPaperoSection';
import type { Person } from '../../types';

const makePerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Test Person',
  x: 0,
  y: 0,
  gender: 'female',
  partnerships: [],
  ...overrides,
});

const baseProps = {
  onUpdatePerson: vi.fn(),
  updatePersonDraftState: vi.fn(),
  onSetPersonPristine: vi.fn(),
};

describe('PersonPaperoSection', () => {
  it('renders all 5 category headers', () => {
    const person = makePerson();
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        {...baseProps}
      />
    );
    expect(screen.getByText('Resourceful')).toBeInTheDocument();
    expect(screen.getByText('Connectedness & Integration')).toBeInTheDocument();
    expect(screen.getByText('Tension Management')).toBeInTheDocument();
    expect(screen.getByText('Systems Thinking')).toBeInTheDocument();
    expect(screen.getByText('Goal Structure')).toBeInTheDocument();
  });

  it('renders all 16 topic labels', () => {
    const person = makePerson();
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        {...baseProps}
      />
    );
    // Resourceful topics
    expect(screen.getByText('Engagement with Issue')).toBeInTheDocument();
    expect(screen.getByText('Problem Solving Activity')).toBeInTheDocument();
    expect(screen.getByText('Family Awareness of Role')).toBeInTheDocument();
    expect(screen.getByText('Locus of Control')).toBeInTheDocument();
    expect(screen.getByText('Leadership')).toBeInTheDocument();
    // Connectedness topics
    expect(screen.getByText('Extended Family Contact')).toBeInTheDocument();
    expect(screen.getByText('Knowledge of Situations')).toBeInTheDocument();
    expect(screen.getByText('Relationship Quality')).toBeInTheDocument();
    expect(screen.getByText('Openness & Tolerance')).toBeInTheDocument();
    // Tension Management topics
    expect(screen.getByText('Anxiety Containment')).toBeInTheDocument();
    expect(screen.getByText('Perceptual Framework')).toBeInTheDocument();
    // Systems Thinking topics
    expect(screen.getByText('Fundamental Questions')).toBeInTheDocument();
    expect(screen.getByText("Family's Focus")).toBeInTheDocument();
    expect(screen.getByText('Locus of Change')).toBeInTheDocument();
    // Goal Structure topics
    expect(screen.getByText('Achievement Goals')).toBeInTheDocument();
    expect(screen.getByText('Process Goals')).toBeInTheDocument();
  });

  it('shows help dialog when ? button is clicked', () => {
    const person = makePerson();
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        {...baseProps}
      />
    );
    const helpButton = screen.getByLabelText('Engagement with Issue help');
    fireEvent.click(helpButton);
    // Help dialog should appear with all 5 level descriptions
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Avoidant/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Fully Engaged/).length).toBeGreaterThanOrEqual(1);
  });

  it('updates score when a level is selected from the help dialog', () => {
    const person = makePerson();
    const onUpdatePerson = vi.fn();
    const updatePersonDraftState = vi.fn();
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        onUpdatePerson={onUpdatePerson}
        updatePersonDraftState={updatePersonDraftState}
        onSetPersonPristine={vi.fn()}
      />
    );
    // Open help dialog
    fireEvent.click(screen.getByLabelText('Leadership help'));
    // Click level 4 button — find the button containing "4. Generally Present"
    const dialogs = screen.getAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    const levelButtons = dialog.querySelectorAll('button');
    const level4Button = Array.from(levelButtons).find(btn => btn.textContent?.includes('4. Generally Present'));
    expect(level4Button).toBeTruthy();
    fireEvent.click(level4Button!);
    // Should have called update with the score
    expect(onUpdatePerson).toHaveBeenCalledWith('p1', {
      paperoScores: { resourceful_leadership: 4 },
    });
    expect(updatePersonDraftState).toHaveBeenCalled();
  });

  it('updates score when Level dropdown is changed', () => {
    const person = makePerson();
    const onUpdatePerson = vi.fn();
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        onUpdatePerson={onUpdatePerson}
        updatePersonDraftState={vi.fn()}
        onSetPersonPristine={vi.fn()}
      />
    );
    // There are 16 Level dropdowns — get all selects and pick the first (Engagement with Issue)
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: '3' } });
    expect(onUpdatePerson).toHaveBeenCalledWith('p1', {
      paperoScores: { resourceful_engagement: 3 },
    });
  });

  it('shows category averages when scores are set', () => {
    const person = makePerson({
      paperoScores: {
        resourceful_engagement: 4,
        resourceful_problemSolving: 2,
        resourceful_familyAwareness: 3,
        resourceful_locusOfControl: 5,
        resourceful_leadership: 1,
      },
    });
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        {...baseProps}
      />
    );
    // Average of 4+2+3+5+1 = 15/5 = 3.0
    expect(screen.getByText('Avg: 3.0')).toBeInTheDocument();
  });

  it('displays current level label when score is set', () => {
    const person = makePerson({
      paperoScores: {
        tension_anxietyContainment: 5,
      },
    });
    render(
      <PersonPaperoSection
        personDraft={person}
        selectedPerson={person}
        {...baseProps}
      />
    );
    expect(screen.getByText('Effectively Managed')).toBeInTheDocument();
  });
});
