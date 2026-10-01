import React from 'react';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { vi } from 'vitest';
import EmotionalLineNode from './EmotionalLineNode';
import type { EmotionalLine, Person } from '../types';
import { LINE_HIT_STROKE_WIDTH } from '../constants/hitAreas';

/**
 * G-TEST-10: the two tests that were here clicked the bare canvas (or did
 * nothing) and asserted onSelect was NOT called, so they passed whether or
 * not a line could be clicked. These fire a Konva click on the line itself —
 * found by its wide hit region, which only the clickable line carries — and
 * expect onSelect. Removing the line's onClick makes them fail.
 */
const person1: Person = { id: 'p1', x: 50, y: 50, name: 'p1', partnerships: [] };
const person2: Person = { id: 'p2', x: 250, y: 50, name: 'p2', partnerships: [] };

const renderAndClick = (emotionalLine: EmotionalLine, button: number) => {
    const onSelect = vi.fn();
    const stageRef = React.createRef<Konva.Stage>();
    render(
        <Stage ref={stageRef}>
            <Layer>
                <EmotionalLineNode
                    emotionalLine={emotionalLine}
                    person1={person1}
                    person2={person2}
                    isSelected={false}
                    onSelect={onSelect}
                    onContextMenu={() => {}}
                />
            </Layer>
        </Stage>
    );
    const clickable = stageRef.current!
        .find<Konva.Line>('Line')
        .filter((line) => line.hitStrokeWidth() === LINE_HIT_STROKE_WIDTH);
    expect(clickable.length).toBeGreaterThan(0);
    clickable[0].fire('click', { evt: { button } }, true);
    return onSelect;
};

describe('EmotionalLineNode Regression (G-TEST-10)', () => {
    it.each([
        ['fusion', 'low'],
        ['conflict', 'solid-saw-tooth'],
        ['projection', 'projection-3'],
    ] as const)('calls onSelect when the %s / %s line is clicked', (relationshipType, lineStyle) => {
        const onSelect = renderAndClick(
            {
                id: 'el1',
                person1_id: 'p1',
                person2_id: 'p2',
                relationshipType,
                lineStyle,
                lineEnding: 'none',
            },
            0
        );
        expect(onSelect).toHaveBeenCalledWith('el1');
    });
});
