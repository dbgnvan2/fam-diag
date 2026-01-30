import { Group, Rect, Text, Circle } from 'react-konva';
import type { Person } from '../types';
import { KonvaEventObject } from 'konva/lib/Node';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onSelect: (personId: string) => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, person: Person) => void;
}

const PersonNode = ({ person, isSelected, onSelect, onDragMove, onDragEnd, onContextMenu }: PersonNodeProps) => {
  const isMale = person.gender === 'male';
  const shapeSize = 60;

  return (
    <Group
      id={person.id}
      x={person.x}
      y={person.y}
      draggable
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(person.id)}
      onTap={() => onSelect(person.id)}
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
    </Group>
  );
};

export default PersonNode;
