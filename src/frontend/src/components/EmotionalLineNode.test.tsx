import React from 'react';
import { render } from '@testing-library/react';
import EmotionalLineNode from './EmotionalLineNode';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import type { Person, EmotionalLine } from '../types';
import { LINE_HIT_STROKE_WIDTH } from '../constants/hitAreas';

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
        expect(texts[0].attrs.text).toBe('>>>>');
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


    /**
     * Emotional pattern lines are the thinnest thing on the canvas and the
     * main way into a pattern's properties.
     */
    it('gives every clickable pattern line a wide hit region', () => {
        const emotionalLine: EmotionalLine = {
            id: 'el-hit',
            person1_id: 'p1',
            person2_id: 'p2',
            relationshipType: 'fusion',
            lineStyle: 'fusion-dotted-wide',
            lineEnding: 'none',
        };
        const person1: Person = { id: 'p1', x: 0, y: 0, name: 'A', partnerships: [] };
        const person2: Person = { id: 'p2', x: 200, y: 200, name: 'B', partnerships: [] };
        const stageRef = React.createRef<any>();
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
        const clickable = stageRef
            .current!.find('Line')
            .filter((line: any) => typeof line.eventListeners?.click !== 'undefined' || line.hitStrokeWidth() === LINE_HIT_STROKE_WIDTH);
        expect(clickable.length).toBeGreaterThan(0);
        clickable.forEach((line: any) => {
            expect(line.hitStrokeWidth()).toBe(LINE_HIT_STROKE_WIDTH);
        });
    });

    /**
     * The component renders through several different paths depending on the
     * pattern type, so asserting one of them says nothing about the rest.
     */
    it.each([
        ['fusion', 'fusion-dotted-wide'],
        ['fusion', 'fusion-triple'],
        ['cutoff', 'cutoff'],
        ['conflict', 'conflict-solid-wide'],
        ['distance', 'distance-dashed-tight'],
        ['projection', 'projection-3'],
        ['open-connection', 'open-connection-2'],
    ] as const)(
        'gives the %s / %s render path a wide hit region too',
        (relationshipType, lineStyle) => {
            const stageRef = React.createRef<any>();
            render(
                <Stage ref={stageRef}>
                    <Layer>
                        <EmotionalLineNode
                            emotionalLine={{
                                id: `el-${lineStyle}`,
                                person1_id: 'p1',
                                person2_id: 'p2',
                                relationshipType: relationshipType as EmotionalLine['relationshipType'],
                                lineStyle: lineStyle as EmotionalLine['lineStyle'],
                                lineEnding: 'arrow-p1-to-p2',
                            }}
                            person1={{ id: 'p1', x: 0, y: 0, name: 'A', partnerships: [] }}
                            person2={{ id: 'p2', x: 200, y: 200, name: 'B', partnerships: [] }}
                            isSelected={false}
                            onSelect={() => {}}
                            onContextMenu={() => {}}
                        />
                    </Layer>
                </Stage>
            );
            const withHit = stageRef
                .current!.find('Line')
                .filter((line: any) => line.hitStrokeWidth() !== 'auto');
            expect(withHit.length).toBeGreaterThan(0);
            withHit.forEach((line: any) => {
                expect(line.hitStrokeWidth()).toBe(LINE_HIT_STROKE_WIDTH);
            });
        }
    );

    // ── Review nodes-07 / nodes-08 ─────────────────────────────────────────

    const renderLine = (line: Partial<EmotionalLine>, person1: Person, person2: Person) => {
        const stageRef = React.createRef<Konva.Stage>();
        render(
            <Stage ref={stageRef}>
                <Layer>
                    <EmotionalLineNode
                        emotionalLine={{
                            id: 'el-x',
                            person1_id: person1.id,
                            person2_id: person2.id,
                            relationshipType: 'distance',
                            lineStyle: 'distance-long',
                            lineEnding: 'arrow-p1-to-p2',
                            ...line,
                        }}
                        person1={person1}
                        person2={person2}
                        isSelected={false}
                        onSelect={() => {}}
                        onContextMenu={() => {}}
                    />
                </Layer>
            </Stage>
        );
        return stageRef.current!;
    };
    const big: Person = { id: 'p1', x: 0, y: 0, name: 'Big', partnerships: [], size: 120 };
    const small: Person = { id: 'p2', x: 300, y: 0, name: 'Small', partnerships: [], size: 30 };

    it('nodes-07: each line end stops at its own person\'s size', () => {
        const stage = renderLine({}, big, small);
        // The pattern line is the one that carries the click handler.
        const drawn = stage.find<Konva.Line>('Line').filter((line) => line.hitStrokeWidth() === LINE_HIT_STROKE_WIDTH);
        expect(drawn.length).toBe(1);
        const [x1, , x2] = drawn[0].points();
        expect(x1).toBeCloseTo(60 * 1.05);
        expect(x2).toBeCloseTo(300 - 15 * 1.05);
    });

    it('nodes-07: the + / − labels sit a shape width from each person, by that person\'s size', () => {
        const stage = renderLine(
            { relationshipType: 'fusion', lineStyle: 'fusion-solid-wide', lineEnding: 'none', adequatePersonId: 'p1' },
            { ...big, x: 0 },
            { ...small, x: 300 }
        );
        const labelX = (label: string) =>
            stage.find<Konva.Text>('Text').filter((text) => text.text() === label).map((text) => text.getParent()!.x());
        expect(labelX('+')[0]).toBeCloseTo(120 * 1.05);
        expect(labelX('−')[0]).toBeCloseTo(300 - 30 * 1.05);
    });

    it.each([
        ['vertical', { x: 0, y: 0 }, { x: 0, y: 200 }],
        ['diagonal', { x: 0, y: 0 }, { x: 150, y: 200 }],
        ['horizontal', { x: 0, y: 0 }, { x: 200, y: 0 }],
    ])('nodes-08: draws the cutoff bars across a %s line at right angles', (_label, a, b) => {
        const stage = renderLine(
            { relationshipType: 'cutoff', lineStyle: 'cutoff' },
            { id: 'p1', name: 'A', partnerships: [], ...a },
            { id: 'p2', name: 'B', partnerships: [], ...b }
        );
        const bars = stage.find<Konva.Line>('.cutoff-bar');
        expect(bars.length).toBe(2);
        const lineDx = b.x - a.x;
        const lineDy = b.y - a.y;
        const lineLen = Math.hypot(lineDx, lineDy);
        bars.forEach((bar) => {
            const [x1, y1, x2, y2] = bar.points();
            const barLen = Math.hypot(x2 - x1, y2 - y1);
            expect(barLen).toBeCloseTo(40);
            const cosine = ((x2 - x1) * lineDx + (y2 - y1) * lineDy) / (barLen * lineLen);
            expect(cosine).toBeCloseTo(0);
        });
    });
});

