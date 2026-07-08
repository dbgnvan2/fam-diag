/**
 * Tests for factsToDiagramImportData — the converter that turns VLM-extracted
 * FactsImportData into a loadable DiagramImportData. Focuses on the image-import
 * path (facts.people present): sex/date/coordinate mapping and layout rules
 * R13/R16/R17. Previously untested.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { factsToDiagramImportData } from './dataImport';
import type { FactsImportData } from '../types/diagramEditor';
import type { Person } from '../types';

const find = (people: Person[], name: string) => {
  const p = people.find((person) => person.name === name);
  if (!p) throw new Error(`person "${name}" not found in [${people.map((x) => x.name).join(', ')}]`);
  return p;
};

describe('factsToDiagramImportData — VLM image-import path', () => {
  describe('per-person metadata mapping', () => {
    it('maps sex → gender', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
        ],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').gender).toBe('male');
      expect(find(people, 'Jennie Boyd').gender).toBe('female');
    });

    it('maps birthYear → birthDate (Jan 1 of that year)', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male', birthYear: 1968 }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').birthDate).toBe('1968-01-01');
    });

    it('maps deceased + deathYear → deathDate', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: 2014 }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Charlie Cole').deathDate).toBe('2014-01-01');
    });

    it('marks deceased-with-unknown-year using a placeholder death date', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: null }],
      };
      const { people } = factsToDiagramImportData(facts);
      // Placeholder so the person renders as deceased; user can correct the year.
      expect(find(people, 'Charlie Cole').deathDate).toBe('1900-01-01');
    });

    it('does not set a death date for a living person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').deathDate).toBeUndefined();
    });

    it('uses image X percentage as left-to-right order, not absolute pixels (R12)', () => {
      // For image imports BOTH axes are layout-determined: Y by generation, X by the
      // packed family layout (R19). The image x% only fixes the drawn L-R ORDER, so a
      // person drawn further left ends up left of one drawn further right.
      const facts: FactsImportData = {
        people: [
          { name: 'Pa', sex: 'male' },
          { name: 'Ma', sex: 'female' },
          { name: 'LeftKid', sex: 'male', x: 20, y: 60 },
          { name: 'RightKid', sex: 'female', x: 80, y: 60 },
        ],
        relationships: [{ a: 'Pa', b: 'Ma', children: ['LeftKid', 'RightKid'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'LeftKid').x).toBeLessThan(find(people, 'RightKid').x);
    });
  });

  describe('relationships → partnerships', () => {
    it('creates a partnership and links explicit children via parentPartnership', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Kid One', sex: 'male' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', type: 'married', children: ['Kid One'] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      expect(partnerships).toHaveLength(1);
      const kid = find(people, 'Kid One');
      expect(kid.parentPartnership).toBe(partnerships[0].id);
      expect(partnerships[0].children).toContain(kid.id);
    });
  });

  describe('R16 — unknown-sex symbols render smaller, but never below the 30px floor', () => {
    it('sets size to 30 for an unknown-sex person (rule 3 floor)', () => {
      const facts: FactsImportData = { people: [{ name: 'Mystery X', sex: 'unknown' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Mystery X').size).toBe(30);
    });

    it('never sizes any imported person below 30 points', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Mystery X', sex: 'unknown' },
          { name: 'Baby X', sex: 'unknown', deceased: true, notes: 'stillbirth' },
        ],
      };
      const { people } = factsToDiagramImportData(facts);
      for (const p of people) {
        if (p.size !== undefined) expect(p.size).toBeGreaterThanOrEqual(30);
      }
    });

    it('does not shrink a known-sex person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').size).toBeUndefined();
    });
  });

  describe('R17 — stillbirth detection', () => {
    it('flags lifeStatus=stillbirth when notes contain "stillbirth"', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Baby X', sex: 'unknown', deceased: true, notes: 'small X — stillbirth' }],
      };
      const { people } = factsToDiagramImportData(facts);
      const baby = find(people, 'Baby X');
      expect(baby.lifeStatus).toBe('stillbirth');
      expect(baby.size).toBe(30);
    });

    it('infers stillbirth from unknown-sex + deceased + no birth year + child of a partnership', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Baby X', sex: 'unknown', deceased: true, birthYear: null },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Baby X'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Baby X').lifeStatus).toBe('stillbirth');
    });

    it('does not flag a living unknown-sex person as stillbirth', () => {
      const facts: FactsImportData = { people: [{ name: 'Mystery X', sex: 'unknown' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Mystery X').lifeStatus).toBeUndefined();
    });
  });

  describe('rule 2 — no positional inference of parent-child links', () => {
    it('leaves a person unattached when no line links them to a couple, even directly below', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male', x: 30, y: 20 },
          { name: 'Jennie Boyd', sex: 'female', x: 50, y: 20 },
          { name: 'Orphan Below', sex: 'male', x: 40, y: 70 }, // sits under the couple, but NO children link
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: [] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      const orphan = find(people, 'Orphan Below');
      expect(orphan.parentPartnership).toBeUndefined();
      expect(partnerships.every((p) => !p.children.includes(orphan.id))).toBe(true);
    });

    it('still attaches a child that IS explicitly linked (rule 1)', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Linked Kid', sex: 'female' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Linked Kid'] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      const kid = find(people, 'Linked Kid');
      expect(kid.parentPartnership).toBe(partnerships[0].id);
      expect(partnerships[0].children).toContain(kid.id);
    });
  });

  describe('R18 — twins / multiple births', () => {
    const twinFacts = (): FactsImportData => ({
      people: [
        { name: 'Wayne Adams', sex: 'male', x: 30 },
        { name: 'Jennie Boyd', sex: 'female', x: 50 },
        { name: 'Twin A', sex: 'female', x: 38, twinGroup: 't1' },
        { name: 'Twin B', sex: 'male', x: 46, twinGroup: 't1' },
      ],
      relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Twin A', 'Twin B'] }],
    });

    it('gives twins a shared multipleBirthGroupId and a shared connectionAnchorX', () => {
      const { people } = factsToDiagramImportData(twinFacts());
      const a = find(people, 'Twin A');
      const b = find(people, 'Twin B');
      expect(a.multipleBirthGroupId).toBeDefined();
      expect(a.multipleBirthGroupId).toBe(b.multipleBirthGroupId);
      expect(a.connectionAnchorX).toBe(b.connectionAnchorX);
    });

    it('does not group an ordinary sibling that has no twinGroup', () => {
      const facts = twinFacts();
      facts.people!.push({ name: 'Solo Sib', sex: 'male' });
      facts.relationships![0].children!.push('Solo Sib');
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Solo Sib').multipleBirthGroupId).toBeUndefined();
    });

    it('does not create a multiple-birth group from a single twinGroup member', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Lonely Twin', sex: 'female', twinGroup: 't1' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Lonely Twin'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Lonely Twin').multipleBirthGroupId).toBeUndefined();
    });
  });

  describe('backward compatibility — non-image facts (no people[])', () => {
    it('still builds people and a partnership from family.parents without applying R16/R17', () => {
      const facts: FactsImportData = {
        family: { parents: ['Wayne Adams', 'Jennie Boyd'], childrenMentionedByName: ['Kid One'] },
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      expect(people.map((p) => p.name).sort()).toEqual(['Jennie Boyd', 'Kid One', 'Wayne Adams']);
      expect(partnerships).toHaveLength(1);
      // R17 (stillbirth) is image-import only — nobody is flagged here.
      // (size is NOT asserted: the non-image path runs normalizeImportedChildLayout,
      // which may legitimately set a size for dense-family auto-resize.)
      expect(people.every((p) => p.lifeStatus === undefined)).toBe(true);
    });
  });
});

/**
 * Regression suite for the generation-assignment fix, driven by the real
 * "Jennie's Boy" hand-drawn diagram. The old first-arrival BFS collapsed the
 * tree and put Wayne (a great-grandchild) in the top generation because his
 * wife Rose has no drawn parents. Longest-path assignment must place Wayne with
 * his own siblings and below his parents. Corrected reference fixture:
 * repo-root "Jennies Boy Corrected.json".
 */
describe("factsToDiagramImportData — Jennie's Boy generation layout", () => {
  // Manual VLM-equivalent extraction of the photographed diagram (no birth years
  // are written on it, so this exercises the STRUCTURAL fix, not the age tiers).
  const jennieFacts = (): FactsImportData => ({
    people: [
      { name: 'Grandfather', sex: 'male', deceased: true },
      { name: 'Grandmother', sex: 'female', deceased: true },
      { name: 'Died@7yrs', sex: 'female', deceased: true },
      { name: 'Helen', sex: 'female', deceased: true },
      { name: 'Eileen', sex: 'female', deceased: true },
      { name: 'Lucy', sex: 'female' },
      { name: 'Ned', sex: 'male' },
      { name: 'Charlie', sex: 'male', deceased: true },
      { name: 'Mae White', sex: 'female', deceased: true },
      { name: 'John', sex: 'male' },
      { name: 'Gerald', sex: 'male' },
      { name: 'Dennis', sex: 'male', deceased: true, twinGroup: 'dl' },
      { name: 'Leonard', sex: 'male', twinGroup: 'dl' },
      { name: 'Unnamed circle', sex: 'female' },
      { name: 'Gordon', sex: 'male' },
      { name: 'Art', sex: 'male' },
      { name: 'Jennie', sex: 'female' },
      { name: 'Ben', sex: 'male' },
      { name: 'Craig', sex: 'male' },
      { name: 'Wayne', sex: 'male' },
      { name: 'Brian', sex: 'male' },
      { name: 'Rose', sex: 'female' },
    ],
    relationships: [
      { a: 'Grandfather', b: 'Grandmother', children: ['Died@7yrs', 'Helen', 'Eileen', 'Lucy'] },
      { a: 'Ned', b: 'Lucy', children: ['John', 'Gerald', 'Dennis', 'Leonard', 'Unnamed circle', 'Jennie'] },
      { a: 'Charlie', b: 'Mae White', children: ['Gordon', 'Art'] },
      { a: 'Art', b: 'Jennie', children: ['Ben', 'Craig', 'Wayne', 'Brian'] },
      { a: 'Wayne', b: 'Rose', children: [] },
    ],
  });

  it('places Wayne in the SAME generation row as his siblings (not the top)', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const wayne = find(people, 'Wayne');
    for (const sib of ['Ben', 'Craig', 'Brian']) {
      expect(find(people, sib).y).toBe(wayne.y);
    }
    // The old bug parked Wayne at the topmost generation — assert he is NOT there.
    const topY = Math.min(...people.map((p) => p.y));
    expect(wayne.y).toBeGreaterThan(topY);
  });

  it('keeps every child strictly below the deeper of its two parents', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const y = (n: string) => find(people, n).y;
    // Wayne below both parents
    expect(y('Wayne')).toBeGreaterThan(y('Art'));
    expect(y('Wayne')).toBeGreaterThan(y('Jennie'));
    // Bug B: Ned/Lucy's children sit below Lucy (a grandparents' child), not level with Ned.
    expect(y('Jennie')).toBeGreaterThan(y('Lucy'));
    expect(y('Jennie')).toBeGreaterThan(y('Ned'));
    // Grandparents are the topmost row.
    expect(y('Grandfather')).toBe(Math.min(...people.map((p) => p.y)));
  });

  it('lets a married-in spouse with no drawn parents inherit their partner’s generation', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    // Rose has no parents drawn; she must sit with Wayne, not be treated as a top-gen root.
    expect(find(people, 'Rose').y).toBe(find(people, 'Wayne').y);
  });

  it('produces the expected four generation bands', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const bands = [...new Set(people.map((p) => p.y))].sort((a, b) => a - b);
    expect(bands).toHaveLength(4); // grandparents → their kids → John/Jennie/Art gen → Wayne gen
  });

  it('matches the corrected reference on family count', () => {
    const ref = JSON.parse(readFileSync(join(__dirname, '../../../../Jennies Boy Corrected.json'), 'utf8'));
    const { partnerships } = factsToDiagramImportData(jennieFacts());
    expect(partnerships).toHaveLength(ref.partnerships.length); // both have 5 families
  });

  it('does not place a childless married-in spouse on top of a sibling (Rose vs Craig)', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const rose = find(people, 'Rose');
    // Rose married into a full sibling row (Ben/Craig/Wayne/Brian) — she must not
    // land exactly on any of them.
    for (const sib of ['Ben', 'Craig', 'Wayne', 'Brian']) {
      expect(find(people, sib).x).not.toBe(rose.x);
    }
  });

  it('gives every person a unique position on their generation row', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const byRow = new Map<number, number[]>();
    for (const p of people) {
      const row = Math.round(p.y);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(Math.round(p.x));
    }
    for (const xs of byRow.values()) {
      expect(new Set(xs).size).toBe(xs.length); // no two people share an (x,y)
    }
  });

  it('brackets every couple wider than its RESIDENT children row (R19, R20)', () => {
    const { people, partnerships } = factsToDiagramImportData(jennieFacts());
    const byId = new Map(people.map((p) => [p.id, p]));
    // A child who is themselves a parent in another family may have married out
    // (R20) and moved next to their spouse, so a couple need only bracket the
    // children that still reside in its row.
    const isParentElsewhere = (id: string) =>
      partnerships.some((pt) => (pt.partner1_id === id || pt.partner2_id === id) && pt.children.length > 0);
    for (const pt of partnerships) {
      const residentKids = pt.children.filter((id) => !isParentElsewhere(id));
      if (residentKids.length === 0) continue;
      const kidsX = residentKids.map((id) => byId.get(id)!.x);
      const p1 = byId.get(pt.partner1_id)!;
      const p2 = byId.get(pt.partner2_id)!;
      expect(Math.min(p1.x, p2.x)).toBeLessThan(Math.min(...kidsX)); // left partner left of resident kids
      expect(Math.max(p1.x, p2.x)).toBeGreaterThan(Math.max(...kidsX)); // right partner right of them
    }
  });
});

describe('factsToDiagramImportData — age as a soft generation check', () => {
  it('nudges a fully-disconnected dated person into the nearest-age generation band', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Grandpa', sex: 'male', birthYear: 1900 },
        { name: 'Grandma', sex: 'female', birthYear: 1905 },
        { name: 'Parent A', sex: 'male', birthYear: 1930 },
        { name: 'Parent B', sex: 'female', birthYear: 1932 },
        { name: 'Kid', sex: 'male', birthYear: 1960 },
        { name: 'Floater', sex: 'female', birthYear: 1958 }, // isolated, but same era as Kid
      ],
      relationships: [
        { a: 'Grandpa', b: 'Grandma', children: ['Parent A'] },
        { a: 'Parent A', b: 'Parent B', children: ['Kid'] },
      ],
    };
    const { people } = factsToDiagramImportData(facts);
    // Floater has no lines, so structure alone would leave her at the top gen (y minimum).
    // The age nudge should drop her onto Kid's row instead.
    expect(find(people, 'Floater').y).toBe(find(people, 'Kid').y);
  });

  it('flags an age-impossible drawn parent→child link but keeps the drawn line', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Young Parent', sex: 'male', birthYear: 1990 },
        { name: 'Other Parent', sex: 'female', birthYear: 1992 },
        { name: 'Older Child', sex: 'male', birthYear: 1980 }, // born BEFORE the parents
      ],
      relationships: [{ a: 'Young Parent', b: 'Other Parent', children: ['Older Child'] }],
    };
    const result = factsToDiagramImportData(facts);
    // Age raises a hand (surfaced via ideasText) ...
    expect(result.ideasText).toMatch(/Age check/i);
    // ... but never grabs the wheel: the drawn parent-child link is preserved.
    const child = find(result.people, 'Older Child');
    expect(child.parentPartnership).toBe(result.partnerships[0].id);
    expect(result.partnerships[0].children).toContain(child.id);
  });
});

describe('factsToDiagramImportData — R20 married-in mate anchoring', () => {
  // Family A (3 kids) is larger than Family B (2 kids). A child of each marries the
  // other. R20 keeps the couple in A's row (anchor) and marks B's child married-in,
  // so B's couple is NOT stretched to reach the child who moved to their spouse.
  const crossLineageFacts = (): FactsImportData => ({
    people: [
      { name: 'Amom', sex: 'female', x: 10 },
      { name: 'Adad', sex: 'male', x: 20 },
      { name: 'AsibL', sex: 'female', x: 5, y: 40 },
      { name: 'AsibR', sex: 'male', x: 15, y: 40 },
      { name: 'Amarry', sex: 'female', x: 25, y: 40 },
      { name: 'Bmom', sex: 'female', x: 80 },
      { name: 'Bdad', sex: 'male', x: 90 },
      { name: 'Bsib', sex: 'female', x: 75, y: 40 },
      { name: 'Bmarry', sex: 'male', x: 85, y: 40 },
      { name: 'GC1', sex: 'male', x: 45, y: 70 },
      { name: 'GC2', sex: 'female', x: 55, y: 70 },
    ],
    relationships: [
      { a: 'Amom', b: 'Adad', children: ['AsibL', 'AsibR', 'Amarry'] },
      { a: 'Bmom', b: 'Bdad', children: ['Bsib', 'Bmarry'] },
      { a: 'Amarry', b: 'Bmarry', children: ['GC1', 'GC2'] },
    ],
  });

  it('does not stretch the married-in partner’s birth family to reach them', () => {
    const { people } = factsToDiagramImportData(crossLineageFacts());
    const x = (n: string) => find(people, n).x;
    // Family B brackets its RESIDENT child (Bsib) ...
    expect(Math.min(x('Bmom'), x('Bdad'))).toBeLessThan(x('Bsib'));
    expect(Math.max(x('Bmom'), x('Bdad'))).toBeGreaterThan(x('Bsib'));
    // ... and Bmarry (married out) is NOT inside Family B's couple span — the couple
    // stays compact and a longer parent-child connector reaches Bmarry instead.
    const bLeft = Math.min(x('Bmom'), x('Bdad'));
    const bRight = Math.max(x('Bmom'), x('Bdad'));
    expect(x('Bmarry') < bLeft || x('Bmarry') > bRight).toBe(true);
  });

  it('still brackets the married couple over their own children', () => {
    const { people } = factsToDiagramImportData(crossLineageFacts());
    const x = (n: string) => find(people, n).x;
    const kidMin = Math.min(x('GC1'), x('GC2'));
    const kidMax = Math.max(x('GC1'), x('GC2'));
    expect(Math.min(x('Amarry'), x('Bmarry'))).toBeLessThan(kidMin);
    expect(Math.max(x('Amarry'), x('Bmarry'))).toBeGreaterThan(kidMax);
  });
});

describe('factsToDiagramImportData — R19 packed family X layout', () => {
  it('places a couple’s Partner Relationship Line wider than its children row', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Pa', sex: 'male', x: 40 },
        { name: 'Ma', sex: 'female', x: 60 },
        { name: 'A', sex: 'male', x: 30, y: 60 },
        { name: 'B', sex: 'female', x: 50, y: 60 },
        { name: 'C', sex: 'male', x: 70, y: 60 },
      ],
      relationships: [{ a: 'Pa', b: 'Ma', children: ['A', 'B', 'C'] }],
    };
    const { people } = factsToDiagramImportData(facts);
    const x = (n: string) => find(people, n).x;
    const kidMin = Math.min(x('A'), x('B'), x('C'));
    const kidMax = Math.max(x('A'), x('B'), x('C'));
    expect(Math.min(x('Pa'), x('Ma'))).toBeLessThan(kidMin);
    expect(Math.max(x('Pa'), x('Ma'))).toBeGreaterThan(kidMax);
  });

  it('keeps two sibling families from overlapping on X', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'GpaA', sex: 'male', x: 20 },
        { name: 'GmaA', sex: 'female', x: 25 },
        { name: 'GpaB', sex: 'male', x: 70 },
        { name: 'GmaB', sex: 'female', x: 75 },
        { name: 'A1', sex: 'male', x: 18, y: 60 },
        { name: 'A2', sex: 'female', x: 27, y: 60 },
        { name: 'B1', sex: 'male', x: 68, y: 60 },
        { name: 'B2', sex: 'female', x: 77, y: 60 },
      ],
      relationships: [
        { a: 'GpaA', b: 'GmaA', children: ['A1', 'A2'] },
        { a: 'GpaB', b: 'GmaB', children: ['B1', 'B2'] },
      ],
    };
    const { people } = factsToDiagramImportData(facts);
    const x = (n: string) => find(people, n).x;
    // Family A's whole X-extent must sit entirely left of family B's — no interleaving.
    const familyAmax = Math.max(x('GpaA'), x('GmaA'), x('A1'), x('A2'));
    const familyBmin = Math.min(x('GpaB'), x('GmaB'), x('B1'), x('B2'));
    expect(familyAmax).toBeLessThan(familyBmin);
  });

  it('assigns a distinct X to every person in a generation (no exact collisions)', () => {
    const { people } = factsToDiagramImportData({
      people: [
        { name: 'P1', sex: 'male' },
        { name: 'P2', sex: 'female' },
        { name: 'K1', sex: 'male', x: 30, y: 60 },
        { name: 'K2', sex: 'female', x: 50, y: 60 },
        { name: 'K3', sex: 'male', x: 70, y: 60 },
      ],
      relationships: [{ a: 'P1', b: 'P2', children: ['K1', 'K2', 'K3'] }],
    });
    const kidXs = ['K1', 'K2', 'K3'].map((n) => find(people, n).x);
    expect(new Set(kidXs).size).toBe(3);
  });
});
