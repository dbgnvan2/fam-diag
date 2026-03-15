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
            lineStyle: 'fusion-dotted-wide',
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

    it('renders double solid lines for level 3 fusion', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-solid-wide',
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
        const lines = group.getChildren().filter((child) => child.getClassName() === 'Line');
        expect(lines).toHaveLength(2);
        lines.forEach((line) => {
            expect(line.attrs.dash).toBeUndefined();
        });
    });

    it('renders triple lines for level 5 fusion', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-triple',
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
        const lines = group.getChildren().filter((child) => child.getClassName() === 'Line');
        expect(lines).toHaveLength(3);
        lines.forEach((line) => {
            expect(line.attrs.strokeWidth).toBeGreaterThan(2);
        });
    });

    it('renders the level 3 distance dash pattern', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el-distance',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-long',
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
        expect(line.attrs.strokeWidth).toBe(2);
        expect(line.attrs.dash).toEqual([14, 8]);
    });

    it('uses the provided color when not selected', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
            lineEnding: 'none',
            color: '#ff5500',
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
        expect(line.attrs.stroke).toBe('#ff5500');
    });

    it('renders the level 5 dot pattern for distance', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-dotted-wide',
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

    it('renders a short-line sawtooth for level 3 conflict', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el1',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'conflict-solid-wide',
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
        expect(line.attrs.dash).toEqual([6, 4]);
    });

    it('renders double dotted sawtooth lines for level 2 conflict', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el-conflict-double-dotted',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'conflict',
            lineStyle: 'conflict-dotted-tight',
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
        const lines = group.getChildren().filter((child) => child.getClassName() === 'Line');
        expect(lines).toHaveLength(2);
        lines.forEach((line) => {
            expect(line.attrs.dash).toEqual([2, 5]);
        });
    });

    it('renders projection markers for projection EPL intensity', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el-projection',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'projection',
            lineStyle: 'projection-5',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 180, y: 50, name: 'p2', partnerships: [] };

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
        const texts = group.find('Text');
        expect(texts.length).toBeGreaterThan(0);
        expect(texts[0].attrs.text).toBe('>>>>>');
    });

    it('renders two EPLs beside each other for the same pair', () => {
        const stageRef = React.createRef<Stage>();
        const emotionalLine: EmotionalLine = {
            id: 'el-sibling',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-dotted-wide',
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
                        siblingIndex={0}
                        siblingCount={2}
                    />
                    <EmotionalLineNode
                        emotionalLine={{ ...emotionalLine, id: 'el-sibling-2' }}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                        siblingIndex={1}
                        siblingCount={2}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        const groups = layer.getChildren();
        const firstLine = groups[0].getChildren()[0];
        const secondLine = groups[1].getChildren()[0];
        expect(firstLine.attrs.points[1]).not.toBe(secondLine.attrs.points[1]);
    });

    it('keeps sibling lanes separated when the second line reverses person order', () => {
        const stageRef = React.createRef<Stage>();
        const forward: EmotionalLine = {
            id: 'el-forward',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'distance',
            lineStyle: 'distance-dotted-wide',
            lineEnding: 'none',
        };
        const reverse: EmotionalLine = {
            ...forward,
            id: 'el-reverse',
            person1_id: 'p2',
            person2_id: 'p1',
        };
        const person1: Person = { id: 'p1', x: 60, y: 60, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 180, y: 60, name: 'p2', partnerships: [] };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={forward}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                        siblingIndex={0}
                        siblingCount={2}
                    />
                    <EmotionalLineNode
                        emotionalLine={reverse}
                        person1={person2}
                        person2={person1}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                        siblingIndex={1}
                        siblingCount={2}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        const groups = layer.getChildren();
        const firstLine = groups[0].getChildren()[0];
        const secondLine = groups[1].getChildren()[0];

        expect(firstLine.attrs.points[1]).not.toBe(secondLine.attrs.points[1]);
    });

});
