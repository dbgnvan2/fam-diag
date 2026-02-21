import { useEffect, useMemo, useState } from 'react';
import { Group, Rect, Text, Circle, Line, Image } from 'react-konva';
import type { Person, FunctionalIndicatorDefinition, PersonFunctionalIndicator } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onSelect: (personId: string, additive: boolean) => void;
  onDragStart: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, person: Person) => void;
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
}

const DEFAULT_BORDER_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#FFF7C2';
const BASE_STROKE_WIDTH = 2;
type IndicatorEntry = PersonFunctionalIndicator & { definition: FunctionalIndicatorDefinition };

const useLoadedImage = (src?: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src || typeof window === 'undefined') {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);
  return image;
};

const IndicatorBadge = ({
  entry,
  size,
  y,
  orientation,
  halfExtent,
}: {
  entry: IndicatorEntry;
  size: number;
  y: number;
  orientation: 'left' | 'right';
  halfExtent: number;
}) => {
  const icon = useLoadedImage(entry.definition.iconDataUrl);
  const fallbackLetter = entry.definition.label?.trim().charAt(0)?.toUpperCase() || '?';
  const statusColor = entry.status === 'current' ? '#c62828' : '#5f6368';
  const statusLabel = entry.status === 'current' ? 'C' : 'P';
  const impactValue = String(entry.impact ?? 0);
  const gap = 2;
  const textWidth = Math.max(22, size * 0.55);
  const textAlign: 'left' | 'right' = orientation === 'right' ? 'left' : 'right';
  const textValue = orientation === 'right' ? `${statusLabel}${impactValue}` : `${impactValue}${statusLabel}`;
  let textX: number;
  let circleCenterX: number;
  if (orientation === 'right') {
    circleCenterX = halfExtent + 2 + size / 2;
    textX = circleCenterX + size / 2 + gap;
  } else {
    circleCenterX = -halfExtent - 2 - size / 2;
    textX = circleCenterX - size / 2 - gap - textWidth;
  }
  return (
    <Group y={y} listening={false}>
      <Text
        x={textX}
        width={textWidth}
        align={textAlign}
        text={textValue}
        fontSize={Math.max(10, size * 0.35)}
        fontStyle="bold"
        fill={statusColor}
        listening={false}
      />
      <Circle
        x={circleCenterX}
        radius={size / 2}
        fill="#ffffff"
        stroke={statusColor}
        strokeWidth={1.5}
      />
      {icon ? (
        <Image
          image={icon}
          width={size - 4}
          height={size - 4}
          x={circleCenterX - (size - 4) / 2}
          y={-(size - 4) / 2}
          listening={false}
        />
      ) : (
        <Text
          text={fallbackLetter}
          width={size}
          height={size}
          x={circleCenterX - size / 2}
          y={-size / 2}
          fontSize={Math.max(10, size * 0.5)}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}
    </Group>
  );
};

const PersonNode = ({
  person,
  isSelected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  functionalIndicatorDefinitions,
}: PersonNodeProps) => {
  const isMale = person.gender === 'male';
  const lifeStatus = person.lifeStatus ?? 'alive';
  const shapeSize = person.size ?? 60;
  const personBorderColor = person.borderColor ?? DEFAULT_BORDER_COLOR;
  const strokeColor = isSelected ? 'blue' : personBorderColor;
  const strokeWidth = isSelected ? BASE_STROKE_WIDTH * 2 : BASE_STROKE_WIDTH;
  const showBackground = person.backgroundEnabled ?? false;
  const backgroundColor = person.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const backgroundPadding = Math.max(10, shapeSize * 0.1);
  const backgroundSize = shapeSize + backgroundPadding;
  const indicatorEntries: IndicatorEntry[] = useMemo(() => {
    if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
      return [];
    }
    return functionalIndicatorDefinitions
      .map((definition) => {
        const match = person.functionalIndicators!.find((entry) => entry.definitionId === definition.id);
        return match ? ({ ...match, definition } as IndicatorEntry) : null;
      })
      .filter((entry): entry is IndicatorEntry => Boolean(entry));
  }, [person.functionalIndicators, functionalIndicatorDefinitions]);
  const indicatorSize = Math.max(14, shapeSize * 0.3);
  const indicatorSpacing = indicatorSize + 4;
  const halfExtent = (showBackground ? backgroundSize : shapeSize) / 2;
  const currentIndicators = indicatorEntries.filter((entry) => entry.status === 'current');
  const pastIndicators = indicatorEntries.filter((entry) => entry.status === 'past');
  const columnStartY = (listLength: number) =>
    -((listLength - 1) * indicatorSpacing) / 2;
  const renderMiscarriage = () => {
    const halfHeight = shapeSize / 2;
    const halfBase = shapeSize * 0.35;
    const outlineWidth = strokeWidth;
    const crossWidth = Math.max(1.5, strokeWidth - 0.5);
    return (
      <>
        <Line
          points={[0, -halfHeight, -halfBase, halfHeight, halfBase, halfHeight]}
          closed
          stroke={strokeColor}
          strokeWidth={outlineWidth}
          fillEnabled={false}
        />
        <Line points={[-halfBase / 2, -halfHeight / 2, halfBase / 2, halfHeight / 2]} stroke={strokeColor} strokeWidth={crossWidth} />
        <Line points={[-halfBase / 2, halfHeight / 2, halfBase / 2, -halfHeight / 2]} stroke={strokeColor} strokeWidth={crossWidth} />
      </>
    );
  };

  const renderStillbirth = () => {
    const radius = shapeSize / 3;
    if (isMale) {
      return (
        <Rect
          width={radius * 2}
          height={radius * 2}
          offsetX={radius}
          offsetY={radius}
          fill="white"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      );
    }
    return (
      <Circle
        radius={radius}
        fill="white"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    );
  };

  const renderAliveBody = () => {
    if (isMale) {
      return (
        <Rect
          width={shapeSize}
          height={shapeSize}
          offsetX={shapeSize / 2}
          offsetY={shapeSize / 2}
          fill={'lightblue'}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      );
    }
    return (
      <Circle
        radius={shapeSize / 2}
        fill={'lightpink'}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    );
  };

  const renderLifeStatus = () => {
    switch (lifeStatus) {
      case 'miscarriage':
        return renderMiscarriage();
      case 'stillbirth':
        return (
          <>
            {renderStillbirth()}
            <Line points={[-shapeSize / 4, -shapeSize / 4, shapeSize / 4, shapeSize / 4]} stroke={strokeColor} strokeWidth={strokeWidth} />
            <Line points={[-shapeSize / 4, shapeSize / 4, shapeSize / 4, -shapeSize / 4]} stroke={strokeColor} strokeWidth={strokeWidth} />
          </>
        );
      default:
        return renderAliveBody();
    }
  };

  const nameProps =
    lifeStatus === 'alive'
      ? {
          fontSize: 14,
          width: shapeSize,
          height: shapeSize,
          offsetX: shapeSize / 2,
          offsetY: shapeSize / 2,
          align: 'center' as const,
          verticalAlign: 'middle' as const,
        }
      : {
          fontSize: 14,
          width: shapeSize,
          offsetX: shapeSize / 2,
          y: shapeSize / 2 + 10,
          align: 'center' as const,
        };

  const displayName = useMemo(() => {
    const first = person.firstName?.trim() || '';
    const last = person.lastName?.trim() || '';
    const combined = [first, last].filter(Boolean).join(' ').trim();
    return combined || person.name || 'Unnamed';
  }, [person.firstName, person.lastName, person.name]);

  return (
    <Group
      id={person.id}
      x={person.x}
      y={person.y}
      draggable
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onClick={(e) => onSelect(person.id, e.evt.shiftKey)}
      onTap={() => onSelect(person.id, false)}
      onContextMenu={(e) => onContextMenu(e, person)}
    >
      {showBackground && (
        <Rect
          width={backgroundSize}
          height={backgroundSize}
          offsetX={backgroundSize / 2}
          offsetY={backgroundSize / 2}
          fill={backgroundColor}
          opacity={0.6}
          cornerRadius={8}
          listening={false}
        />
      )}
      {renderLifeStatus()}
      <Text
        text={displayName}
        {...nameProps}
        listening={false}
      />
        {person.deathDate && (
          <Text
            text={`d. ${person.deathDate}`}
            x={-25}
            y={35}
            width={50}
            align="center"
            fontSize={12}
          />
        )}
        {pastIndicators.map((entry, index) => (
          <IndicatorBadge
            key={`${person.id}-${entry.definition.id}-past`}
            entry={entry}
            size={indicatorSize}
            y={columnStartY(pastIndicators.length) + index * indicatorSpacing}
            orientation="left"
            halfExtent={halfExtent}
          />
        ))}
        {currentIndicators.map((entry, index) => (
          <IndicatorBadge
            key={`${person.id}-${entry.definition.id}-current`}
            entry={entry}
            size={indicatorSize}
            y={columnStartY(currentIndicators.length) + index * indicatorSpacing}
            orientation="right"
            halfExtent={halfExtent}
          />
        ))}
    </Group>
  );
};

export default PersonNode;
