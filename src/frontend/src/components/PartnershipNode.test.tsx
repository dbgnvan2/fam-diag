import React from 'react';
import { render } from '@testing-library/react';
import PartnershipNode from './PartnershipNode';
import { Stage, Layer } from 'react-konva';
import type { Partnership, Person } from '../types';

describe('PartnershipNode', () => {
    const partner1: Person = { id: 'p1', name: 'p1', x: 0, y: 0, gender: 'male', partnerships: [] };
    const partner2: Person = { id: 'p2', name: 'p2', x: 100, y: 0, gender: 'female', partnerships: [] };
    const partnership: Partnership = { id: 'p1', partner1_id: 'p1', partner2_id: 'p2', horizontalConnectorY: 50, relationshipType: 'married', relationshipStatus: 'married', children: [] };
    it('renders without crashing', () => {
        render(
            <Stage>
                <Layer>
                    <PartnershipNode partnership={partnership} partner1={partner1} partner2={partner2} isSelected={false} onSelect={() => {}} onHorizontalConnectorDragEnd={() => {}} onContextMenu={() => {}} />
                </Layer>
            </Stage>
        );
    });
    it('keeps horizontal endpoints aligned with partner drop lines', () => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={partnership}
                        partner1={{ ...partner1, x: 12.345678 }}
                        partner2={{ ...partner2, x: 87.654321 }}
                        isSelected={false}
                        onSelect={() => {}}
                        onHorizontalConnectorDragEnd={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );

        const stage = stageRef.current!;
        const layer = stage.getLayers()[0];
        const rootGroup = layer.getChildren()[0];
        const children = rootGroup.getChildren();
        const leftDrop = children[0];
        const rightDrop = children[1];
        const horizontalGroup = children[2];
        const horizontal = horizontalGroup.getChildren()[1];

        expect(leftDrop.attrs.points[0]).toBe(horizontal.attrs.points[0]);
        expect(rightDrop.attrs.points[2]).toBe(horizontal.attrs.points[2]);
        expect(leftDrop.attrs.points[3]).toBe(horizontalGroup.attrs.y);
        expect(rightDrop.attrs.points[3]).toBe(horizontalGroup.attrs.y);
    });
});
