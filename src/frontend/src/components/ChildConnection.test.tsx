import React from 'react';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import ChildConnection from './ChildConnection';
import type { Person, Partnership } from '../types';
import { getPersonVerticalExtents } from '../utils/personGeometry';

describe('ChildConnection', () => {
  const partnership: Partnership = {
    id: 'partnership-1',
    partner1_id: 'p1',
    partner2_id: 'p2',
    horizontalConnectorY: 100,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children: [],
  };

  const partner1: Person = { id: 'p1', x: 0, y: 0, name: 'A', partnerships: [] };
  const partner2: Person = { id: 'p2', x: 200, y: 0, name: 'B', partnerships: [] };

  const renderConnection = (child: Person) => {
    const stageRef = React.createRef<Stage>();
    render(
      <Stage ref={stageRef}>
        <Layer>
          <ChildConnection
            child={child}
            partnership={partnership}
            partner1={partner1}
            partner2={partner2}
            isSelected={false}
            onSelect={() => {}}
            onContextMenu={() => {}}
          />
        </Layer>
      </Stage>
    );
    const stage = stageRef.current!;
    const layer = stage.getLayers()[0];
    const group = layer.getChildren()[0];
    return group.getChildren()[0];
  };

  it('keeps a single child aligned vertically when within the PRL span', () => {
    const line = renderConnection({
      id: 'child-1',
      name: 'Child',
      x: 50,
      y: 200,
      partnerships: [],
      parentPartnership: 'partnership-1',
    });
    expect(line.attrs.points).toEqual([50, 170, 50, 100]);
  });

  it('clamps the connector to the PRL when the child moves beyond the span', () => {
    const line = renderConnection({
      id: 'child-2',
      name: 'Child',
      x: 400,
      y: 200,
      partnerships: [],
      parentPartnership: 'partnership-1',
    });
    expect(line.attrs.points).toEqual([400, 170, 200, 100]);
  });

  it('uses an explicit connection anchor when provided (twins/triplets)', () => {
    const line = renderConnection({
      id: 'child-3',
      name: 'Twin',
      x: 20,
      y: 200,
      partnerships: [],
      parentPartnership: 'partnership-1',
      connectionAnchorX: 120,
    });
    expect(line.attrs.points).toEqual([20, 170, 120, 100]);
  });

  it('anchors to the top of resized children', () => {
    const child: Person = {
      id: 'child-4',
      name: 'Small Child',
      x: 80,
      y: 180,
      partnerships: [],
      parentPartnership: 'partnership-1',
      size: 40,
    };
    const line = renderConnection(child);
    const { top } = getPersonVerticalExtents(child);
    expect(line.attrs.points[1]).toBeCloseTo(child.y - top);
  });

  it('anchors miscarriage markers at the triangle apex', () => {
    const child: Person = {
      id: 'child-5',
      name: 'Loss',
      x: 120,
      y: 220,
      partnerships: [],
      parentPartnership: 'partnership-1',
      lifeStatus: 'miscarriage',
      size: 40,
    };
    const line = renderConnection(child);
    const { top } = getPersonVerticalExtents(child);
    expect(line.attrs.points[1]).toBeCloseTo(child.y - top);
  });
});
