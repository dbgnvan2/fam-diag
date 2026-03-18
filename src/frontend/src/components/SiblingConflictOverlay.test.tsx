import React from 'react';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import SiblingConflictOverlay from './SiblingConflictOverlay';
import type { Person, Partnership } from '../types';

const makePerson = (overrides: Partial<Person>): Person => ({
  id: overrides.id || 'p',
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  name: overrides.name || 'Person',
  partnerships: overrides.partnerships || [],
  ...overrides,
});

const makePartnership = (overrides: Partial<Partnership>): Partnership => ({
  id: overrides.id || 'rel',
  partner1_id: overrides.partner1_id || 'p1',
  partner2_id: overrides.partner2_id || 'p2',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: overrides.children || [],
  ...overrides,
});

const renderOverlay = (person: Person, people: Person[], partnerships: Partnership[]) => {
  const stageRef = React.createRef<Stage>();
  render(
    <Stage ref={stageRef}>
      <Layer>
        <SiblingConflictOverlay person={person} people={people} partnerships={partnerships} />
      </Layer>
    </Stage>
  );
  const group = stageRef.current!.getLayers()[0].getChildren()[0];
  return group;
};

describe('SiblingConflictOverlay', () => {
  const dad = makePerson({ id: 'dad', name: 'Dad', birthSex: 'male', x: -100, y: 0 });
  const mom = makePerson({ id: 'mom', name: 'Mom', birthSex: 'female', x: 100, y: 0 });
  const parentPartnership = makePartnership({
    id: 'parents',
    partner1_id: 'dad',
    partner2_id: 'mom',
    children: ['child'],
  });

  it('renders parent lines (diagonal) going out the top for a person with no partner', () => {
    const child = makePerson({
      id: 'child', birthSex: 'male', x: 0, y: 200,
      parentPartnership: 'parents', siblingsComplete: true,
      siblingPositionOverride: 'ob/b',
      partnerships: [],
    });
    const people = [dad, mom, child];
    const group = renderOverlay(child, people, [parentPartnership]);
    const lines = group.getChildren().filter((n: any) => n.getClassName() === 'Line');
    // 2 lines for father (rank+sex) + 2 lines for mother (rank+sex) = 4 total
    expect(lines.length).toBe(4);
  });

  it('renders partner lines (horizontal) in addition to parent lines when partner exists', () => {
    const partnerPerson = makePerson({
      id: 'partner', birthSex: 'female', x: 100, y: 200,
      partnerships: ['couple'],
      siblingPositionOverride: 'os/b',
    });
    const child = makePerson({
      id: 'child', birthSex: 'male', x: 0, y: 200,
      parentPartnership: 'parents', siblingsComplete: true,
      siblingPositionOverride: 'ob/b',
      partnerships: ['couple'],
    });
    const couple = makePartnership({ id: 'couple', partner1_id: 'child', partner2_id: 'partner', children: [] });
    const people = [dad, mom, child, partnerPerson];
    const group = renderOverlay(child, people, [parentPartnership, couple]);
    const lines = group.getChildren().filter((n: any) => n.getClassName() === 'Line');
    // 2 father + 2 mother + 2 partner = 6 lines
    expect(lines.length).toBe(6);
  });

  it('colors rank line green when there is no rank conflict', () => {
    // ob/b vs ob/b → rank conflict (both oldest) — test for no-conflict: use yb/b vs ob/b
    const partnerPerson = makePerson({
      id: 'partner', birthSex: 'female', x: 100, y: 200,
      partnerships: ['couple'],
      siblingPositionOverride: 'ys/b',
    });
    const child = makePerson({
      id: 'child', birthSex: 'male', x: 0, y: 200,
      parentPartnership: 'parents', siblingsComplete: true,
      siblingPositionOverride: 'ob/s',
      partnerships: ['couple'],
    });
    const couple = makePartnership({ id: 'couple', partner1_id: 'child', partner2_id: 'partner', children: [] });
    const people = [dad, mom, child, partnerPerson];
    const group = renderOverlay(child, people, [parentPartnership, couple]);
    const lines = group.getChildren().filter((n: any) => n.getClassName() === 'Line');
    const partnerLines = lines.slice(-2); // last 2 are partner rank+sex
    const rankLine = partnerLines[0];
    expect(rankLine.attrs.stroke).toBe('#43a047'); // green = no conflict
  });

  it('colors rank line red when there is a rank conflict', () => {
    // ob/b vs os/s → both oldest = rank conflict
    const partnerPerson = makePerson({
      id: 'partner', birthSex: 'female', x: 100, y: 200,
      partnerships: ['couple'],
      siblingPositionOverride: 'os/s',
    });
    const child = makePerson({
      id: 'child', birthSex: 'male', x: 0, y: 200,
      parentPartnership: 'parents', siblingsComplete: true,
      siblingPositionOverride: 'ob/b',
      partnerships: ['couple'],
    });
    const couple = makePartnership({ id: 'couple', partner1_id: 'child', partner2_id: 'partner', children: [] });
    const people = [dad, mom, child, partnerPerson];
    const group = renderOverlay(child, people, [parentPartnership, couple]);
    const lines = group.getChildren().filter((n: any) => n.getClassName() === 'Line');
    const partnerRankLine = lines[lines.length - 2];
    expect(partnerRankLine.attrs.stroke).toBe('#e53935'); // red = conflict
  });

  it('colors sex line green for same-sex parent-child pair (N/A)', () => {
    // son vs father: same sex → sex line should be green (N/A = no conflict)
    const child = makePerson({
      id: 'child', birthSex: 'male', x: 0, y: 200,
      parentPartnership: 'parents', siblingsComplete: true,
      siblingPositionOverride: 'ob/b',
      partnerships: [],
    });
    const people = [dad, mom, child];
    const group = renderOverlay(child, people, [parentPartnership]);
    const lines = group.getChildren().filter((n: any) => n.getClassName() === 'Line');
    // Father lines: lines[0]=rank, lines[1]=sex
    const fatherSexLine = lines[1];
    expect(fatherSexLine.attrs.stroke).toBe('#43a047'); // green = N/A (same sex pair)
  });

  it('shows dashed gray lines when parent is not on the diagram', () => {
    // Parent absent from people → conflict === null → gray dashed
    const child = makePerson({
      id: 'child', birthSex: 'male', x: 0, y: 200,
      parentPartnership: 'parents',
      siblingPositionOverride: 'ob/b',
      partnerships: [],
    });
    // Only the child in people — dad and mom not found
    const people = [child];
    const group = renderOverlay(child, people, [parentPartnership]);
    const lines = group.getChildren().filter((n: any) => n.getClassName() === 'Line');
    // Father rank line should be gray dashed (parent not found)
    const fatherRankLine = lines[0];
    expect(fatherRankLine.attrs.stroke).toBe('#bdbdbd');
    expect(fatherRankLine.attrs.dash).toBeDefined();
  });
});
