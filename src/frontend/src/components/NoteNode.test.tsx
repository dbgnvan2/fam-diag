import React from 'react';
import { render } from '@testing-library/react';
import NoteNode from './NoteNode';
import { Stage, Layer } from 'react-konva';
import { vi } from 'vitest';

describe('NoteNode', () => {
  it('renders the note title and text', () => {
    const layerRef = React.createRef<any>();
    render(
      <Stage>
        <Layer ref={layerRef}>
          <NoteNode
            x={0}
            y={0}
            title="Test Title"
            text="Test Text"
            onDragEnd={() => {}}
          />
        </Layer>
      </Stage>
    );

    const layer = layerRef.current;
    const group = layer.getChildren()[0];
    const texts = group.getChildren().filter((node: any) => node.getClassName() === 'Text');
    
    expect(texts[0].getAttr('text')).toBe('Test Title');
    expect(texts[1].getAttr('text')).toBe('Test Text');
  });

  it('renders a resize handle', () => {
    const layerRef = React.createRef<any>();
    render(
      <Stage>
        <Layer ref={layerRef}>
          <NoteNode
            x={0}
            y={0}
            title="Resizable"
            text="Body"
            onDragEnd={() => {}}
          />
        </Layer>
      </Stage>
    );
    const layer = layerRef.current;
    const group = layer.getChildren()[0];
    const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('uses a stable default width of about 20 characters', () => {
    const layerRef = React.createRef<any>();
    render(
      <Stage>
        <Layer ref={layerRef}>
          <NoteNode
            x={0}
            y={0}
            title="Joe Smith"
            text="Short note"
            onDragEnd={() => {}}
          />
        </Layer>
      </Stage>
    );
    const layer = layerRef.current;
    const group = layer.getChildren()[0];
    const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
    const noteRect = rects[0];
    expect(noteRect.width()).toBe(147);
  });

  it('keeps resize handle anchored to the lower-right corner', () => {
    const layerRef = React.createRef<any>();
    const { rerender } = render(
      <Stage>
        <Layer ref={layerRef}>
          <NoteNode
            x={0}
            y={0}
            title="Corner"
            text="Anchor"
            width={220}
            height={140}
            onDragEnd={() => {}}
          />
        </Layer>
      </Stage>
    );

    const getRects = () => {
      const layer = layerRef.current;
      const group = layer.getChildren()[0];
      const rects = group.getChildren().filter((node: any) => node.getClassName() === 'Rect');
      return { noteRect: rects[0], handleRect: rects[1] };
    };

    let { noteRect, handleRect } = getRects();
    expect(handleRect.x() + handleRect.width()).toBe(noteRect.width());
    expect(handleRect.y() + handleRect.height()).toBe(noteRect.height());

    rerender(
      <Stage>
        <Layer ref={layerRef}>
          <NoteNode
            x={0}
            y={0}
            title="Corner"
            text="Anchor"
            width={300}
            height={180}
            onDragEnd={() => {}}
          />
        </Layer>
      </Stage>
    );

    ({ noteRect, handleRect } = getRects());
    expect(handleRect.x() + handleRect.width()).toBe(noteRect.width());
    expect(handleRect.y() + handleRect.height()).toBe(noteRect.height());
  });

  it('calls onSelect when the note is clicked', () => {
    const layerRef = React.createRef<any>();
    const onSelect = vi.fn();
    render(
      <Stage>
        <Layer ref={layerRef}>
          <NoteNode
            x={0}
            y={0}
            title="Clickable"
            text="Click me"
            onDragEnd={() => {}}
            onSelect={onSelect}
          />
        </Layer>
      </Stage>
    );

    const layer = layerRef.current;
    const group = layer.getChildren()[0];
    group.fire('click', { evt: new MouseEvent('click') });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
