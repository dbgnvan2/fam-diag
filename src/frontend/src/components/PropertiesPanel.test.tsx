import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PropertiesPanel from './PropertiesPanel';
import type { EmotionalLine, Person, FunctionalIndicatorDefinition, Partnership } from '../types';
import { vi } from 'vitest';

describe('PropertiesPanel', () => {
    const indicatorDefinitions: FunctionalIndicatorDefinition[] = [];
    it('renders startDate and notes for an EmotionalLine', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
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

        expect(screen.getByLabelText('Start:')).toBeInTheDocument();
        expect(screen.getByLabelText('Notes:')).toBeInTheDocument();
        expect((screen.getByLabelText('Start:') as HTMLInputElement).value).toBe('2024-01-01');
        expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
    });

    it('updates the line color when the picker changes', () => {
        const updateEmotionalLine = vi.fn();
        const emotionalLine: EmotionalLine = {
            id: 'el-color',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
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
        fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
        expect(updateEmotionalLine).toHaveBeenCalledWith('el-color', expect.objectContaining({ color: '#00aa00' }));
    });

    it('shows sibling position details in the person sibling section', () => {
        const people: Person[] = [
            {
                id: 'dad',
                name: 'Dad',
                x: 0,
                y: 0,
                birthSex: 'male',
                partnerships: [],
            },
            {
                id: 'mom',
                name: 'Mom',
                x: 0,
                y: 0,
                birthSex: 'female',
                partnerships: [],
            },
            {
                id: 'harry',
                name: 'Harry',
                x: 0,
                y: 0,
                birthSex: 'male',
                birthDate: '1980-01-01',
                parentPartnership: 'parents',
                siblingsComplete: true,
                partnerships: [],
            },
            {
                id: 'jane',
                name: 'Jane',
                x: 0,
                y: 0,
                birthSex: 'female',
                birthDate: '1982-01-01',
                parentPartnership: 'parents',
                siblingsComplete: true,
                partnerships: [],
            },
        ];
        const partnerships: Partnership[] = [
            {
                id: 'parents',
                partner1_id: 'dad',
                partner2_id: 'mom',
                horizontalConnectorY: 0,
                relationshipType: 'married',
                relationshipStatus: 'married',
                children: ['harry', 'jane'],
            },
        ];

        render(
            <PropertiesPanel
                selectedItem={people[2]}
                people={people}
                partnerships={partnerships}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialPersonSection="sibling"
                onClose={() => {}}
            />
        );

        expect(screen.getByRole('tab', { name: /Sibling/i })).toBeInTheDocument();
        expect(screen.getByText(/Sibling Position/i)).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Override/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Position/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Compatibility/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /^Override$/i }));
        expect(screen.getByLabelText(/Override Position:/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /^Position$/i }));
        expect(screen.getAllByText(/ob\/s/).length).toBeGreaterThan(0);
    });

    it('shows sibling override help text', () => {
        const person: Person = {
            id: 'harry',
            name: 'Harry',
            x: 0,
            y: 0,
            birthSex: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialPersonSection="sibling"
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Sibling override help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Sibling override help/i });
        expect(within(helpDialog).getAllByText(/Siblings Complete:/i).length).toBeGreaterThan(0);
        expect(within(helpDialog).getAllByText(/Birth Order Override:/i).length).toBeGreaterThan(0);
        expect(within(helpDialog).getAllByText(/Override Position:/i).length).toBeGreaterThan(0);
    });

    it('renders only sibling override controls in the compact sibling popup', () => {
        const person: Person = {
            id: 'harry',
            name: 'Harry',
            x: 0,
            y: 0,
            birthSex: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialPersonSection="sibling"
                compactPersonSectionMode
                onClose={() => {}}
            />
        );

        expect(screen.getByRole('dialog', { name: /Sibling properties/i })).toBeInTheDocument();
        expect(screen.getByText(/Sibling Override/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Override Position:/i)).toBeInTheDocument();
        expect(screen.queryByText(/Person vs Father/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Derived:/i)).not.toBeInTheDocument();
    });

    it('shows FOO as a person subtab with the three family measure fields', () => {
        const person: Person = {
            id: 'harry',
            name: 'Harry',
            x: 0,
            y: 0,
            birthSex: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="properties"
                initialPersonSection="foo"
                onClose={() => {}}
            />
        );

        expect(screen.getByRole('tab', { name: /^Person$/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /^FOO$/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Emotional Cutoff:/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Family Stability:/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Family Intactness:/i)).toBeInTheDocument();
    });

    it('lets the user pick a family stability value from the FOO help box', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'harry',
            name: 'Harry',
            x: 0,
            y: 0,
            birthSex: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="properties"
                initialPersonSection="foo"
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Family Stability help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Family Stability Scale/i });
        fireEvent.click(within(helpDialog).getByRole('button', { name: /Semi-stable/i }));

        expect(updatePerson).toHaveBeenCalledWith('harry', expect.objectContaining({ familyStability: 'Semi-stable' }));
        expect((screen.getByLabelText('Family Stability:') as HTMLSelectElement).value).toBe('Semi-stable');
    });

    it('shows Intensity label for distance EPLs', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-distance',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-dashed-tight',
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
        expect(
            within(intensitySelect).getByRole('option', { name: /^Minimal$/i })
        ).toBeInTheDocument();
        expect(
            within(intensitySelect).getByRole('option', { name: /^Severe$/i })
        ).toBeInTheDocument();
    });

    it('shows five intensity levels for conflict EPLs', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-conflict',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'conflict-dotted-wide',
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
        expect(
            within(intensitySelect).getByRole('option', { name: /^Minimum$/i })
        ).toBeInTheDocument();
        expect(
            within(intensitySelect).getByRole('option', { name: /^Maximal$/i })
        ).toBeInTheDocument();
    });

    it('shows conflict intensity help text from the intensity level help icon', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-conflict-help',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'conflict-dotted-wide',
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

        fireEvent.click(screen.getByRole('button', { name: /Conflict intensity level help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Conflict Intensity Level/i });
        expect(screen.getByText(/Minimum – very occasional bickering/i)).toBeInTheDocument();
        expect(screen.getByText(/Maximal – frequent arguments and striking one another/i)).toBeInTheDocument();
        expect(within(helpDialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('lets the user pick a conflict intensity level from the help box', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-conflict-pick',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'conflict-dotted-wide',
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

        fireEvent.click(screen.getByRole('button', { name: /Conflict intensity level help/i }));
        fireEvent.click(screen.getByRole('button', { name: /Major/i }));

        expect((screen.getByLabelText('Intensity Level:') as HTMLSelectElement).value).toBe('4');
        expect((screen.getByLabelText('Intensity:') as HTMLSelectElement).value).toBe('conflict-solid-tight');
    });

    it('shows distance intensity help text from the intensity level help icon', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-distance-help',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-dashed-tight',
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

        fireEvent.click(screen.getByRole('button', { name: /Distance intensity level help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Distance Intensity Level/i });
        expect(screen.getByText(/Minimal – Occasional use of distance to manage tension/i)).toBeInTheDocument();
        expect(screen.getByText(/Severe – Distance is structured into separate lifestyles/i)).toBeInTheDocument();
        expect(within(helpDialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('lets the user pick a distance intensity level from the help box', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-distance-pick',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-dashed-tight',
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

        fireEvent.click(screen.getByRole('button', { name: /Distance intensity level help/i }));
        fireEvent.click(screen.getByRole('button', { name: /Major/i }));

        expect((screen.getByLabelText('Intensity Level:') as HTMLSelectElement).value).toBe('4');
        expect((screen.getByLabelText('Intensity:') as HTMLSelectElement).value).toBe('distance-dotted-tight');
    });

    it('shows + / - Adequate intensity help text from the intensity level help icon', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-fusion-help',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
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

        fireEvent.click(screen.getByRole('button', { name: /\+ \/ - Adequate intensity level help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /\+ \/ - Adequate Intensity Level/i });
        expect(screen.getByText(/Minimal – The amount of loss of self to one’s spouse is minimal/i)).toBeInTheDocument();
        expect(screen.getByText(/Severe – Person has become almost a complete no self/i)).toBeInTheDocument();
        expect(within(helpDialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('lets the user pick a + / - Adequate intensity level from the help box', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-fusion-pick',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
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

        fireEvent.click(screen.getByRole('button', { name: /\+ \/ - Adequate intensity level help/i }));
        fireEvent.click(screen.getByRole('button', { name: /Major/i }));

        expect((screen.getByLabelText('Intensity Level:') as HTMLSelectElement).value).toBe('4');
        expect((screen.getByLabelText('Intensity:') as HTMLSelectElement).value).toBe('fusion-solid-tight');
    });

    it('shows projection intensity help text from the intensity level help icon', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-projection-help',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'projection',
            lineStyle: 'projection-1',
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

        fireEvent.click(screen.getByRole('button', { name: /Family projection intensity level help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Family Projection Intensity Scale/i });
        expect(screen.getByText(/Minimal – Parental worry\/anxiety about the child is very occasional/i)).toBeInTheDocument();
        expect(screen.getByText(/Severe – The intensity of the attachment between child and parents is so severe/i)).toBeInTheDocument();
        expect(within(helpDialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('lets the user pick a projection intensity level from the help box', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-projection-pick',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'projection',
            lineStyle: 'projection-1',
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

        fireEvent.click(screen.getByRole('button', { name: /Family projection intensity level help/i }));
        fireEvent.click(screen.getByRole('button', { name: /Major/i }));

        expect((screen.getByLabelText('Intensity Level:') as HTMLSelectElement).value).toBe('4');
        expect((screen.getByLabelText('Intensity:') as HTMLSelectElement).value).toBe('projection-4');
    });

    it('synchronizes emotional intensity level with the selected conflict line style', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-conflict-sync',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'conflict-dotted-wide',
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

        fireEvent.change(screen.getByLabelText('Intensity:'), {
            target: { value: 'conflict-solid-tight' },
        });

        expect((screen.getByLabelText('Intensity Level:') as HTMLSelectElement).value).toBe('4');
    });

    it('shows Triangle Properties and saves triangle settings for TPL', () => {
        const updateTriangleColor = vi.fn();
        const updateTriangleIntensity = vi.fn();
        const updateEmotionalLine = vi.fn();
        const emotionalLine: EmotionalLine = {
            id: 'tpl-1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
            lineEnding: 'none',
            color: '#444444',
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
                triangleId="tri-1"
                triangleColor="#8a5a00"
                triangleIntensity="medium"
                onUpdateTriangleColor={updateTriangleColor}
                onUpdateTriangleIntensity={updateTriangleIntensity}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('Triangle Properties')).toBeInTheDocument();
        expect(screen.getByLabelText('Type:')).toBeInTheDocument();
        expect(screen.getByLabelText('Intensity Level:')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Triangle Intensity:'), { target: { value: 'high' } });
        fireEvent.change(screen.getByLabelText('Triangle Color:'), { target: { value: '#123456' } });
        fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
        expect(updateTriangleColor).toHaveBeenCalledWith('tri-1', '#123456');
        expect(updateTriangleIntensity).toHaveBeenCalledWith('tri-1', 'high');
        expect(updateEmotionalLine).not.toHaveBeenCalled();
    });

    it('applies person size changes immediately without pressing Save', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p-size',
            name: 'Size Person',
            x: 0,
            y: 0,
            gender: 'male',
            size: 60,
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Format' }));
        fireEvent.change(screen.getByLabelText('Size:'), { target: { value: '72' } });
        expect(updatePerson).toHaveBeenCalledWith('p-size', { size: 72 });
    });

    it('applies the current foreground color immediately when Enabled is checked', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p-format',
            name: 'Format Person',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
            foregroundColor: '#123456',
            foregroundEnabled: false,
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Format' }));
        fireEvent.click(screen.getAllByRole('checkbox', { name: /Enabled/i })[0]);

        expect(updatePerson).toHaveBeenCalledWith('p-format', {
            foregroundEnabled: true,
            foregroundColor: '#123456',
        });
    });

    it('shows only the active person subsection tab content', () => {
        const person: Person = {
            id: 'p-tabs',
            name: 'Tab Person',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
            notes: 'Hidden until notes tab',
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        expect(screen.getByLabelText('First Name:')).toBeInTheDocument();
        expect(screen.queryByLabelText('Birth Date:')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Notes:')).toBeInTheDocument();
        expect(screen.queryByLabelText('Size:')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
        expect(screen.getByLabelText('Birth Date:')).toBeInTheDocument();
        expect(screen.queryByLabelText('First Name:')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Notes:')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Format' }));
        expect(screen.getByLabelText('Size:')).toBeInTheDocument();
        expect(screen.queryByLabelText('Notes:')).not.toBeInTheDocument();
    });

    it('renders a compact single-section person popup when requested', () => {
        const person: Person = {
            id: 'p-compact',
            name: 'Compact Person',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
            notes: 'Popup note',
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialPersonSection="name"
                compactPersonSectionMode
                onClose={() => {}}
            />
        );

        expect(screen.getByRole('dialog', { name: /name properties/i })).toBeInTheDocument();
        expect(screen.getByLabelText('Notes:')).toBeInTheDocument();
        expect(screen.queryByRole('tablist', { name: /properties tabs/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('tablist', { name: /person property sections/i })).not.toBeInTheDocument();
    });

    it('updates functional indicator impact via symptom bar modal', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
            events: [
                {
                    id: 'symptom-1',
                    date: '2026-01-02',
                    startDate: '2026-01-02',
                    category: 'emotional',
                    symptomType: 'Alcohol',
                    eventType: 'SYMPTOM',
                    status: 'ongoing',
                    intensity: 1,
                    frequency: 1,
                    impact: 2,
                    howWell: 5,
                    otherPersonName: 'None',
                    primaryPersonName: 'Person One',
                    wwwwh: '',
                    observations: '',
                    eventClass: 'individual',
                    sourceIndicatorId: 'fi1',
                },
            ],
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 2, frequency: 1, intensity: 1 }],
        };
        const defs: FunctionalIndicatorDefinition[] = [{ id: 'fi1', label: 'Alcohol', group: 'emotional' }];
        render(
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

        // Symptoms tab shows a bar for the Alcohol symptom
        fireEvent.click(screen.getByRole('tab', { name: /^Symptoms$/i }));
        expect(screen.getByText('Alcohol')).toBeInTheDocument();

        // Clicking the bar opens Edit Symptom modal
        fireEvent.click(screen.getByText('Alcohol'));
        expect(screen.getByText('Edit Symptom')).toBeInTheDocument();

        // Change impact to 4 and save
        const impactSelect = screen.getByLabelText('Impact:');
        fireEvent.change(impactSelect, { target: { value: '4' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({
            functionalIndicators: expect.arrayContaining([
                expect.objectContaining({ definitionId: 'fi1', impact: 4 }),
            ]),
        }));
    });

    it('shows the symptom intensity scale and lets the user pick a level from help', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 2, frequency: 1, intensity: 1 }],
        };
        const defs: FunctionalIndicatorDefinition[] = [{ id: 'fi1', label: 'Alcohol', group: 'emotional' }];

        render(
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

        // Symptoms tab shows a bar for the indicator
        fireEvent.click(screen.getByRole('tab', { name: /^Symptoms$/i }));
        expect(screen.getByText('Alcohol')).toBeInTheDocument();

        // Clicking the bar (no linked event) opens Add Symptom modal
        fireEvent.click(screen.getByText('Alcohol'));
        expect(screen.getByText('Add Symptom')).toBeInTheDocument();

        // Intensity select uses symptom-specific labels
        const intensitySelect = screen.getByLabelText('Intensity:') as HTMLSelectElement;
        expect(within(intensitySelect).getByRole('option', { name: /1: Minimal/i })).toBeInTheDocument();
        expect(within(intensitySelect).getByRole('option', { name: /5: Severe/i })).toBeInTheDocument();

        // Open intensity help and pick Major (level 4)
        fireEvent.click(screen.getByRole('button', { name: /Intensity scale help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Intensity scale/i });
        fireEvent.click(within(helpDialog).getByRole('button', { name: /Major/i }));

        // Save updates the functionalIndicator with the chosen intensity
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(updatePerson).toHaveBeenLastCalledWith('p1', expect.objectContaining({
            functionalIndicators: expect.arrayContaining([
                expect.objectContaining({ definitionId: 'fi1', intensity: 4 }),
            ]),
        }));
    });

    it('opens a seeded symptom event modal with the selected symptom category', () => {
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="events"
                openNewEventRequestId="seeded-symptom"
                newEventSeed={{ eventType: 'SYMPTOM', category: 'emotional' }}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('Add Symptom')).toBeInTheDocument();
        expect(screen.getByLabelText('Category:')).toHaveValue('Emotional');
        expect(screen.getByLabelText('Notes:')).toBeInTheDocument();
    });

    it('opens a seeded emotional autonomy modal and applies an intensity from help', () => {
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="events"
                openNewEventRequestId="seeded-autonomy"
                newEventSeed={{
                    eventType: 'EA',
                    category: 'Emotional Autonomy',
                    eventClass: 'emotional-pattern',
                    intensity: 1,
                }}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('Add Emotional Autonomy')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Intensity scale help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Intensity scale/i });
        fireEvent.click(within(helpDialog).getByRole('button', { name: /Moderate-High/i }));

        expect(screen.getByLabelText('Intensity:')).toHaveValue('4');
    });

    it('opens a seeded FoO Triangle modal and applies the selected scale level', () => {
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="events"
                openNewEventRequestId="seeded-foo-triangle"
                newEventSeed={{
                    eventType: 'FOO',
                    category: 'Triangle Flexibility',
                    eventClass: 'emotional-pattern',
                    intensity: 1,
                }}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('Add Family of Origin')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Intensity scale help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Intensity scale/i });
        fireEvent.click(within(helpDialog).getByRole('button', { name: /Moderate-High/i }));

        expect(screen.getByLabelText('Intensity:')).toHaveValue('4');
    });

    it('opens a seeded Extended FoO modal and applies the selected scale level', () => {
        const person: Person = {
            id: 'p1',
            name: 'Person One',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
        };

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="events"
                openNewEventRequestId="seeded-foo-extended"
                newEventSeed={{
                    eventType: 'FOO',
                    category: 'Family Stability',
                    eventClass: 'emotional-pattern',
                    intensity: 1,
                }}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('Add Family of Origin')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Intensity scale help/i }));
        const helpDialog = screen.getByRole('dialog', { name: /Intensity scale/i });
        fireEvent.click(within(helpDialog).getByRole('button', { name: /Semi-stable/i }));

        expect(screen.getByLabelText('Intensity:')).toHaveValue('4');
    });

    it('updates first and last name fields immediately while keeping display name in sync', () => {
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
        expect(updatePerson).toHaveBeenCalledWith('p2', expect.objectContaining({ firstName: 'Mary', name: 'Mary Doe' }));

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
        expect(updatePerson).toHaveBeenLastCalledWith('p2', expect.objectContaining({ lastName: 'Smith', name: 'Mary Smith' }));
    });

    it('only saves birth/death dates when Save is clicked', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p-date',
            name: 'Date Person',
            x: 0,
            y: 0,
            gender: 'female',
            birthDate: '2000-01-01',
            partnerships: [],
            events: [],
        };
        render(
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

        fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
        fireEvent.change(screen.getByLabelText('Birth Date:'), { target: { value: '2001-02-03' } });
        expect(updatePerson).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
        expect(updatePerson).toHaveBeenCalledWith(
            'p-date',
            expect.objectContaining({
                birthDate: '2001-02-03',
                events: expect.any(Array),
            })
        );
    });

    it('saves Birth Sex, Gender Date, and Gender with events on Save', () => {
        const updatePerson = vi.fn();
        const person: Person = {
            id: 'p-gender',
            name: 'Gender Person',
            x: 0,
            y: 0,
            gender: 'female',
            birthSex: 'female',
            genderIdentity: 'feminine',
            birthDate: '1990-01-01',
            partnerships: [],
            events: [],
        };
        render(
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

        fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));
        fireEvent.change(screen.getByLabelText('Birth Sex:'), { target: { value: 'male' } });
        fireEvent.change(screen.getByLabelText('Gender Date:'), { target: { value: '2020-05-01' } });
        fireEvent.change(screen.getByLabelText('Gender:'), { target: { value: 'masculine' } });
        expect(updatePerson).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

        expect(updatePerson).toHaveBeenCalledWith(
            'p-gender',
            expect.objectContaining({
                birthSex: 'male',
                gender: 'male',
                genderDate: '2020-05-01',
                genderIdentity: 'masculine',
                events: expect.arrayContaining([
                    expect.objectContaining({ subtype: 'Birth Sex: Male' }),
                    expect.objectContaining({ subtype: 'Gender Date' }),
                    expect.objectContaining({ subtype: 'Gender: Masculine' }),
                ]),
            })
        );
    });

    it('creates person events when partnership dates are saved', () => {
        const updatePerson = vi.fn();
        const updatePartnership = vi.fn();
        const partner1: Person = {
            id: 'person-a',
            name: 'Partner A',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: ['pair-1'],
            events: [],
        };
        const partner2: Person = {
            id: 'person-b',
            name: 'Partner B',
            x: 100,
            y: 0,
            gender: 'female',
            partnerships: ['pair-1'],
            events: [],
        };
        const partnership: Partnership = {
            id: 'pair-1',
            partner1_id: 'person-a',
            partner2_id: 'person-b',
            horizontalConnectorY: 120,
            relationshipType: 'engaged',
            relationshipStatus: 'start',
            children: [],
            events: [],
        };

        render(
            <PropertiesPanel
                selectedItem={partnership}
                people={[partner1, partner2]}
                eventCategories={['Relationship']}
                relationshipTypes={['engaged', 'married']}
                relationshipStatuses={['start', 'married', 'separated', 'divorce']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={updatePartnership}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        const startInput = screen.getByLabelText('Start:');
        fireEvent.change(startInput, { target: { value: '2020-01-01' } });
        const saveButtons = screen.getAllByRole('button', { name: /^Save$/i });
        fireEvent.click(saveButtons[saveButtons.length - 1]);

        expect(updatePartnership).toHaveBeenCalled();
        expect(updatePerson).toHaveBeenCalledTimes(2);

        const firstCall = updatePerson.mock.calls[0];
        const secondCall = updatePerson.mock.calls[1];

        expect(firstCall[0]).toBe('person-a');
        expect(firstCall[1].events?.[0]).toMatchObject({
            date: '2020-01-01',
            primaryPersonName: 'Partner A',
            otherPersonName: 'Partner B',
            eventClass: 'relationship',
        });

        expect(secondCall[0]).toBe('person-b');
        expect(secondCall[1].events?.[0]).toMatchObject({
            date: '2020-01-01',
            primaryPersonName: 'Partner B',
            otherPersonName: 'Partner A',
            eventClass: 'relationship',
        });
    });

    it('renders a date field for a custom relationship status from settings', () => {
        const partnership: Partnership = {
            id: 'pair-custom',
            partner1_id: 'person-a',
            partner2_id: 'person-b',
            horizontalConnectorY: 120,
            relationshipType: 'married',
            relationshipStatus: 'estranged',
            children: [],
            statusDates: { estranged: '2021-02-03' },
        };
        const partner1: Person = {
            id: 'person-a',
            name: 'Partner A',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: ['pair-custom'],
        };
        const partner2: Person = {
            id: 'person-b',
            name: 'Partner B',
            x: 100,
            y: 0,
            gender: 'female',
            partnerships: ['pair-custom'],
        };

        render(
            <PropertiesPanel
                selectedItem={partnership}
                people={[partner1, partner2]}
                eventCategories={['Relationship']}
                relationshipStatuses={['married', 'estranged']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        expect(screen.getByLabelText('Estranged:')).toBeInTheDocument();
        expect((screen.getByLabelText('Estranged:') as HTMLInputElement).value).toBe('2021-02-03');
    });

    it('shows the married relationship structure for status and date fields', () => {
        const partnership: Partnership = {
            id: 'pair-married',
            partner1_id: 'person-a',
            partner2_id: 'person-b',
            horizontalConnectorY: 120,
            relationshipType: 'married',
            relationshipStatus: 'married',
            children: [],
        };

        render(
            <PropertiesPanel
                selectedItem={partnership}
                people={[]}
                eventCategories={['Relationship']}
                relationshipTypes={['married', 'engaged']}
                relationshipStatuses={['married', 'separated', 'divorce', 'widowed', 'start', 'ongoing', 'ended']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        const statusSelect = screen.getByLabelText('Status:');
        const options = within(statusSelect).getAllByRole('option').map((option) => option.textContent);
        expect(options).toEqual(['Married', 'Divorce', 'Separated', 'Widowed']);
        expect(screen.getByLabelText('Married:')).toBeInTheDocument();
        expect(screen.getByLabelText('Divorces:')).toBeInTheDocument();
        expect(screen.getByLabelText('Separated:')).toBeInTheDocument();
        expect(screen.getByLabelText('Widowed:')).toBeInTheDocument();
        expect(screen.queryByLabelText('Start:')).not.toBeInTheDocument();
    });

    it('switches engaged relationships to the start-ongoing-ended structure', () => {
        const partnership: Partnership = {
            id: 'pair-engaged',
            partner1_id: 'person-a',
            partner2_id: 'person-b',
            horizontalConnectorY: 120,
            relationshipType: 'married',
            relationshipStatus: 'married',
            children: [],
        };

        render(
            <PropertiesPanel
                selectedItem={partnership}
                people={[]}
                eventCategories={['Relationship']}
                relationshipTypes={['married', 'engaged']}
                relationshipStatuses={['married', 'separated', 'divorce', 'widowed', 'start', 'ongoing', 'ended']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        fireEvent.change(screen.getByLabelText('Type:'), { target: { value: 'engaged' } });

        const statusSelect = screen.getByLabelText('Status:') as HTMLSelectElement;
        const options = within(statusSelect).getAllByRole('option').map((option) => option.textContent);
        expect(options).toEqual(['Start', 'Ongoing', 'Ended']);
        expect(statusSelect.value).toBe('start');
        expect(screen.getByLabelText('Start:')).toBeInTheDocument();
        expect(screen.getByLabelText('Ongoing:')).toBeInTheDocument();
        expect(screen.getByLabelText('Ended:')).toBeInTheDocument();
    });

    it('opens directly on events tab when requested', () => {
        const person: Person = {
            id: 'person-events',
            name: 'Event Person',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
            events: [
                {
                    id: 'event-1',
                    date: '2024-04-01',
                    category: 'Individual',
                    intensity: 1,
                    frequency: 1,
                    impact: 1,
                    howWell: 5,
                    otherPersonName: '',
                    primaryPersonName: 'Event Person',
                    wwwwh: '',
                    observations: 'Example note',
                    eventClass: 'individual',
                },
            ],
        };
        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Individual']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                initialActiveTab="events"
                focusEventId="event-1"
                onClose={() => {}}
            />
        );
        expect(screen.getByRole('tab', { name: 'Events' })).toBeInTheDocument();
        expect(screen.getByText(/2024-04-01/i)).toBeInTheDocument();
        // Event bar renders the category as the type label
        expect(screen.getByText('Individual')).toBeInTheDocument();
    });

    it('shows Type, Status, Date, and row actions in compact partnership event rows', () => {
        const partnership: Partnership = {
            id: 'pair-events',
            partner1_id: 'person-a',
            partner2_id: 'person-b',
            horizontalConnectorY: 120,
            relationshipType: 'common-law',
            relationshipStatus: 'married',
            children: [],
            events: [
                {
                    id: 'rel-event-1',
                    date: '2024-04-01',
                    category: 'married',
                    eventType: 'NODAL',
                    status: 'discrete',
                    subtype: 'Separated Date',
                    intensity: 1,
                    frequency: 1,
                    impact: 1,
                    howWell: 5,
                    otherPersonName: 'Partner B',
                    primaryPersonName: 'Partner A',
                    wwwwh: '',
                    observations: 'Relationship event',
                    eventClass: 'relationship',
                },
            ],
        };
        const partner1: Person = {
            id: 'person-a',
            name: 'Partner A',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: ['pair-events'],
        };
        const partner2: Person = {
            id: 'person-b',
            name: 'Partner B',
            x: 100,
            y: 0,
            gender: 'female',
            partnerships: ['pair-events'],
        };

        render(
            <PropertiesPanel
                selectedItem={partnership}
                people={[partner1, partner2]}
                eventCategories={['Relationship']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                initialActiveTab="events"
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        // Events are now rendered as clickable bars (no column headers or Edit/Delete buttons)
        expect(screen.getByText('Separated Date')).toBeInTheDocument();
        expect(screen.getByText('2024-04-01')).toBeInTheDocument();
    });

    it('shows tab help content for Person, Symptoms, and Events', () => {
        const person: Person = {
            id: 'person-help',
            name: 'Help Person',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
            functionalIndicators: [],
            events: [],
        };
        const defs: FunctionalIndicatorDefinition[] = [
            { id: 'sleep', label: 'Sleep' },
        ];

        render(
            <PropertiesPanel
                selectedItem={person}
                people={[person]}
                eventCategories={['Individual']}
                functionalIndicatorDefinitions={defs}
                onUpdatePerson={() => {}}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /help for person tab/i }));
        expect(screen.getByText(/Persons have basic nodal events of Birth, Death, Birth Sex, and Gender/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /Symptoms/i }));
        fireEvent.click(screen.getByRole('button', { name: /help for symptoms tab/i }));
        expect(screen.getByText(/Symptom categories can be configured on this tab/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /^Events$/i }));
        fireEvent.click(screen.getByRole('button', { name: /help for events tab/i }));
        expect(screen.getByText(/The Events tab lists the events related to the Person, Relationship, or Emotional Pattern/i)).toBeInTheDocument();
    });
});
