import { Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useMemo } from 'react';

interface NoteNodeProps {
  x: number;
  y: number;
  title: string;
  text: string;
  anchorX?: number;
  anchorY?: number;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
}

const NoteNode = ({ x, y, title, text, anchorX, anchorY, onDragEnd }: NoteNodeProps) => {
  const titleFontSize = 14;
  const textFontSize = 12;
  const lineHeight = 1.2;
  const padding = 5;
  const gap = 5;
  const maxCharsPerLine = 40;

  const { boxWidth, boxHeight, textY, contentWidth, wrappedTitle, wrappedText } = useMemo(() => {
    const measure = (value: string, fontSize: number, fontStyle?: string) => {
      if (typeof document === 'undefined') {
        return 0;
      }
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return 0;
      const style = fontStyle ? `${fontStyle} ` : '';
      context.font = `${style}${fontSize}px Arial`;
      return context.measureText(value).width;
    };

    const wrapByChars = (value: string, maxChars: number) => {
      const lines = value.split('\n');
      const wrapped: string[] = [];
      for (const line of lines) {
        if (line.length === 0) {
          wrapped.push('');
          continue;
        }
        for (let i = 0; i < line.length; i += maxChars) {
          wrapped.push(line.slice(i, i + maxChars));
        }
      }
      return wrapped.join('\n');
    };

    const wrappedTitle = wrapByChars(title, maxCharsPerLine);
    const wrappedText = wrapByChars(text, maxCharsPerLine);

    const titleLines = wrappedTitle.split('\n');
    const textLines = wrappedText.split('\n');

    const titleLineWidths = titleLines.map((line) => measure(line, titleFontSize, 'bold'));
    const textLineWidths = textLines.map((line) => measure(line, textFontSize));
    const maxLineWidth = Math.max(0, ...titleLineWidths, ...textLineWidths);
    const contentWidth = Math.ceil(maxLineWidth);

    const titleHeight = Math.ceil(titleLines.length * titleFontSize * lineHeight);
    const textHeight = Math.ceil(textLines.length * textFontSize * lineHeight);
    const boxWidth = contentWidth + padding * 2;
    const boxHeight = padding + titleHeight + gap + textHeight + padding;
    const textY = padding + titleHeight + gap;

    return { boxWidth, boxHeight, textY, contentWidth, wrappedTitle, wrappedText };
  }, [title, text]);

  const centerX = boxWidth / 2;
  const centerY = boxHeight / 2;
  const shouldDrawAnchor = typeof anchorX === 'number' && typeof anchorY === 'number';

  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragEnd={onDragEnd}
    >
      {shouldDrawAnchor && (
        <Line
          points={[anchorX! - x, anchorY! - y, centerX, centerY]}
          stroke="#999999"
          strokeWidth={1}
          dash={[4, 4]}
          listening={false}
        />
      )}
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill="white"
        stroke="black"
        strokeWidth={1}
        cornerRadius={5}
      />
      <Text
        text={wrappedTitle}
        x={padding}
        y={padding}
        fontSize={titleFontSize}
        fontStyle="bold"
        width={contentWidth}
        wrap="char"
      />
      <Text
        text={wrappedText}
        x={padding}
        y={textY}
        fontSize={textFontSize}
        width={contentWidth}
        wrap="char"
      />
    </Group>
  );
};

export default NoteNode;
