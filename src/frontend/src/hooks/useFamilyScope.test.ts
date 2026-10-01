/**
 * Spec: docs/implementation_plan_2026-09-19.md#M2
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFamilyScope } from './useFamilyScope';
import type { Partnership, Person } from '../types';

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id,
  x: 0,
  y: 0,
  partnerships: [],
  ...overrides,
});

const partnership = (
  id: string,
  partner1_id: string,
  partner2_id: string,
  children: string[] = []
): Partnership => ({
  id,
  partner1_id,
  partner2_id,
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children,
});

// gf + gm -> dad + mum -> root -> kid
const people: Person[] = [
  person('gf', { partnerships: ['prG'] }),
  person('gm', { partnerships: ['prG'] }),
  person('dad', { partnerships: ['prP'], parentPartnership: 'prG' }),
  person('mum', { partnerships: ['prP'] }),
  person('root', { partnerships: ['prRoot'], parentPartnership: 'prP' }),
  person('spouse', { partnerships: ['prRoot'] }),
  person('kid', { parentPartnership: 'prRoot' }),
  person('stranger'),
];
const partnerships: Partnership[] = [
  partnership('prG', 'gf', 'gm', ['dad']),
  partnership('prP', 'dad', 'mum', ['root']),
  partnership('prRoot', 'root', 'spouse', ['kid']),
];

const setup = () => renderHook(() => useFamilyScope({ people, partnerships }));

describe('useFamilyScope', () => {
  it('test_m2a1_default_focus_is_two_up_two_down_with_collaterals', () => {
    const { result } = setup();
    expect(result.current.focus).toBeNull();
    expect(result.current.scope).toBeNull();

    act(() => result.current.focusOnPerson('root'));

    expect(result.current.focus).toEqual({
      rootId: 'root',
      up: 2,
      down: 2,
      includeCollaterals: true,
      includePartnerFOO: false,
    });
    expect(result.current.scope?.personIds.has('gf')).toBe(true);
    expect(result.current.scope?.personIds.has('kid')).toBe(true);
    expect(result.current.scope?.personIds.has('stranger')).toBe(false);
  });

  it('test_m2a2_steppers_clamp_at_zero_and_max_depth', () => {
    const { result } = setup();
    act(() => result.current.focusOnPerson('root'));
    expect(result.current.depth).toEqual({ maxUp: 2, maxDown: 1 });

    // Down is already at 2 but the family is only 1 deep — clamps to 1.
    act(() => result.current.adjustDown(1));
    expect(result.current.focus?.down).toBe(1);

    act(() => result.current.adjustDown(-5));
    expect(result.current.focus?.down).toBe(0);

    act(() => result.current.adjustUp(5));
    expect(result.current.focus?.up).toBe(2);

    act(() => result.current.adjustUp(-1));
    expect(result.current.focus?.up).toBe(1);
    expect(result.current.scope?.personIds.has('gf')).toBe(false);
    expect(result.current.scope?.personIds.has('dad')).toBe(true);
  });

  it('test_m2a3_clear_focus_restores_all_visibility', () => {
    const { result } = setup();
    act(() => result.current.focusOnPerson('root'));
    expect(result.current.isInScope('stranger')).toBe(false);

    act(() => result.current.clearFocus());
    expect(result.current.focus).toBeNull();
    expect(result.current.scope).toBeNull();
    // With no focus every person is in scope.
    expect(result.current.isInScope('stranger')).toBe(true);
    expect(result.current.exclusions.visiblePeople).toBe(people.length);
  });

  it('test_m2a3_exclusions_report_counts_while_focused', () => {
    const { result } = setup();
    act(() => result.current.focusOnPerson('root', { up: 0, down: 0 }));
    expect(result.current.exclusions.totalPeople).toBe(people.length);
    expect(result.current.exclusions.visiblePeople).toBe(2); // root + spouse
  });

  it('test_m2a1_root_person_is_exposed_for_the_chip_label', () => {
    const { result } = setup();
    act(() => result.current.focusOnPerson('dad'));
    expect(result.current.rootPerson?.id).toBe('dad');
    act(() => result.current.clearFocus());
    expect(result.current.rootPerson).toBeNull();
  });

  it('test_m2a2_steppers_are_noops_without_a_focus', () => {
    const { result } = setup();
    act(() => result.current.adjustUp(1));
    act(() => result.current.adjustDown(1));
    expect(result.current.focus).toBeNull();
  });
});

describe('useFamilyScope — a focus whose root is gone (review 2026-09-30 DE1-06)', () => {
  it('File > New / Open / deleting the root clears the focus instead of hiding everyone', () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: Person[] }) => useFamilyScope({ people: list, partnerships }),
      { initialProps: { list: people } }
    );
    act(() => result.current.focusOnPerson('root'));
    expect(result.current.scope).not.toBeNull();
    // A new diagram: the root is gone, a person is added.
    rerender({ list: [person('newcomer')] });
    expect(result.current.focus).toBeNull();
    expect(result.current.scope).toBeNull();
    expect(result.current.isInScope('newcomer')).toBe(true);
  });
});

describe('useFamilyScope — a drag does not recompute the scope (review 2026-09-30 struct-03)', () => {
  it('moving people keeps the same scope object; a structural change makes a new one', () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: Person[] }) => useFamilyScope({ people: list, partnerships }),
      { initialProps: { list: people } }
    );
    act(() => result.current.focusOnPerson('root'));
    const first = result.current.scope;
    rerender({ list: people.map((entry) => ({ ...entry, x: entry.x + 25, y: entry.y + 10 })) });
    expect(result.current.scope).toBe(first);
    rerender({ list: people.map((entry) => (entry.id === 'stranger' ? { ...entry, parentPartnership: 'prRoot' } : entry)) });
    expect(result.current.scope).not.toBe(first);
  });
});
