import { Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Person, Triangle } from '../types';

interface TriangleFillNodeProps {
  triangle: Triangle;
  person1: Person;
  person2: Person;
  person3: Person;
  onSelect?: (triangleId: string) => void;
  onContextMenu?: (e: KonvaEventObject<PointerEvent>, triangleId: string) => void;
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

const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const full = /^#([0-9a-fA-F]{6})$/;
  let r = 136;
  let g = 90;
  let b = 0;
  if (full.test(normalized)) {
    r = parseInt(normalized.slice(1, 3), 16);
    g = parseInt(normalized.slice(3, 5), 16);
    b = parseInt(normalized.slice(5, 7), 16);
  } else if (short.test(normalized)) {
    r = parseInt(normalized[1] + normalized[1], 16);
    g = parseInt(normalized[2] + normalized[2], 16);
    b = parseInt(normalized[3] + normalized[3], 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const TriangleFillNode = ({
  triangle,
  person1,
  person2,
  person3,
  onSelect,
  onContextMenu,
}: TriangleFillNodeProps) => {
  const centroid = {
    x: (person1.x + person2.x + person3.x) / 3,
    y: (person1.y + person2.y + person3.y) / 3,
  };
  const v1 = getVertex(person1, centroid);
  const v2 = getVertex(person2, centroid);
  const v3 = getVertex(person3, centroid);
  const baseColor = triangle.color || '#8a5a00';
  const fillAlpha = triangle.intensity === 'low' ? 0.08 : triangle.intensity === 'high' ? 0.2 : 0.12;
  const strokeAlpha = triangle.intensity === 'low' ? 0.22 : triangle.intensity === 'high' ? 0.34 : 0.28;
  return (
    <Line
      points={[v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]}
      closed
      fill={withAlpha(baseColor, fillAlpha)}
      stroke={withAlpha(baseColor, strokeAlpha)}
      strokeWidth={1}
      hitStrokeWidth={14}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect?.(triangle.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect?.(triangle.id);
      }}
      onContextMenu={(e) => {
        e.cancelBubble = true;
        onContextMenu?.(e, triangle.id);
      }}
    />
  );
};

export default TriangleFillNode;
