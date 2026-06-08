/**
 * Standalone integration test for the genogram pipeline.
 *
 * Runs in plain Node via tsx — bypasses vitest, which hangs on the
 * opencv-js WASM workload. Imports the REAL pipeline.ts and runs it
 * against the actual fixture images. Compares to jennie_boy_diagram.json
 * (the goal reference).
 *
 * Usage:
 *   npm run test:genogram
 *
 * Exit code 0 = all assertions pass.
 */

import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import {
  installCreateImageBitmapPolyfill,
  installCanvasCreateElementPolyfill,
  patchCanvasDrawImage,
  fixtureAsBlob,
} from '../src/utils/genogram/__tests__/integrationHelpers';
import { runGenogramPipeline } from '../src/utils/genogram/pipeline';
import type { Person, Partnership } from '../src/types';

const FIXTURES_DIR = resolve(__dirname, '../../../Test Data');
const REPO_ROOT = resolve(__dirname, '../../..');

type FixtureSpec = {
  name: string;
  image: string;
  reference?: string;
};

const FIXTURES: FixtureSpec[] = [
  {
    name: 'Jennies Boy',
    image: resolve(FIXTURES_DIR, 'Family Diagram Jennies Boy for Import.jpg'),
    reference: resolve(REPO_ROOT, 'jennie_boy_diagram.json'),
  },
  {
    name: 'Dixie',
    image: resolve(FIXTURES_DIR, 'dixie small family diagram for import.png'),
  },
  {
    name: 'Galloway',
    image: resolve(FIXTURES_DIR, 'Galloway Family Diagram for import.png'),
  },
];

// ─── tiny assertion harness ─────────────────────────────────────────────
let passes = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ' — ' + detail : ''}`);
    console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function runFixture(spec: FixtureSpec): Promise<void> {
  console.log(`\n─── ${spec.name} ───`);
  const blob = fixtureAsBlob(spec.image);
  const t0 = Date.now();
  const result = await runGenogramPipeline(blob, {
    skipOcr: true,
    onProgress: (p) => {
      if (process.env.GENOGRAM_DEBUG === '1') {
        process.stderr.write(`  [progress] ${p.stage}: ${p.message}\n`);
      }
    },
  });
  const elapsed = Date.now() - t0;
  const people: Person[] = result.data.people ?? [];
  const partnerships: Partnership[] = result.data.partnerships ?? [];

  console.log(
    `  • ${elapsed}ms — symbols=${result.symbols.length} people=${people.length} partnerships=${partnerships.length}`
  );

  // Per-symbol shape distribution helps diagnose classifier failures.
  const shapeCounts = result.symbols.reduce<Record<string, number>>((acc, s) => {
    acc[s.shape] = (acc[s.shape] || 0) + 1;
    return acc;
  }, {});
  console.log(`    shapes:`, shapeCounts);

  if (process.env.GENOGRAM_DEBUG === '1') {
    // Dump per-symbol features so we can tune the classifier offline.
    result.symbols.forEach((s, i) => {
      const c = (s as unknown as { bbox: { w: number; h: number } });
      console.log(
        `    [${i}] ${s.shape.padEnd(8)} bbox=${c.bbox.w}x${c.bbox.h}`
      );
    });
  }

  check(`completes in under 5 seconds`, elapsed < 5000, `took ${elapsed}ms`);
  check(`detects at least one symbol`, result.symbols.length > 0);
  check(`produces at least one person`, people.length > 0);

  // Reference-based checks.
  if (spec.reference) {
    const ref = JSON.parse(readFileSync(spec.reference, 'utf8')) as {
      people: unknown[];
      partnerships: unknown[];
    };
    const refPersonCount = ref.people.length;
    const refPartnershipCount = ref.partnerships.length;
    const minP = Math.floor(refPersonCount * 0.6);
    const maxP = Math.ceil(refPersonCount * 1.4);
    check(
      `person count is within ±40% of reference (${refPersonCount})`,
      people.length >= minP && people.length <= maxP,
      `got ${people.length}, expected [${minP}, ${maxP}]`
    );
    check(
      `partnership count is between 1 and 3× reference (${refPartnershipCount})`,
      partnerships.length >= 1 && partnerships.length <= refPartnershipCount * 3,
      `got ${partnerships.length}`
    );
  }

  // Topology invariants applicable to every fixture.
  partnerships.forEach((p, i) => {
    check(`partnership[${i}] has horizontalConnectorY > 0`, (p.horizontalConnectorY ?? 0) > 0);
  });

  const personIds = new Set(people.map((p) => p.id));
  partnerships.forEach((pp) => {
    pp.children.forEach((cid) => {
      check(
        `partnership.children id "${cid}" references a real person`,
        personIds.has(cid)
      );
    });
  });

  const ppIds = new Set(partnerships.map((p) => p.id));
  people.forEach((person) => {
    if (person.parentPartnership) {
      check(
        `person ${person.id}.parentPartnership references a real partnership`,
        ppIds.has(person.parentPartnership)
      );
    }
  });

  // No two people overlap. MIN_PERSON_SPACING is 80 in assemble.ts.
  let minDist = Infinity;
  let minPair: [string, string] = ['', ''];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const d = Math.hypot(people[i].x - people[j].x, people[i].y - people[j].y);
      if (d < minDist) {
        minDist = d;
        minPair = [people[i].id, people[j].id];
      }
    }
  }
  check(
    `no two people are closer than 79px (min observed ${minDist.toFixed(1)}px between ${minPair[0]} and ${minPair[1]})`,
    minDist >= 79
  );

  // Deceased detection: at least one symbol should be flagged is_dead per
  // fixture if it actually contains X-marked shapes. We can't assert exact
  // counts without per-fixture ground truth, so use a loose lower bound.
  const deceasedCount = result.symbols.filter((s) => s.is_dead).length;
  if (spec.reference) {
    // Jennies Boy has 4–5 X-marked symbols. Require at least 1 to be flagged.
    check(`detects at least one deceased symbol`, deceasedCount >= 1);
  }

  // Topology layout: same-generation people share a Y. Build expected
  // generations by walking parentPartnership chains.
  const personById = new Map(people.map((p) => [p.id, p]));
  const ppById = new Map(partnerships.map((pp) => [pp.id, pp]));
  const genOf = new Map<string, number>();
  function computeGen(id: string, depth = 0): number {
    if (depth > 50) return 0; // cycle guard
    if (genOf.has(id)) return genOf.get(id)!;
    const person = personById.get(id);
    if (!person?.parentPartnership) {
      genOf.set(id, 0);
      return 0;
    }
    const pp = ppById.get(person.parentPartnership);
    if (!pp) {
      genOf.set(id, 0);
      return 0;
    }
    const g = Math.max(computeGen(pp.partner1_id, depth + 1), computeGen(pp.partner2_id, depth + 1)) + 1;
    genOf.set(id, g);
    return g;
  }
  people.forEach((p) => computeGen(p.id));

  // Bucket Y by generation. All people in the same generation must share Y.
  const yByGen = new Map<number, Set<number>>();
  people.forEach((p) => {
    const g = genOf.get(p.id) ?? 0;
    const ys = yByGen.get(g) ?? new Set<number>();
    ys.add(Math.round(p.y));
    yByGen.set(g, ys);
  });
  let allSameY = true;
  yByGen.forEach((ys) => {
    if (ys.size > 1) allSameY = false;
  });
  check('all same-generation people share a Y', allSameY);

  // Children are below their parents' Y.
  let kidsBelowParents = true;
  partnerships.forEach((pp) => {
    const p1 = personById.get(pp.partner1_id);
    pp.children.forEach((cid) => {
      const c = personById.get(cid);
      if (p1 && c && c.y <= p1.y) kidsBelowParents = false;
    });
  });
  check('children sit below their parents', kidsBelowParents);
}

async function main(): Promise<void> {
  installCreateImageBitmapPolyfill();
  installCanvasCreateElementPolyfill();
  patchCanvasDrawImage();

  for (const spec of FIXTURES) {
    try {
      await runFixture(spec);
    } catch (err) {
      failures.push(`${spec.name} threw: ${(err as Error).message}`);
      console.error(`  ✗ ${spec.name} threw:`, err);
    }
  }

  console.log(`\n${passes} checks passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
  process.exit(0);
}

main();
