# Image Import — VLM Specification

**Date:** 2026-06-07
**Status:** Spec for implementation. Supersedes the classical-CV import approach for the primary path.
**Audience:** the coding agent implementing the Image Diagram import feature.

---

## 1. Background and decision

The "File → Image Diagram" feature imports a photographed, hand-drawn genogram and turns it into an editable family diagram.

The current code attempts this with a classical computer-vision pipeline (OpenCV.js + Tesseract: contour detection, shape classification, Hough-line X detection, per-symbol OCR). That approach has two problems:

1. **It is broken in the browser right now.** `src/utils/cvLoader.ts` was rewired to `import('./cv-js')`, but `src/utils/cv-js/` was never created — the module does not exist, so browser import fails at load. The earlier WASM path (`@techstark/opencv-js`) was itself blocked by an ESM/CommonJS incompatibility and a 9 MB main-thread WASM compile that pegged the UI. See `docs/genogram-import-status.md` and `docs/implementation_plan_2026-06-08-opencv-js.md`.
2. **Even when it ran (in Node), accuracy was poor.** Per the status doc: gender classification was wrong on ~19/21 symbols, partnerships over-counted, triangles unverified, and letter OCR was never validated because Tesseract was too slow to keep in the loop. The algorithms are inherently brittle on wobbly hand-drawn, angled-photo input.

**Decision:** replace the perception front-end with a single whole-image vision-language-model (VLM) call. A vision model reads hand-drawn genograms holistically — shapes, X marks, faint marks like a "c" circle, miscarriage stars, and the letters *underneath* the X strokes — in one pass, with no contour math. This was confirmed empirically: a VLM read the target diagram correctly (with normal human-level ambiguity on a few symbols).

A network/API call at import time is acceptable (confirmed). No offline fallback is required for the primary path. The classical pipeline may be left in place as dead/optional code or removed, but it is no longer the import path.

### Why this is also *less* code and lower risk

The existing pipeline's only job is to produce, from pixels, the same structured facts a VLM can produce directly. The downstream assembly code — ID assignment, partnership cross-linking, child placement, layout, overlap resolution — is **good and tested** and is reused unchanged. We are replacing only the brittle perception step.

---

## 2. Architecture — target the app's own schema

**Core principle (from the product owner):** the result of image processing must be a JSON object the app already knows how to import. Do **not** invent a new schema. Do **not** have the VLM emit the internal `DiagramImportData` shape directly — that shape carries generated IDs, x/y coordinates, and dense cross-references between people and partnerships, which is error-prone to generate by hand.

Instead, target the existing **`FactsImportData`** schema and reuse the existing, tested converter.

### Existing seam

`src/frontend/src/utils/dataImport.ts` already exports:

```ts
export const factsToDiagramImportData = (facts: FactsImportData): DiagramImportData => { ... }
```

This converter already does all the hard wiring:
- assigns `nanoid()` IDs to people and partnerships,
- cross-links partners ↔ partnerships,
- creates and places children, sets `parentPartnership`,
- runs `normalizeImportedChildLayout(...)` for layout,
- emits the final `DiagramImportData` the File → Open / import flow accepts.

`FactsImportData` and `DiagramImportData` are defined in `src/frontend/src/types/diagramEditor.ts`.

### Data flow

```
photographed genogram (Blob)
   │
   ▼  downscale ≤1600px long side
one Anthropic vision call  ──►  FactsImportData JSON  (the VLM's only job)
   │
   ▼  factsToDiagramImportData()   (existing, tested — extended minimally)
DiagramImportData
   │
   ▼  existing import flow (ImageDiagramModal → DiagramEditor)
editable diagram on canvas
```

The VLM produces a **first draft**. It is not deterministic and not perfect (exactly as a human transcriber is not). The app is already a manual editor, so the correction surface exists for free. Low-confidence reads must be surfaced so the user knows what to check.

---

## 3. Schema — `FactsImportData` + additive `people[]`

The current `FactsImportData` (in `types/diagramEditor.ts`) was built for transcript processing. It is name-and-relationship oriented and does **not** carry per-person sex, deceased flag, or birth/death years as first-class fields — all of which a genogram image shows. So it needs a **small, additive** extension: a new optional `people[]` array. Everything else is reused verbatim so existing transcript/facts behavior is untouched.

### 3.1 Type change (additive only)

In `src/frontend/src/types/diagramEditor.ts`, extend `FactsImportData`:

```ts
export type FactsImportData = {
  sourceFile?: string;
  processedAt?: string;
  family?: {
    parents?: string[];
    marriageYear?: number;
    childrenCountMentioned?: number;
    childrenMentionedByName?: string[];
  };
  relationships?: Array<{
    a?: string;
    b?: string;
    type?: string;
    status?: string;
    evidence?: string;
  }>;
  clinical?: {
    explicitSchizophreniaMentions?: string[];
    explicitNoDiagnosisMentions?: string[];
    events?: Array<{ person?: string; type?: string; year?: number }>;
  };
  uncertainties?: string[];

  // NEW — additive block for image import. Optional; absent for transcript imports.
  people?: Array<{
    name: string;                       // letter or name AS DRAWN; "" if illegible
    sex?: 'male' | 'female' | 'unknown';
    deceased?: boolean;                 // X drawn through the symbol
    birthYear?: number | null;
    deathYear?: number | null;
    confidence?: 'high' | 'med' | 'low';
    notes?: string;                     // adjacent text, e.g. "b.1968", "div. 2021"
  }>;
};
```

### 3.2 Converter change (additive only)

Extend `factsToDiagramImportData()` so that, when `facts.people` is present, it merges each entry onto the matching `Person` (by name, via the existing `findLikelyExistingPerson` / `getPerson` path):

- `sex` → `person.gender` (`'male' | 'female'`; `'unknown'` → leave default, add a note)
- `deceased: true` → set `person.deathDate` (use `deathYear` if given, else a placeholder year as the transcript path already does for deceased-without-date)
- `birthYear` → `person.birthDate = "${birthYear}-01-01"`
- `deathYear` → `person.deathDate = "${deathYear}-01-01"`
- `notes` → appended to `person.notes`, `notesEnabled = true`
- `confidence: 'low'` → also push a line into the returned `ideasText` / `uncertainties` so the user sees what to review

**Do not change** existing behavior when `facts.people` is absent. All current transcript/facts tests must still pass.

### 3.3 The name-collision rule (critical)

`factsToDiagramImportData()` matches people **by name**. The target genograms use many single-letter, repeated labels — e.g. three different people labelled **M** (M b.1968 male, M b.1939 female, top-right grandmother M), two labelled **C**, two **E**, two **K**. Plain name-matching will collide them into one person and corrupt the diagram.

**Therefore every person label must be globally unique and stable.** The VLM is instructed (see prompt) to disambiguate using adjacent birth-year text or position, producing labels like `M (b.1968)`, `M (b.1939)`, `M (grandmother, top-right)`. The same disambiguated label must be used everywhere that person is referenced — in `people[]`, in `family.parents`, in `family.childrenMentionedByName`, and in `relationships[].a/.b`. This is the single most likely failure point; treat it as a hard requirement, not a nicety.

### 3.4 Worked example (target diagram)

Abbreviated — illustrates shape, not exhaustive symbol list:

```jsonc
{
  "sourceFile": "galloway-genogram.jpg",
  "processedAt": "2026-06-07",
  "family": {
    "parents": ["A (b.1940)", "M (b.1939)"],
    "marriageYear": 1969,
    "childrenMentionedByName": ["D (b.1971)", "D (b.1976)"]
  },
  "relationships": [
    { "a": "C (grandfather, top-right)", "b": "M (grandmother, top-right)",
      "type": "married", "status": "widowed",
      "evidence": "Top-right grandparents, both deceased (X). Sibship below incl. M (b.1939)." },
    { "a": "A (b.1940)", "b": "M (b.1939)",
      "type": "married", "status": "widowed",
      "evidence": "m.1969. Both deceased. 3 miscarriages (stars) + 1 deceased infant + D (b.1971) + D (b.1976)." },
    { "a": "M (b.1968)", "b": "D (b.1971)",
      "type": "married", "status": "married",
      "evidence": "m.2009. Children: K (b.2010), E, E (b.2014)." },
    { "a": "D-male (b.1976)", "b": "C (b.1976 spouse)",
      "type": "married", "status": "divorce",
      "evidence": "m.2015, div. 2021. Child: B (b.2018). 'c' circle = pregnancy." }
  ],
  "clinical": { "explicitSchizophreniaMentions": [], "explicitNoDiagnosisMentions": [], "events": [] },
  "uncertainties": [
    "Top-right sibling row: a square-with-triangle may be a pregnancy, not a born person.",
    "Letters under X marks (N, J, A) are low-confidence reads."
  ],
  "people": [
    { "name": "M (b.1968)", "sex": "male", "deceased": false, "birthYear": 1968, "deathYear": null, "confidence": "high", "notes": "b.1968" },
    { "name": "D (b.1971)", "sex": "female", "deceased": false, "birthYear": 1971, "deathYear": null, "confidence": "high", "notes": "b.1971" },
    { "name": "A (b.1940)", "sex": "male", "deceased": true, "birthYear": 1940, "deathYear": 2014, "confidence": "med", "notes": "b.1940 d.2014; letter under X" },
    { "name": "M (b.1939)", "sex": "female", "deceased": true, "birthYear": 1939, "deathYear": 2026, "confidence": "med", "notes": "b.1939 d.2026" },
    { "name": "D-male (b.1976)", "sex": "male", "deceased": false, "birthYear": 1976, "deathYear": null, "confidence": "high", "notes": "b.1976; m.2015 div.2021" },
    { "name": "B (b.2018)", "sex": "male", "deceased": false, "birthYear": 2018, "deathYear": null, "confidence": "high", "notes": "b.2018" },
    { "name": "K (b.2010)", "sex": "female", "deceased": false, "birthYear": 2010, "deathYear": null, "confidence": "med", "notes": "b.2010; possible twin with E" },
    { "name": "E (child of M&D)", "sex": "male", "deceased": false, "birthYear": null, "deathYear": null, "confidence": "med", "notes": "square; possible twin (b.2010)" },
    { "name": "E (b.2014)", "sex": "female", "deceased": false, "birthYear": 2014, "deathYear": null, "confidence": "med", "notes": "b.2014" }
    // ...one entry per square/circle/X symbol. Exclude stars and bare triangles.
  ]
}
```

---

## 4. The VLM extraction prompt

Send the **whole** downscaled image (not per-symbol crops) plus the text below. Use the browser-direct Anthropic fetch pattern already in `src/frontend/src/utils/genogram/letterVlm.ts` (same endpoint, headers including `anthropic-dangerous-direct-browser-access: true`, same api-key/model config source). Request a generous `max_tokens` (these JSON payloads are large — budget ≥4000). Ask for JSON only.

### 4.1 System / instruction text

```
You are an expert at reading hand-drawn genograms (family-tree diagrams used in
family-systems therapy), including ones that are photographed at an angle, faint,
or drawn in pencil. You will be given ONE image of a genogram. Extract its content
into a single JSON object and return ONLY that JSON — no prose, no markdown fences.

SYMBOL KEY (standard genogram notation — apply strictly, by shape):
- A square-ish shape = MALE. (sex: "male")
- A circle-ish shape = FEMALE. (sex: "female")
- An X drawn THROUGH a square or circle = that person is DECEASED. The shape still
  tells you the sex. (deceased: true)
- A plain X with NO enclosing square or circle = a person of UNKNOWN sex.
  (sex: "unknown")
- A triangle = a pregnancy. This is NOT a born person — do NOT add it to people[].
- A small star or asterisk (*) = a miscarriage / pregnancy loss. NOT a person —
  do NOT add it to people[]. You MAY note the count in uncertainties or evidence.
- A small circle containing the letter "c" = a current pregnancy. Treat as a
  pregnancy marker (note it), not a fully born person, unless clearly drawn as a
  normal person symbol.
- A horizontal line connecting two people = a couple/partnership.
- "m.YYYY" near a couple line = marriage year. "div. YYYY" or a double slash on
  the line = divorce. A vertical line dropping to people below a couple = their
  children.
- Text like "b.1968" or "b.1940 d.2014" next to a symbol = birth / death years.

READING X-ED SYMBOLS: a heavy X often overlaps the letter inside. Do your best to
read the letter UNDER the X. If you cannot, set name to "" and confidence "low".

UNIQUE-LABEL RULE (CRITICAL — the app collides people that share a name):
Many people are labelled with a single letter, and letters REPEAT across the page
(e.g. three different people marked "M"). Every person you output MUST have a
globally unique, stable "name". Disambiguate using the nearest birth year, then by
role/position. Examples: "M (b.1968)", "M (b.1939)", "M (grandmother, top-right)".
Use the EXACT SAME label everywhere you reference that person — in people[], in
family.parents, in family.childrenMentionedByName, and in relationships a/b.
Never output two people with identical "name" values.

OUTPUT — return a single JSON object with these keys:
{
  "sourceFile": string,            // filename if known, else ""
  "processedAt": "YYYY-MM-DD",
  "family": {                      // OPTIONAL — the most central couple, if clear
    "parents": [label, label],
    "marriageYear": number,
    "childrenMentionedByName": [label, ...]
  },
  "relationships": [               // ONE entry per couple/partnership line drawn
    { "a": label, "b": label,
      "type": "married" | "engaged" | "common-law" | "living-together" | "dating" | "affair" | "friendship",
      "status": "married" | "divorce" | "separated" | "widowed" | "ended" | "ongoing",
      "evidence": "free text: marriage/divorce years, children, losses, anything written"
    }
  ],
  "clinical": {                    // ONLY if a diagnosis/event is literally written on the page
    "explicitSchizophreniaMentions": [label, ...],
    "explicitNoDiagnosisMentions": [],
    "events": [ { "person": label, "type": string, "year": number } ]
  },
  "uncertainties": [ string, ... ],// every ambiguous/low-confidence read, in words
  "people": [                      // ONE entry per square / circle / plain-X symbol
    { "name": label,
      "sex": "male" | "female" | "unknown",
      "deceased": boolean,
      "birthYear": number | null,
      "deathYear": number | null,
      "confidence": "high" | "med" | "low",
      "notes": "adjacent text or shape notes"
    }
  ]
}

RULES:
- Put EVERY square, circle, and plain-X person in people[]. Exclude triangles and
  stars (record those in uncertainties/evidence instead).
- Mark deceased: true for any symbol with an X through it.
- If a birth or death year is not written, use null — never guess a year.
- If you are unsure about a shape, an X, a letter, twins-vs-separate-births, or a
  triangle-vs-square, list it in uncertainties and set that person's confidence to
  "med" or "low" rather than guessing silently.
- Set status "widowed" only if a partner is deceased; "divorce" if a divorce mark
  or "div." is present; otherwise "married"/"ongoing" as drawn.
- Return ONLY the JSON object. No commentary, no code fences.
```

### 4.2 Parsing / robustness

- Strip accidental ```` ```json ```` fences before `JSON.parse`.
- On malformed JSON: log the raw response to the `ImportLog`, surface a clear error to the user, do not throw uncaught.
- Validate with the existing `isFactsImportData` type guard in `dataImport.ts` before handing off (extend the guard if needed so the `people[]` block is accepted).
- De-duplicate any people that still share a `name` after parsing (defensive — the prompt forbids it, but enforce it too): if duplicates appear, append a positional suffix and add an `uncertainties` note.

---

## 5. Implementation directive (for the coding agent)

Build the VLM-primary import path:

1. **New file** `src/frontend/src/utils/genogram/vlmImport.ts` exporting an async function that takes the image `Blob` (and the same `onProgress` / `ImportLog` conventions used by `runGenogramPipeline`), downscales to ≤1600 px on the long side, makes ONE Anthropic vision call using the fetch pattern from `letterVlm.ts` with the prompt in §4, parses the response to `FactsImportData` (§4.2), and returns it.

2. **Extend** `FactsImportData` in `types/diagramEditor.ts` with the optional `people[]` block (§3.1). Additive only.

3. **Extend** `factsToDiagramImportData()` in `dataImport.ts` to merge `facts.people[]` onto matching persons (§3.2), preserving all existing behavior when the block is absent.

4. **Wire** `ImageDiagramModal.tsx` to the new flow:
   `vlmImport(blob)` → `FactsImportData` → `factsToDiagramImportData()` → existing import flow.
   Surface low-confidence people and `uncertainties` to the user (the modal already has an import-log surface — `ImportLogModal.tsx`).

5. **Remove** the dead `import('./cv-js')` line in `cvLoader.ts`. The classical pipeline is no longer the import path; either delete it or leave it unreferenced. Remove `@techstark/opencv-js` from `vite.config.ts optimizeDeps.exclude` and from `package.json` only if no remaining code imports it (the integration test under `scripts/` may still reference it — check before removing the dependency).

### Tests (write these — do not wait to be asked)

- `dataImport` test: a `FactsImportData` with a `people[]` block maps correctly through `factsToDiagramImportData()` — assert a `sex:"male"` → `gender:"male"`, a `deceased:true` → a `deathDate` is set, a `birthYear` → `birthDate`, and a `confidence:"low"` person surfaces in the returned `ideasText`/uncertainties.
- `vlmImport` test: with a **mocked** `fetch`, a well-formed JSON response parses into a valid `FactsImportData`; a malformed/fenced response is handled gracefully (logged, no uncaught throw); duplicate `name` values are de-duplicated.
- Regression: all existing transcript/facts tests in `dataImport` still pass unchanged.

### Completion gate (project checklist — all must pass)

```bash
cd src/frontend && npx tsc --noEmit
cd src/frontend && npx vitest run
cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b
```

Plus a real browser smoke test: File → Image Diagram → choose the target photo → Analyze → a diagram appears, with no "cv undefined" or module-not-found errors in the console.

---

## 6. Honest caveats / non-goals

- **The VLM output is a draft, not ground truth.** It is non-deterministic and will occasionally misread an ambiguous symbol (e.g. triangle-vs-square, a letter under a heavy X, twins-vs-separate births). The design leans on the app being a manual editor and on surfacing `confidence`/`uncertainties` so the user knows what to verify. Do not present results as authoritative.
- **Name collisions are the top risk.** The unique-label rule (§3.3, §4.1) is load-bearing. If it is not enforced both in the prompt and defensively in parsing, repeated single-letter labels will merge distinct people.
- **Birth/death years are only as good as the handwriting.** The prompt forbids guessing years (`null` when unwritten); honor that — a wrong inferred date is worse than a blank.
- **This spec covers the import path only.** It does not change manual diagram creation, the save format, or `DiagramImportData` itself (only the additive `people[]` field on the upstream `FactsImportData`).
- **Cost/privacy:** each import is one vision API call (a fraction of a cent) and sends the image to Anthropic. Acceptable per product decision; note it in user-facing docs if the app has a privacy section.
```
