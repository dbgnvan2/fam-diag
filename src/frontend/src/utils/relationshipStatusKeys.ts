/**
 * Purpose: one definition of how a partnership's status dates are keyed, and
 *          which legacy date field mirrors each status.
 * Spec:    n/a — REVIEW-unread-areas-2026-09-30.md (synthesized status
 *          events listed twice)
 * Tests:   src/frontend/src/utils/relationshipStatusKeys.test.ts
 *
 * The Properties panel writes `statusDates` under canonical keys ('start',
 * 'divorce', ...) and mirrors some of them into a legacy field
 * (`relationshipStartDate`, `divorceDate`, ...). syntheticDateEvents used a
 * different key list, so a start date entered in the panel was listed twice.
 * Both now read this module.
 */
import type { Partnership } from '../types';

export type PartnershipDateField =
  | 'relationshipStartDate'
  | 'marriedStartDate'
  | 'separationDate'
  | 'divorceDate';

const RELATIONSHIP_STATUS_KEY_ALIASES: Record<string, string> = {
  started: 'start',
  start: 'start',
  divorced: 'divorce',
  divorce: 'divorce',
  widowed: 'widowed',
  ongoing: 'ongoing',
  ended: 'ended',
  married: 'married',
  separated: 'separated',
};

export const canonicalRelationshipStatusKey = (value: string): string =>
  RELATIONSHIP_STATUS_KEY_ALIASES[value.trim().toLowerCase()] || value.trim().toLowerCase();

/** The legacy field that mirrors each canonical status key. */
export const LEGACY_STATUS_DATE_FIELD_BY_KEY: Partial<Record<string, PartnershipDateField>> = {
  start: 'relationshipStartDate',
  ongoing: 'relationshipStartDate',
  married: 'marriedStartDate',
  separated: 'separationDate',
  divorce: 'divorceDate',
};

/** The canonical status key each legacy field records. */
export const STATUS_KEY_BY_LEGACY_FIELD: Record<PartnershipDateField, string> = {
  relationshipStartDate: 'start',
  marriedStartDate: 'married',
  separationDate: 'separated',
  divorceDate: 'divorce',
};

/** Legacy field for a status key in any spelling ('divorced', 'Started', ...). */
export const legacyFieldForStatus = (status: string): PartnershipDateField | undefined =>
  LEGACY_STATUS_DATE_FIELD_BY_KEY[canonicalRelationshipStatusKey(status)];

export const readPartnershipStatusDate = (partnership: Partnership, status: string): string => {
  const key = canonicalRelationshipStatusKey(status);
  const explicit = partnership.statusDates?.[key];
  if (explicit) return explicit;
  const aliasMatch = Object.entries(partnership.statusDates || {}).find(
    ([entryKey]) => canonicalRelationshipStatusKey(entryKey) === key
  );
  if (aliasMatch?.[1]) return aliasMatch[1];
  const legacyField = LEGACY_STATUS_DATE_FIELD_BY_KEY[key];
  return legacyField ? partnership[legacyField] || '' : '';
};

/** Sets (or, with an empty value, clears) one status date and its legacy mirror. */
export const withPartnershipStatusDate = (
  partnership: Partnership,
  status: string,
  value: string
): Partnership => {
  const key = canonicalRelationshipStatusKey(status);
  const trimmed = value.trim();
  const legacyField = LEGACY_STATUS_DATE_FIELD_BY_KEY[key];
  const nextStatusDates = { ...(partnership.statusDates || {}) };
  // Several statuses share one legacy field (start / ongoing). A date held
  // only in that field belongs to the field's own status; record it there
  // before another status that shares the field is written, or it is lost.
  if (legacyField) {
    const ownKey = STATUS_KEY_BY_LEGACY_FIELD[legacyField];
    const legacyValue = partnership[legacyField];
    if (key !== ownKey && legacyValue && !readStatusDatesOnly(nextStatusDates, ownKey)) {
      const anyHolder = Object.entries(nextStatusDates).some(
        ([entryKey, entryValue]) => entryValue === legacyValue && legacyFieldForStatus(entryKey) === legacyField
      );
      if (!anyHolder) nextStatusDates[ownKey] = legacyValue;
    }
  }
  // Drop every alias spelling of this status, so 'divorced' and 'divorce'
  // cannot both survive with different dates.
  Object.keys(nextStatusDates).forEach((entryKey) => {
    if (canonicalRelationshipStatusKey(entryKey) === key) delete nextStatusDates[entryKey];
  });
  if (trimmed) nextStatusDates[key] = trimmed;
  const next: Partnership = {
    ...partnership,
    statusDates: Object.keys(nextStatusDates).length ? nextStatusDates : undefined,
  };
  if (legacyField) next[legacyField] = legacyMirror(legacyField, nextStatusDates) || undefined;
  return next;
};

const readStatusDatesOnly = (statusDates: Record<string, string>, key: string): string =>
  Object.entries(statusDates).find(
    ([entryKey, entryValue]) => entryValue && canonicalRelationshipStatusKey(entryKey) === key
  )?.[1] || '';

/**
 * The date a legacy field mirrors: its own status's date (start for
 * relationshipStartDate), else the date of another status that shares it.
 */
const legacyMirror = (field: PartnershipDateField, statusDates: Record<string, string> = {}): string => {
  const own = readStatusDatesOnly(statusDates, STATUS_KEY_BY_LEGACY_FIELD[field]);
  if (own) return own;
  return (
    Object.entries(statusDates).find(
      ([entryKey, entryValue]) => entryValue && legacyFieldForStatus(entryKey) === field
    )?.[1] || ''
  );
};

/** The status whose date a legacy field currently mirrors. */
export const statusKeyMirroredBy = (partnership: Partnership, field: PartnershipDateField): string => {
  const ownKey = STATUS_KEY_BY_LEGACY_FIELD[field];
  const value = partnership[field];
  const statusDates = partnership.statusDates || {};
  if (!value || readStatusDatesOnly(statusDates, ownKey) === value) return ownKey;
  const holder = Object.entries(statusDates).find(
    ([entryKey, entryValue]) => entryValue === value && legacyFieldForStatus(entryKey) === field
  );
  return holder ? canonicalRelationshipStatusKey(holder[0]) : ownKey;
};

/** How a status ends a relationship on the canvas: two slashes or one. */
export type RelationshipEnding = 'divorce' | 'separation';

const ENDING_BY_STATUS_KEY: Record<string, RelationshipEnding> = {
  divorce: 'divorce',
  separated: 'separation',
  separation: 'separation',
  ended: 'separation',
};

/**
 * Whether a status (in any spelling) marks a divorce, a separation, or
 * neither. The one classifier for "is this a divorce / separation status",
 * shared by the status field and the status dates.
 */
export const relationshipEndingForStatus = (status: string): RelationshipEnding | null =>
  ENDING_BY_STATUS_KEY[canonicalRelationshipStatusKey(status)] ?? null;
