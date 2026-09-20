/**
 * Timeline blocks are positioned by date, so a short event is a few pixels
 * wide and any label inside it is cut to a character or two. The box carries a
 * three-letter code and the hover bubble carries the identification.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  blockShapeForPerson,
  buildTimelineHoverText,
  eventAbbreviation,
  eventDisplayName,
  intensityStyle,
  realNote,
} from './timelineItemText';
import {
  BLOCK_BORDER_RADIUS,
  INTENSITY_BORDER,
  INTENSITY_FILL,
  INTENSITY_UNRATED_BORDER,
  INTENSITY_UNRATED_FILL,
} from '../constants/timelineBlockStyle';
import { SYNTHETIC_EVENT_NOTE } from './syntheticDateEvents';

describe('eventAbbreviation', () => {
  it('test_timeline_abbreviates_the_standard_nodal_events', () => {
    expect(eventAbbreviation('Birth')).toBe('Bir');
    expect(eventAbbreviation('Death')).toBe('Dea');
    expect(eventAbbreviation('Marriage')).toBe('Mar');
    expect(eventAbbreviation('Divorce')).toBe('Div');
    expect(eventAbbreviation('Separation')).toBe('Sep');
    expect(eventAbbreviation('Adoption')).toBe('Ado');
  });

  it('test_timeline_abbreviates_on_the_first_real_word', () => {
    // "Family: Stress" must read Fam, not a punctuation fragment.
    expect(eventAbbreviation('Family: Stress')).toBe('Fam');
    expect(eventAbbreviation('Relationship Started')).toBe('Rel');
    expect(eventAbbreviation('  Triangle  ')).toBe('Tri');
  });

  it('test_timeline_short_and_missing_names_are_handled', () => {
    expect(eventAbbreviation('EA')).toBe('EA');
    expect(eventAbbreviation('')).toBe('—');
    expect(eventAbbreviation(undefined)).toBe('—');
    expect(eventAbbreviation('···')).toBe('···'.slice(0, 3));
  });
});

describe('realNote', () => {
  it('test_timeline_synthesizer_placeholder_is_not_a_note', () => {
    // It explains where the event came from; it is not something a user wrote.
    expect(realNote(SYNTHETIC_EVENT_NOTE)).toBe('');
    expect(realNote(`  ${SYNTHETIC_EVENT_NOTE}  `)).toBe('');
  });

  it('test_timeline_a_real_note_survives', () => {
    expect(realNote('Moved to Calgary')).toBe('Moved to Calgary');
    expect(realNote(undefined)).toBe('');
  });
});

describe('buildTimelineHoverText', () => {
  it('test_timeline_hover_reads_what_who_relation', () => {
    expect(
      buildTimelineHoverText({
        eventName: 'Birth',
        ownerName: 'Jim Doe',
        relation: 'Grandson',
      })
    ).toBe('Birth — Jim Doe — Grandson');
  });

  it('test_timeline_hover_drops_the_relation_for_an_own_event', () => {
    expect(
      buildTimelineHoverText({ eventName: 'Birth', ownerName: 'Emma Carter' })
    ).toBe('Birth — Emma Carter');
  });

  it('test_timeline_hover_adds_the_date_and_a_real_note_underneath', () => {
    expect(
      buildTimelineHoverText({
        eventName: 'Marriage',
        ownerName: 'Noah Reed + Emma Carter',
        dateRange: '1995-07-07',
        note: 'Small ceremony',
      })
    ).toBe('Marriage — Noah Reed + Emma Carter\n1995-07-07\nSmall ceremony');
  });

  it('test_timeline_hover_never_shows_the_synthesizer_placeholder', () => {
    const text = buildTimelineHoverText({
      eventName: 'Birth',
      ownerName: 'Jim Doe',
      relation: 'Grandson',
      note: SYNTHETIC_EVENT_NOTE,
      dateRange: '2015-04-02',
    });
    expect(text).toBe('Birth — Jim Doe — Grandson\n2015-04-02');
    expect(text).not.toContain('auto-generated');
  });

  it('test_timeline_hover_never_renders_empty_separators', () => {
    expect(buildTimelineHoverText({ eventName: 'Birth' })).toBe('Birth');
    expect(buildTimelineHoverText({ eventName: '' })).toBe('Event');
    expect(
      buildTimelineHoverText({ eventName: 'Birth', ownerName: '   ', relation: '' })
    ).toBe('Birth');
  });
});

describe('eventDisplayName', () => {
  it('test_timeline_symptom_reads_as_the_symptom_not_its_group', () => {
    // A symptom's category is its group ("physical"), which tells the reader
    // nothing; the symptom itself is on symptomType / subtype.
    expect(
      eventDisplayName({
        category: 'physical',
        eventType: 'SYMPTOM',
        symptomType: 'Anxiety',
        subtype: '',
      })
    ).toBe('Anxiety');
    expect(eventAbbreviation(
      eventDisplayName({ category: 'physical', eventType: 'SYMPTOM', symptomType: 'Anxiety' })
    )).toBe('Anx');
  });

  it('test_timeline_symptom_without_a_type_falls_back_to_its_group', () => {
    expect(
      eventDisplayName({ category: 'physical', eventType: 'SYMPTOM', symptomType: '', subtype: '' })
    ).toBe('physical');
  });

  it('test_timeline_ff_typed_symptom_still_reads_as_the_symptom', () => {
    // Real diagrams record indicator-backed symptoms as eventType 'FF' as
    // often as 'SYMPTOM'. Both carry sourceIndicatorId — that, not the type
    // tag, is what marks the event as describing a symptom.
    expect(
      eventDisplayName({
        category: 'physical',
        eventType: 'FF',
        symptomType: 'Anxiety',
        sourceIndicatorId: 'symptom-physical-default',
      })
    ).toBe('Anxiety');
    expect(
      eventDisplayName({
        category: 'emotional',
        eventType: 'FF',
        subtype: 'anxiety',
        sourceIndicatorId: 'symptom-emotional-default',
      })
    ).toBe('anxiety');
  });

  it('test_timeline_a_plain_event_keeps_its_category_over_its_subtype', () => {
    // Without a symptom marker the subtype is a qualifier, not the name:
    // a relocation is a "Relocation", not an "Interstate".
    expect(
      eventDisplayName({ category: 'Relocation', eventType: 'NODAL', subtype: 'Interstate' })
    ).toBe('Relocation');
  });

  it('test_timeline_non_symptom_events_use_their_category', () => {
    expect(eventDisplayName({ category: 'Birth', eventType: 'NODAL' })).toBe('Birth');
    expect(eventDisplayName({ category: '', eventType: 'NODAL' })).toBe('Event');
    expect(eventDisplayName({ category: '', eventType: 'NODAL' }, 'Son born')).toBe('Son born');
  });
});

describe('blockShapeForPerson', () => {
  it('test_timeline_shape_follows_the_owner_sex', () => {
    expect(blockShapeForPerson({ birthSex: 'male' })).toBe('rect');
    expect(blockShapeForPerson({ birthSex: 'female' })).toBe('oval');
    // The older single-letter gender codes are still in saved diagrams.
    expect(blockShapeForPerson({ gender: 'b' })).toBe('rect');
    expect(blockShapeForPerson({ gender: 's' })).toBe('oval');
  });

  it('test_timeline_shape_is_neutral_when_sex_is_unknown_or_absent', () => {
    expect(blockShapeForPerson({ birthSex: 'intersex' })).toBe('neutral');
    expect(blockShapeForPerson({})).toBe('neutral');
    expect(blockShapeForPerson(null)).toBe('neutral');
    expect(blockShapeForPerson(undefined)).toBe('neutral');
  });

  it('test_timeline_oval_is_a_pill_and_rect_is_square_cornered', () => {
    expect(BLOCK_BORDER_RADIUS.oval).toBe('999px');
    expect(BLOCK_BORDER_RADIUS.rect).toBe('2px');
  });
});

describe('intensityStyle', () => {
  it('test_timeline_intensity_runs_blue_to_red', () => {
    // 1 blue, 5 red, with green and orange between.
    expect(intensityStyle(1).fill).toBe(INTENSITY_FILL[1]);
    expect(intensityStyle(5).fill).toBe(INTENSITY_FILL[5]);
    const ramp = [1, 2, 3, 4, 5].map((level) => intensityStyle(level).fill);
    expect(new Set(ramp).size).toBe(5);
  });

  it('test_timeline_unrated_intensity_is_not_on_the_ramp', () => {
    // 0 means "not rated" and must not read as a rating (the repo's
    // long-standing 1-based intensity rule).
    const unrated = intensityStyle(0).fill;
    expect(unrated).toBe(INTENSITY_UNRATED_FILL);
    expect(Object.values(INTENSITY_FILL)).not.toContain(unrated);
    expect(intensityStyle(undefined).fill).toBe(unrated);
    expect(intensityStyle(null).fill).toBe(unrated);
  });

  it('test_timeline_out_of_range_intensity_falls_back_to_unrated', () => {
    expect(intensityStyle(9).fill).toBe(INTENSITY_UNRATED_FILL);
    expect(intensityStyle(-1).fill).toBe(INTENSITY_UNRATED_FILL);
  });

  it('test_timeline_each_level_has_a_matching_border', () => {
    [1, 2, 3, 4, 5].forEach((level) => {
      expect(intensityStyle(level).border).toBe(INTENSITY_BORDER[level]);
    });
    expect(intensityStyle(0).border).toBe(INTENSITY_UNRATED_BORDER);
  });
});

describe('eventDisplayName — the symptom marker cannot go stale', () => {
  it('test_timeline_producer_drops_the_indicator_link_on_a_non_symptom_save', () => {
    // PropertiesPanel.saveEvent keeps sourceIndicatorId only for SYMPTOM and
    // FF. Without that, retyping a symptom as a NODAL event left the link
    // behind and this function would name the event by its subtype.
    const source = readFileSync(
      join(__dirname, '../components/PropertiesPanel.tsx'),
      'utf8'
    );
    expect(source).toContain("normalizedType === 'SYMPTOM' || normalizedType === 'FF'");
    expect(source).not.toMatch(/\n\s*sourceIndicatorId: eventDraft\.sourceIndicatorId,/);
  });

  it('test_timeline_a_nodal_event_without_the_link_keeps_its_category', () => {
    expect(
      eventDisplayName({
        category: 'Relocation',
        eventType: 'NODAL',
        subtype: 'Interstate',
        sourceIndicatorId: undefined,
      })
    ).toBe('Relocation');
  });
});
