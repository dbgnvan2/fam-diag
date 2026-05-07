/**
 * Pure helpers for reordering items in an array — used by Settings list modals
 * to support up/down arrows and drag-and-drop reordering.
 */

export const moveItemUp = <T>(items: T[], index: number): T[] => {
  if (index <= 0 || index >= items.length) return items;
  const next = [...items];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
};

export const moveItemDown = <T>(items: T[], index: number): T[] => {
  if (index < 0 || index >= items.length - 1) return items;
  const next = [...items];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
};

export const reorderItem = <T>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
