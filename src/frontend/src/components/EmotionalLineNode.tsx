import { Group, Line, Text } from 'react-konva';
import type { EmotionalLine, Person } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

const getDashStyle = (lineStyle: EmotionalLine['lineStyle']) => {
    switch (lineStyle) {
        case 'dotted':
            return [2, 5];
        case 'dashed':
            return [10, 5];
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
    const { lineStyle, lineEnding, relationshipType } = emotionalLine;

    const p1_x_center = person1.x;
    const p1_y_center = person1.y;
    const p2_x_center = person2.x;
    const p2_y_center = person2.y;

    const points = [p1_x_center, p1_y_center, p2_x_center, p2_y_center];
    
    const radius = 30;
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

    const lineProps = {
        stroke: isSelected ? 'blue' : 'black',
        strokeWidth: isSelected ? 5 : 3,
        onClick: handleSelect,
        onTap: handleSelect,
        onContextMenu: handleContextMenu,
    };

    const renderLines = () => {
        if (relationshipType === 'cutoff') {
            const midX = (p1_x_center + p2_x_center) / 2;
            const midY = (p1_y_center + p2_y_center) / 2;

            return (
                <Group>
                    <Line points={linePoints} {...lineProps} />
                    <Line points={[midX - 2, midY - 10, midX - 2, midY + 10]} {...lineProps} />
                    <Line points={[midX + 2, midY - 10, midX + 2, midY + 10]} {...lineProps} />
                </Group>
            )
        }

        if (lineStyle === 'double' || lineStyle === 'triple') {
            const numLines = lineStyle === 'double' ? 2 : 3;
            const lineOffset = 5; // offset between parallel lines
            const angle = Math.atan2(p2_y_center - p1_y_center, p2_x_center - p1_x_center);
            const dx = Math.sin(angle) * lineOffset;
            const dy = -Math.cos(angle) * lineOffset;

            const lines = [];
            for (let i = 0; i < numLines; i++) {
                lines.push(
                    <Line
                        key={i}
                        points={[p1_x_center + dx * i, p1_y_center + dy * i, p2_x_center + dx * i, p2_y_center + dy * i]}
                        {...lineProps}
                    />
                );
            }
            return lines;
                } else if (lineStyle === 'dotted' || lineStyle === 'dashed') {
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

        const p1 = [p1_edge_x, p1_edge_y];
        const p2 = [p2_edge_x, p2_edge_y];

        const arrowLength = 15;
        const lineLength = 10;
        
        const endings = [];

        // Arrows
        if (lineEnding === 'arrow-p1-to-p2' || lineEnding === 'arrow-bidirectional') {
            const x1 = p2[0] - arrowLength * Math.cos(angle - Math.PI / 6);
            const y1 = p2[1] - arrowLength * Math.sin(angle - Math.PI / 6);
            const x2 = p2[0] - arrowLength * Math.cos(angle + Math.PI / 6);
            const y2 = p2[1] - arrowLength * Math.sin(angle + Math.PI / 6);
            endings.push(<Line key="arrow-p2" points={[x1, y1, p2[0], p2[1], x2, y2]} closed fill={lineProps.stroke} {...lineProps} />);
        }
        if (lineEnding === 'arrow-p2-to-p1' || lineEnding === 'arrow-bidirectional') {
            const x1 = p1[0] + arrowLength * Math.cos(angle - Math.PI / 6);
            const y1 = p1[1] + arrowLength * Math.sin(angle - Math.PI / 6);
            const x2 = p1[0] + arrowLength * Math.cos(angle + Math.PI / 6);
            const y2 = p1[1] + arrowLength * Math.sin(angle + Math.PI / 6);
            endings.push(<Line key="arrow-p1" points={[x1, y1, p1[0], p1[1], x2, y2]} closed fill={lineProps.stroke} {...lineProps} />);
        }

        // Perpendicular
        const perpAngle = angle + Math.PI / 2;
        const offset = 10;
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
            {emotionalLine.notes && (
                <Text
                    text={emotionalLine.notes}
                    x={(p1_x_center + p2_x_center) / 2}
                    y={(p1_y_center + p2_y_center) / 2}
                    fontSize={12}
                    align="center"
                />
            )}
        </Group>
    );
};

export default EmotionalLineNode;
