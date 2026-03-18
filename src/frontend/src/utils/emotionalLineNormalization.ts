import { nanoid } from 'nanoid';
import type { EmotionalLine, Triangle } from '../types';
import { DEFAULT_LINE_COLOR } from './emotionalPatternOptions';

export type EmotionalLineInput = Partial<EmotionalLine> & { lineStyle?: string; color?: string };
export type TriangleInput = Partial<Triangle>;

export const normalizeEmotionalLine = (line: EmotionalLineInput): EmotionalLine => {
  let normalized = { ...line } as EmotionalLine;
  if (!normalized.status) {
    normalized = { ...normalized, status: 'ongoing' };
  }
  if (normalized.relationshipType === 'distance' && normalized.lineStyle === 'cutoff') {
    normalized = { ...normalized, lineStyle: 'distance-long' };
  }
  if (normalized.relationshipType === 'cutoff' && normalized.lineStyle !== 'cutoff') {
    normalized = { ...normalized, lineStyle: 'cutoff' };
  }
  if (normalized.relationshipType === 'projection') {
    const projectionStyles: EmotionalLine['lineStyle'][] = [
      'projection-1',
      'projection-2',
      'projection-3',
      'projection-4',
      'projection-5',
    ];
    const currentStyle = normalized.lineStyle as EmotionalLine['lineStyle'];
    let nextStyle: EmotionalLine['lineStyle'] =
      projectionStyles.includes(currentStyle) ? currentStyle : 'projection-3';
    if ((normalized.lineStyle as unknown as string) === 'projection-flow') {
      nextStyle = 'projection-5';
    } else if ((normalized.lineStyle as unknown as string) === 'low') {
      nextStyle = 'projection-1';
    } else if ((normalized.lineStyle as unknown as string) === 'medium') {
      nextStyle = 'projection-3';
    } else if ((normalized.lineStyle as unknown as string) === 'high') {
      nextStyle = 'projection-5';
    }
    normalized = { ...normalized, lineStyle: nextStyle, lineEnding: 'none' };
  }
  if (normalized.relationshipType === 'distance') {
    const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
      dotted: 'distance-dotted-wide',
      dashed: 'distance-dashed-wide',
      'long-dash': 'distance-long',
    };
    const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
    if (mapped) {
      normalized = { ...normalized, lineStyle: mapped };
    }
  }
  if (normalized.relationshipType === 'conflict') {
    const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
      'dotted-saw-tooth': 'conflict-dotted-wide',
      'solid-saw-tooth': 'conflict-solid-wide',
      'double-saw-tooth': 'conflict-double',
    };
    const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
    if (mapped) {
      normalized = { ...normalized, lineStyle: mapped };
    }
  }
  if (normalized.relationshipType === 'fusion') {
    const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
      single: 'fusion-dotted-tight',
      double: 'fusion-solid-tight',
      triple: 'fusion-triple',
      low: 'fusion-dotted-tight',
      medium: 'fusion-solid-tight',
      high: 'fusion-triple',
    };
    const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
    if (mapped) {
      normalized = { ...normalized, lineStyle: mapped };
    }
  }
  if (!normalized.color) {
    normalized = { ...normalized, color: DEFAULT_LINE_COLOR };
  }
  return normalized;
};

export const normalizeEmotionalLines = (lines: EmotionalLineInput[]): EmotionalLine[] =>
  lines.map((line) => normalizeEmotionalLine(line));

export const buildDefaultTpl = (
  person1_id: string,
  person2_id: string,
  triangleColor?: string
): EmotionalLine => ({
  id: nanoid(),
  person1_id,
  person2_id,
  status: 'ongoing',
  relationshipType: 'fusion',
  lineStyle: 'fusion-dotted-wide',
  lineEnding: 'none',
  startDate: new Date().toISOString().slice(0, 10),
  color: triangleColor || DEFAULT_LINE_COLOR,
  events: [],
});

export const normalizeTriangles = (items: TriangleInput[]): Triangle[] =>
  items
    .map((item) => {
      const id = item.id || nanoid();
      const person1_id = item.person1_id || '';
      const person2_id = item.person2_id || '';
      const person3_id = item.person3_id || '';
      const pairA = [person1_id, person2_id];
      const pairB = [person2_id, person3_id];
      const pairC = [person3_id, person1_id];
      const intensity: Triangle['intensity'] =
        item.intensity === 'low' || item.intensity === 'high' ? item.intensity : 'medium';
      const existingTpls = Array.isArray(item.tpls) ? normalizeEmotionalLines(item.tpls) : [];
      const findTpl = (a: string, b: string) =>
        existingTpls.find(
          (tpl) =>
            (tpl.person1_id === a && tpl.person2_id === b) ||
            (tpl.person1_id === b && tpl.person2_id === a)
        );
      const tpls: EmotionalLine[] = [
        findTpl(pairA[0], pairA[1]) || buildDefaultTpl(pairA[0], pairA[1], item.color),
        findTpl(pairB[0], pairB[1]) || buildDefaultTpl(pairB[0], pairB[1], item.color),
        findTpl(pairC[0], pairC[1]) || buildDefaultTpl(pairC[0], pairC[1], item.color),
      ];
      return {
        id,
        person1_id,
        person2_id,
        person3_id,
        color: item.color,
        intensity,
        tpls,
      };
    })
    .filter(
      (item) =>
        !!item.person1_id &&
        !!item.person2_id &&
        !!item.person3_id &&
        item.person1_id !== item.person2_id &&
        item.person1_id !== item.person3_id &&
        item.person2_id !== item.person3_id
    );
