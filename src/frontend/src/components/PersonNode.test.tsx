import React from 'react';
import { render } from '@testing-library/react';
import PersonNode from './PersonNode';
import { Stage, Layer } from 'react-konva';
import type { Person } from '../types';

describe('PersonNode', () => {
    const baseProps = {
        isSelected: false,
        onSelect: () => {},
        onDragStart: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onContextMenu: () => {},
    };

    const person: Person = { id: 'p1', name: 'p1', x: 0, y: 0, gender: 'male', partnerships: [] };
    it('renders without crashing', () => {
        render(
            <Stage>
                <Layer>
                    <PersonNode person={person} {...baseProps} />
                </Layer>
            </Stage>
        );
    });

    it('renders miscarriage triangle with cross', () => {
        const stageRef = React.createRef<Stage>();
        const miscarriage: Person = { id: 'p2', name: 'Loss', x: 0, y: 0, partnerships: [], lifeStatus: 'miscarriage' };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={miscarriage} {...baseProps} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const triangles = group.getChildren().filter((node: any) => node.getClassName() === 'Line' && node.attrs.closed);
        expect(triangles.length).toBeGreaterThan(0);
    });

    it('renders stillbirth with X overlay', () => {
        const stageRef = React.createRef<Stage>();
        const stillbirth: Person = { id: 'p3', name: 'Stillborn', x: 0, y: 0, partnerships: [], lifeStatus: 'stillbirth', gender: 'female' };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={stillbirth} {...baseProps} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const lines = group.getChildren().filter((node: any) => node.getClassName() === 'Line');
        expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it('renders shaded background when enabled', () => {
        const stageRef = React.createRef<Stage>();
        const shadedPerson: Person = {
            id: 'p4',
            name: 'Shaded',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
            size: 80,
            backgroundEnabled: true,
            backgroundColor: '#ff0000',
        };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={shadedPerson} {...baseProps} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
        const hasBackground = rects.some((rect: any) => rect.attrs.width === shadedPerson.size + 10);
        expect(hasBackground).toBe(true);
    });
});
