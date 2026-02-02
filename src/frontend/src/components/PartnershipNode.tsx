import { Group, Line, Text } from 'react-konva';
import type { Partnership, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface PartnershipNodeProps {
  partnership: Partnership;
  partner1: Person;
  partner2: Person;
  isSelected: boolean;
  onSelect: (partnershipId: string) => void;
  onHorizontalConnectorDragEnd: (partnershipId: string, y: number) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, partnershipId: string) => void;
}

const getDashStyle = (relationshipType: string) => {
    switch (relationshipType) {
        case 'common-law':
            return [20, 10];
        case 'living-together':
            return [10, 5];
        case 'dating':
            return [2, 5];
        case 'married':
        default:
            return undefined;
    }
}

const PartnershipNode = ({ partnership, partner1, partner2, isSelected, onSelect, onHorizontalConnectorDragEnd, onContextMenu }: PartnershipNodeProps) => {
  const { horizontalConnectorY, relationshipType, relationshipStatus, relationshipStartDate, marriedStartDate, separationDate, divorceDate } = partnership;
  const dashStyle = getDashStyle(relationshipType);

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
  
  const midPointX = (pLeft_x_center + pRight_x_center) / 2;

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
            dash={dashStyle}
        />
        {/* Right vertical drop */}
        <Line
            points={[pRight_x_center, pRight_y_bottom, pRight_x_center, horizontalConnectorY]}
            stroke="black"
            strokeWidth={2}
            dash={dashStyle}
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
          onContextMenu={(e) => onContextMenu(e, partnership.id)}
          dragBoundFunc={(pos) => {
            return {
              x: 0,
              y: pos.y,
            };
          }}
        >
          <Line
              points={[pLeft_x_center, 0, pRight_x_center, 0]}
              stroke="transparent" // invisible, just for hit detection
              strokeWidth={20}
          />
          <Line
              points={[pLeft_x_center, 0, pRight_x_center, 0]}
              stroke={isSelected ? 'blue' : 'black'}
              strokeWidth={2}
              dash={dashStyle}
          />
        </Group>

        {relationshipStartDate && (
          <Text
            text={`Start: ${relationshipStartDate}`}
            x={midPointX - 50}
            y={horizontalConnectorY - 20}
            fontSize={12}
          />
        )}

        {marriedStartDate && (
          <Text
            text={`Married: ${marriedStartDate}`}
            x={midPointX - 50}
            y={horizontalConnectorY - 35}
            fontSize={12}
          />
        )}

        {separationDate && (
          <Text
            text={`Separated: ${separationDate}`}
            x={midPointX - 50}
            y={horizontalConnectorY + 5}
            fontSize={12}
          />
        )}

        {divorceDate && (
          <Text
            text={`Divorced: ${divorceDate}`}
            x={midPointX - 50}
            y={horizontalConnectorY + 20}
            fontSize={12}
          />
        )}

        {relationshipStatus === 'separated' && (
            <Line points={[midPointX - 5, horizontalConnectorY - 10, midPointX + 5, horizontalConnectorY + 10]} stroke="black" strokeWidth={2} />
        )}
        {relationshipStatus === 'divorced' && (
            <>
                <Line points={[midPointX - 10, horizontalConnectorY - 10, midPointX, horizontalConnectorY + 10]} stroke="black" strokeWidth={2} />
                <Line points={[midPointX, horizontalConnectorY - 10, midPointX + 10, horizontalConnectorY + 10]} stroke="black" strokeWidth={2} />
            </>
        )}
    </Group>
  );
};

export default PartnershipNode;
