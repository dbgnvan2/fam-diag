import { Line, Group, Shape } from 'react-konva';
import type { Partnership, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import { getPersonVerticalExtents } from '../utils/personGeometry';

interface ChildConnectionProps {
  child: Person;
  partnership: Partnership;
  partner1: Person;
  partner2: Person;
  isSelected: boolean;
  onSelect: (childId: string) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => void;
}

// Clamp function as defined in the requirements
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const ChildConnection = ({ child, partnership, partner1, partner2, isSelected, onSelect, onContextMenu }: ChildConnectionProps) => {
  const child_x_center = child.x;
  const { top: topOffset } = getPersonVerticalExtents(child);
  const child_y_top = child.y - topOffset;

  const p1_x_center = partner1.x;
  const p2_x_center = partner2.x;

  const partnershipLineStartX = Math.min(p1_x_center, p2_x_center);
  const partnershipLineEndX = Math.max(p1_x_center, p2_x_center);
  
  const defaultConnectionX = clamp(child_x_center, partnershipLineStartX, partnershipLineEndX);
  const connectionX = child.connectionAnchorX !== undefined ? clamp(child.connectionAnchorX, partnershipLineStartX, partnershipLineEndX) : defaultConnectionX;
  const connectionY = partnership.horizontalConnectorY;
  // Normal model: line is attached to the child center and ends on the PRL anchor.
  const points = [child_x_center, child_y_top, connectionX, connectionY];

  const isAdopted = child.adoptionStatus === 'adopted';
  const hasFamilyCutoff = child.parentConnectionPattern === 'family-cutoff';
  const dx = connectionX - child_x_center;
  const dy = connectionY - child_y_top;
  const length = Math.hypot(dx, dy);
  const unitX = length > 0 ? dx / length : 0;
  const unitY = length > 0 ? dy / length : -1;
  const perpX = -unitY;
  const perpY = unitX;
  const cutoffStroke = isSelected ? 'blue' : 'black';

  const familyCutoffArcCenters = hasFamilyCutoff && length > 18
    ? [-7, 7].map((offset) => {
        const centerX = child_x_center + unitX * (length / 2 + offset);
        const centerY = child_y_top + unitY * (length / 2 + offset);
        return { x: centerX, y: centerY };
      })
    : [];

  const handleSelect = () => {
    onSelect(child.id);
  }

  return (
    <Group>
        <Line
            points={points}
            stroke={isSelected ? 'blue' : 'black'}
            strokeWidth={1}
            dash={isAdopted ? [10, 5] : undefined}
        />
        {familyCutoffArcCenters.map((center, index) => {
            const halfWidth = 12;
            const depth = 10;
            const startX = center.x - perpX * halfWidth;
            const startY = center.y - perpY * halfWidth;
            const endX = center.x + perpX * halfWidth;
            const endY = center.y + perpY * halfWidth;
            const controlX = center.x + unitX * depth;
            const controlY = center.y + unitY * depth;
            return (
              <Shape
                key={`family-cutoff-${index}`}
                name="family-cutoff-arc"
                listening={false}
                stroke={cutoffStroke}
                strokeWidth={2}
                sceneFunc={(context, shape) => {
                  context.beginPath();
                  context.moveTo(startX, startY);
                  context.quadraticCurveTo(controlX, controlY, endX, endY);
                  context.fillStrokeShape(shape);
                }}
              />
            );
        })}
        <Line
            points={points}
            stroke="transparent"
            strokeWidth={10}
            onClick={handleSelect}
            onTap={handleSelect}
            onContextMenu={(e) => onContextMenu(e, child.id, partnership.id)}
        />
    </Group>
  );
};

export default ChildConnection;
