import { Group, Line } from 'react-konva';
import type { EmotionalLine, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

const getDashStyle = (lineStyle: EmotionalLine['lineStyle']) => {
    switch (lineStyle) {
        case 'low':
            return [2, 5];
        case 'medium':
            return [8, 4];
        case 'high':
            return [8, 4];
        case 'dotted':
            return [2, 5];
        case 'dashed':
            return [10, 5];
        case 'long-dash':
            return [20, 5];
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
}

const EmotionalLineNode = ({ emotionalLine, person1, person2, isSelected, onSelect, onContextMenu }: EmotionalLineNodeProps) => {
    const { lineStyle, lineEnding } = emotionalLine;

    const p1_x_center = person1.x;
    const p1_y_center = person1.y;
    const p2_x_center = person2.x;
    const p2_y_center = person2.y;

    const points = [p1_x_center, p1_y_center, p2_x_center, p2_y_center];
    
    const radius = 30 * 1.05;
    const angle = Math.atan2(p2_y_center - p1_y_center, p2_x_center - p1_x_center);

    const p1_edge_x = p1_x_center + radius * Math.cos(angle);
    const p1_edge_y = p1_y_center + radius * Math.sin(angle);
    const p2_edge_x = p2_x_center - radius * Math.cos(angle);
    const p2_edge_y = p2_y_center - radius * Math.sin(angle);

    const linePoints = lineEnding === 'none' ? points : [p1_edge_x, p1_edge_y, p2_edge_x, p2_edge_y];

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
    const fusionDash = lineStyle === 'low' || lineStyle === 'medium' || lineStyle === 'high'
        ? getDashStyle(lineStyle)
        : undefined;
    const strokeWidth = (lineStyle === 'high' || lineStyle === 'long-dash')
        ? baseStrokeWidth + 1
        : baseStrokeWidth;

    const lineProps = {
        stroke: isSelected ? 'blue' : baseColor,
        strokeWidth,
        onClick: handleSelect,
        onTap: handleSelect,
        onContextMenu: handleContextMenu,
    };

    const renderLines = () => {
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

        if (lineStyle === 'low' || lineStyle === 'medium' || lineStyle === 'high') {
            return <Line points={linePoints} {...lineProps} dash={fusionDash} />;
        } else if (lineStyle === 'dotted' || lineStyle === 'dashed' || lineStyle === 'long-dash') {
            const dash = getDashStyle(lineStyle);
            return <Line points={linePoints} {...lineProps} dash={dash} />;
        } else if (lineStyle === 'solid-saw-tooth' || lineStyle === 'dotted-saw-tooth' || lineStyle === 'double-saw-tooth') {
            const amplitude = 10;
            const sawtoothPoints = getSawtoothPoints(p1_x_center, p1_y_center, p2_x_center, p2_y_center, amplitude);
            const dash = lineStyle === 'dotted-saw-tooth' ? [2, 5] : undefined;
            
            if (lineStyle === 'double-saw-tooth') {
                const lineOffset = 5;
                const angle = Math.atan2(p2_y_center - p1_y_center, p2_x_center - p1_x_center);
                const dx = Math.sin(angle) * lineOffset;
                const dy = -Math.cos(angle) * lineOffset;
                const amplitude = 10;
                const points1 = getSawtoothPoints(p1_x_center + dx, p1_y_center + dy, p2_x_center + dx, p2_y_center + dy, amplitude);
                const points2 = getSawtoothPoints(p1_x_center - dx, p1_y_center - dy, p2_x_center - dx, p2_y_center - dy, amplitude);

                return (
                    <>
                        <Line points={points1} {...lineProps} />
                        <Line points={points2} {...lineProps} />
                    </>
                )
            }
            return <Line points={sawtoothPoints} {...lineProps} dash={dash} />;
        }


        return <Line points={linePoints} {...lineProps} />;
    };

    const renderEndings = () => {
        if (lineEnding === 'none') return null;

        let p1 = [p1_edge_x, p1_edge_y];
        let p2 = [p2_edge_x, p2_edge_y];

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

    return (
        <Group>
            {renderLines()}
            {renderEndings()}
        </Group>
    );
};

export default EmotionalLineNode;
