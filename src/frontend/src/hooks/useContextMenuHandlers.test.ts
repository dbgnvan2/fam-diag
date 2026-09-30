/**
 * Behaviour tests for the canvas context menus: what each item actually
 * does, not what the source text contains.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { EmotionalProcessEvent, EventType, Person } from '../types';
import { useContextMenuHandlers } from './useContextMenuHandlers';
import { EVENT_CATEGORIES } from '../constants/eventConstants';
import { DEFAULT_SCOPE_DOWN, DEFAULT_SCOPE_UP } from '../utils/familyScope';

type MenuItem = { label: string; onClick?: () => void; children?: MenuItem[] };

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id,
  x: 0,
  y: 0,
  partnerships: [],
  ...overrides,
});

const setup = (selectedPeopleIds: string[], overrides: Record<string, unknown> = {}) => {
  let menu: { items: MenuItem[] } | null = null;
  const deps = {
    people: [person('a', { isCoach: true }), person('b'), person('c'), person('d')],
    partnerships: [],
    selectedPeopleIds,
    selectedPartnershipId: null,
    selectedFamilyIds: [],
    relationshipTypes: [],
    functionalFactCategories: [{ id: 'ff', name: 'Work' }],
    setContextMenu: vi.fn((value) => {
      menu = typeof value === 'function' ? value(menu) : value;
    }),
    familyScopeFocus: null,
    deriveTimelineIds: vi.fn((personIds: string[], familyIds: string[]) => ({
      personIds: [...personIds, 'derived-person'],
      familyIds: [...familyIds, 'derived-family'],
    })),
    deriveTimelineIdsForRoot: vi.fn(() => ({ personIds: [], familyIds: [] })),
    zoom: 1,
    viewport: { width: 800, height: 600 },
    panelWidth: 0,
    ribbonHeight: 0,
    ...overrides,
  };
  const proxy = new Proxy(deps as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : (target[key] = vi.fn())),
  });
  const { result } = renderHook(() => useContextMenuHandlers(proxy as never));
  const event = {
    evt: { preventDefault: vi.fn(), clientX: 10, clientY: 20 },
    cancelBubble: false,
    target: { getStage: () => null },
  } as unknown as KonvaEventObject<PointerEvent>;
  return { result, deps: proxy as Record<string, ReturnType<typeof vi.fn>>, event, menu: () => menu };
};

const flatten = (items: MenuItem[], path: string[] = []): Array<{ path: string[]; item: MenuItem }> =>
  items.flatMap((item) => [
    { path: [...path, item.label], item },
    ...flatten(item.children || [], [...path, item.label]),
  ]);

describe('Add Triangle (M18)', () => {
  it('with three people selected, right-clicking one of them offers Add Triangle for those three', () => {
    const { result, deps, event, menu } = setup(['a', 'b', 'c']);
    result.current.handlePersonContextMenu(event, person('b'));
    const item = flatten(menu()!.items).find((entry) => entry.item.label === 'Add Triangle');
    expect(item).toBeDefined();
    item!.item.onClick!();
    expect(deps.addTriangle).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('a single person\'s menu has no Add Triangle (regression: it built one from a stale selection)', () => {
    const { result, event, menu } = setup(['a', 'b', 'c']);
    result.current.handlePersonContextMenu(event, person('d'));
    expect(flatten(menu()!.items).some((entry) => entry.item.label === 'Add Triangle')).toBe(false);
  });
});

describe('context-menu event seeds (M2)', () => {
  it('every seed names a category the event dialog knows, and no rating or date', () => {
    const { result, deps, event, menu } = setup(['a']);
    result.current.handlePersonContextMenu(event, person('a', { isCoach: true }));
    const leaves = flatten(menu()!.items).filter((entry) => entry.item.onClick && (entry.path.includes('Add') || entry.path.includes('Coach Event')));
    leaves.forEach((entry) => entry.item.onClick?.());
    const seeds = deps.openContextualEventCreator.mock.calls
      .map((call) => call[2] as Partial<EmotionalProcessEvent> | undefined)
      .filter((seed): seed is Partial<EmotionalProcessEvent> => !!seed && !!seed.category);
    expect(seeds.length).toBeGreaterThanOrEqual(5);
    seeds.forEach((seed) => {
      const type = seed.eventType as EventType;
      const known = type === 'FF' ? ['Work'] : EVENT_CATEGORIES[type];
      expect(known.map((c) => c.toLowerCase())).toContain((seed.category || '').toLowerCase());
      expect(seed.intensity).toBeUndefined();
      expect(seed.date).toBeUndefined();
      expect(seed.startDate).toBeUndefined();
    });
  });
});

describe('Timeline entry points use the scope derivation', () => {
  it('the person menu opens the lanes the derivation returns', () => {
    const { result, deps, event, menu } = setup(['a']);
    result.current.handlePersonContextMenu(event, person('a'));
    flatten(menu()!.items).find((entry) => entry.path.join('>') === 'Timeline')!.item.onClick!();
    expect(deps.deriveTimelineIds).toHaveBeenCalledWith(['a'], []);
    expect(deps.setTimelineSelectionIds).toHaveBeenCalledWith(['a', 'derived-person']);
    expect(deps.setTimelineFamilySelectionIds).toHaveBeenCalledWith(['derived-family']);
  });

  it('the group menu opens the lanes the derivation returns', () => {
    const { result, deps, event, menu } = setup(['a', 'b']);
    result.current.handlePersonContextMenu(event, person('a'));
    flatten(menu()!.items).find((entry) => entry.item.label === 'Timeline')!.item.onClick!();
    expect(deps.setTimelineSelectionIds).toHaveBeenCalledWith(['a', 'b', 'derived-person']);
  });
});

describe('Focus Family submenu', () => {
  const focusItem = (label: string, overrides: Record<string, unknown> = {}) => {
    const harness = setup(['a'], overrides);
    harness.result.current.handlePersonContextMenu(harness.event, person('a'));
    const item = flatten(harness.menu()!.items).find(
      (entry) => entry.path[0] === 'Focus Family' && entry.item.label === label
    );
    return { ...harness, item: item?.item };
  };

  it('the default preset uses the shared default depth', () => {
    const { item, deps } = focusItem(`${DEFAULT_SCOPE_UP} up / ${DEFAULT_SCOPE_DOWN} down`);
    item!.onClick!();
    expect(deps.focusFamilyOnPerson).toHaveBeenCalledWith('a', { up: DEFAULT_SCOPE_UP, down: DEFAULT_SCOPE_DOWN });
  });

  it('"Whole family" is clamped to the family\'s real depth', () => {
    const { item, deps } = focusItem('Whole family', {
      people: [person('a', { parentPartnership: 'pr' }), person('mum', { partnerships: ['pr'] }), person('dad', { partnerships: ['pr'] })],
      partnerships: [{ id: 'pr', partner1_id: 'dad', partner2_id: 'mum', children: ['a'], horizontalConnectorY: 0, relationshipType: 'married', relationshipStatus: 'married' }],
    });
    item!.onClick!();
    expect(deps.focusFamilyOnPerson).toHaveBeenCalledWith('a', { up: 1, down: 0 });
  });

  it('"Lineal only" turns collaterals off', () => {
    const { item, deps } = focusItem('Lineal only (no siblings/cousins)');
    item!.onClick!();
    expect(deps.focusFamilyOnPerson).toHaveBeenCalledWith('a', expect.objectContaining({ includeCollaterals: false }));
  });

  it('"Include spouses\' families" turns includePartnerFOO on (it had no UI)', () => {
    const { item, deps } = focusItem("Include spouses' families");
    item!.onClick!();
    expect(deps.focusFamilyOnPerson).toHaveBeenCalledWith('a', expect.objectContaining({ includePartnerFOO: true }));
  });

  it('"Timeline for this family" derives lanes from the focus it sets, not the previous one', () => {
    const { item, deps } = focusItem(`Timeline for this family (${DEFAULT_SCOPE_UP} up / ${DEFAULT_SCOPE_DOWN} down)`, {
      deriveTimelineIdsForRoot: vi.fn(() => ({ personIds: ['a', 'x'], familyIds: ['f'] })),
    });
    item!.onClick!();
    expect(deps.deriveTimelineIdsForRoot).toHaveBeenCalledWith('a', { up: DEFAULT_SCOPE_UP, down: DEFAULT_SCOPE_DOWN });
    expect(deps.setTimelineSelectionIds).toHaveBeenCalledWith(['a', 'x']);
    expect(deps.setTimelineFamilySelectionIds).toHaveBeenCalledWith(['f']);
  });

  it('"Clear focus" appears only while a focus is set', () => {
    expect(focusItem('Clear focus').item).toBeUndefined();
    const { item, deps } = focusItem('Clear focus', { familyScopeFocus: { rootId: 'a', up: 2, down: 2 } });
    item!.onClick!();
    expect(deps.clearFamilyFocus).toHaveBeenCalled();
  });
});
