import React from 'react';
import { render } from '@testing-library/react';
import PersonNode from './PersonNode';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { vi } from 'vitest';
import type { Person, FunctionalIndicatorDefinition, EmotionalProcessEvent } from '../types';

describe('PersonNode', () => {
    const baseProps = {
        isSelected: false,
        onSelect: () => {},
        onDragStart: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onContextMenu: () => {},
        onHoverChange: () => {},
    };
    const definitions: FunctionalIndicatorDefinition[] = [];
    const person: Person = { id: 'p1', name: 'p1', x: 0, y: 0, gender: 'male', partnerships: [] };
    it('renders without crashing', () => {
        render(
            <Stage>
                <Layer>
                    <PersonNode person={person} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
    });

    it('renders AI agent as hexagon (6-point closed polygon)', () => {
        const stageRef = React.createRef<Stage>();
        const aiAgent: Person = {
            id: 'ai1',
            name: 'Claude',
            x: 0,
            y: 0,
            gender: 'ai-agent',
            birthSex: 'ai-agent',
            genderIdentity: 'nonbinary',
            genderSymbol: 'ai_agent',
            partnerships: [],
        };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={aiAgent} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        // Hexagon is a closed Line with 12 numeric values (6 points × 2 coords)
        const hexagons = group.getChildren().filter(
            (node: any) => node.getClassName() === 'Line' && node.attrs.closed && node.attrs.points?.length === 12
        );
        expect(hexagons.length).toBe(1);
    });

    // Typed helpers for the review-fix tests below.
    const renderTyped = (subject: Person, extraProps: Partial<React.ComponentProps<typeof PersonNode>> = {}): Konva.Group => {
        const stageRef = React.createRef<Konva.Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={subject} {...baseProps} functionalIndicatorDefinitions={definitions} {...extraProps} />
                </Layer>
            </Stage>
        );
        return stageRef.current!.getLayers()[0].getChildren()[0] as Konva.Group;
    };
    const konvaLines = (group: Konva.Group) => group.find<Konva.Line>('Line');
    // Point-in-triangle by the sign of the three edge cross products.
    const insideTriangle = (px: number, py: number, tri: number[]) => {
        const [ax, ay, bx, by, cx, cy] = tri;
        const side = (x1: number, y1: number, x2: number, y2: number) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
        const d1 = side(ax, ay, bx, by);
        const d2 = side(bx, by, cx, cy);
        const d3 = side(cx, cy, ax, ay);
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        return !(hasNeg && hasPos);
    };

    const renderAndGetGroup = (subject: Person) => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={subject} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        return stageRef.current.getLayers()[0].getChildren()[0];
    };
    const triangles = (group: any) =>
        group.getChildren().filter(
            (node: any) => node.getClassName() === 'Line' && node.attrs.closed && node.attrs.points?.length === 6
        );
    const circles = (group: any) => group.getChildren().filter((node: any) => node.getClassName() === 'Circle');

    it('renders a person with no sex recorded as a triangle, not a circle (regression)', () => {
        const unknown: Person = { id: 'u1', name: 'Unknown', x: 0, y: 0, partnerships: [] };
        const group = renderAndGetGroup(unknown);
        expect(triangles(group).length).toBe(1);
        expect(circles(group).length).toBe(0);
    });

    it('still renders a female as a circle and a male with no triangle', () => {
        const female = renderAndGetGroup({ id: 'f1', name: 'F', x: 0, y: 0, gender: 'female', partnerships: [] });
        expect(circles(female).length).toBe(1);
        expect(triangles(female).length).toBe(0);
        const male = renderAndGetGroup({ id: 'm1', name: 'M', x: 0, y: 0, gender: 'male', partnerships: [] });
        expect(triangles(male).length).toBe(0);
    });

    // G-TEST-11: the old fixture had no sex, so with the miscarriage branch
    // removed the unknown-sex triangle still satisfied "a closed Line". The
    // fixture is female now (an alive female is a circle) and the test checks
    // the miscarriage shape itself: an unfilled triangle whose base is 0.35 x
    // size each side, and the two cross strokes.
    it('renders miscarriage as an unfilled triangle with a cross, whatever the sex (G-TEST-11)', () => {
        const group = renderTyped({ id: 'p2', name: 'Loss', x: 0, y: 0, partnerships: [], gender: 'female', lifeStatus: 'miscarriage' });
        const outlines = konvaLines(group).filter((line) => line.closed() && line.fillEnabled() === false);
        expect(outlines.length).toBe(1);
        const expected = [0, -30, -21, 30, 21, 30];
        outlines[0].points().forEach((value, index) => expect(value).toBeCloseTo(expected[index]));
        const crossStrokes = konvaLines(group).filter((line) => !line.closed() && line.points().length === 4);
        expect(crossStrokes.length).toBe(2);
        expect(group.find('Circle').length).toBe(0);
    });

    it('renders stillbirth with X overlay', () => {
        const stageRef = React.createRef<Stage>();
        const stillbirth: Person = { id: 'p3', name: 'Stillborn', x: 0, y: 0, partnerships: [], lifeStatus: 'stillbirth', gender: 'female' };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={stillbirth} {...baseProps} functionalIndicatorDefinitions={definitions} />
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
                    <PersonNode person={shadedPerson} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
        const expectedSize = shadedPerson.size * 1.05;
        const hasBackground = rects.some((rect: any) => rect.attrs.width === expectedSize);
        expect(hasBackground).toBe(true);
    });

    it('uses the configured shaded background color', () => {
        const stageRef = React.createRef<Stage>();
        const clientPerson: Person = {
            id: 'p-client',
            name: 'Client',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
            backgroundEnabled: true,
            backgroundColor: '#22aa88',
        };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={clientPerson} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
        expect(rects.some((rect: any) => rect.attrs.fill === '#22aa88')).toBe(true);
    });

    it('fills the person node with the enabled foreground color', () => {
        const stageRef = React.createRef<Stage>();
        const tintedPerson: Person = {
            id: 'p-foreground',
            name: 'Tinted',
            x: 0,
            y: 0,
            gender: 'male',
            partnerships: [],
            foregroundEnabled: true,
            foregroundColor: '#22aa88',
        };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={tintedPerson} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
        expect(rects.some((rect: any) => rect.attrs.width === 60 && rect.attrs.fill === '#22aa88')).toBe(true);
    });

    it('renders functional indicator badges with fallback letters', () => {
        const stageRef = React.createRef<Stage>();
        const personWithIndicator: Person = {
            id: 'p5',
            name: 'Indicator',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 5, frequency: 3, intensity: 4 }],
        };
        const indicatorDefinitions: FunctionalIndicatorDefinition[] = [
            { id: 'fi1', label: 'Affair' },
        ];
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={personWithIndicator} {...baseProps} functionalIndicatorDefinitions={indicatorDefinitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const texts = group.find('Text');
        const hasCombined = texts.some((node: any) => node.text() === 'C5');
        expect(hasCombined).toBe(true);
    });

    // The maturity badge is a small square (Rect, fill #f0f4ff) at the upper-left.
    // These two tests used to count Circle children, which matched the person's
    // own body circle, not the badge.
    const maturityBadges = (group: any) =>
        group.find('Rect').filter((n: any) => n.attrs.fill === '#f0f4ff');

    it('renders a maturity badge at the upper-left when siblingMaturityLevel is set', () => {
        const stageRef = React.createRef<Stage>();
        const maturePerson: Person = {
            id: 'p-mat',
            name: 'Mature',
            x: 0,
            y: 0,
            partnerships: [],
            siblingMaturityLevel: 3,
        };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={maturePerson} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const badges = maturityBadges(group);
        expect(badges.length).toBe(1);
        expect(badges[0].x()).toBeLessThan(0);
        expect(badges[0].y()).toBeLessThan(0);
        // Text label should show the maturity level
        const texts = group.find('Text');
        expect(texts.some((n: any) => n.text() === '3')).toBe(true);
    });

    it('does not render a maturity badge when siblingMaturityLevel is not set', () => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={person} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        expect(maturityBadges(group).length).toBe(0);
    });

    it('renders the sibling effective position code to the left of the person', () => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode
                        person={person}
                        {...baseProps}
                        functionalIndicatorDefinitions={definitions}
                        siblingEffectivePosition="ob/s"
                    />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const texts = group.find('Text');
        expect(texts.some((n: any) => n.text() === 'ob/s')).toBe(true);
    });

    it('does not render a position code label when siblingEffectivePosition is not provided', () => {
        const stageRef = React.createRef<Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={person} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const texts = group.find('Text');
        // Only name text should be present (no position code)
        expect(texts.every((n: any) => n.text() !== 'ob/s')).toBe(true);
    });

    it('displays age label based on birth/death dates', () => {
        const stageRef = React.createRef<Stage>();
        const datedPerson: Person = {
            id: 'p6',
            name: 'Aged',
            x: 0,
            y: 0,
            gender: 'female',
            partnerships: [],
            birthDate: '1980-01-05',
            deathDate: '2020-01-06',
        };
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode person={datedPerson} {...baseProps} functionalIndicatorDefinitions={definitions} />
                </Layer>
            </Stage>
        );
        const stage = stageRef.current;
        const group = stage.getLayers()[0].getChildren()[0];
        const texts = group.find('Text');
        expect(texts.some((node: any) => node.text() === 'Age 40')).toBe(true);
        expect(texts.some((node: any) => node.text() === 'd. 2020-01-06')).toBe(true);
    });

    const maturityBadgesTyped = (group: Konva.Group) =>
        group.find<Konva.Rect>('Rect').filter((rect) => rect.fill() === '#f0f4ff');

    // ── Review nodes-09 / nodes-10 / nodes-11 ───────────────────────────────

    // The body square of a male carries the male fill and the full size.
    const maleBody = (group: Konva.Group) =>
        group.find<Konva.Rect>('Rect').filter((rect) => rect.fill() === '#ADD8E6' && rect.width() === 60);
    const femaleBody = (group: Konva.Group) =>
        group.find<Konva.Circle>('Circle').filter((circle) => circle.fill() === '#FFC0CB');
    const unknownBody = (group: Konva.Group) =>
        konvaLines(group).filter((line) => line.closed() && line.fill() === '#D9D9D9');

    it.each(['Male', 'MALE', 'm', 'b', 'B'])('nodes-10: draws gender %s as a male square', (gender) => {
        const group = renderTyped({ id: 'g', name: 'G', x: 0, y: 0, partnerships: [], gender });
        expect(maleBody(group).length).toBe(1);
        expect(femaleBody(group).length).toBe(0);
    });

    it.each(['Female', 'f', 's', 'S'])('nodes-10: draws gender %s as a female circle', (gender) => {
        const group = renderTyped({ id: 'g', name: 'G', x: 0, y: 0, partnerships: [], gender });
        expect(femaleBody(group).length).toBe(1);
    });

    it.each(['x', 'other', 'Unknown'])('nodes-10: draws an unrecognised gender %s as the unknown triangle, not female', (gender) => {
        const group = renderTyped({ id: 'g', name: 'G', x: 0, y: 0, partnerships: [], gender });
        expect(unknownBody(group).length).toBe(1);
        expect(femaleBody(group).length).toBe(0);
    });

    it('nodes-09: draws a stillborn person of unknown sex as a triangle with the X inside it', () => {
        const group = renderTyped({ id: 's', name: 'S', x: 0, y: 0, partnerships: [], lifeStatus: 'stillbirth' });
        expect(group.find('Circle').length).toBe(0);
        const body = konvaLines(group).filter((line) => line.closed() && line.fill() === 'white');
        expect(body.length).toBe(1);
        const tri = body[0].points();
        const cross = konvaLines(group).filter((line) => !line.closed() && line.points().length === 4);
        expect(cross.length).toBe(2);
        cross.forEach((line) => {
            const [x1, y1, x2, y2] = line.points();
            expect(insideTriangle(x1, y1, tri)).toBe(true);
            expect(insideTriangle(x2, y2, tri)).toBe(true);
        });
    });

    it('nodes-09: a stillborn female is still a circle', () => {
        const group = renderTyped({ id: 's', name: 'S', x: 0, y: 0, partnerships: [], lifeStatus: 'stillbirth', gender: 'female' });
        expect(group.find('Circle').length).toBe(1);
    });

    it('nodes-09: keeps the death X inside the unknown-sex triangle', () => {
        const group = renderTyped({ id: 'd', name: 'D', x: 0, y: 0, partnerships: [], deathDate: '2001-02-03' });
        const tri = unknownBody(group)[0].points();
        const cross = konvaLines(group).filter((line) => !line.closed() && line.points().length === 4);
        expect(cross.length).toBe(2);
        cross.forEach((line) => {
            const [x1, y1, x2, y2] = line.points();
            expect(insideTriangle(x1, y1, tri)).toBe(true);
            expect(insideTriangle(x2, y2, tri)).toBe(true);
        });
    });

    // Konva fires 'click' for every mouse button; the handlers must ignore
    // anything but the left one.
    const clickWith = (node: Konva.Node, button: number) =>
        node.fire('click', { evt: { button, clientX: 1, clientY: 2, shiftKey: false } }, true);

    it('nodes-11: a right-click on a symptom badge does not open it; a left click does', () => {
        const onSymptomBadgeClick = vi.fn();
        const indicatorDefinitions: FunctionalIndicatorDefinition[] = [{ id: 'fi1', label: 'Affair', color: '#123456' }];
        const stageRef = React.createRef<Konva.Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <PersonNode
                        person={{
                            id: 'sb', name: 'SB', x: 0, y: 0, partnerships: [], gender: 'female',
                            functionalIndicators: [{ definitionId: 'fi1', status: 'current', impact: 2 }],
                        }}
                        {...baseProps}
                        functionalIndicatorDefinitions={indicatorDefinitions}
                        onSymptomBadgeClick={onSymptomBadgeClick}
                    />
                </Layer>
            </Stage>
        );
        const badge = stageRef.current!.find<Konva.Circle>('Circle').filter((circle) => circle.stroke() === '#123456');
        expect(badge.length).toBe(1);
        clickWith(badge[0], 2);
        expect(onSymptomBadgeClick).not.toHaveBeenCalled();
        clickWith(badge[0], 0);
        expect(onSymptomBadgeClick).toHaveBeenCalledTimes(1);
    });

    it('nodes-11: a right-click on the sibling square does not open it; a left click does', () => {
        const onSiblingSquareClick = vi.fn();
        const group = renderTyped(
            { id: 'sq', name: 'SQ', x: 0, y: 0, partnerships: [], gender: 'male', siblingMaturityLevel: 2 },
            { onSiblingSquareClick }
        );
        const square = maturityBadgesTyped(group);
        expect(square.length).toBe(1);
        clickWith(square[0], 2);
        expect(onSiblingSquareClick).not.toHaveBeenCalled();
        clickWith(square[0], 0);
        expect(onSiblingSquareClick).toHaveBeenCalledTimes(1);
    });

    it('nodes-11: a right-click on the autonomy square does not open it; a left click does', () => {
        const onAutonomySquareClick = vi.fn();
        const eaEvent: EmotionalProcessEvent = {
            id: 'ea1', eventType: 'EA', category: 'Emotional Autonomy', status: 'discrete', intensity: 3, howWell: 0,
            date: '2020-01-01', startDate: '2020-01-01', otherPersonName: '', wwwwh: '', observations: '',
            anchorType: 'PERSON', anchorId: 'au', eventClass: 'individual', createdAt: 0,
        };
        const group = renderTyped(
            { id: 'au', name: 'AU', x: 0, y: 0, partnerships: [], gender: 'male', events: [eaEvent] },
            { onAutonomySquareClick }
        );
        const square = group.find<Konva.Rect>('Rect').filter((rect) => rect.fill() === '#e8f5e9');
        expect(square.length).toBe(1);
        clickWith(square[0], 2);
        expect(onAutonomySquareClick).not.toHaveBeenCalled();
        clickWith(square[0], 0);
        expect(onAutonomySquareClick).toHaveBeenCalledTimes(1);
    });
});

