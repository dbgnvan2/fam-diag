import { Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo, useState } from 'react';

interface NoteNodeProps {
  x: number;
  y: number;
  title: string;
  text: string;
  anchorX?: number;
  anchorY?: number;
  fillColor?: string;
  width?: number;
  height?: number;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onResizeEnd?: (width: number, height: number) => void;
}

const NoteNode = ({
  x,
  y,
  title,
  text,
  anchorX,
  anchorY,
  fillColor = 'white',
  width,
  height,
  onDragEnd,
  onResizeEnd,
}: NoteNodeProps) => {
  const titleFontSize = 14;
  const textFontSize = 12;
  const lineHeight = 1.2;
  const padding = 5;
  const gap = 5;
  const minWidth = 150;
  const minHeight = 70;
  const handleSize = 10;
  const [draftSize, setDraftSize] = useState<{ width?: number; height?: number }>({
    width,
    height,
  });

  useEffect(() => {
    setDraftSize({ width, height });
  }, [width, height]);

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

    const requestedWidth = draftSize.width && Number.isFinite(draftSize.width) ? draftSize.width : undefined;
    const derivedMaxChars = requestedWidth
      ? Math.max(18, Math.floor((requestedWidth - padding * 2) / 7))
      : 40;
    const wrappedText = wrapByChars(text, derivedMaxChars);
    const wrappedTitleByWidth = wrapByChars(title, Math.max(12, derivedMaxChars - 3));

    const titleLines = wrappedTitleByWidth.split('\n');
    const textLines = wrappedText.split('\n');

    const titleLineWidths = titleLines.map((line) => measure(line, titleFontSize, 'bold'));
    const textLineWidths = textLines.map((line) => measure(line, textFontSize));
    const maxLineWidth = Math.max(0, ...titleLineWidths, ...textLineWidths);
    const contentWidth = Math.ceil(maxLineWidth);

    const titleHeight = Math.ceil(titleLines.length * titleFontSize * lineHeight);
    const textHeight = Math.ceil(textLines.length * textFontSize * lineHeight);
    const intrinsicWidth = contentWidth + padding * 2;
    const boxWidth = Math.max(
      minWidth,
      requestedWidth ?? intrinsicWidth
    );
    const intrinsicHeight = padding + titleHeight + gap + textHeight + padding;
    const requestedHeight = draftSize.height && Number.isFinite(draftSize.height) ? draftSize.height : undefined;
    const boxHeight = Math.max(minHeight, intrinsicHeight, requestedHeight ?? 0);
    const textY = padding + titleHeight + gap;

    return { boxWidth, boxHeight, textY, contentWidth: Math.max(contentWidth, boxWidth - padding * 2), wrappedTitle: wrappedTitleByWidth, wrappedText };
  }, [title, text, draftSize.width, draftSize.height]);

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
          strokeWidth={1.5}
          dash={[6, 6]}
          listening={false}
        />
      )}
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill={fillColor}
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
      <Rect
        x={boxWidth - handleSize}
        y={boxHeight - handleSize}
        width={handleSize}
        height={handleSize}
        fill="#dddddd"
        stroke="#666666"
        strokeWidth={1}
        draggable
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          const nextWidth = Math.max(minWidth, e.target.x() + handleSize);
          const nextHeight = Math.max(minHeight, e.target.y() + handleSize);
          setDraftSize({ width: nextWidth, height: nextHeight });
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          const nextWidth = Math.max(minWidth, e.target.x() + handleSize);
          const nextHeight = Math.max(minHeight, e.target.y() + handleSize);
          setDraftSize({ width: nextWidth, height: nextHeight });
          onResizeEnd?.(nextWidth, nextHeight);
        }}
      />
    </Group>
  );
};

export default NoteNode;
