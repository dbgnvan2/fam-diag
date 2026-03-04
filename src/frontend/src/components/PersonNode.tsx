import { useEffect, useMemo, useState } from 'react';
import { Group, Rect, Text, Circle, Line, Image, Star } from 'react-konva';
import type {
  Person,
  FunctionalIndicatorDefinition,
  PersonFunctionalIndicator,
  GenderSymbol,
  BirthSex,
  GenderIdentity,
} from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onSelect: (personId: string, additive: boolean) => void;
  onDragStart: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>, person: Person) => void;
  onHoverChange: (personId: string | null) => void;
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

const deriveGenderSymbol = (person: Person): GenderSymbol => {
  if (person.genderSymbol) return person.genderSymbol;
  if (person.birthSex && person.genderIdentity) {
    if (person.birthSex === 'female' && person.genderIdentity === 'feminine') return 'female_cis';
    if (person.birthSex === 'male' && person.genderIdentity === 'masculine') return 'male_cis';
    if (person.birthSex === 'intersex' && person.genderIdentity === 'feminine') return 'intersex_feminine';
    if (person.birthSex === 'intersex' && person.genderIdentity === 'masculine') return 'intersex_masculine';
    if (person.birthSex === 'intersex' && person.genderIdentity === 'nonbinary') return 'intersex_nonbinary';
    if (person.birthSex === 'intersex' && person.genderIdentity === 'agender') return 'intersex_agender';
    if (person.genderIdentity === 'nonbinary') return 'nonbinary';
    if (person.genderIdentity === 'agender') return 'agender';
    return person.genderIdentity === 'feminine' ? 'female_trans' : 'male_trans';
  }
  if (person.gender === 'male') return 'male_cis';
  if (person.gender === 'intersex') return 'intersex';
  return 'female_cis';
};

const deriveBirthSex = (person: Person, symbol: GenderSymbol): BirthSex => {
  if (person.birthSex) return person.birthSex;
  if (symbol.startsWith('intersex_') || symbol === 'intersex') return 'intersex';
  if (person.gender === 'male') return 'male';
  return 'female';
};

const deriveGenderIdentity = (person: Person, symbol: GenderSymbol): GenderIdentity => {
  if (person.genderIdentity) return person.genderIdentity;
  if (symbol === 'female_cis') return 'feminine';
  if (symbol === 'male_cis') return 'masculine';
  if (symbol === 'nonbinary' || symbol === 'intersex_nonbinary') return 'nonbinary';
  if (symbol === 'agender' || symbol === 'intersex_agender') return 'agender';
  if (symbol === 'intersex_feminine') return 'feminine';
  if (symbol === 'intersex_masculine') return 'masculine';
  if (symbol === 'female_trans') return 'feminine';
  if (symbol === 'male_trans') return 'masculine';
  return person.gender === 'male' ? 'masculine' : 'feminine';
};

const PersonNode = ({
  person,
  isSelected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onHoverChange,
  functionalIndicatorDefinitions,
}: PersonNodeProps) => {
  const genderSymbol = deriveGenderSymbol(person);
  const birthSex = deriveBirthSex(person, genderSymbol);
  const genderIdentity = deriveGenderIdentity(person, genderSymbol);
  const isMale = birthSex === 'male';
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
    const cisColor = '#e7b676';
    const transColor = '#9fdce6';
    const isCis =
      (birthSex === 'female' && genderIdentity === 'feminine') ||
      (birthSex === 'male' && genderIdentity === 'masculine');
    const fillColor = isCis ? cisColor : transColor;
    const hybridStroke = strokeColor;
    const renderShape = (kind: 'circle' | 'square' | 'triangle-up' | 'triangle-down' | 'star') => {
      if (kind === 'circle') {
        return <Circle radius={shapeSize / 2} fill={fillColor} stroke={hybridStroke} strokeWidth={strokeWidth} />;
      }
      if (kind === 'square') {
        return (
          <Rect
            width={shapeSize}
            height={shapeSize}
            offsetX={shapeSize / 2}
            offsetY={shapeSize / 2}
            fill={fillColor}
            stroke={hybridStroke}
            strokeWidth={strokeWidth}
          />
        );
      }
      if (kind === 'star') {
        return (
          <Star
            x={0}
            y={0}
            numPoints={5}
            innerRadius={shapeSize * 0.19}
            outerRadius={shapeSize * 0.5}
            fill={fillColor}
            stroke={hybridStroke}
            strokeWidth={strokeWidth}
          />
        );
      }
      if (kind === 'triangle-down') {
        return (
          <Line
            points={[
              0,
              shapeSize * 0.5,
              -shapeSize * 0.45,
              -shapeSize * 0.45,
              shapeSize * 0.45,
              -shapeSize * 0.45,
            ]}
            closed
            fill={fillColor}
            stroke={hybridStroke}
            strokeWidth={strokeWidth}
          />
        );
      }
      return (
        <Line
          points={[
            0,
            -shapeSize * 0.5,
            -shapeSize * 0.45,
            shapeSize * 0.45,
            shapeSize * 0.45,
            shapeSize * 0.45,
          ]}
          closed
          fill={fillColor}
          stroke={hybridStroke}
          strokeWidth={strokeWidth}
        />
      );
    };
    const birthShape: 'circle' | 'square' | 'triangle-up' =
      birthSex === 'female' ? 'circle' : birthSex === 'male' ? 'square' : 'triangle-up';
    const identityShape: 'circle' | 'square' | 'triangle-down' | 'star' =
      genderIdentity === 'feminine'
        ? 'circle'
        : genderIdentity === 'masculine'
        ? 'square'
        : genderIdentity === 'nonbinary'
        ? 'triangle-down'
        : 'star';

    if (isCis) {
      return renderShape(birthShape);
    }

    return (
      <>
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.rect(-shapeSize / 2, -shapeSize / 2, shapeSize / 2, shapeSize);
            ctx.closePath();
          }}
        >
          {renderShape(birthShape)}
        </Group>
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.rect(0, -shapeSize / 2, shapeSize / 2, shapeSize);
            ctx.closePath();
          }}
        >
          {renderShape(identityShape)}
        </Group>
      </>
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

  const renderDeathOverlay = () => {
    if (!person.deathDate) return null;
    if (lifeStatus === 'miscarriage' || lifeStatus === 'stillbirth') return null;
    // Keep the X fully inside each shape. Circles need inset endpoints.
    const half = shapeSize / 2;
    const inset = isMale ? 0 : Math.max(1, shapeSize * 0.06);
    const extent = Math.max(0, half - inset);
    return (
      <>
        <Line
          points={[-extent, -extent, extent, extent]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          listening={false}
        />
        <Line
          points={[-extent, extent, extent, -extent]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          listening={false}
        />
      </>
    );
  };

  const parseDate = (iso?: string) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const ageLabel = useMemo(() => {
    const birth = parseDate(person.birthDate);
    if (!birth) return null;
    const end = parseDate(person.deathDate) ?? new Date();
    let age = end.getFullYear() - birth.getFullYear();
    const monthDiff = end.getMonth() - birth.getMonth();
    const dayDiff = end.getDate() - birth.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }
    if (age < 0) return null;
    return `Age ${age}`;
  }, [person.birthDate, person.deathDate]);

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
      onMouseEnter={() => onHoverChange(person.id)}
      onMouseLeave={() => onHoverChange(null)}
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
      {renderDeathOverlay()}
      <Text
        text={displayName}
        {...nameProps}
        listening={false}
      />
        {ageLabel && (
          <Text
            text={ageLabel}
            x={-shapeSize / 2}
            y={shapeSize / 2 + 6}
            width={shapeSize}
            align="center"
            fontSize={12}
            listening={false}
          />
        )}
        {person.deathDate && (
          <Text
            text={`d. ${person.deathDate}`}
            x={-shapeSize / 2}
            y={shapeSize / 2 + 20}
            width={shapeSize}
            align="center"
            fontSize={12}
            listening={false}
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
