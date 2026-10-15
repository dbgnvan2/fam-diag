import React from 'react';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { mountedStage, childGroup, childrenNamed } from '../test/konvaStage';
import TriangleNode from './TriangleNode';
import type { Person, Triangle } from '../types';

describe('TriangleNode', () => {
  it('renders three sides for a triangle', () => {
    const stageRef = React.createRef<Konva.Stage>();
    const triangle: Triangle = {
      id: 't1',
      person1_id: 'p1',
      person2_id: 'p2',
      person3_id: 'p3',
    };
    const p1: Person = { id: 'p1', x: 0, y: 0, name: 'A', partnerships: [] };
    const p2: Person = { id: 'p2', x: 100, y: 0, name: 'B', partnerships: [] };
    const p3: Person = { id: 'p3', x: 50, y: 100, name: 'C', partnerships: [] };

    render(
      <Stage ref={stageRef}>
        <Layer>
          <TriangleNode
            triangle={triangle}
            person1={p1}
            person2={p2}
            person3={p3}
            isSelected={false}
            onSelect={() => {}}
            onContextMenu={() => {}}
          />
        </Layer>
      </Stage>
    );

    const stage = mountedStage(stageRef);
    const layer = stage.getLayers()[0];
    const group = childGroup(layer);
    const lines = childrenNamed<Konva.Line>(group, 'Line');
    expect(lines).toHaveLength(3);
  });
});
