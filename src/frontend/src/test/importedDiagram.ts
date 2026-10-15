/**
 * The diagram converters (factsToDiagramImportData, parseTranscriptToDraftDiagram)
 * always return these lists, but DiagramImportData makes them optional because
 * it also describes partial files. Tests assert them instead of casting, so a
 * converter that stops returning one fails with a clear message.
 */
import type { DiagramImportData } from '../types/diagramEditor';
import type { EmotionalLine, Partnership, Person } from '../types';

export type ConvertedDiagram = DiagramImportData & {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
};

export const requireLists = (data: DiagramImportData): ConvertedDiagram => {
  const { people, partnerships, emotionalLines } = data;
  if (!people || !partnerships || !emotionalLines) {
    throw new Error(
      `converter result is missing a list: people=${!!people} partnerships=${!!partnerships} emotionalLines=${!!emotionalLines}`
    );
  }
  return { ...data, people, partnerships, emotionalLines };
};
