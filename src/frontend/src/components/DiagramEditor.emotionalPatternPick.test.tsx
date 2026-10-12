/**
 * The one-person route to an Emotional Pattern, driven through the real
 * editor: right-click a person, choose Emotional Pattern, click a second
 * person. This covers the editor's handleSelect wrap that sends the second
 * click to the pick (gate 2026-10-12 MEDIUM: without it the route was dead
 * with a green suite).
 */
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Konva from 'konva';
import DiagramEditor from './DiagramEditor';
import { EMOTIONAL_PATTERN_PICK_HINT } from '../data/helpContent';

const personNode = (personId: string) => {
  const stage = Konva.stages[Konva.stages.length - 1];
  const node = stage.findOne(`#${personId}`);
  expect(node).toBeTruthy();
  return node!;
};

const rightClickPerson = (personId: string) => {
  act(() => {
    personNode(personId).fire(
      'contextmenu',
      { evt: new MouseEvent('contextmenu', { clientX: 120, clientY: 120, button: 2 }) },
      true
    );
  });
};

const clickPerson = (personId: string) => {
  act(() => {
    personNode(personId).fire('click', { evt: new MouseEvent('click', { button: 0 }) }, true);
  });
};

const dialogOpen = () => screen.queryByRole('heading', { name: 'Add Emotional Pattern' });
const banner = () => screen.queryByLabelText('Emotional Pattern second person');

const startPickOn = (personId: string) => {
  rightClickPerson(personId);
  fireEvent.click(screen.getByText('Emotional Pattern'));
};

describe('DiagramEditor — Emotional Pattern from one person', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clicking a second person opens the Add Emotional Pattern dialog for both', () => {
    render(<DiagramEditor />);
    startPickOn('demo-dad');
    expect(banner()).toBeTruthy();
    expect(dialogOpen()).toBeNull();

    clickPerson('demo-son');

    expect(dialogOpen()).toBeTruthy();
    expect(banner()).toBeNull();
    // demo-dad is Alex Carter and demo-son is Liam Carter in the default diagram.
    const dialog = dialogOpen()!.parentElement as HTMLElement;
    const valueAfter = (label: string) => within(dialog).getByText(label).nextElementSibling?.textContent;
    expect(valueAfter('From:')).toBe('Alex Carter');
    expect(valueAfter('Towards:')).toBe('Liam Carter');
  });

  it('clicking the first person again keeps waiting', () => {
    render(<DiagramEditor />);
    startPickOn('demo-dad');
    clickPerson('demo-dad');
    expect(dialogOpen()).toBeNull();
    expect(banner()).toBeTruthy();
  });

  it('after Cancel, clicking a person selects it and opens no dialog', () => {
    render(<DiagramEditor />);
    startPickOn('demo-dad');
    fireEvent.click(within(banner()!).getByRole('button', { name: EMOTIONAL_PATTERN_PICK_HINT.cancelLabel }));
    expect(banner()).toBeNull();
    clickPerson('demo-son');
    expect(dialogOpen()).toBeNull();
  });
});
