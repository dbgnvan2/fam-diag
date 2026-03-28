import React from 'react';
import { render } from '@testing-library/react';
import PartnershipNode from './PartnershipNode';
import { Stage, Layer } from 'react-konva';
import type { Partnership, Person } from '../types';

describe('PartnershipNode', () => {
    const partner1: Person = { id: 'p1', name: 'p1', x: 0, y: 0, gender: 'male', partnerships: [] };
    const partner2: Person = { id: 'p2', name: 'p2', x: 100, y: 0, gender: 'female', partnerships: [] };
    const partnership: Partnership = { id: 'p1', partner1_id: 'p1', partner2_id: 'p2', horizontalConnectorY: 50, relationshipType: 'married', relationshipStatus: 'married', children: [] };
    const noopProps = {
        isFamilySelected: false,
        onFamilyNameOffsetChange: () => {},
        onFamilyNameSizeChange: () => {},
        onFamilyClick: () => {},
        onFamilyContextMenu: () => {},
        onFamilyIndicatorClick: () => {},
    };
    it('renders without crashing', () => {
        render(
            <Stage>
                <Layer>
                    <PartnershipNode partnership={partnership} partner1={partner1} partner2={partner2} isSelected={false} onSelect={() => {}} onHorizontalConnectorDragEnd={() => {}} onContextMenu={() => {}} {...noopProps} />
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
                        {...noopProps}
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
    it('renders the divorce indicator for the canonical divorce status used by the properties panel', () => {
        const divorceStageRef = React.createRef<Stage>();
        render(
            <Stage ref={divorceStageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={{ ...partnership, relationshipStatus: 'divorce' }}
                        partner1={partner1}
                        partner2={partner2}
                        isSelected={false}
                        onSelect={() => {}}
                        onHorizontalConnectorDragEnd={() => {}}
                        onContextMenu={() => {}}
                        {...noopProps}
                    />
                </Layer>
            </Stage>
        );

        const stage = divorceStageRef.current!;
        const layer = stage.getLayers()[0];
        const rootGroup = layer.getChildren()[0];
        const indicatorLines = rootGroup
            .getChildren()
            .filter((node) => node.getClassName() === 'Line' && node !== rootGroup.getChildren()[0] && node !== rootGroup.getChildren()[1]);

        const divorceMarkers = indicatorLines.filter((node) => {
            const points = node.attrs.points;
            return Array.isArray(points) && points.length === 4 && points[0] !== points[2] && points[1] !== points[3];
        });

        expect(divorceMarkers).toHaveLength(2);
    });
    it('uses custom line color when partnership.color is set', () => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={{ ...partnership, color: '#FF1744' }}
                        partner1={partner1}
                        partner2={partner2}
                        isSelected={false}
                        onSelect={() => {}}
                        onHorizontalConnectorDragEnd={() => {}}
                        onContextMenu={() => {}}
                        {...noopProps}
                    />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current!;
        const layer = stage.getLayers()[0];
        const rootGroup = layer.getChildren()[0];
        const leftDrop = rootGroup.getChildren()[0];
        const rightDrop = rootGroup.getChildren()[1];
        expect(leftDrop.attrs.stroke).toBe('#FF1744');
        expect(rightDrop.attrs.stroke).toBe('#FF1744');
        // Horizontal visible line is inside the draggable group
        const horizontalGroup = rootGroup.getChildren()[2];
        const visibleLine = horizontalGroup.getChildren()[1];
        expect(visibleLine.attrs.stroke).toBe('#FF1744');
    });
    it('renders background line when partnership.backgroundColor is set', () => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={{ ...partnership, backgroundColor: '#e3f2fd' }}
                        partner1={partner1}
                        partner2={partner2}
                        isSelected={false}
                        onSelect={() => {}}
                        onHorizontalConnectorDragEnd={() => {}}
                        onContextMenu={() => {}}
                        {...noopProps}
                    />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current!;
        const layer = stage.getLayers()[0];
        const rootGroup = layer.getChildren()[0];
        const horizontalGroup = rootGroup.getChildren()[2];
        // With background: bgLine(0), hitLine(1), visibleLine(2)
        const bgLine = horizontalGroup.getChildren()[0];
        expect(bgLine.attrs.stroke).toBe('#e3f2fd');
        expect(bgLine.attrs.strokeWidth).toBe(10);
    });
});
