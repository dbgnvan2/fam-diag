import React from 'react';
import { render, screen } from '@testing-library/react';
import PropertiesPanel from './PropertiesPanel';
import type { EmotionalLine } from '../types';

describe('PropertiesPanel', () => {
    it('renders startDate and notes for an EmotionalLine', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'single',
            lineEnding: 'none',
            startDate: '2024-01-01',
            notes: 'Test notes',
        };

        render(
            <PropertiesPanel
                selectedItem={emotionalLine}
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
});
