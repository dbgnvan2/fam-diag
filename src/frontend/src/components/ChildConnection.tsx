import { Line, Group } from 'react-konva';
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

  const points = [child_x_center, child_y_top, connectionX, connectionY];

  const isAdopted = child.adoptionStatus === 'adopted';

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
