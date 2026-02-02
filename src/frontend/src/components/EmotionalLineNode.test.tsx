import React from 'react';
import { render } from '@testing-library/react';
import EmotionalLineNode from './EmotionalLineNode';
import { Stage, Layer } from 'react-konva';
import type { Person, EmotionalLine } from '../types';

describe('EmotionalLineNode', () => {
    it('renders without crashing', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'single',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 150, y: 50, name: 'p2', partnerships: [] };

        render(
            <Stage>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={emotionalLine}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );
    });

    it('renders 3 lines for triple fusion', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'triple',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 150, y: 50, name: 'p2', partnerships: [] };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={emotionalLine}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        // The group rendered by EmotionalLineNode will have the lines as children
        const group = layer.getChildren()[0];
        expect(group.getChildren().length).toBe(3);
    });

    it('renders 2 lines for double fusion', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'double',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 150, y: 50, name: 'p2', partnerships: [] };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={emotionalLine}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        const group = layer.getChildren()[0];
        expect(group.getChildren().length).toBe(2);
    });

    it('renders a dotted line for dotted distance', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'dotted',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 150, y: 50, name: 'p2', partnerships: [] };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={emotionalLine}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        const group = layer.getChildren()[0];
        const line = group.getChildren()[0];
        expect(line.attrs.dash).toEqual([2, 5]);
    });

    it('renders a sawtooth line for solid-saw-tooth conflict', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'solid-saw-tooth',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 150, y: 50, name: 'p2', partnerships: [] };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={emotionalLine}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        const group = layer.getChildren()[0];
        const line = group.getChildren()[0];
        // The number of points will be > 2 for a sawtooth line
        expect(line.attrs.points.length).toBeGreaterThan(4);
    });

});
