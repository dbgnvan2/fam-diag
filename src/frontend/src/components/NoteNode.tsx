import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

interface NoteNodeProps {
  x: number;
  y: number;
  title: string;
  text: string;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
}

const NoteNode = ({ x, y, title, text, onDragEnd }: NoteNodeProps) => {
  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragEnd={onDragEnd}
    >
      <Rect
        width={150}
        height={100}
        fill="white"
        stroke="black"
        strokeWidth={1}
        cornerRadius={5}
      />
      <Text
        text={title}
        x={5}
        y={5}
        fontSize={14}
        fontStyle="bold"
        width={140}
        wrap="char"
      />
      <Text
        text={text}
        x={5}
        y={25}
        fontSize={12}
        width={140}
        wrap="char"
      />
    </Group>
  );
};

export default NoteNode;
