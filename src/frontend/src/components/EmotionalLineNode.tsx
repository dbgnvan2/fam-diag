import { Group, Line, Rect, Text } from 'react-konva';
import type { EmotionalLine, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

const getDashStyle = (lineStyle: EmotionalLine['lineStyle']) => {
    switch (lineStyle) {
        case 'fusion-dotted-wide':
        case 'fusion-dotted-tight':
        case 'low':
            return [2, 5];
        case 'fusion-solid-wide':
        case 'fusion-solid-tight':
        case 'medium':
        case 'high':
            return [8, 4];
        case 'dotted':
        case 'distance-dotted-wide':
            return [2, 5];
        case 'distance-dotted-tight':
            return [5, 5];
        case 'dashed':
        case 'distance-dashed-wide':
            return [14, 4];
        case 'distance-dashed-tight':
            return [10, 2];
        case 'long-dash':
        case 'distance-long':
            return [14, 8];
        default:
            return undefined;
    }
}

const getSawtoothPoints = (x1: number, y1: number, x2: number, y2: number, amplitude: number) => {
    const points = [];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const numSegments = 20; // for example
    const segmentLength = distance / numSegments;

    points.push(x1, y1);
    for (let i = 1; i < numSegments; i++) {
        const currentX = x1 + Math.cos(angle) * i * segmentLength;
        const currentY = y1 + Math.sin(angle) * i * segmentLength;
        const perpendicularAngle = angle + Math.PI / 2;
        const offsetX = Math.cos(perpendicularAngle) * amplitude * (i % 2 === 0 ? 1 : -1);
        const offsetY = Math.sin(perpendicularAngle) * amplitude * (i % 2 === 0 ? 1 : -1);
        points.push(currentX + offsetX, currentY + offsetY);
    }
    points.push(x2, y2);
    return points;
}

interface EmotionalLineNodeProps {
    emotionalLine: EmotionalLine;
    person1: Person;
    person2: Person;
    isSelected: boolean;
    onSelect: (emotionalLineId: string) => void;
    onContextMenu: (e: KonvaEventObject<PointerEvent>, emotionalLineId: string) => void;
    siblingIndex?: number;
    siblingCount?: number;
}

const EmotionalLineNode = ({
    emotionalLine,
    person1,
    person2,
    isSelected,
    onSelect,
    onContextMenu,
    siblingIndex = 0,
    siblingCount = 1,
}: EmotionalLineNodeProps) => {
    const { relationshipType, lineStyle, lineEnding } = emotionalLine;

    const baseP1X = person1.x;
    const baseP1Y = person1.y;
    const baseP2X = person2.x;
    const baseP2Y = person2.y;
    const baseAngle = Math.atan2(baseP2Y - baseP1Y, baseP2X - baseP1X);
    const basePerpendicularAngle = baseAngle + Math.PI / 2;
    // Scale offset so visual separation stays constant at any angle.
    // For steep (near-vertical) lines the perpendicular is nearly horizontal,
    // so we boost the offset to keep the gap readable.
    const absSin = Math.abs(Math.sin(baseAngle));
    const angleScale = 1 + absSin * 0.5;            // up to 1.5× boost for vertical lines
    const baseLaneOffset =
        siblingCount === 1
            ? 0
            : siblingCount === 2
                ? (siblingIndex === 0 ? -8 : 8)
                : siblingCount === 3
                    ? (siblingIndex === 0 ? -12 : siblingIndex === 1 ? 0 : 12)
                    : (siblingIndex - (siblingCount - 1) / 2) * 12;
    const laneOffset = baseLaneOffset * angleScale;
    const canonicalPair = [person1.id, person2.id].sort();
    const followsCanonicalDirection = person1.id === canonicalPair[0] && person2.id === canonicalPair[1];
    const normalizedLaneOffset = followsCanonicalDirection ? laneOffset : -laneOffset;
    const laneDx = Math.cos(basePerpendicularAngle) * normalizedLaneOffset;
    const laneDy = Math.sin(basePerpendicularAngle) * normalizedLaneOffset;

    const p1_x_center = baseP1X + laneDx;
    const p1_y_center = baseP1Y + laneDy;
    const p2_x_center = baseP2X + laneDx;
    const p2_y_center = baseP2Y + laneDy;

    const points = [p1_x_center, p1_y_center, p2_x_center, p2_y_center];
    
    const radius = 30 * 1.05;
    const angle = Math.atan2(p2_y_center - p1_y_center, p2_x_center - p1_x_center);

    const p1_edge_x = p1_x_center + radius * Math.cos(angle);
    const p1_edge_y = p1_y_center + radius * Math.sin(angle);
    const p2_edge_x = p2_x_center - radius * Math.cos(angle);
    const p2_edge_y = p2_y_center - radius * Math.sin(angle);

    const linePoints = lineEnding === 'none' ? points : [p1_edge_x, p1_edge_y, p2_edge_x, p2_edge_y];
    const perpendicularAngle = angle + Math.PI / 2;

    const handleSelect = (e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onSelect(emotionalLine.id);
    }

    const handleContextMenu = (e: KonvaEventObject<PointerEvent>) => {
        e.cancelBubble = true;
        onContextMenu(e, emotionalLine.id);
    }

    const baseColor = emotionalLine.color || '#444444';
    const baseStrokeWidth = isSelected ? 3 : 2;
    const strokeWidth = (
        lineStyle === 'fusion-triple' ||
        lineStyle === 'high' ||
        lineStyle === 'long-dash' ||
        lineStyle === 'conflict-double' ||
        lineStyle === 'projection-5' ||
        lineStyle === 'open-connection-4' ||
        lineStyle === 'open-connection-5'
    )
        ? baseStrokeWidth + 1
        : baseStrokeWidth;

    const lineProps = {
        stroke: isSelected ? 'blue' : baseColor,
        strokeWidth,
        hitStrokeWidth: 24,
        onClick: handleSelect,
        onTap: handleSelect,
        onContextMenu: handleContextMenu,
    };

    const shiftLinePoints = (pts: number[], deltaX: number, deltaY: number) => {
        const shifted = [...pts];
        shifted[0] += deltaX;
        shifted[1] += deltaY;
        shifted[2] += deltaX;
        shifted[3] += deltaY;
        return shifted;
    };

    const renderLines = () => {
        if (relationshipType === 'open-connection') {
            const markerMapFwd: Record<string, string> = {
                'open-connection-1': '+>',
                'open-connection-2': '++>',
                'open-connection-3': '+++>',
                'open-connection-4': '++++>',
                'open-connection-5': '+++++>',
            };
            const markerMapRev: Record<string, string> = {
                'open-connection-1': '<+',
                'open-connection-2': '<++',
                'open-connection-3': '<+++',
                'open-connection-4': '<++++',
                'open-connection-5': '<+++++',
            };
            const angleDeg = (angle * 180) / Math.PI;
            const flipped = angleDeg > 90 || angleDeg < -90;
            const markerText = flipped
                ? (markerMapRev[lineStyle] || '<+')
                : (markerMapFwd[lineStyle] || '+>');
            const markerAngle = flipped ? angleDeg + 180 : angleDeg;
            const isHeavy = lineStyle === 'open-connection-4' || lineStyle === 'open-connection-5';
            const markerCount = 4;
            // Use the same coordinates as the visible line (linePoints)
            const ocx1 = linePoints[0], ocy1 = linePoints[1];
            const ocx2 = linePoints[2], ocy2 = linePoints[3];
            const markers = Array.from({ length: markerCount }, (_, idx) => {
                const fraction = (idx + 1) / (markerCount + 1);
                const x = ocx1 + (ocx2 - ocx1) * fraction;
                const y = ocy1 + (ocy2 - ocy1) * fraction;
                const mFontSize = isHeavy ? 15 : 13;
                return (
                    <Text
                        key={`open-conn-marker-${idx}`}
                        text={markerText}
                        x={x}
                        y={y}
                        offsetX={6}
                        offsetY={mFontSize / 2}
                        fontSize={mFontSize}
                        fontStyle="bold"
                        fill={lineProps.stroke}
                        rotation={markerAngle}
                        listening={false}
                    />
                );
            });
            return (
                <Group>
                    <Line
                        points={linePoints}
                        stroke="transparent"
                        strokeWidth={28}
                        onClick={handleSelect}
                        onTap={handleSelect}
                        onContextMenu={handleContextMenu}
                    />
                    {markers}
                </Group>
            );
        }

        if (relationshipType === 'projection') {
            const markerCount = 4;
            const markerMapFwd: Record<string, string> = {
                'projection-1': '>··>',
                'projection-2': '>·>',
                'projection-3': '>>',
                'projection-4': '>>>',
                'projection-5': '>>>>',
                low: '>··>',
                medium: '>>',
                high: '>>>>',
            };
            const markerMapRev: Record<string, string> = {
                'projection-1': '<··<',
                'projection-2': '<·<',
                'projection-3': '<<',
                'projection-4': '<<<',
                'projection-5': '<<<<',
                low: '<··<',
                medium: '<<',
                high: '<<<<',
            };
            const angleDeg = (angle * 180) / Math.PI;
            const flipped = angleDeg > 90 || angleDeg < -90;
            const markerText = flipped
                ? (markerMapRev[lineStyle] || '<··<')
                : (markerMapFwd[lineStyle] || '>··>');
            const markerAngle = flipped ? angleDeg + 180 : angleDeg;
            const isHeavy = lineStyle === 'projection-4' || lineStyle === 'projection-5' || lineStyle === 'high';
            // Use the same coordinates as the visible line (linePoints)
            const lx1 = linePoints[0], ly1 = linePoints[1];
            const lx2 = linePoints[2], ly2 = linePoints[3];
            const markers = Array.from({ length: markerCount }, (_, idx) => {
                const fraction = (idx + 1) / (markerCount + 1);
                const x = lx1 + (lx2 - lx1) * fraction;
                const y = ly1 + (ly2 - ly1) * fraction;
                const mFontSize = isHeavy ? 15 : 13;
                return (
                    <Text
                        key={`projection-marker-${idx}`}
                        text={markerText}
                        x={x}
                        y={y}
                        offsetX={6}
                        offsetY={mFontSize / 2}
                        fontSize={mFontSize}
                        fontStyle="bold"
                        fill={lineProps.stroke}
                        rotation={markerAngle}
                        listening={false}
                    />
                );
            });
            return (
                <Group>
                    <Line
                        points={linePoints}
                        stroke="transparent"
                        strokeWidth={28}
                        onClick={handleSelect}
                        onTap={handleSelect}
                        onContextMenu={handleContextMenu}
                    />
                    {markers}
                </Group>
            );
        }

        if (lineStyle === 'cutoff') {
            const midX = (p1_x_center + p2_x_center) / 2;
            const midY = (p1_y_center + p2_y_center) / 2;

            return (
                <Group>
                    <Line points={linePoints} {...lineProps} />
                    <Line points={[midX - 2, midY - 20, midX - 2, midY + 20]} {...lineProps} />
                    <Line points={[midX + 2, midY - 20, midX + 2, midY + 20]} {...lineProps} />
                </Group>
            )
        }

        if (
            lineStyle === 'fusion-dotted-wide' ||
            lineStyle === 'fusion-dotted-tight' ||
            lineStyle === 'fusion-solid-wide' ||
            lineStyle === 'fusion-solid-tight' ||
            lineStyle === 'fusion-triple'
        ) {
            const offsetStep =
                lineStyle === 'fusion-dotted-wide' || lineStyle === 'fusion-solid-wide' ? 6 : 3;
            const count = lineStyle === 'fusion-triple' ? 3 : 2;
            const offsets = count === 3 ? [-1, 0, 1] : [-1, 1];
            const dash =
                lineStyle === 'fusion-dotted-wide' || lineStyle === 'fusion-dotted-tight'
                    ? [2, 6]
                    : undefined;
            return (
                <>
                    {offsets.map((multiplier, idx) => {
                        const deltaX = Math.cos(perpendicularAngle) * offsetStep * multiplier;
                        const deltaY = Math.sin(perpendicularAngle) * offsetStep * multiplier;
                        const shiftedPoints = shiftLinePoints(linePoints, deltaX, deltaY);
                        return <Line key={`fusion-${lineStyle}-${idx}`} points={shiftedPoints} {...lineProps} dash={dash} />;
                    })}
                </>
            );
        } else if (
            lineStyle === 'dotted' ||
            lineStyle === 'dashed' ||
            lineStyle === 'long-dash' ||
            lineStyle === 'distance-dotted-wide' ||
            lineStyle === 'distance-dotted-tight' ||
            lineStyle === 'distance-dashed-wide' ||
            lineStyle === 'distance-dashed-tight' ||
            lineStyle === 'distance-long'
        ) {
            const dash = getDashStyle(lineStyle);
            return <Line points={linePoints} {...lineProps} dash={dash} />;
        } else if (
            lineStyle === 'solid-saw-tooth' ||
            lineStyle === 'dotted-saw-tooth' ||
            lineStyle === 'double-saw-tooth' ||
            lineStyle === 'conflict-dotted-wide' ||
            lineStyle === 'conflict-dotted-tight' ||
            lineStyle === 'conflict-solid-wide' ||
            lineStyle === 'conflict-solid-tight' ||
            lineStyle === 'conflict-double'
        ) {
            const renderSawtoothBand = (
                key: string,
                offset: number,
                amplitude: number,
                dash?: number[]
            ) => {
                const dx = Math.sin(angle) * offset;
                const dy = -Math.cos(angle) * offset;
                const points = getSawtoothPoints(
                    p1_x_center + dx,
                    p1_y_center + dy,
                    p2_x_center + dx,
                    p2_y_center + dy,
                    amplitude
                );
                return <Line key={key} points={points} {...lineProps} dash={dash} />;
            };

            if (lineStyle === 'dotted-saw-tooth' || lineStyle === 'conflict-dotted-wide') {
                return renderSawtoothBand(`conflict-${lineStyle}`, 0, 5, [2, 5]);
            }

            if (lineStyle === 'conflict-dotted-tight') {
                return (
                    <>
                        {renderSawtoothBand('conflict-dotted-tight-1', -3, 5, [2, 5])}
                        {renderSawtoothBand('conflict-dotted-tight-2', 3, 5, [2, 5])}
                    </>
                );
            }

            if (lineStyle === 'solid-saw-tooth' || lineStyle === 'conflict-solid-wide') {
                return renderSawtoothBand(`conflict-${lineStyle}`, 0, 5, [6, 4]);
            }

            if (lineStyle === 'conflict-solid-tight' || lineStyle === 'double-saw-tooth') {
                return (
                    <>
                        {renderSawtoothBand(`conflict-${lineStyle}-1`, -3, 5)}
                        {renderSawtoothBand(`conflict-${lineStyle}-2`, 3, 5)}
                    </>
                );
            }

            return (
                <>
                    {renderSawtoothBand('conflict-double-1', -4, 5)}
                    {renderSawtoothBand('conflict-double-2', 0, 5)}
                    {renderSawtoothBand('conflict-double-3', 4, 5)}
                </>
            );
        }


        return <Line points={linePoints} {...lineProps} />;
    };

    const renderEndings = () => {
        if (relationshipType === 'projection' || relationshipType === 'open-connection') return null;
        if (lineEnding === 'none') return null;

        const p1 = [p1_edge_x, p1_edge_y];
        const p2 = [p2_edge_x, p2_edge_y];

        const arrowLength = 15;
        const lineLength = 10;

        const bandWidth = lineProps.strokeWidth;
        const arrowWidth = Math.max(11, bandWidth * 1.2);
        
        const endings = [];

        const makeArrow = (key: string, tip: number[], directionAngle: number) => {
            const baseCenter = [
                tip[0] - arrowLength * Math.cos(directionAngle),
                tip[1] - arrowLength * Math.sin(directionAngle),
            ];
            const perpAngle = directionAngle + Math.PI / 2;
            const left = [
                baseCenter[0] + (arrowWidth / 2) * Math.cos(perpAngle),
                baseCenter[1] + (arrowWidth / 2) * Math.sin(perpAngle),
            ];
            const right = [
                baseCenter[0] - (arrowWidth / 2) * Math.cos(perpAngle),
                baseCenter[1] - (arrowWidth / 2) * Math.sin(perpAngle),
            ];
            return (
                <Line
                    key={key}
                    points={[left[0], left[1], tip[0], tip[1], right[0], right[1]]}
                    closed
                    fill={lineProps.stroke}
                    stroke={lineProps.stroke}
                    strokeWidth={lineProps.strokeWidth}
                    listening={false}
                />
            );
        };

        // Arrows
        if (lineEnding === 'arrow-p1-to-p2' || lineEnding === 'arrow-bidirectional') {
            endings.push(makeArrow('arrow-p2', p2, angle));
        }
        if (lineEnding === 'arrow-p2-to-p1' || lineEnding === 'arrow-bidirectional') {
            endings.push(makeArrow('arrow-p1', p1, angle + Math.PI));
        }

        // Perpendicular
        const perpAngle = angle + Math.PI / 2;
        const offset = 20;
        if (lineEnding === 'perpendicular-p1' || lineEnding === 'double-perpendicular-p1') {
            const p1_offset = [p1[0] + Math.cos(angle) * offset, p1[1] + Math.sin(angle) * offset];
            const p1_1 = [p1_offset[0] + Math.cos(perpAngle) * lineLength, p1_offset[1] + Math.sin(perpAngle) * lineLength];
            const p1_2 = [p1_offset[0] - Math.cos(perpAngle) * lineLength, p1_offset[1] - Math.sin(perpAngle) * lineLength];
            endings.push(<Line key="perp-p1" points={[p1_1[0], p1_1[1], p1_2[0], p1_2[1]]} {...lineProps} />);
            if (lineEnding === 'double-perpendicular-p1') {
                const p1_3 = [p1_offset[0] + Math.cos(angle) * 5 + Math.cos(perpAngle) * lineLength, p1_offset[1] + Math.sin(angle) * 5 + Math.sin(perpAngle) * lineLength];
                const p1_4 = [p1_offset[0] + Math.cos(angle) * 5 - Math.cos(perpAngle) * lineLength, p1_offset[1] + Math.sin(angle) * 5 - Math.sin(perpAngle) * lineLength];
                endings.push(<Line key="perp-p1-2" points={[p1_3[0], p1_3[1], p1_4[0], p1_4[1]]} {...lineProps} />);
            }
        }
        if (lineEnding === 'perpendicular-p2' || lineEnding === 'double-perpendicular-p2') {
            const p2_offset = [p2[0] - Math.cos(angle) * offset, p2[1] - Math.sin(angle) * offset];
            const p2_1 = [p2_offset[0] + Math.cos(perpAngle) * lineLength, p2_offset[1] + Math.sin(perpAngle) * lineLength];
            const p2_2 = [p2_offset[0] - Math.cos(perpAngle) * lineLength, p2_offset[1] - Math.sin(perpAngle) * lineLength];
            endings.push(<Line key="perp-p2" points={[p2_1[0], p2_1[1], p2_2[0], p2_2[1]]} {...lineProps} />);
            if (lineEnding === 'double-perpendicular-p2') {
                const p2_3 = [p2_offset[0] - Math.cos(angle) * 5 + Math.cos(perpAngle) * lineLength, p2_offset[1] - Math.sin(angle) * 5 + Math.sin(perpAngle) * lineLength];
                const p2_4 = [p2_offset[0] - Math.cos(angle) * 5 - Math.cos(perpAngle) * lineLength, p2_offset[1] - Math.sin(angle) * 5 - Math.sin(perpAngle) * lineLength];
                endings.push(<Line key="perp-p2-2" points={[p2_3[0], p2_3[1], p2_4[0], p2_4[1]]} {...lineProps} />);
            }
        }

        return endings;
    }

    const formatShortDate = (iso?: string | null) => {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
        const [, year, month] = iso.match(/^(\d{4})-(\d{2})/) || [];
        if (!year || !month) return null;
        return `${year.slice(2)}/${month}`;
    };

    const renderDateLabels = () => {
        const labels: JSX.Element[] = [];
        // Place dates exactly on the line with a white background pill.
        const fontSize = 9;
        const padX = 2;
        const padY = 2;

        // Determine text rotation so it reads left-to-right
        const angleDeg = (angle * 180) / Math.PI;
        const textFlipped = angleDeg > 90 || angleDeg < -90;
        const textRotation = textFlipped ? angleDeg + 180 : angleDeg;

        const addLabel = (text: string, fraction: number, key: string) => {
            // Point on the line at the given fraction
            const x = p1_x_center + (p2_x_center - p1_x_center) * fraction;
            const y = p1_y_center + (p2_y_center - p1_y_center) * fraction;
            // Approximate text width: ~5.4px per char at fontSize 9
            const textWidth = text.length * 5.4;
            const bgWidth = textWidth + padX * 2;
            const bgHeight = fontSize + padY * 2;
            // Use a Group at the line point for reliable rotation + centering
            labels.push(
                <Group key={key} x={x} y={y} rotation={textRotation} listening={false}>
                    <Rect
                        x={-bgWidth / 2}
                        y={-bgHeight / 2}
                        width={bgWidth}
                        height={bgHeight}
                        fill="white"
                        cornerRadius={2}
                    />
                    <Text
                        x={-bgWidth / 2}
                        y={-bgHeight / 2 + padY}
                        width={bgWidth}
                        height={fontSize}
                        text={text}
                        fontSize={fontSize}
                        fill={baseColor}
                        align="center"
                    />
                </Group>
            );
        };

        const startLabel = formatShortDate(emotionalLine.startDate);
        const endLabel = formatShortDate(emotionalLine.endDate);
        if (startLabel && endLabel) {
            // Both dates: start near p1 end, end near p2 end
            const sFrac = textFlipped ? 0.75 : 0.25;
            const eFrac = textFlipped ? 0.25 : 0.75;
            addLabel(`S:${startLabel}`, sFrac, `${emotionalLine.id}-start`);
            addLabel(`E:${endLabel}`, eFrac, `${emotionalLine.id}-end`);
        } else if (startLabel) {
            addLabel(`S:${startLabel}`, 0.5, `${emotionalLine.id}-start`);
        } else if (endLabel) {
            addLabel(`E:${endLabel}`, 0.5, `${emotionalLine.id}-end`);
        }
        return labels;
    };

    const renderAdequateLabels = () => {
        if (relationshipType !== 'fusion' || !emotionalLine.adequatePersonId) return null;
        const fontSize = 16;
        const padX = 2;
        const padY = 1;
        const bgSize = fontSize + padX * 2;
        // Place labels centered on the EPL line, a full circle (2×radius) from each person center.
        // This avoids collision with the person shape and symptom indicator circles.
        const lineLen = Math.sqrt(
            (p2_x_center - p1_x_center) ** 2 + (p2_y_center - p1_y_center) ** 2
        );
        const circleAway = radius * 2;
        const p1Frac = lineLen > 0 ? circleAway / lineLen : 0.2;
        const p2Frac = lineLen > 0 ? 1 - circleAway / lineLen : 0.8;
        const isP1Adequate = emotionalLine.adequatePersonId === emotionalLine.person1_id;
        const p1Label = isP1Adequate ? '+' : '−';
        const p2Label = isP1Adequate ? '−' : '+';
        const makeLabel = (label: string, frac: number, key: string) => {
            const clampedFrac = Math.max(0.1, Math.min(0.9, frac));
            const x = p1_x_center + (p2_x_center - p1_x_center) * clampedFrac;
            const y = p1_y_center + (p2_y_center - p1_y_center) * clampedFrac;
            const isPlus = label === '+';
            return (
                <Group key={key} x={x} y={y} listening={false}>
                    <Rect
                        x={-bgSize / 2}
                        y={-bgSize / 2}
                        width={bgSize}
                        height={bgSize}
                        fill="white"
                        stroke={isPlus ? '#2e7d32' : '#c62828'}
                        strokeWidth={1}
                        cornerRadius={bgSize / 2}
                    />
                    <Text
                        x={-bgSize / 2}
                        y={-bgSize / 2 + padY}
                        width={bgSize}
                        height={bgSize}
                        text={label}
                        fontSize={fontSize}
                        fontStyle="bold"
                        fill={isPlus ? '#2e7d32' : '#c62828'}
                        align="center"
                        verticalAlign="middle"
                    />
                </Group>
            );
        };
        return (
            <>
                {makeLabel(p1Label, p1Frac, `${emotionalLine.id}-adequate-p1`)}
                {makeLabel(p2Label, p2Frac, `${emotionalLine.id}-adequate-p2`)}
            </>
        );
    };

    return (
        <Group>
            {renderLines()}
            {renderEndings()}
            {renderDateLabels()}
            {renderAdequateLabels()}
        </Group>
    );
};

export default EmotionalLineNode;
