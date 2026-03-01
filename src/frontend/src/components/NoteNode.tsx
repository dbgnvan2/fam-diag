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
  onSelect?: () => void;
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
  onSelect,
}: NoteNodeProps) => {
  const DEFAULT_NOTE_CHAR_WIDTH = 20;
  const AVERAGE_CHAR_PIXELS = 7;
  const titleFontSize = 14;
  const textFontSize = 12;
  const lineHeight = 1.2;
  const paddingTopBottom = 5;
  const paddingLeft = 5;
  const paddingRight = 2;
  const gap = 5;
  const minWidth = 10;
  const minHeight = 5;
  const handleSize = 10;
  const [liveSize, setLiveSize] = useState<{ width?: number; height?: number }>({
    width,
    height,
  });
  const [hoveringHandle, setHoveringHandle] = useState(false);
  const [hoveringNote, setHoveringNote] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState(false);

  useEffect(() => {
    setLiveSize({ width, height });
  }, [width, height]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.cursor =
      draggingHandle || hoveringHandle ? 'nwse-resize' : hoveringNote ? 'move' : 'default';
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [draggingHandle, hoveringHandle, hoveringNote]);

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

    const wrapByWidth = (
      value: string,
      maxWidth: number,
      fontSize: number,
      fontStyle?: string
    ) => {
      const paragraphs = value.split('\n');
      const wrappedParagraphs: string[] = [];
      const splitLongWord = (word: string) => {
        const chunks: string[] = [];
        let current = '';
        for (const char of word) {
          const candidate = current + char;
          if (current && measure(candidate, fontSize, fontStyle) > maxWidth) {
            chunks.push(current);
            current = char;
          } else {
            current = candidate;
          }
        }
        if (current) chunks.push(current);
        return chunks;
      };

      paragraphs.forEach((paragraph) => {
        if (paragraph === '') {
          wrappedParagraphs.push('');
          return;
        }
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
          wrappedParagraphs.push('');
          return;
        }
        const lines: string[] = [];
        let line = '';
        words.forEach((word) => {
          const candidate = line ? `${line} ${word}` : word;
          if (!line || measure(candidate, fontSize, fontStyle) <= maxWidth) {
            line = candidate;
            return;
          }
          lines.push(line);
          if (measure(word, fontSize, fontStyle) <= maxWidth) {
            line = word;
            return;
          }
          const chunks = splitLongWord(word);
          if (chunks.length > 1) {
            chunks.slice(0, -1).forEach((chunk) => lines.push(chunk));
          }
          line = chunks[chunks.length - 1] || '';
        });
        if (line) lines.push(line);
        wrappedParagraphs.push(lines.join('\n'));
      });

      return wrappedParagraphs.join('\n');
    };

    const defaultWidth = paddingLeft + paddingRight + DEFAULT_NOTE_CHAR_WIDTH * AVERAGE_CHAR_PIXELS;
    const requestedWidth = liveSize.width && Number.isFinite(liveSize.width) ? liveSize.width : undefined;
    const boxWidth = Math.max(minWidth, Math.round(requestedWidth ?? defaultWidth));
    const targetContentWidth = Math.max(8, boxWidth - (paddingLeft + paddingRight));
    const wrappedText = wrapByWidth(text, targetContentWidth, textFontSize);
    const wrappedTitleByWidth = wrapByWidth(title, targetContentWidth, titleFontSize, 'bold');

    const titleLines = wrappedTitleByWidth.split('\n');
    const textLines = wrappedText.split('\n');

    const contentWidth = targetContentWidth;

    const titleHeight = Math.ceil(titleLines.length * titleFontSize * lineHeight);
    const textHeight = Math.ceil(textLines.length * textFontSize * lineHeight);
    const intrinsicHeight = paddingTopBottom + titleHeight + gap + textHeight + paddingTopBottom;
    const requestedHeight = liveSize.height && Number.isFinite(liveSize.height) ? liveSize.height : undefined;
    const boxHeight = Math.max(
      minHeight,
      requestedHeight ? Math.round(requestedHeight) : Math.ceil(intrinsicHeight)
    );
    const textY = paddingTopBottom + titleHeight + gap;

    return {
      boxWidth,
      boxHeight,
      textY,
      contentWidth,
      wrappedTitle: wrappedTitleByWidth,
      wrappedText,
    };
  }, [title, text, liveSize.width, liveSize.height]);

  const centerX = boxWidth / 2;
  const centerY = boxHeight / 2;
  const shouldDrawAnchor = typeof anchorX === 'number' && typeof anchorY === 'number';
  const handleSelect = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (draggingHandle) return;
    event.cancelBubble = true;
    onSelect?.();
  };

  const applyHandleSize = (handleX: number, handleY: number, commit: boolean) => {
    const next = {
      width: Math.max(minWidth, Math.round(handleX + handleSize)),
      height: Math.max(minHeight, Math.round(handleY + handleSize)),
    };
    setLiveSize(next);
    if (commit) {
      onResizeEnd?.(next.width, next.height);
    }
  };

  return (
    <Group
      x={x}
      y={y}
      draggable={!draggingHandle}
      onDragEnd={onDragEnd}
      onClick={handleSelect}
      onTap={handleSelect}
      onMouseEnter={() => setHoveringNote(true)}
      onMouseLeave={() => setHoveringNote(false)}
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
        x={paddingLeft}
        y={paddingTopBottom}
        fontSize={titleFontSize}
        fontStyle="bold"
        width={contentWidth}
        wrap="word"
      />
      <Text
        text={wrappedText}
        x={paddingLeft}
        y={textY}
        fontSize={textFontSize}
        width={contentWidth}
        wrap="word"
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
          setDraggingHandle(true);
        }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          applyHandleSize(e.target.x(), e.target.y(), false);
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          applyHandleSize(e.target.x(), e.target.y(), true);
          setDraggingHandle(false);
        }}
        onMouseEnter={() => setHoveringHandle(true)}
        onMouseLeave={() => setHoveringHandle(false)}
      />
    </Group>
  );
};

export default NoteNode;
