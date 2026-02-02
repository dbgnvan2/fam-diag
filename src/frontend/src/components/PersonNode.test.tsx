import React from 'react';
import { render } from '@testing-library/react';
import PersonNode from './PersonNode';
import { Stage, Layer } from 'react-konva';
import type { Person } from '../types';

describe('PersonNode', () => {
    const person: Person = { id: 'p1', name: 'p1', x: 0, y: 0, gender: 'male', partnerships: [] };
    it('renders without crashing', () => {
        render(
            <Stage>
                <Layer>
                    <PersonNode person={person} isSelected={false} onSelect={() => {}} onDragMove={() => {}} onDragEnd={() => {}} onContextMenu={() => {}} />
                </Layer>
            </Stage>
        );
    });
});

