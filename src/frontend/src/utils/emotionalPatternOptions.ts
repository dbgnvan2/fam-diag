/**
 * Emotional Pattern Line (EPL) style constants and helpers — extracted from DiagramEditor.tsx.
 * Defines the mapping between relationship types and their line style values / intensity labels.
 */

import type { EmotionalLine } from '../types';

export const DEFAULT_LINE_COLOR = '#444444';

export const LINE_STYLE_VALUES: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle'][]> = {
  fusion: [
    'fusion-dotted-wide',
    'fusion-dotted-tight',
    'fusion-solid-wide',
    'fusion-solid-tight',
    'fusion-triple',
  ],
  distance: [
    'distance-dashed-tight',
    'distance-dashed-wide',
    'distance-long',
    'distance-dotted-tight',
    'distance-dotted-wide',
  ],
  cutoff: ['cutoff'],
  conflict: [
    'conflict-dotted-wide',
    'conflict-dotted-tight',
    'conflict-solid-wide',
    'conflict-solid-tight',
    'conflict-double',
  ],
  projection: ['projection-1', 'projection-2', 'projection-3', 'projection-4', 'projection-5'],
};

export const emotionalPatternIntensityOptions = (relationshipType: EmotionalLine['relationshipType']) => {
  switch (relationshipType) {
    case 'fusion':
      return [
        { value: 'fusion-dotted-wide', label: 'Minimal' },
        { value: 'fusion-dotted-tight', label: 'Mild' },
        { value: 'fusion-solid-wide', label: 'Moderate' },
        { value: 'fusion-solid-tight', label: 'Major' },
        { value: 'fusion-triple', label: 'Severe' },
      ] as const;
    case 'distance':
      return [
        { value: 'distance-dashed-tight', label: 'Minimal' },
        { value: 'distance-dashed-wide', label: 'Mild' },
        { value: 'distance-long', label: 'Moderate' },
        { value: 'distance-dotted-tight', label: 'Major' },
        { value: 'distance-dotted-wide', label: 'Severe' },
      ] as const;
    case 'conflict':
      return [
        { value: 'conflict-dotted-wide', label: 'Minimum' },
        { value: 'conflict-dotted-tight', label: 'Mild' },
        { value: 'conflict-solid-wide', label: 'Moderate' },
        { value: 'conflict-solid-tight', label: 'Major' },
        { value: 'conflict-double', label: 'Maximal' },
      ] as const;
    case 'projection':
      return [
        { value: 'projection-1', label: 'Minimal' },
        { value: 'projection-2', label: 'Mild' },
        { value: 'projection-3', label: 'Moderate' },
        { value: 'projection-4', label: 'Major' },
        { value: 'projection-5', label: 'Severe' },
      ] as const;
    default:
      return [{ value: 'cutoff', label: 'Cutoff' }] as const;
  }
};

export const intensityValueForLineStyle = (lineStyle: EmotionalLine['lineStyle']): number => {
  if (
    lineStyle === 'fusion-dotted-wide' ||
    lineStyle === 'distance-dashed-tight' ||
    lineStyle === 'conflict-dotted-wide' ||
    lineStyle === 'projection-1' ||
    lineStyle === 'dotted' ||
    lineStyle === 'dotted-saw-tooth'
  ) return 1;
  if (lineStyle === 'fusion-dotted-tight') return 2;
  if (
    lineStyle === 'distance-dashed-wide' ||
    lineStyle === 'conflict-dotted-tight' ||
    lineStyle === 'projection-2'
  ) return 2;
  if (
    lineStyle === 'fusion-solid-wide' ||
    lineStyle === 'distance-long' ||
    lineStyle === 'conflict-solid-wide' ||
    lineStyle === 'projection-3' ||
    lineStyle === 'dashed' ||
    lineStyle === 'solid-saw-tooth'
  ) return 3;
  if (
    lineStyle === 'fusion-solid-tight' ||
    lineStyle === 'distance-dotted-tight' ||
    lineStyle === 'conflict-solid-tight' ||
    lineStyle === 'projection-4'
  ) return 4;
  if (
    lineStyle === 'fusion-triple' ||
    lineStyle === 'distance-dotted-wide' ||
    lineStyle === 'conflict-double' ||
    lineStyle === 'projection-5' ||
    lineStyle === 'long-dash' ||
    lineStyle === 'double-saw-tooth'
  ) return 5;
  if (lineStyle === 'low') return 1;
  if (lineStyle === 'medium') return 3;
  if (lineStyle === 'high') return 5;
  return 0;
};
