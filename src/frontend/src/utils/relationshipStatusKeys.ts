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
  const nextStatusDates = { ...(partnership.statusDates || {}) };
  // Drop every alias spelling of this status, so 'divorced' and 'divorce'
  // cannot both survive with different dates.
  Object.keys(nextStatusDates).forEach((entryKey) => {
    if (canonicalRelationshipStatusKey(entryKey) === key) delete nextStatusDates[entryKey];
  });
  if (trimmed) nextStatusDates[key] = trimmed;
  const legacyField = LEGACY_STATUS_DATE_FIELD_BY_KEY[key];
  const next: Partnership = {
    ...partnership,
    statusDates: Object.keys(nextStatusDates).length ? nextStatusDates : undefined,
  };
  if (legacyField) next[legacyField] = trimmed || undefined;
  return next;
};
