/**
 * Typed access to a react-konva tree in tests. Each helper checks what it
 * returns, so a test fails with a clear message instead of reaching into a
 * null stage or a Shape where a Group was expected.
 */
import Konva from 'konva';
import type { RefObject } from 'react';

/** The node behind a ref, once rendered. */
export const mounted = <T>(ref: RefObject<T | null>, what: string): T => {
  if (!ref.current) throw new Error(`${what} ref is empty: it did not mount`);
  return ref.current;
};

/** The stage behind a ref, once rendered. */
export const mountedStage = (ref: RefObject<Konva.Stage | null>): Konva.Stage => mounted(ref, 'Stage');

/** The child at `index` of a container, which the component renders as a Group. */
export const childGroup = (parent: Konva.Container, index = 0): Konva.Group => {
  const node = parent.getChildren()[index];
  if (!(node instanceof Konva.Group)) {
    throw new Error(`expected a Group at child ${index}, got ${node ? node.getClassName() : 'nothing'}`);
  }
  return node;
};

/**
 * A container's direct children whose class name is `className`, typed as
 * that class. Matches on getClassName(), like the tests always did — not
 * instanceof, which would also count subclasses (an Arrow is a Line).
 */
export const childrenNamed = <T extends Konva.Node>(parent: Konva.Container, className: string): T[] =>
  parent.getChildren().filter((node) => node.getClassName() === className) as T[];

/** The child at `index` of a container, which the component renders as a drawn Shape. */
export const childShape = (parent: Konva.Container, index = 0): Konva.Shape => {
  const node = parent.getChildren()[index];
  if (!(node instanceof Konva.Shape)) {
    throw new Error(`expected a Shape at child ${index}, got ${node ? node.getClassName() : 'nothing'}`);
  }
  return node;
};
