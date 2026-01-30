import { Line } from 'react-konva';
import type { Partnership, Person } from '../types';

interface ChildConnectionProps {
  child: Person;
  partnership: Partnership;
  partner1: Person;
  partner2: Person;
}

// Clamp function as defined in the requirements
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const ChildConnection = ({ child, partnership, partner1, partner2 }: ChildConnectionProps) => {
  const child_x_center = child.x;
  const child_y_top = child.y - 30;

  const p1_x_center = partner1.x;
  const p2_x_center = partner2.x;

  const partnershipLineStartX = Math.min(p1_x_center, p2_x_center);
  const partnershipLineEndX = Math.max(p1_x_center, p2_x_center);
  
  const connectionX = clamp(child_x_center, partnershipLineStartX, partnershipLineEndX);
  const connectionY = partnership.horizontalConnectorY;

  const points = [child_x_center, child_y_top, connectionX, connectionY];

  return (
    <Line
        points={points}
        stroke="black"
        strokeWidth={1}
    />
  );
};

export default ChildConnection;
