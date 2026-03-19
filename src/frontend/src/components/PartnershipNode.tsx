import { Group, Line, Rect, Text } from 'react-konva';
import type { Partnership, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import { getPersonVerticalExtents } from '../utils/personGeometry';
import { computeDefaultFamilyName } from '../utils/partnershipUtils';

interface PartnershipNodeProps {
  partnership: Partnership;
  partner1: Person;
  partner2: Person;
  isSelected: boolean;
  isFamilySelected: boolean;
  onSelect: (partnershipId: string) => void;
  onHorizontalConnectorDragEnd: (partnershipId: string, y: number) => void;
  onFamilyNameOffsetChange: (partnershipId: string, offsetX: number) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, partnershipId: string) => void;
  onFamilyClick: (partnershipId: string) => void;
  onFamilyContextMenu: (e: KonvaEventObject<PointerEvent>, partnershipId: string) => void;
  onFamilyIndicatorClick: (partnershipId: string, eventId: string, position: { x: number; y: number }) => void;
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

const TRI_SIDE = 16;
const TRI_HALF = TRI_SIDE / 2;
const TRI_H = Math.round(TRI_SIDE * Math.sqrt(3) / 2);
const INDICATOR_DEFS = [
  { letter: 'V', processType: 'triangle-functioning' },
  { letter: 'F', processType: 'triangle-flexibility' },
  { letter: 'R', processType: 'triangle-stress-response' },
] as const;

const DIA_SIZE = 16;
const DIA_HALF = DIA_SIZE / 2;
const STRESSOR_INDICATOR_DEFS = [
  { letter: 'R', processType: 'stress-emotional-reactivity' },
  { letter: 'A', processType: 'stress-family-adaptability' },
  { letter: 'S', processType: 'stress-family-stressor' },
  { letter: 'C', processType: 'stress-chronic-stress' },
] as const;

const PartnershipNode = ({ partnership, partner1, partner2, isSelected, isFamilySelected, onSelect, onHorizontalConnectorDragEnd, onFamilyNameOffsetChange, onContextMenu, onFamilyClick, onFamilyContextMenu, onFamilyIndicatorClick }: PartnershipNodeProps) => {
  const { horizontalConnectorY, relationshipType, relationshipStatus, relationshipStartDate, marriedStartDate, separationDate, divorceDate, familyName, familyNameOffsetX } = partnership;
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
        {(() => {
          const label = familyName !== undefined ? familyName : computeDefaultFamilyName(partner1, partner2);
          if (!label) return null;
          const fontSize = 22;
          const padX = 10;
          const padY = 6;
          const charWidth = fontSize * 0.58;
          const boxW = Math.max(100, label.length * charWidth + padX * 2);
          const boxH = fontSize + padY * 2;
          const centerX = midPointX + (familyNameOffsetX ?? 0);
          const boxY = connectorY + 8;
          return (
            <Group
              x={centerX}
              y={boxY}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(pLeft_x_center + boxW / 2, Math.min(pRight_x_center - boxW / 2, pos.x)),
                y: boxY,
              })}
              onDragEnd={(e) => {
                const newCenterX = e.target.x();
                onFamilyNameOffsetChange(partnership.id, normalizeCoord(newCenterX - midPointX));
              }}
              onClick={() => onFamilyClick(partnership.id)}
              onTap={() => onFamilyClick(partnership.id)}
              onContextMenu={(e) => { e.cancelBubble = true; onFamilyContextMenu(e, partnership.id); }}
              onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
              onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
            >
              <Rect
                x={-boxW / 2}
                y={0}
                width={boxW}
                height={boxH}
                fill={isFamilySelected ? '#dbeafe' : '#f8f9fc'}
                stroke={isFamilySelected ? '#3b82f6' : '#9aaac4'}
                strokeWidth={isFamilySelected ? 2 : 1}
                cornerRadius={3}
              />
              <Text
                x={-boxW / 2 + padX}
                y={padY}
                text={label}
                fontSize={fontSize}
                fontFamily="sans-serif"
                fill="#23324a"
                listening={false}
              />
              {(() => {
                const active = INDICATOR_DEFS.flatMap((def) => {
                  const events = (partnership.familyEvents || []).filter(
                    (ev) => ev.emotionalProcessType === def.processType
                  );
                  if (events.length === 0) return [];
                  return [{ ...def, event: events[events.length - 1] }];
                });
                if (active.length === 0) return null;
                const spacing = 30;
                const startX = -((active.length - 1) * spacing) / 2;
                return active.map((ind, i) => {
                  const cx = startX + i * spacing;
                  return (
                    <Group
                      key={ind.processType}
                      x={cx}
                      y={boxH + 2}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        onFamilyIndicatorClick(partnership.id, ind.event.id, {
                          x: (e.evt as MouseEvent).clientX,
                          y: (e.evt as MouseEvent).clientY,
                        });
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        onFamilyIndicatorClick(partnership.id, ind.event.id, { x: 0, y: 0 });
                      }}
                      onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
                    >
                      <Rect x={-TRI_HALF - 2} y={-2} width={TRI_SIDE + 18} height={TRI_H + 4} fill="transparent" />
                      <Line
                        points={[0, 0, -TRI_HALF, TRI_H, TRI_HALF, TRI_H]}
                        closed
                        fill="#dbeafe"
                        stroke="#4b68a6"
                        strokeWidth={1.5}
                        listening={false}
                      />
                      <Text
                        x={-TRI_HALF}
                        y={Math.round(TRI_H * 0.38)}
                        width={TRI_SIDE}
                        text={ind.letter}
                        fontSize={9}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#1e3a6e"
                        align="center"
                        listening={false}
                      />
                      <Text
                        x={TRI_HALF + 2}
                        y={Math.round(TRI_H / 2) - 5}
                        text={String(ind.event.intensity ?? '')}
                        fontSize={10}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#23324a"
                        listening={false}
                      />
                    </Group>
                  );
                });
              })()}
              {(() => {
                const activeStressors = STRESSOR_INDICATOR_DEFS.flatMap((def) => {
                  const events = (partnership.familyEvents || []).filter(
                    (ev) => ev.emotionalProcessType === def.processType
                  );
                  if (events.length === 0) return [];
                  return [{ ...def, event: events[events.length - 1] }];
                });
                if (activeStressors.length === 0) return null;
                const spacing = 30;
                const startX = -((activeStressors.length - 1) * spacing) / 2;
                const diaRowY = boxH + 2 + TRI_H + 6;
                return activeStressors.map((ind, i) => {
                  const cx = startX + i * spacing;
                  return (
                    <Group
                      key={ind.processType}
                      x={cx}
                      y={diaRowY}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        onFamilyIndicatorClick(partnership.id, ind.event.id, {
                          x: (e.evt as MouseEvent).clientX,
                          y: (e.evt as MouseEvent).clientY,
                        });
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        onFamilyIndicatorClick(partnership.id, ind.event.id, { x: 0, y: 0 });
                      }}
                      onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }}
                    >
                      <Rect x={-DIA_HALF - 2} y={-2} width={DIA_SIZE + 18} height={DIA_SIZE + 4} fill="transparent" />
                      <Line
                        points={[0, 0, DIA_HALF, DIA_HALF, 0, DIA_SIZE, -DIA_HALF, DIA_HALF]}
                        closed
                        fill="#f6f0fb"
                        stroke="#7a5a9e"
                        strokeWidth={1.5}
                        listening={false}
                      />
                      <Text
                        x={-DIA_HALF}
                        y={Math.round(DIA_HALF - 4)}
                        width={DIA_SIZE}
                        text={ind.letter}
                        fontSize={9}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#4a2570"
                        align="center"
                        listening={false}
                      />
                      <Text
                        x={DIA_HALF + 2}
                        y={Math.round(DIA_SIZE / 2) - 5}
                        text={String(ind.event.intensity ?? '')}
                        fontSize={10}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#23324a"
                        listening={false}
                      />
                    </Group>
                  );
                });
              })()}
            </Group>
          );
        })()}
    </Group>
  );
};

export default PartnershipNode;
