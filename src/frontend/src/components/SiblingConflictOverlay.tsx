/**
 * SiblingConflictOverlay — Konva overlay per person when "Sibling Conflicts" is on.
 *
 * Parent indicators radiate diagonally from top-centre at 45°:
 *     • Upper-left  → father
 *     • Upper-right → mother
 * Partner indicator: horizontal lines from the side facing the partner.
 *
 * Each indicator = two parallel segments:
 *   1. Rank compatibility  — green (no conflict) | red (conflict) | gray dashed (unknown)
 *   2. Sex  compatibility  — same colour scheme; same-sex pair = green (N/A)
 *
 * Position code and maturity level are always shown in PersonNode, not here.
 */
import { Group, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Person, Partnership } from '../types';
import { deriveSiblingPositionResult, partnerForPerson } from '../utils/siblingPosition';
import type { ConflictResult } from '../utils/siblingPosition';

export interface SiblingConflictHoverInfo {
  personId: string;
  role: 'father' | 'mother' | 'partner';
  lineType: 'rank' | 'sex';
  x: number;
  y: number;
  conflict: ConflictResult | null;
}

export interface SiblingConflictClickInfo {
  personId: string;
  role: 'father' | 'mother' | 'partner';
  conflict: ConflictResult | null;
}

interface Props {
  person: Person;
  people: Person[];
  partnerships: Partnership[];
  onHover?: (info: SiblingConflictHoverInfo) => void;
  onHoverLeave?: () => void;
  onLineClick?: (info: SiblingConflictClickInfo) => void;
}

const SQ2 = Math.SQRT1_2;

// Parent diagonal segments (parallel, offset perpendicular to direction)
const PARENT_START_GAP = 4;
const PARENT_SEG_LEN   = 28;
const PARENT_PERP_SEP  = 5;   // perpendicular gap between rank and sex lines
const PARENT_STROKE    = 3.5;
const HIT_STROKE       = 14;  // wider hit area for easier interaction

// Partner horizontal segments (parallel, stacked vertically)
const PARTNER_START_GAP = 5;
const PARTNER_SEG_LEN   = 28;
const PARTNER_VERT_SEP  = 5;
const PARTNER_STROKE    = 3.5;

function conflictColor(conflict: boolean): string {
  return conflict ? '#e53935' : '#43a047';
}

// ── Parent indicators (diagonal from top-centre) ─────────────────────────────

interface ParentIndicatorsProps {
  topX: number;
  topY: number;
  dx: number;  // unit direction x
  dy: number;  // unit direction y
  conflict: ConflictResult | null;
  keyBase: string;
  onHover?: (lineType: 'rank' | 'sex', x: number, y: number) => void;
  onHoverLeave?: () => void;
  onClick?: () => void;
}

function ParentIndicators({ topX, topY, dx, dy, conflict, keyBase, onHover, onHoverLeave, onClick }: ParentIndicatorsProps) {
  // Perpendicular unit vector (rotate direction 90° CCW): (-dy, dx)
  const px = -dy;
  const py = dx;

  // Both lines go the same distance; offset perpendicular by ±PARENT_PERP_SEP/2
  const half = PARENT_PERP_SEP / 2;
  const d = PARENT_START_GAP;
  const len = PARENT_SEG_LEN;

  // Rank line: offset +half perp
  const rank = [
    topX + dx * d + px * half,
    topY + dy * d + py * half,
    topX + dx * (d + len) + px * half,
    topY + dy * (d + len) + py * half,
  ];
  // Sex line: offset -half perp
  const sex = [
    topX + dx * d - px * half,
    topY + dy * d - py * half,
    topX + dx * (d + len) - px * half,
    topY + dy * (d + len) - py * half,
  ];

  const rankUnknown = conflict === null;
  const sexUnknown  = conflict === null || conflict.sex_conflict_uncertain;
  const sexColor = sexUnknown
    ? '#bdbdbd'
    : conflict!.sex_conflict === null
    ? '#43a047'  // N/A for same-sex pair = no conflict
    : conflictColor(conflict!.sex_conflict);

  const handleMouseEnter = (lineType: 'rank' | 'sex') => (e: KonvaEventObject<MouseEvent>) => {
    onHover?.(lineType, e.evt.clientX, e.evt.clientY);
  };

  return (
    <>
      <Line key={`${keyBase}-rank`} points={rank}
        stroke={rankUnknown ? '#bdbdbd' : conflictColor(conflict!.rank_conflict)}
        strokeWidth={PARENT_STROKE} lineCap="round"
        hitStrokeWidth={HIT_STROKE}
        dash={rankUnknown ? [4, 3] : undefined}
        onMouseEnter={onHover ? handleMouseEnter('rank') : undefined}
        onMouseLeave={onHoverLeave}
        onClick={onClick}
      />
      <Line key={`${keyBase}-sex`} points={sex}
        stroke={sexColor}
        strokeWidth={PARENT_STROKE} lineCap="round"
        hitStrokeWidth={HIT_STROKE}
        dash={sexUnknown ? [4, 3] : undefined}
        onMouseEnter={onHover ? handleMouseEnter('sex') : undefined}
        onMouseLeave={onHoverLeave}
        onClick={onClick}
      />
    </>
  );
}

// ── Partner indicators (horizontal from left or right edge) ──────────────────

interface PartnerIndicatorsProps {
  edgeX: number;   // x of the person's edge on the partner's side
  centreY: number;
  dir: 1 | -1;    // 1 = rightward, -1 = leftward
  conflict: ConflictResult | null;
  keyBase: string;
  onHover?: (lineType: 'rank' | 'sex', x: number, y: number) => void;
  onHoverLeave?: () => void;
  onClick?: () => void;
}

function PartnerIndicators({ edgeX, centreY, dir, conflict, keyBase, onHover, onHoverLeave, onClick }: PartnerIndicatorsProps) {
  const x1 = edgeX + dir * PARTNER_START_GAP;
  const x2 = edgeX + dir * (PARTNER_START_GAP + PARTNER_SEG_LEN);

  const rankY = centreY - PARTNER_VERT_SEP;
  const sexY  = centreY + PARTNER_VERT_SEP;

  const rankUnknown = conflict === null;
  const sexUnknown  = conflict === null || conflict.sex_conflict_uncertain;
  const sexColor = sexUnknown
    ? '#bdbdbd'
    : conflict!.sex_conflict === null
    ? '#43a047'  // N/A for same-sex pair = no conflict
    : conflictColor(conflict!.sex_conflict);

  const handleMouseEnter = (lineType: 'rank' | 'sex') => (e: KonvaEventObject<MouseEvent>) => {
    onHover?.(lineType, e.evt.clientX, e.evt.clientY);
  };

  return (
    <>
      <Line key={`${keyBase}-rank`} points={[x1, rankY, x2, rankY]}
        stroke={rankUnknown ? '#bdbdbd' : conflictColor(conflict!.rank_conflict)}
        strokeWidth={PARTNER_STROKE} lineCap="round"
        hitStrokeWidth={HIT_STROKE}
        dash={rankUnknown ? [4, 3] : undefined}
        onMouseEnter={onHover ? handleMouseEnter('rank') : undefined}
        onMouseLeave={onHoverLeave}
        onClick={onClick}
      />
      <Line key={`${keyBase}-sex`} points={[x1, sexY, x2, sexY]}
        stroke={sexColor}
        strokeWidth={PARTNER_STROKE} lineCap="round"
        hitStrokeWidth={HIT_STROKE}
        dash={sexUnknown ? [4, 3] : undefined}
        onMouseEnter={onHover ? handleMouseEnter('sex') : undefined}
        onMouseLeave={onHoverLeave}
        onClick={onClick}
      />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SiblingConflictOverlay = ({ person, people, partnerships, onHover, onHoverLeave, onLineClick }: Props) => {
  const result  = deriveSiblingPositionResult({ person, people, partnerships });
  const partner = partnerForPerson(person, people, partnerships);

  const halfExtent  = (person.size ?? 60) / 2;
  const topX = person.x;
  const topY = person.y - halfExtent;
  const cy   = person.y;

  const partnerDir: 1 | -1 = partner && partner.x < person.x ? -1 : 1;
  const partnerEdgeX = person.x + partnerDir * halfExtent;

  const makeHover = (role: 'father' | 'mother' | 'partner', conflict: ConflictResult | null) =>
    onHover
      ? (lineType: 'rank' | 'sex', x: number, y: number) =>
          onHover({ personId: person.id, role, lineType, x, y, conflict })
      : undefined;

  const makeClick = (role: 'father' | 'mother' | 'partner', conflict: ConflictResult | null) =>
    onLineClick
      ? () => onLineClick({ personId: person.id, role, conflict })
      : undefined;

  return (
    <Group listening={!!(onHover || onLineClick)}>
      {/* Father — 45° upper-left from top-centre */}
      <ParentIndicators
        topX={topX} topY={topY}
        dx={-SQ2} dy={-SQ2}
        conflict={result.conflict_with_father}
        keyBase={`${person.id}-father`}
        onHover={makeHover('father', result.conflict_with_father)}
        onHoverLeave={onHoverLeave}
        onClick={makeClick('father', result.conflict_with_father)}
      />
      {/* Mother — 45° upper-right from top-centre */}
      <ParentIndicators
        topX={topX} topY={topY}
        dx={SQ2} dy={-SQ2}
        conflict={result.conflict_with_mother}
        keyBase={`${person.id}-mother`}
        onHover={makeHover('mother', result.conflict_with_mother)}
        onHoverLeave={onHoverLeave}
        onClick={makeClick('mother', result.conflict_with_mother)}
      />
      {/* Partner — horizontal from the side facing the partner */}
      {result.conflict_with_partner !== null && (
        <PartnerIndicators
          edgeX={partnerEdgeX}
          centreY={cy}
          dir={partnerDir}
          conflict={result.conflict_with_partner}
          keyBase={`${person.id}-partner`}
          onHover={makeHover('partner', result.conflict_with_partner)}
          onHoverLeave={onHoverLeave}
          onClick={makeClick('partner', result.conflict_with_partner)}
        />
      )}
    </Group>
  );
};

export default SiblingConflictOverlay;
