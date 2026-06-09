/**
 * Genogram Rules — Fact-Check + Auto-Fix System
 *
 * Consolidated set of rules that validate and adjust VLM-extracted data to
 * conform to genogram conventions and the layout rules established by the
 * product owner.
 *
 * Rules are organized into two phases:
 *
 *   PHASE 1: DATA RULES (applied to FactsImportData before conversion)
 *     R1  Triangles are pregnancy markers — NOT people; remove
 *     R2  Stars/asterisks are miscarriages — NOT people; remove
 *     R3  Names must be unique — dedupe with suffix
 *     R4  Name sex hint should match sex field — warn on mismatch
 *     R5  Relationships must reference valid people — clean dangling refs
 *     R6  Siblings cannot be married to each other — warn + remove relationship
 *
 *   PHASE 2: LAYOUT RULES (applied after partnerships built, in dataImport.ts)
 *     R7  Each generation has same Y — snap via BFS depth
 *     R8  Partners have same Y (same generation) — iterate until consistent
 *     R9  Siblings have same Y — share parentPartnership → share generation
 *     R10 Generations separated by N px on Y axis (200px default)
 *     R11 Siblings spaced N px apart on X axis (80px default)
 *     R12 Preserve X sequence — never reorder siblings or couples
 *     R13 Children X positioned under parents' partnership range
 *     R14 Process top-left to bottom-right — spatial inference for orphans
 *     R15 Partnership connector Y consistent per generation
 *     R16 Unknown-sex symbols rendered 1/4 size (15px vs default 60px)
 *
 * Each rule:
 *   - Has a clear name and description
 *   - Logs warnings/fixes to the import log
 *   - Can be enabled/disabled (future: via settings)
 */

import type { FactsImportData } from '../../types/diagramEditor';

/** Result of running a rule: list of human-readable messages for the import log */
export type RuleResult = {
  warnings: string[]; // Things to alert the user about
  fixes: string[]; // Auto-fixes that were applied
};

/**
 * Run all PHASE 1 (data) rules against FactsImportData.
 * Mutates facts in place. Returns warnings + fixes for the log.
 */
export function applyDataRules(facts: FactsImportData): RuleResult {
  const result: RuleResult = { warnings: [], fixes: [] };

  rule1_filterTriangles(facts, result);
  rule2_filterStars(facts, result);
  rule3_dedupeNames(facts, result);
  rule4_sexNameConsistency(facts, result);
  rule5_cleanDanglingRelationships(facts, result);
  rule6_siblingsCannotMarry(facts, result);

  return result;
}

// =============================================================================
// R1: Triangles are pregnancy markers, NOT people
// =============================================================================
function rule1_filterTriangles(facts: FactsImportData, result: RuleResult): void {
  if (!facts.people) return;
  const before = facts.people.length;
  facts.people = facts.people.filter((p) => {
    const lower = (p.name || '').toLowerCase();
    if (lower.includes('triangle')) {
      result.fixes.push(`R1: Removed triangle (pregnancy marker, not a person): "${p.name}"`);
      return false;
    }
    return true;
  });
  if (facts.people.length < before) {
    result.fixes.push(`R1: Filtered ${before - facts.people.length} triangle entries`);
  }
}

// =============================================================================
// R2: Stars/asterisks are miscarriages, NOT people
// =============================================================================
function rule2_filterStars(facts: FactsImportData, result: RuleResult): void {
  if (!facts.people) return;
  const before = facts.people.length;
  facts.people = facts.people.filter((p) => {
    const lower = (p.name || '').toLowerCase();
    if (lower.includes('star') || lower.includes('asterisk') || lower.includes('miscarriage')) {
      result.fixes.push(`R2: Removed miscarriage marker (not a person): "${p.name}"`);
      return false;
    }
    return true;
  });
  if (facts.people.length < before) {
    result.fixes.push(`R2: Filtered ${before - facts.people.length} star/asterisk entries`);
  }
}

// =============================================================================
// R3: Names must be unique
// =============================================================================
function rule3_dedupeNames(facts: FactsImportData, result: RuleResult): void {
  if (!facts.people) return;
  const seen = new Map<string, number>();
  for (const person of facts.people) {
    const name = person.name || '';
    const count = seen.get(name) || 0;
    if (count > 0) {
      const oldName = name;
      person.name = `${name} (dup ${count + 1})`;
      result.fixes.push(`R3: Duplicate name "${oldName}" → renamed to "${person.name}"`);
    }
    seen.set(name, count + 1);
  }
}

// =============================================================================
// R4: Sex/name consistency check
// =============================================================================
function rule4_sexNameConsistency(facts: FactsImportData, result: RuleResult): void {
  if (!facts.people) return;
  for (const person of facts.people) {
    const lower = (person.name || '').toLowerCase();
    const nameSaysFemale = /\bfemale\b/.test(lower);
    const nameSaysMale = /\bmale\b/.test(lower) && !nameSaysFemale;
    if (nameSaysFemale && person.sex === 'male') {
      result.warnings.push(`R4: Inconsistency: "${person.name}" name suggests female but sex=male`);
    }
    if (nameSaysMale && person.sex === 'female') {
      result.warnings.push(`R4: Inconsistency: "${person.name}" name suggests male but sex=female`);
    }
  }
}

// =============================================================================
// R5: Clean up relationships referring to filtered-out people
// =============================================================================
function rule5_cleanDanglingRelationships(facts: FactsImportData, result: RuleResult): void {
  if (!facts.people || !facts.relationships) return;
  const validNames = new Set(facts.people.map((p) => p.name));
  const before = facts.relationships.length;
  facts.relationships = facts.relationships.filter((r) => {
    if (r.a && !validNames.has(r.a)) {
      result.fixes.push(`R5: Removed relationship: partner "${r.a}" was filtered out`);
      return false;
    }
    if (r.b && !validNames.has(r.b)) {
      result.fixes.push(`R5: Removed relationship: partner "${r.b}" was filtered out`);
      return false;
    }
    return true;
  });
  if (facts.relationships.length < before) {
    result.fixes.push(`R5: Cleaned ${before - facts.relationships.length} dangling relationships`);
  }
  for (const rel of facts.relationships) {
    if (rel.children) {
      const cBefore = rel.children.length;
      rel.children = rel.children.filter((c) => validNames.has(c));
      if (rel.children.length < cBefore) {
        result.fixes.push(
          `R5: Cleaned ${cBefore - rel.children.length} invalid children refs in relationship "${rel.a}"+"${rel.b}"`
        );
      }
    }
  }
}

// =============================================================================
// R6: Siblings cannot be married to each other
// =============================================================================
function rule6_siblingsCannotMarry(facts: FactsImportData, result: RuleResult): void {
  if (!facts.relationships) return;
  // Build map: person -> their parents' relationship (sibling group)
  const personToSiblingGroup = new Map<string, string>();
  for (const rel of facts.relationships) {
    const groupKey = `${rel.a}|${rel.b}`;
    if (rel.children) {
      for (const child of rel.children) {
        personToSiblingGroup.set(child, groupKey);
      }
    }
  }
  const before = facts.relationships.length;
  facts.relationships = facts.relationships.filter((rel) => {
    if (!rel.a || !rel.b) return true;
    const groupA = personToSiblingGroup.get(rel.a);
    const groupB = personToSiblingGroup.get(rel.b);
    if (groupA && groupB && groupA === groupB) {
      result.warnings.push(
        `R6: VIOLATION — "${rel.a}" and "${rel.b}" are siblings (same parents), cannot be married. Relationship REMOVED.`
      );
      return false;
    }
    return true;
  });
  if (facts.relationships.length < before) {
    result.fixes.push(`R6: Removed ${before - facts.relationships.length} sibling-marriage relationships`);
  }
}
