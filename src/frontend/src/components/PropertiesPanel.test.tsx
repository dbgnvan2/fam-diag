import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PropertiesPanel from './PropertiesPanel';
import type { EmotionalLine } from '../types';
import { vi } from 'vitest';

describe('PropertiesPanel', () => {
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
});
