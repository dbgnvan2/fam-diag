/**
 * Older diagrams hold a copy of each partnership status record on both
 * partners (`<id>-p1` / `<id>-p2`). The status date is shown as the
 * partnership's own date event, so the copy must not be listed beside it on
 * the person's Events tab or Timeline lane (regression: one marriage, two rows).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PropertiesPanel from './PropertiesPanel';
import TimelineBoardModal from './modals/TimelineBoardModal';
import type { EmotionalProcessEvent, Partnership, Person } from '../types';

const record: EmotionalProcessEvent = {
  id: 'rec-1',
  date: '1990-05-06',
  startDate: '1990-05-06',
  category: 'Married',
  subtype: 'Married',
  eventType: 'NODAL',
  status: 'discrete',
  intensity: 3,
  frequency: 0,
  impact: 0,
  howWell: 1,
  otherPersonName: 'B',
  primaryPersonName: 'A',
  wwwwh: '',
  observations: '',
  anchorType: 'RELATIONSHIP_PRL',
  anchorId: 'pr1',
  eventClass: 'relationship',
  createdAt: 1,
};
const personA: Person = {
  id: 'pa', name: 'A', x: 0, y: 0, birthSex: 'male', partnerships: ['pr1'],
  events: [{ ...record, id: 'rec-1-p1' }],
};
const personB: Person = {
  id: 'pb', name: 'B', x: 0, y: 0, birthSex: 'female', partnerships: ['pr1'],
  events: [{ ...record, id: 'rec-1-p2', primaryPersonName: 'B', otherPersonName: 'A' }],
};
const partnership: Partnership = {
  id: 'pr1', partner1_id: 'pa', partner2_id: 'pb', relationshipType: 'married',
  relationshipStatus: 'married', horizontalConnectorY: 0, children: [], events: [record],
  marriedStartDate: '1990-05-06', statusDates: { married: '1990-05-06' },
};

describe('legacy partner copies of status records', () => {
  it('the Events tab lists the marriage once', () => {
    render(
      <PropertiesPanel
        selectedItem={personA}
        people={[personA, personB]}
        partnerships={[partnership]}
        eventCategories={[]}
        functionalIndicatorDefinitions={[]}
        sirCategories={[]}
        functionalFactCategories={[]}
        onUpdatePerson={() => {}}
        onUpdatePartnership={() => {}}
        onUpdateEmotionalLine={() => {}}
        initialActiveTab="events"
        onClose={() => {}}
      />
    );
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it("the person's Timeline lane shows the marriage once", () => {
    render(
      <TimelineBoardModal
        people={[personA, personB]}
        partnerships={[partnership]}
        allEmotionalLines={[]}
        eventCategories={[]}
        timelineSelectionIds={['pa']}
        timelineFamilySelectionIds={[]}
        onUpdatePerson={vi.fn()}
        onUpdatePartnership={vi.fn()}
        onUpdateEmotionalLine={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const marriageBlocks = Array.from(document.querySelectorAll('[data-hover-text]')).filter((el) =>
      /marri/i.test(el.getAttribute('data-hover-text') || '')
    );
    expect(marriageBlocks).toHaveLength(1);
  });
});
