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

const PersonNode = ({ person, isSelected, onSelect, onDragStart, onDragMove, onDragEnd, onContextMenu }: PersonNodeProps) => {
  const isMale = person.gender === 'male';
  const shapeSize = 60;

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
      {isMale ? (
        <Rect
          width={shapeSize}
          height={shapeSize}
          offsetX={shapeSize / 2}
          offsetY={shapeSize / 2}
          fill={'lightblue'}
          stroke={isSelected ? 'blue' : 'black'}
          strokeWidth={isSelected ? 3 : 1}
        />
      ) : (
        <Circle
          radius={shapeSize / 2}
          fill={'lightpink'}
          stroke={isSelected ? 'blue' : 'black'}
          strokeWidth={isSelected ? 3 : 1}
        />
      )}
      <Text
        text={person.name}
        fontSize={14}
        width={shapeSize}
        height={shapeSize}
        offsetX={shapeSize / 2}
        offsetY={shapeSize / 2}
        align="center"
        verticalAlign="middle"
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
