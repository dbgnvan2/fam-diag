# Sibling Position & Rank-Sex Conflict Module Specification

Based on Walter Toman's sibling position system as described in *Family Constellation* (4th ed., 1976).

---

## 1. Data Model Assumptions

The module reads from the existing genogram data structure. For each `Person` node, the following fields are assumed accessible:

```
Person {
  id: string
  sex: "M" | "F" | null
  birthdate: ISO date string | null
  birth_order_override: integer | null   // manual override if birthdate absent
  parents: [PersonID, PersonID]          // biological/functional parents
  partner: PersonID | null
  siblings_complete: boolean             // user-asserted flag: are all siblings shown?
}
```

The module does **not** infer `siblings_complete`. It must be user-set. Default is `false`.

---

## 2. Sibling Position Derivation

### 2.1 Gather Sibling Set

For a given person P:
1. Identify all persons sharing at least one parent with P (half-siblings included unless a future flag excludes them)
2. Exclude P from the set
3. Sort by `birthdate` ascending; fall back to `birth_order_override` if no birthdate
4. If neither is available for any sibling, the full sort is **indeterminate** — flag accordingly

### 2.2 Determine Rank

| Condition | Rank Code |
|-----------|-----------|
| No siblings in diagram | `only` |
| P is first in sorted order | `oldest` |
| P is last in sorted order | `youngest` |
| P is neither first nor last | `middle` |

### 2.3 Determine Sex Composition

Count the sex of siblings **excluding P**:

| Sibling sexes present | Composition Code |
|-----------------------|-----------------|
| All male | `b` (brothers only) |
| All female | `s` (sisters only) |
| Mixed | `bs` |
| All null/unknown | `unknown` |
| Some known, some null | `partial` |

### 2.4 Assemble Position Code

Combine person sex + rank + composition:

```
[b|s]_[only|oldest|youngest|middle]_[b|s|bs|unknown|partial]
```

**Canonical display labels** following Toman's notation:

| Person Sex | Rank | Composition | Display Code |
|-----------|------|-------------|-------------|
| M | oldest | b | ob/b |
| M | oldest | s | ob/s |
| M | oldest | bs | ob/bs |
| M | youngest | b | yb/b |
| M | youngest | s | yb/s |
| M | youngest | bs | yb/bs |
| M | middle | b | mb/b |
| M | middle | s | mb/s |
| M | middle | bs | mb/bs |
| M | only | — | m/oc |
| F | oldest | s | os/s |
| F | oldest | b | os/b |
| F | oldest | bs | os/bs |
| F | youngest | s | ys/s |
| F | youngest | b | ys/b |
| F | youngest | bs | ys/bs |
| F | middle | s | ms/s |
| F | middle | b | ms/b |
| F | middle | bs | ms/bs |
| F | only | — | f/oc |

### 2.5 Confidence Flag

Assign one of four confidence levels to every derived position:

| Flag | Condition |
|------|-----------|
| `CONFIRMED` | `siblings_complete = true`, all siblings have sex + sortable date |
| `PROVISIONAL` | `siblings_complete = false` OR any sibling missing sex or date |
| `INDETERMINATE` | Cannot determine rank (e.g., unsortable siblings with no override) |
| `MANUAL` | User has explicitly set position via override (see §4) |

---

## 3. Rank-Sex Conflict Calculation

### 3.1 Prerequisites

Conflict is only computed when **both** persons in a pair have a position code that is not `INDETERMINATE`, and neither has `unknown` composition. If either is `PROVISIONAL`, compute the conflict but display a provisional warning.

The three pair types computed for each Person are:
- **Person vs Father** — Person's position against Father's sibling position
- **Person vs Mother** — Person's position against Mother's sibling position
- **Person vs Partner** — Person's position against Partner's sibling position

If the relevant person (father, mother, partner) has no derivable or manual position, output `"insufficient data"` for that pair.

### 3.2 Rank Conflict Rule

Rank conflict exists when both persons share the same rank category:

```
rank_conflict = (rank_A == rank_B)
```

The rank categories compared are: `oldest`, `youngest`, `middle`, `only`.

`only` children conflict on the rank dimension with **all** ranks:

```
if either person is `only`:
    rank_conflict = true
```

### 3.3 Sex Conflict Rule

Sex conflict applies only to **opposite-sex pairs**. For same-sex pairs, set `sex_conflict = null` and display `"N/A (same-sex pair)"`.

For an opposite-sex pair (one M, one F):

```
male_has_sister_experience    = male's composition includes "s" or "bs"
female_has_brother_experience = female's composition includes "b" or "bs"

sex_conflict = NOT male_has_sister_experience AND NOT female_has_brother_experience
```

Special cases:
- `m/oc` or `f/oc`: no cross-sex sibling experience → contributes to sex conflict
- `partial` or `unknown` composition: cannot determine → flag sex conflict as `UNCERTAIN`

### 3.4 Conflict Category Output

| rank_conflict | sex_conflict | Category Label |
|---------------|-------------|----------------|
| false | false | `No Conflict` |
| true | false | `Rank Conflict` |
| false | true | `Sex Conflict` |
| true | true | `Rank and Sex Conflict` |
| either | UNCERTAIN | `Indeterminate (missing sex data)` |
| either | null | `Rank Only Applicable (same-sex pair)` |

---

## 4. Manual Position Override

### 4.1 Trigger

The UI presents a position selector on each Person's detail panel. It activates when:
- The user clicks "Override sibling position"
- OR the computed confidence is `INDETERMINATE`

### 4.2 Selector Logic

Build the selectable options list **only from positions consistent with known data**:

- Person's own sex is known → filter to M or F positions only
- Person's own sex is unknown → show all positions
- If at least one sibling's sex is known → filter to compositions consistent with known sibling sexes
- Rank is derivable → pre-select that rank, but allow override

Present options as canonical codes with plain-language labels alongside, for example:

```
ob/s  —  Oldest brother of sisters
ys/b  —  Youngest sister of brothers
```

### 4.3 Storage

Store the override as:

```
sibling_position_override: string | null   // e.g. "ob/s"
```

When set, the system uses this value in all conflict calculations and sets confidence to `MANUAL`. The derived position is still computed and stored separately for display comparison.

---

## 5. Output Data Structure per Person

```
SiblingPositionResult {
  person_id: string
  derived_position: string | null        // e.g. "ob/s"
  manual_position: string | null
  effective_position: string             // manual_position ?? derived_position
  confidence: "CONFIRMED" | "PROVISIONAL" | "INDETERMINATE" | "MANUAL"

  conflict_with_father:  ConflictResult | null
  conflict_with_mother:  ConflictResult | null
  conflict_with_partner: ConflictResult | null
}

ConflictResult {
  other_person_id: string
  other_effective_position: string
  rank_conflict: boolean
  sex_conflict: boolean | null           // null = same-sex pair
  sex_conflict_uncertain: boolean
  category: string                       // one of the category labels from §3.4
  confidence_note: string | null         // e.g. "Partner position is PROVISIONAL"
}
```

---

## 6. Edge Cases

| Scenario | Handling |
|----------|----------|
| Person has no parents recorded | No siblings determinable → `INDETERMINATE` |
| All siblings have unknown sex | Rank derivable, composition = `unknown`, sex conflict = `UNCERTAIN` |
| Half-siblings only | Compute normally; add `half_sibling_only: true` flag to result |
| Twins (same birthdate) | Cannot rank between them; flag both as `INDETERMINATE` for rank unless `birth_order_override` distinguishes them |
| Parent has no siblings in diagram and no override | `INDETERMINATE` — do not invent a position |
| Partner is same sex as Person | Compute rank conflict; suppress sex conflict with `null` |
| Person's own sex is null | Cannot derive position → `INDETERMINATE`; override selector shows all options |
| Siblings present but none have a sortable date or override | Rank is `INDETERMINATE` even if sex composition is known |

---

## 7. Constraints — What the Module Must Not Do

- Do not infer missing siblings from age gaps or family size norms
- Do not assign a default position when data is insufficient
- Do not calculate conflict when either party is `INDETERMINATE` unless that party has a manual override
- Do not apply Toman's personality or compatibility profiles — this spec covers structural position coding only
- Do not treat `siblings_complete = false` as equivalent to `siblings_complete = true` even if the diagram appears complete

---

## 8. Reference: Toman Position Codes — Quick Lookup

| Code | Description |
|------|-------------|
| ob/b | Oldest brother of brothers |
| ob/s | Oldest brother of sisters |
| ob/bs | Oldest brother of brothers and sisters |
| yb/b | Youngest brother of brothers |
| yb/s | Youngest brother of sisters |
| yb/bs | Youngest brother of brothers and sisters |
| mb/b | Middle brother of brothers |
| mb/s | Middle brother of sisters |
| mb/bs | Middle brother of brothers and sisters |
| m/oc | Male only child |
| os/s | Oldest sister of sisters |
| os/b | Oldest sister of brothers |
| os/bs | Oldest sister of brothers and sisters |
| ys/s | Youngest sister of sisters |
| ys/b | Youngest sister of brothers |
| ys/bs | Youngest sister of brothers and sisters |
| ms/s | Middle sister of sisters |
| ms/b | Middle sister of brothers |
| ms/bs | Middle sister of brothers and sisters |
| f/oc | Female only child |
