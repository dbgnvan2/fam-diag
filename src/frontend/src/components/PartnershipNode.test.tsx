import React from 'react';
import { render } from '@testing-library/react';
import PartnershipNode from './PartnershipNode';
import { Stage, Layer } from 'react-konva';
import type { Partnership, Person } from '../types';

describe('PartnershipNode', () => {
    it('renders notes when provided', () => {
        const stageRef = React.createRef<Stage>();
        const partnership: Partnership = {
            id: 'p1',
            partner1_id: 'p1',
            partner2_id: 'p2',
            horizontalConnectorY: 150,
            relationshipType: 'married',
            relationshipStatus: 'married',
            children: [],
            notes: 'Test notes',
        };
        const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
        const person2: Person = { id: 'p2', x: 250, y: 50, name: 'p2', partnerships: [] };

        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={partnership}
                        partner1={person1}
                        partner2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onHorizontalConnectorDragEnd={() => {}}
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
