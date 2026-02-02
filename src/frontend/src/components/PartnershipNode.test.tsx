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
});


