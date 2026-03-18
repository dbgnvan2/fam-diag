import { Group, Shape } from 'react-konva';
import type { EmotionalLine, Partnership, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import { getPersonVerticalExtents } from '../utils/personGeometry';

interface FamilyCutoffArcProps {
  child: Person;
  partnership: Partnership;
  partner1: Person;
  partner2: Person;
  emotionalLine: EmotionalLine;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, id: string) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Read the most-recent EPE event intensity (1–4) from the line's events. */
const getCutoffArcCount = (line: EmotionalLine): number => {
  const events = line.events || [];
  const latest = [...events]
    .filter((e) => e.eventType === 'EPE' || e.eventClass === 'emotional-pattern')
    .sort((a, b) => {
      const aTs = new Date(a.startDate || a.date || 0).getTime();
      const bTs = new Date(b.startDate || b.date || 0).getTime();
      return bTs - aTs;
    })[0];
  const level = typeof latest?.intensity === 'number' ? latest.intensity : 1;
  return Math.min(4, Math.max(1, level));
};

/** Evenly-spaced offsets along the line for N arcs, centred at 0. */
const arcOffsets = (count: number): number[] => {
  const spacing = 8;
  const half = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => (i - half) * spacing);
};

const FamilyCutoffArc = ({
  child,
  partnership,
  partner1,
  partner2,
  emotionalLine,
  isSelected,
  onSelect,
  onContextMenu,
}: FamilyCutoffArcProps) => {
  const child_x_center = child.x;
  const { top: topOffset } = getPersonVerticalExtents(child);
  const child_y_top = child.y - topOffset;

  const p1_x_center = partner1.x;
  const p2_x_center = partner2.x;
  const partnershipLineStartX = Math.min(p1_x_center, p2_x_center);
  const partnershipLineEndX = Math.max(p1_x_center, p2_x_center);

  const defaultConnectionX = clamp(child_x_center, partnershipLineStartX, partnershipLineEndX);
  const connectionX =
    child.connectionAnchorX !== undefined
      ? clamp(child.connectionAnchorX, partnershipLineStartX, partnershipLineEndX)
      : defaultConnectionX;
  const connectionY = partnership.horizontalConnectorY;

  const dx = connectionX - child_x_center;
  const dy = connectionY - child_y_top;
  const length = Math.hypot(dx, dy);

  if (length <= 18) return null;

  const unitX = dx / length;
  const unitY = dy / length;
  const perpX = -unitY;
  const perpY = unitX;

  const arcStroke = isSelected ? 'blue' : 'black';
  const halfWidth = 12;
  const depth = 10;
  const arcCount = getCutoffArcCount(emotionalLine);
  const offsets = arcOffsets(arcCount);

  const handleSelect = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(emotionalLine.id);
  };

  const handleContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.cancelBubble = true;
    onContextMenu(e, emotionalLine.id);
  };

  return (
    <Group onClick={handleSelect} onTap={handleSelect} onContextMenu={handleContextMenu}>
      {offsets.map((offset, index) => {
        const cx = child_x_center + unitX * (length / 2 + offset);
        const cy = child_y_top + unitY * (length / 2 + offset);
        const startX = cx - perpX * halfWidth;
        const startY = cy - perpY * halfWidth;
        const endX = cx + perpX * halfWidth;
        const endY = cy + perpY * halfWidth;
        const controlX = cx + unitX * depth;
        const controlY = cy + unitY * depth;
        return (
          <Shape
            key={`cutoff-arc-${index}`}
            stroke={arcStroke}
            strokeWidth={2}
            hitStrokeWidth={16}
            sceneFunc={(context, shape) => {
              context.beginPath();
              context.moveTo(startX, startY);
              context.quadraticCurveTo(controlX, controlY, endX, endY);
              context.fillStrokeShape(shape);
            }}
          />
        );
      })}
    </Group>
  );
};

export default FamilyCutoffArc;
