import { Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';

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
  const [draftSize, setDraftSize] = useState<{ width?: number; height?: number }>({
    width,
    height,
  });
  const [resizing, setResizing] = useState(false);
  const [hoveringHandle, setHoveringHandle] = useState(false);
  const [hoveringNote, setHoveringNote] = useState(false);
  const groupRef = useRef<Konva.Group | null>(null);

  useEffect(() => {
    setDraftSize({ width, height });
  }, [width, height]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.cursor =
      resizing || hoveringHandle ? 'nwse-resize' : hoveringNote ? 'move' : 'default';
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [resizing, hoveringHandle, hoveringNote]);

  const getSizeFromStagePointer = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer || !groupRef.current) return null;
    const groupPosition = groupRef.current.getAbsolutePosition();
    const localX = pointer.x - groupPosition.x;
    const localY = pointer.y - groupPosition.y;
    return {
      width: Math.max(minWidth, localX),
      height: Math.max(minHeight, localY),
    };
  };
  const applyStageResize = useCallback((stage: Konva.Stage, commit: boolean) => {
    const nextSize = getSizeFromStagePointer(stage);
    if (!nextSize) return;
    const stableSize = {
      width: Math.round(nextSize.width),
      height: Math.round(nextSize.height),
    };
    setDraftSize(stableSize);
    if (commit) {
      onResizeEnd?.(stableSize.width, stableSize.height);
    }
  }, [onResizeEnd]);

  useEffect(() => {
    if (!resizing || !groupRef.current) return;
    const stage = groupRef.current.getStage();
    if (!stage) return;

    const handleMove = () => {
      applyStageResize(stage, false);
    };
    const handleEnd = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      event.cancelBubble = true;
      applyStageResize(stage, true);
      setResizing(false);
    };

    stage.on('mousemove.note-resize touchmove.note-resize', handleMove);
    stage.on('mouseup.note-resize touchend.note-resize', handleEnd);

    return () => {
      stage.off('.note-resize');
    };
  }, [resizing, applyStageResize]);

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
    const requestedWidth = draftSize.width && Number.isFinite(draftSize.width) ? draftSize.width : undefined;
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
    const requestedHeight = draftSize.height && Number.isFinite(draftSize.height) ? draftSize.height : undefined;
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
  }, [title, text, draftSize.width, draftSize.height]);

  const centerX = boxWidth / 2;
  const centerY = boxHeight / 2;
  const shouldDrawAnchor = typeof anchorX === 'number' && typeof anchorY === 'number';
  const handleSelect = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (resizing) return;
    event.cancelBubble = true;
    onSelect?.();
  };

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      draggable={!resizing}
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
        listening
        onMouseDown={(e) => {
          e.cancelBubble = true;
          const stage = e.target.getStage();
          if (stage) {
            applyStageResize(stage, false);
          }
          setResizing(true);
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true;
          const stage = e.target.getStage();
          if (stage) {
            applyStageResize(stage, false);
          }
          setResizing(true);
        }}
        onMouseEnter={() => setHoveringHandle(true)}
        onMouseLeave={() => setHoveringHandle(false)}
      />
    </Group>
  );
};

export default NoteNode;
