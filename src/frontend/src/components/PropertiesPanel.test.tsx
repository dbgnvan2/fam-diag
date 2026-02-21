import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PropertiesPanel from './PropertiesPanel';
import type { EmotionalLine, Person, FunctionalIndicatorDefinition } from '../types';
import { vi } from 'vitest';

describe('PropertiesPanel', () => {
    const indicatorDefinitions: FunctionalIndicatorDefinition[] = [];
    it('renders startDate and notes for an EmotionalLine', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'low',
            lineEnding: 'none',
            startDate: '2024-01-01',
            notes: 'Test notes',
        };

        render(
            <PropertiesPanel
                selectedItem={emotionalLine}
                people={[]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        expect(screen.getByLabelText('Start Date:')).toBeInTheDocument();
        expect(screen.getByLabelText('Notes:')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
    });

    it('updates the line color when the picker changes', () => {
        const updateEmotionalLine = vi.fn();
        const emotionalLine: EmotionalLine = {
            id: 'el-color',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'low',
            lineEnding: 'none',
            color: '#aa0000',
        };

        render(
            <PropertiesPanel
                selectedItem={emotionalLine}
                people={[]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={updateEmotionalLine}
                onClose={() => {}}
            />
        );

        const colorInput = screen.getByLabelText('Color:');
        fireEvent.change(colorInput, { target: { value: '#00aa00' } });
        expect(updateEmotionalLine).toHaveBeenCalledWith('el-color', { color: '#00aa00' });
    });

    it('shows Intensity label for distance EPLs', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-distance',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'dotted',
            lineEnding: 'none',
        };

        render(
            <PropertiesPanel
                selectedItem={emotionalLine}
                people={[]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        const intensitySelect = screen.getByLabelText('Intensity:');
        expect(intensitySelect).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Low \(dotted\)/i })).toBeInTheDocument();
    });

    it('updates functional indicator status and impact for a person', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
        };
        const defs: FunctionalIndicatorDefinition[] = [{ id: 'fi1', label: 'Affair' }];
        const { rerender } = render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={defs}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Indicators/i }));
        const statusSelect = screen.getAllByLabelText('Status:')[0];
        fireEvent.change(statusSelect, { target: { value: 'current' } });
        expect(updatePerson).toHaveBeenCalledWith('p1', {
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 1 }],
        });

        const updatedPerson: Person = {
            ...person,
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 1 }],
        };
        rerender(
            <PropertiesPanel
                selectedItem={updatedPerson}
                people={[updatedPerson]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={defs}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Indicators/i }));

        const impactInput = screen.getAllByLabelText('Impact:')[0];
        fireEvent.change(impactInput, { target: { value: '7' } });
        expect(updatePerson).toHaveBeenLastCalledWith('p1', {
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 7 }],
        });
    });

    it('updates first and last name fields while keeping display name in sync', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p2',
            name: 'Jane Doe',
            firstName: 'Jane',
            lastName: 'Doe',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
        };
        const { rerender } = render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={[]}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );
        const firstInput = screen.getByLabelText('First Name:');
        fireEvent.change(firstInput, { target: { value: 'Mary' } });
        expect(updatePerson).toHaveBeenCalledWith('p2', { firstName: 'Mary', name: 'Mary Doe' });

        const updatedAfterFirst: Person = { ...person, firstName: 'Mary', name: 'Mary Doe' };
        rerender(
            <PropertiesPanel
                selectedItem={updatedAfterFirst}
                people={[updatedAfterFirst]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={[]}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        const lastInput = screen.getByLabelText('Last Name:');
        fireEvent.change(lastInput, { target: { value: 'Smith' } });
        expect(updatePerson).toHaveBeenLastCalledWith('p2', { lastName: 'Smith', name: 'Mary Smith' });
    });
});
