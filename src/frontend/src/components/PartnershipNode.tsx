import { Group, Line, Text } from 'react-konva';
import type { Partnership, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import { getPersonVerticalExtents } from '../utils/personGeometry';

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
        case 'affair':
            return [4, 4];
        case 'friendship':
            return [14, 6, 4, 6];
        case 'married':
        default:
            return undefined;
    }
}

const normalizeCoord = (value: number) => Number(value.toFixed(3));

const PartnershipNode = ({ partnership, partner1, partner2, isSelected, onSelect, onHorizontalConnectorDragEnd, onContextMenu }: PartnershipNodeProps) => {
  const { horizontalConnectorY, relationshipType, relationshipStatus, relationshipStartDate, marriedStartDate, separationDate, divorceDate } = partnership;
  const dashStyle = getDashStyle(relationshipType);

  const connectorY = normalizeCoord(horizontalConnectorY);
  const p1Extents = getPersonVerticalExtents(partner1);
  const p2Extents = getPersonVerticalExtents(partner2);
  const p1_x_center = normalizeCoord(partner1.x);
  const p1_y_bottom = normalizeCoord(partner1.y + p1Extents.bottom);
  const p2_x_center = normalizeCoord(partner2.x);
  const p2_y_bottom = normalizeCoord(partner2.y + p2Extents.bottom);

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
        {/* Left Partner Descending Line (PDL) */}
        <Line
            points={[pLeft_x_center, pLeft_y_bottom, pLeft_x_center, connectorY]}
            stroke="black"
            strokeWidth={2}
            dash={dashStyle}
        />
        {/* Right Partner Descending Line (PDL) */}
        <Line
            points={[pRight_x_center, pRight_y_bottom, pRight_x_center, connectorY]}
            stroke="black"
            strokeWidth={2}
            dash={dashStyle}
        />
        {/* Horizontal connector - draggable */}
        <Group
          draggable
          dragDirection="vertical"
          y={connectorY}
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
            y={connectorY - 20}
            fontSize={12}
          />
        )}

        {marriedStartDate && (
          <Text
            text={`Married: ${marriedStartDate}`}
            x={midPointX - 50}
            y={connectorY - 35}
            fontSize={12}
          />
        )}

        {separationDate && (
          <Text
            text={`Separated: ${separationDate}`}
            x={midPointX - 50}
            y={connectorY + 5}
            fontSize={12}
          />
        )}

        {divorceDate && (
          <Text
            text={`Divorced: ${divorceDate}`}
            x={midPointX - 50}
            y={connectorY + 20}
            fontSize={12}
          />
        )}

        {(relationshipStatus === 'separated' || relationshipStatus === 'ended') && (
            <Line points={[midPointX - 5, connectorY - 10, midPointX + 5, connectorY + 10]} stroke="black" strokeWidth={2} />
        )}
        {(relationshipStatus === 'divorced' || relationshipStatus === 'ended') && (
            <>
                <Line points={[midPointX - 10, connectorY - 10, midPointX, connectorY + 10]} stroke="black" strokeWidth={2} />
                <Line points={[midPointX, connectorY - 10, midPointX + 10, connectorY + 10]} stroke="black" strokeWidth={2} />
            </>
        )}
    </Group>
  );
};

export default PartnershipNode;
