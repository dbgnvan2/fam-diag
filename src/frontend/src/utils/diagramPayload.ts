/**
 * Purpose: build the object written to a saved diagram file, as a pure
 *          function so the "view state never persists" guarantee can be
 *          asserted against the real payload rather than against the source
 *          text of a component.
 * Spec:    docs/implementation_plan_2026-09-19.md#M5.A.1
 * Tests:   src/frontend/src/utils/diagramPayload.test.ts
 *
 * Anything absent from DiagramPayloadState cannot reach the file. The family
 * scope focus is deliberately not a member.
 */
import type {
  EmotionalLine,
  FunctionalFactCategoryDefinition,
  FunctionalIndicatorDefinition,
  NodalCategoryDefinition,
  PageNote,
  Partnership,
  Person,
  PredictionSet,
  Triangle,
} from '../types';

export type DiagramPayloadState = {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  pageNotes: PageNote[];
  triangles: Triangle[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  autoSaveMinutes: number;
  ideasText: string;
  predictionSets: PredictionSet[];
  functionalFactCategories: FunctionalFactCategoryDefinition[];
  nodalCategories: NodalCategoryDefinition[];
};

/** The keys a saved diagram file contains, in write order. */
export const DIAGRAM_PAYLOAD_KEYS = [
  'fileMeta',
  'people',
  'partnerships',
  'emotionalLines',
  'pageNotes',
  'triangles',
  'functionalIndicatorDefinitions',
  'eventCategories',
  'relationshipTypes',
  'relationshipStatuses',
  'autoSaveMinutes',
  'ideasText',
  'predictionSets',
  'functionalFactCategories',
  'nodalCategories',
] as const;

export function buildDiagramPayload(
  state: DiagramPayloadState,
  targetFileName: string,
  exportedAt: string = new Date().toISOString()
) {
  return {
    fileMeta: {
      fileName: targetFileName,
      displayName: targetFileName,
      exportedAt,
    },
    people: state.people,
    partnerships: state.partnerships,
    emotionalLines: state.emotionalLines,
    pageNotes: state.pageNotes,
    triangles: state.triangles,
    functionalIndicatorDefinitions: state.functionalIndicatorDefinitions,
    eventCategories: state.eventCategories,
    relationshipTypes: state.relationshipTypes,
    relationshipStatuses: state.relationshipStatuses,
    autoSaveMinutes: state.autoSaveMinutes,
    ideasText: state.ideasText,
    predictionSets: state.predictionSets,
    functionalFactCategories: state.functionalFactCategories,
    nodalCategories: state.nodalCategories,
  };
}
