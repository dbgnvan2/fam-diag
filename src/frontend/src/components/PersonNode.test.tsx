import React from 'react';
import { render } from '@testing-library/react';
import PersonNode from './PersonNode';
import { Stage, Layer } from 'react-konva';
import type { Person } from '../types';

describe('PersonNode', () => {
    it('renders notes when provided', () => {
        const stageRef = React.createRef<Stage>();
        const person: Person = {
            id: 'p1',
            x: 50,
            y: 50,
            name: 'p1',
            partnerships: [],
            notes: 'Test notes',
        };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode
                        person={person}
                        isSelected={false}
                        onSelect={() => {}}
                        onDragMove={() => {}}
                        onDragEnd={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current;
        const layer = stage.getLayers()[0];
        const group = layer.getChildren()[0];
        const text = group.getChildren().find(node => node.getClassName() === 'Text' && node.attrs.text === 'Test notes');
        expect(text).toBeDefined();
    });
});
