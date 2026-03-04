import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
        expect((screen.getByLabelText('Start Date:') as HTMLInputElement).value).toBe('2024-01-01');
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
        fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
        expect(updateEmotionalLine).toHaveBeenCalledWith('el-color', expect.objectContaining({ color: '#00aa00' }));
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

    it('shows dotted sawtooth as low intensity for conflict EPLs', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-conflict',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'dotted-saw-tooth',
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

        expect(screen.getByLabelText('Intensity:')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Low \(dotted sawtooth\)/i })).toBeInTheDocument();
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
            lineStyle: 'low',
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
        expect(screen.getByLabelText('Relationship Type:')).toBeInTheDocument();
        expect(screen.getByLabelText('Line Ending:')).toBeInTheDocument();
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

        fireEvent.change(screen.getByLabelText('Size:'), { target: { value: '72' } });
        expect(updatePerson).toHaveBeenCalledWith('p-size', { size: 72 });
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
        fireEvent.click(screen.getByRole('button', { name: /^Indicators$/i }));
        const statusSelect = screen.getAllByLabelText('Status:')[0];
        fireEvent.change(statusSelect, { target: { value: 'current' } });
        expect(updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({
            functionalIndicators: expect.arrayContaining([
                expect.objectContaining({ definitionId: 'fi1', status: 'current', impact: 0, frequency: 0, intensity: 0 }),
            ]),
        }));

        const updatedPerson: Person = {
            ...person,
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 2, frequency: 1, intensity: 1 }],
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
        fireEvent.click(screen.getByRole('button', { name: /^Indicators$/i }));

        const impactInput = screen.getAllByLabelText('Impact:')[0];
        fireEvent.change(impactInput, { target: { value: '4' } });
        expect(updatePerson).toHaveBeenLastCalledWith('p1', expect.objectContaining({
            functionalIndicators: expect.arrayContaining([
                expect.objectContaining({ definitionId: 'fi1', status: 'current', impact: 4, frequency: 1, intensity: 1 }),
            ]),
        }));

        const personAfterImpact: Person = {
            ...updatedPerson,
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 4, frequency: 1, intensity: 1 }],
        };
        rerender(
            <PropertiesPanel
                selectedItem={personAfterImpact}
                people={[personAfterImpact]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={defs}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /^Indicators$/i }));

        const frequencySelect = screen.getAllByLabelText('Frequency:')[0];
        fireEvent.change(frequencySelect, { target: { value: '3' } });
        expect(updatePerson).toHaveBeenLastCalledWith('p1', expect.objectContaining({
            functionalIndicators: expect.arrayContaining([
                expect.objectContaining({ definitionId: 'fi1', status: 'current', impact: 4, frequency: 3, intensity: 1 }),
            ]),
        }));

        const personAfterFrequency: Person = {
            ...personAfterImpact,
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 4, frequency: 3, intensity: 1 }],
        };
        rerender(
            <PropertiesPanel
                selectedItem={personAfterFrequency}
                people={[personAfterFrequency]}
                eventCategories={['Job']}
                functionalIndicatorDefinitions={defs}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={() => {}}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /^Indicators$/i }));

        const intensitySelect = screen.getAllByLabelText('Intensity:')[0];
        fireEvent.change(intensitySelect, { target: { value: '5' } });
        expect(updatePerson).toHaveBeenLastCalledWith('p1', expect.objectContaining({
            functionalIndicators: expect.arrayContaining([
                expect.objectContaining({ definitionId: 'fi1', status: 'current', impact: 4, frequency: 3, intensity: 5 }),
            ]),
        }));
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
                    expect.objectContaining({ statusLabel: 'Birth Sex: Male' }),
                    expect.objectContaining({ statusLabel: 'Gender Date' }),
                    expect.objectContaining({ statusLabel: 'Gender: Masculine' }),
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
            relationshipType: 'married',
            relationshipStatus: 'married',
            children: [],
            events: [],
        };

        render(
            <PropertiesPanel
                selectedItem={partnership}
                people={[partner1, partner2]}
                eventCategories={['Relationship']}
                functionalIndicatorDefinitions={indicatorDefinitions}
                onUpdatePerson={updatePerson}
                onUpdatePartnership={updatePartnership}
                onUpdateEmotionalLine={() => {}}
                onClose={() => {}}
            />
        );

        const startInput = screen.getByLabelText('Relationship Start:');
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
        expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument();
        expect(screen.getByText(/2024-04-01/i)).toBeInTheDocument();
        expect(screen.getByText('FF')).toBeInTheDocument();
    });

    it('shows tab help content for Person, Indicators, and Events', () => {
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

        fireEvent.click(screen.getByRole('button', { name: /help for indicators tab/i }));
        expect(screen.getByText(/Indicators of functioning specific to symptom development/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /help for events tab/i }));
        expect(screen.getByText(/The Events tab lists the events related to the Person, Relationship, or Emotional Process/i)).toBeInTheDocument();
    });
});
