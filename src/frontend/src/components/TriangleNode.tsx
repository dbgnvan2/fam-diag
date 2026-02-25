import { Group, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Person, Triangle } from '../types';

interface TriangleNodeProps {
  triangle: Triangle;
  person1: Person;
  person2: Person;
  person3: Person;
  isSelected: boolean;
  onSelect: (triangleId: string) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, triangleId: string) => void;
}

const getVertex = (from: Person, to: { x: number; y: number }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.0001) return { x: from.x, y: from.y };
  const unitX = dx / distance;
  const unitY = dy / distance;
  const radius = ((from.size ?? 60) / 2) * 1.05;
  return {
    x: from.x + unitX * radius,
    y: from.y + unitY * radius,
  };
};

const TriangleNode = ({
  triangle,
  person1,
  person2,
  person3,
  isSelected,
  onSelect,
  onContextMenu,
}: TriangleNodeProps) => {
  const centroid = {
    x: (person1.x + person2.x + person3.x) / 3,
    y: (person1.y + person2.y + person3.y) / 3,
  };
  const v1 = getVertex(person1, centroid);
  const v2 = getVertex(person2, centroid);
  const v3 = getVertex(person3, centroid);
  const stroke = isSelected ? '#0077cc' : triangle.color || '#8a5a00';

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(triangle.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(triangle.id);
      }}
      onContextMenu={(e) => onContextMenu(e, triangle.id)}
    >
      <Line points={[v1.x, v1.y, v2.x, v2.y]} stroke={stroke} strokeWidth={isSelected ? 3 : 2} hitStrokeWidth={16} />
      <Line points={[v2.x, v2.y, v3.x, v3.y]} stroke={stroke} strokeWidth={isSelected ? 3 : 2} hitStrokeWidth={16} />
      <Line points={[v3.x, v3.y, v1.x, v1.y]} stroke={stroke} strokeWidth={isSelected ? 3 : 2} hitStrokeWidth={16} />
    </Group>
  );
};

export default TriangleNode;
