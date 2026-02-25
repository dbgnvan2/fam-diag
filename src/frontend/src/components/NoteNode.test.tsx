import React from 'react';
import { render } from '@testing-library/react';
import NoteNode from './NoteNode';
import { Stage, Layer } from 'react-konva';

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
});
