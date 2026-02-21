import { Group, Rect, Text, Circle, Line } from 'react-konva';
import type { Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onSelect: (personId: string, additive: boolean) => void;
  onDragStart: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, person: Person) => void;
}

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';

const PersonNode = ({ person, isSelected, onSelect, onDragStart, onDragMove, onDragEnd, onContextMenu }: PersonNodeProps) => {
  const isMale = person.gender === 'male';
  const lifeStatus = person.lifeStatus ?? 'alive';
  const shapeSize = person.size ?? 60;
  const personBorderColor = person.borderColor ?? DEFAULT_BORDER_COLOR;
  const strokeColor = isSelected ? 'blue' : personBorderColor;
  const showBackground = person.backgroundEnabled ?? false;
  const backgroundColor = person.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const backgroundSize = shapeSize + 10;
  const renderMiscarriage = () => {
    const halfHeight = shapeSize / 2;
    const halfBase = shapeSize * 0.35;
    return (
      <>
        <Line
          points={[0, -halfHeight, -halfBase, halfHeight, halfBase, halfHeight]}
          closed
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
          fillEnabled={false}
        />
        <Line points={[-halfBase / 2, -halfHeight / 2, halfBase / 2, halfHeight / 2]} stroke={strokeColor} strokeWidth={2} />
        <Line points={[-halfBase / 2, halfHeight / 2, halfBase / 2, -halfHeight / 2]} stroke={strokeColor} strokeWidth={2} />
      </>
    );
  };

  const renderStillbirth = () => {
    const radius = shapeSize / 3;
    if (isMale) {
      return (
        <Rect
          width={radius * 2}
          height={radius * 2}
          offsetX={radius}
          offsetY={radius}
          fill="white"
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 1}
        />
      );
    }
    return (
      <Circle
        radius={radius}
        fill="white"
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 1}
      />
    );
  };

  const renderAliveBody = () => {
    if (isMale) {
      return (
        <Rect
          width={shapeSize}
          height={shapeSize}
          offsetX={shapeSize / 2}
          offsetY={shapeSize / 2}
          fill={'lightblue'}
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 1}
        />
      );
    }
    return (
      <Circle
        radius={shapeSize / 2}
        fill={'lightpink'}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 1}
      />
    );
  };

  const renderLifeStatus = () => {
    switch (lifeStatus) {
      case 'miscarriage':
        return renderMiscarriage();
      case 'stillbirth':
        return (
          <>
            {renderStillbirth()}
            <Line points={[-shapeSize / 4, -shapeSize / 4, shapeSize / 4, shapeSize / 4]} stroke={strokeColor} strokeWidth={2} />
            <Line points={[-shapeSize / 4, shapeSize / 4, shapeSize / 4, -shapeSize / 4]} stroke={strokeColor} strokeWidth={2} />
          </>
        );
      default:
        return renderAliveBody();
    }
  };

  const nameProps =
    lifeStatus === 'alive'
      ? {
          fontSize: 14,
          width: shapeSize,
          height: shapeSize,
          offsetX: shapeSize / 2,
          offsetY: shapeSize / 2,
          align: 'center' as const,
          verticalAlign: 'middle' as const,
        }
      : {
          fontSize: 14,
          width: shapeSize,
          offsetX: shapeSize / 2,
          y: shapeSize / 2 + 10,
          align: 'center' as const,
        };

  return (
    <Group
      id={person.id}
      x={person.x}
      y={person.y}
      draggable
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onClick={(e) => onSelect(person.id, e.evt.shiftKey)}
      onTap={() => onSelect(person.id, false)}
      onContextMenu={(e) => onContextMenu(e, person)}
    >
      {showBackground && (
        <Rect
          width={backgroundSize}
          height={backgroundSize}
          offsetX={backgroundSize / 2}
          offsetY={backgroundSize / 2}
          fill={backgroundColor}
          opacity={0.6}
          cornerRadius={8}
          listening={false}
        />
      )}
      {renderLifeStatus()}
      <Text
        text={person.name}
        {...nameProps}
        listening={false}
      />
        {person.deathDate && (
          <Text
            text={`d. ${person.deathDate}`}
            x={-25}
            y={35}
            width={50}
            align="center"
            fontSize={12}
          />
        )}
    </Group>
  );
};

export default PersonNode;
