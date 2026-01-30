import { Group, Line } from 'react-konva';
import type { Partnership, Person } from '../types';
import { KonvaEventObject } from 'konva/lib/Node';

interface PartnershipNodeProps {
  partnership: Partnership;
  partner1: Person;
  partner2: Person;
  isSelected: boolean;
  onSelect: (partnershipId: string) => void;
  onHorizontalConnectorDragEnd: (partnershipId: string, y: number) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, partnershipId: string) => void;
}

const PartnershipNode = ({ partnership, partner1, partner2, isSelected, onSelect, onHorizontalConnectorDragEnd, onContextMenu }: PartnershipNodeProps) => {
  const { horizontalConnectorY } = partnership;

  const p1_x_center = partner1.x;
  const p1_y_bottom = partner1.y + 30;
  const p2_x_center = partner2.x;
  const p2_y_bottom = partner2.y + 30;

  const partnerLeft = partner1.x < partner2.x ? partner1 : partner2;
  const partnerRight = partner1.x < partner2.x ? partner2 : partner1;

  const pLeft_x_center = (partnerLeft.id === partner1.id ? p1_x_center : p2_x_center);
  const pLeft_y_bottom = (partnerLeft.id === partner1.id ? p1_y_bottom : p2_y_bottom);
  const pRight_x_center = (partnerRight.id === partner1.id ? p1_x_center : p2_x_center);
  const pRight_y_bottom = (partnerRight.id === partner1.id ? p1_y_bottom : p2_y_bottom);
  
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onHorizontalConnectorDragEnd(partnership.id, e.target.y());
  };

  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'ns-resize';
    }
  };

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'default';
    }
  };
  
  const handleSelect = () => {
    onSelect(partnership.id);
  }

  return (
    <Group>
        {/* Left vertical drop */}
        <Line
            points={[pLeft_x_center, pLeft_y_bottom, pLeft_x_center, horizontalConnectorY]}
            stroke="black"
            strokeWidth={2}
        />
        {/* Right vertical drop */}
        <Line
            points={[pRight_x_center, pRight_y_bottom, pRight_x_center, horizontalConnectorY]}
            stroke="black"
            strokeWidth={2}
        />
        {/* Horizontal connector - draggable */}
        <Group
          draggable
          dragDirection="vertical"
          y={horizontalConnectorY}
          onDragEnd={handleDragEnd}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleSelect}
          onTap={handleSelect}
          dragBoundFunc={(pos) => {
            return {
              x: 0,
              y: pos.y,
            };
          }}
          onContextMenu={(e) => onContextMenu(e, partnership.id)}
        >
          <Line
              points={[pLeft_x_center - pLeft_x_center, 0, pRight_x_center - pLeft_x_center, 0]}
              stroke="transparent" // invisible, just for hit detection
              strokeWidth={20}
              x={pLeft_x_center}
          />
          <Line
              points={[pLeft_x_center- pLeft_x_center, 0, pRight_x_center - pLeft_x_center, 0]}
              stroke={isSelected ? 'blue' : 'black'}
              strokeWidth={2}
              x={pLeft_x_center}
          />
        </Group>
    </Group>
  );
};

export default PartnershipNode;
