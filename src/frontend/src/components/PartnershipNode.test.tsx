import React from 'react';
import { render } from '@testing-library/react';
import PartnershipNode from './PartnershipNode';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { vi } from 'vitest';
import type { EmotionalProcessEvent, Partnership, Person } from '../types';
import { LINE_HIT_STROKE_WIDTH } from '../constants/hitAreas';

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

    /**
     * Reported: Bob Doe and mary Doe were marked married, separated and
     * divorced and the line stayed unbroken. All three dates were recorded
     * but relationshipStatus was still "ongoing", and the marks keyed off
     * that dropdown alone.
     */
    const countSlashes = (stageRef: React.RefObject<any>, connectorY: number) => {
        const stage = stageRef.current;
        // The separation marks are the only diagonal lines drawn across the
        // connector: same short span, crossing its Y.
        return stage
            .find('Line')
            .filter((line: any) => {
                const pts = line.points();
                if (pts.length !== 4) return false;
                const risesAcross = Math.abs(pts[1] - pts[3]) === 20;
                const crosses = Math.min(pts[1], pts[3]) < connectorY && Math.max(pts[1], pts[3]) > connectorY;
                return risesAcross && crosses;
            }).length;
    };

    const renderWith = (overrides: Partial<Partnership>) => {
        const stageRef = React.createRef<any>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={{ ...partnership, ...overrides }}
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
        return stageRef;
    };

    it('draws two slashes for a couple whose divorce date is recorded', () => {
        // Bob and mary Doe, exactly as saved: every date entered, status
        // never changed from "ongoing".
        const stageRef = renderWith({
            relationshipStatus: 'ongoing',
            marriedStartDate: '1969-03-03',
            separationDate: '1980-01-01',
            divorceDate: '1985-01-01',
            statusDates: { married: '1969-03-03', separated: '1980-01-01', divorce: '1985-01-01' },
        });
        expect(countSlashes(stageRef, 50)).toBe(2);
    });

    it('draws one slash for a couple who are only separated', () => {
        const stageRef = renderWith({
            relationshipStatus: 'ongoing',
            marriedStartDate: '1969-03-03',
            separationDate: '1980-01-01',
        });
        expect(countSlashes(stageRef, 50)).toBe(1);
    });

    it('draws no slashes for an intact marriage', () => {
        const stageRef = renderWith({
            relationshipStatus: 'married',
            marriedStartDate: '1969-03-03',
        });
        expect(countSlashes(stageRef, 50)).toBe(0);
    });

    it('gives the partnership line a hit region far wider than the line it draws', () => {
        const stageRef = renderWith({});
        const lines = stageRef.current!.find('Line');
        const connector = lines.filter((line: any) => {
            const pts = line.points();
            return pts.length === 4 && pts[1] === 0 && pts[3] === 0;
        });
        const hit = connector.find((line: any) => line.hitStrokeWidth() === LINE_HIT_STROKE_WIDTH);
        expect(hit).toBeTruthy();
        // The visible line stays 2px; only the clickable region grew.
        const drawn = connector.find((line: any) => line.strokeWidth() === 2);
        expect(drawn).toBeTruthy();
    });

    // ── Review nodes-06 / nodes-11 ─────────────────────────────────────────

    const renderTyped = (overrides: Partial<Partnership>, extra: Partial<React.ComponentProps<typeof PartnershipNode>> = {}) => {
        const stageRef = React.createRef<Konva.Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PartnershipNode
                        partnership={{ ...partnership, ...overrides }}
                        partner1={{ ...partner1, lastName: 'Smith' }}
                        partner2={{ ...partner2, maidenName: 'Jones' }}
                        isSelected={false}
                        onSelect={() => {}}
                        onHorizontalConnectorDragEnd={() => {}}
                        onContextMenu={() => {}}
                        {...noopProps}
                        {...extra}
                    />
                </Layer>
            </Stage>
        );
        return stageRef.current!;
    };

    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    it('nodes-06: Separated and Divorced labels are not drawn under the family-name box', () => {
        const stage = renderTyped({
            relationshipStartDate: '1960-01-01',
            marriedStartDate: '1961-01-01',
            separationDate: '1980-01-01',
            divorceDate: '1985-01-01',
        });
        const box = stage.find<Konva.Rect>('Rect').filter((rect) => rect.fill() === '#f8f9fc');
        expect(box.length).toBe(1);
        const boxRect = box[0].getClientRect();
        const labels = stage.find<Konva.Text>('Text').filter((text) => /^(Start|Married|Separated|Divorced): /.test(text.text()));
        expect(labels.map((text) => text.text().split(':')[0]).sort()).toEqual(['Divorced', 'Married', 'Separated', 'Start']);
        labels.forEach((text) => expect(overlaps(text.getClientRect(), boxRect)).toBe(false));
        // And no two labels share a row.
        const rows = labels.map((text) => text.y());
        expect(new Set(rows).size).toBe(rows.length);
    });

    it('nodes-11: a right-click on a family indicator does not open it; a left click does', () => {
        const onFamilyIndicatorClick = vi.fn();
        const familyEvent: EmotionalProcessEvent = {
            id: 'fe1', eventType: 'FAMILY', category: 'Triangles', subtype: 'Functioning', status: 'discrete',
            intensity: 3, howWell: 0, date: '2020-01-01', startDate: '2020-01-01', otherPersonName: '', wwwwh: '',
            observations: '', anchorType: 'FAMILY', anchorId: 'p1', eventClass: 'family', createdAt: 0,
        };
        const stage = renderTyped({ familyEvents: [familyEvent] }, { onFamilyIndicatorClick });
        // The indicator's hit box is the only transparent Rect in the node.
        const hit = stage.find<Konva.Rect>('Rect').filter((rect) => rect.fill() === 'transparent');
        expect(hit.length).toBe(1);
        hit[0].fire('click', { evt: { button: 2, clientX: 1, clientY: 2 } }, true);
        expect(onFamilyIndicatorClick).not.toHaveBeenCalled();
        hit[0].fire('click', { evt: { button: 0, clientX: 1, clientY: 2 } }, true);
        expect(onFamilyIndicatorClick).toHaveBeenCalledWith('p1', 'fe1', { x: 1, y: 2 });
    });
});

