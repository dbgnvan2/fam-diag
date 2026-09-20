# Spec coverage — docs/implementation_plan_2026-09-19.md

Generated after implementation. Every acceptance criterion is verified by the named test,
except `M5.A.3`, which was flagged during planning as not code-testable and is covered by a
human-review step instead.

| Criterion | Test | File |
|---|---|---|
| M1.A.1 | `test_m1a1_returns_root_only_for_zero_up_zero_down` | `utils/familyScope.test.ts` |
| M1.A.2 | `test_m1a2_two_up_includes_grandparents_excludes_great_grandparents` | `utils/familyScope.test.ts` |
| M1.A.3 | `test_m1a3_two_down_includes_grandchildren_excludes_great_grandchildren` | `utils/familyScope.test.ts` |
| M1.A.4 | `test_m1a4_includes_child_spouse_but_not_spouse_parents` | `utils/familyScope.test.ts` |
| M1.A.5 | `test_m1a5_partner_foo_toggle_includes_partner_parents` | `utils/familyScope.test.ts` |
| M1.A.6 | `test_m1a6_collaterals_off_excludes_siblings_aunts_cousins` | `utils/familyScope.test.ts` |
| M1.A.6 | `test_m1a6_collaterals_on_includes_siblings_aunts_cousins` | `utils/familyScope.test.ts` |
| M1.A.7 | `test_m1a7_grandparent_sibling_excluded_at_two_up` | `utils/familyScope.test.ts` |
| M1.A.8 | `test_m1a8_adopted_person_traverses_both_parent_partnerships` | `utils/familyScope.test.ts` |
| M1.A.9 | `test_m1a9_cyclic_parent_chain_terminates` | `utils/familyScope.test.ts` |
| M1.A.10 | `test_m1a10_partnership_requires_both_partners_in_scope` | `utils/familyScope.test.ts` |
| M1.A.11 | `test_m1a11_isolated_root_returns_single_person` | `utils/familyScope.test.ts` |
| M1.A.11 | `test_m1a11_unknown_root_returns_empty_scope` | `utils/familyScope.test.ts` |
| M1.A.12 | `test_m1a12_counts_hidden_lines_triangles_and_boundary_events` | `utils/familyScope.test.ts` |
| M1.A.12 | `test_m1a12_null_scope_reports_everything_visible` | `utils/familyScope.test.ts` |
| M1.A.13 | `test_m1a13_dixie_depth_is_finite` | `utils/familyScope.fixture.test.ts` |
| M1.A.13 | `test_m1a13_dixie_three_generations_scope_is_subset` | `utils/familyScope.fixture.test.ts` |
| M1.A.13 | `test_m1a13_dixie_two_up_reaches_grandparents` | `utils/familyScope.fixture.test.ts` |
| M2.A.1 | `test_m2a1_default_focus_is_two_up_two_down_with_collaterals` | `hooks/useFamilyScope.test.ts` |
| M2.A.1 | `test_m2a1_root_person_is_exposed_for_the_chip_label` | `hooks/useFamilyScope.test.ts` |
| M2.A.2 | `test_m2a2_reports_real_ancestor_and_descendant_depth` | `utils/familyScope.test.ts` |
| M2.A.2 | `test_m2a2_steppers_are_noops_without_a_focus` | `hooks/useFamilyScope.test.ts` |
| M2.A.2 | `test_m2a2_steppers_clamp_at_zero_and_max_depth` | `hooks/useFamilyScope.test.ts` |
| M2.A.3 | `test_m2a3_clear_focus_restores_all_visibility` | `hooks/useFamilyScope.test.ts` |
| M2.A.3 | `test_m2a3_exclusions_report_counts_while_focused` | `hooks/useFamilyScope.test.ts` |
| M2.A.4 | `test_m2a4_no_scope_leaves_the_year_slider_in_sole_charge` | `utils/familyScope.test.ts` |
| M2.A.4 | `test_m2a4_no_year_cutoff_leaves_the_scope_in_sole_charge` | `utils/familyScope.test.ts` |
| M2.A.4 | `test_m2a4_scope_and_year_slider_and_together` | `utils/familyScope.test.ts` |
| M2.A.5 | `test_m2a5_focus_prunes_hidden_selection` | `utils/familyScope.test.ts` |
| M2.A.5 | `test_m2a5_keeps_a_selection_that_is_entirely_in_scope` | `utils/familyScope.test.ts` |
| M2.A.5 | `test_m2a5_no_scope_leaves_the_selection_untouched` | `utils/familyScope.test.ts` |
| M2.A.6 | `test_m2a6_focus_cycle_leaves_data_unmutated` | `utils/familyScope.test.ts` |
| M2.A.7 | `test_m2a7_focus_never_moves_a_person` | `utils/familyScope.persistence.test.ts` |
| M3.A.1 | `test_m3a1_focus_family_offers_a_lineal_only_variant` | `hooks/useContextMenuHandlers.familyScope.test.ts` |
| M3.A.1 | `test_m3a1_person_menu_has_focus_family_submenu` | `hooks/useContextMenuHandlers.familyScope.test.ts` |
| M3.A.2 | `test_m3a2_center_control_is_optional` | `components/FamilyScopeChip.test.tsx` |
| M3.A.2 | `test_m3a2_clear_button_calls_clear_focus` | `components/FamilyScopeChip.test.tsx` |
| M3.A.2 | `test_m3a2_hidden_when_no_focus` | `components/FamilyScopeChip.test.tsx` |
| M3.A.2 | `test_m3a2_renders_root_name_counts_and_steppers` | `components/FamilyScopeChip.test.tsx` |
| M3.A.2 | `test_m3a2_steppers_call_adjust_with_signed_delta` | `components/FamilyScopeChip.test.tsx` |
| M3.A.2 | `test_m3a2_steppers_disable_at_the_depth_limits` | `components/FamilyScopeChip.test.tsx` |
| M3.A.3 | `test_m3a3_reports_boundary_exclusions_when_nonzero` | `components/FamilyScopeChip.test.tsx` |
| M3.A.3 | `test_m3a3_reports_nothing_when_no_exclusions` | `components/FamilyScopeChip.test.tsx` |
| M3.A.4 | `test_m3a4_steppers_respond_to_keyboard` | `components/FamilyScopeChip.test.tsx` |
| M4.A.1 | `test_m4a1_explicit_person_selection_wins_over_scope` | `utils/familyScope.test.ts` |
| M4.A.1 | `test_m4a1_lanes_sorted_by_generation_then_birthdate` | `utils/familyScope.test.ts` |
| M4.A.1 | `test_m4a1_no_scope_and_no_selection_yields_no_person_lanes` | `utils/familyScope.test.ts` |
| M4.A.1 | `test_m4a1_scope_drives_lanes_when_no_person_selected` | `utils/familyScope.test.ts` |
| M4.A.2 | `test_m4a2_all_three_timeline_entry_points_use_scope` | `hooks/useContextMenuHandlers.familyScope.test.ts` |
| M4.A.2 | `test_m4a2_editor_passes_the_derivation_into_the_context_menu_hook` | `hooks/useContextMenuHandlers.familyScope.test.ts` |
| M4.A.2 | `test_m4a2_family_lane_ids_also_come_from_the_derivation` | `hooks/useContextMenuHandlers.familyScope.test.ts` |
| M5.A.1 | `test_m5a1_focus_absent_from_saved_json` | `utils/familyScope.persistence.test.ts` |
| M5.A.2 | `test_m5a2_autosave_payload_unchanged_under_focus` | `utils/familyScope.persistence.test.ts` |
| M5.A.2 | `test_m5a2_scope_returns_ids_not_entity_references` | `utils/familyScope.persistence.test.ts` |
| M7.A.1 | `test_m7a1_birth_and_death_still_render_once` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.A.1 | `test_m7a1_person_lane_shows_own_marriage_without_family_lane` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.A.1 | `test_m7a1_person_lane_shows_separation_and_divorce` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.A.2 | `test_m7a2_own_family_and_triangle_events_on_person_lane` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.A.3 | `test_m7a3_timeline_imports_shared_synthesizer` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.B.1 | `test_m7b1_indicator_with_backing_event_is_not_duplicated` | `utils/syntheticDateEvents.test.ts` |
| M7.B.1 | `test_m7b1_indicator_without_date_is_skipped` | `utils/syntheticDateEvents.test.ts` |
| M7.B.1 | `test_m7b1_indicator_without_event_becomes_symptom_event` | `utils/syntheticDateEvents.test.ts` |
| M7.B.1 | `test_m7b1_past_indicator_is_marked_ended` | `utils/syntheticDateEvents.test.ts` |
| M7.B.1 | `test_m7b1_unknown_definition_falls_back_to_a_generic_label` | `utils/syntheticDateEvents.test.ts` |
| M7.C.1 | `test_m7c1_reports_how_many_relatives_contributed` | `utils/systemEvents.test.ts` |
| M7.C.1 | `test_m7c1_returns_relation_class_and_label_per_event` | `utils/systemEvents.test.ts` |
| M7.C.2 | `test_m7c2_ring_follows_active_canvas_scope` | `utils/systemEvents.test.ts` |
| M7.C.2 | `test_m7c2_ring_uses_defaults_when_no_focus_active` | `utils/systemEvents.test.ts` |
| M7.C.3 | `test_m7c3_labels_father_death_and_parents_divorce` | `utils/systemEvents.test.ts` |
| M7.C.3 | `test_m7c3_unknown_sex_falls_back_to_neutral_label` | `utils/systemEvents.test.ts` |
| M7.C.4 | `test_m7c4_emotional_pattern_between_relatives_is_collected` | `utils/systemEvents.test.ts` |
| M7.C.4 | `test_m7c4_indicator_without_backing_event_reaches_lane` | `utils/systemEvents.test.ts` |
| M7.C.4 | `test_m7c4_relative_symptom_event_reaches_lane` | `utils/systemEvents.test.ts` |
| M7.C.5 | `test_m7c5_own_partnership_marriage_is_collected` | `utils/systemEvents.test.ts` |
| M7.C.5 | `test_m7c5_parental_family_events_collected` | `utils/systemEvents.test.ts` |
| M7.C.6 | `test_m7c6_partnership_clone_p1_p2_not_duplicated` | `utils/systemEvents.test.ts` |
| M7.C.6 | `test_m7c6_same_event_from_two_relations_appears_once` | `utils/systemEvents.test.ts` |
| M7.D.1 | `test_m7d1_event_after_death_excluded` | `utils/systemEvents.test.ts` |
| M7.D.1 | `test_m7d1_grandparent_death_before_birth_excluded` | `utils/systemEvents.test.ts` |
| M7.D.1 | `test_m7d1_span_starting_before_birth_ending_after_is_kept` | `utils/systemEvents.test.ts` |
| M7.D.2 | `test_m7d2_grandparents_marriage_is_not_exempt` | `utils/systemEvents.test.ts` |
| M7.D.2 | `test_m7d2_parents_marriage_kept_although_before_birth` | `utils/systemEvents.test.ts` |
| M7.D.3 | `test_m7d3_no_birthdate_disables_lower_bound_and_flags_it` | `utils/systemEvents.test.ts` |
| M7.E.1 | `test_m7e1_lane_count_is_reported_without_truncation` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.E.1 | `test_m7e1_system_event_renders_on_person_lane_with_relation_label` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.E.2 | `test_m7e2_relative_count_counts_people_not_owner_entities` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.E.2 | `test_m7e2_reports_no_birthdate_caveat` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.E.2 | `test_m7e2_toggle_off_hides_system_events_and_updates_count` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.E.3 | `test_m7e3_click_opens_event_on_owning_entity` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |
| M7.F.1 | `test_m7f1_events_tab_lists_parents_divorce` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.F.1 | `test_m7f1_no_system_section_without_a_scope` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.F.1 | `test_m7f1_reports_how_many_relatives_contributed` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.F.2 | `test_m7f2_opening_a_system_event_targets_its_owner` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.F.2 | `test_m7f2_own_event_card_still_editable` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.F.2 | `test_m7f2_system_event_card_is_readonly_on_person` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.F.3 | `test_m7f3_deleting_owner_event_clears_it_from_relative_view` | `components/PropertiesPanel.systemEvents.test.tsx` |
| M7.G.1 | `test_m7g1_system_events_are_read_only_projection` | `utils/systemEvents.test.ts` |
| M7.G.2 | `test_m7g2_toggle_cycle_leaves_own_events_unchanged` | `components/modals/TimelineBoardModal.systemEvents.test.tsx` |

**98 tests covering 49 criteria: M1.A.1, M1.A.2, M1.A.3, M1.A.4, M1.A.5, M1.A.6, M1.A.7, M1.A.8, M1.A.9, M1.A.10, M1.A.11, M1.A.12, M1.A.13, M2.A.1, M2.A.2, M2.A.3, M2.A.4, M2.A.5, M2.A.6, M2.A.7, M3.A.1, M3.A.2, M3.A.3, M3.A.4, M4.A.1, M4.A.2, M5.A.1, M5.A.2, M7.A.1, M7.A.2, M7.A.3, M7.B.1, M7.C.1, M7.C.2, M7.C.3, M7.C.4, M7.C.5, M7.C.6, M7.D.1, M7.D.2, M7.D.3, M7.E.1, M7.E.2, M7.E.3, M7.F.1, M7.F.2, M7.F.3, M7.G.1, M7.G.2.**

## Not code-testable

| Criterion | Why | Where it is checked |
|---|---|---|
| M5.A.3 | PNG/SVG export renders the Konva stage through `toDataURL()`; asserting pixel content in jsdom is not feasible | `manual_testing_guide.md` § 7, step 1 |

## Documentation criteria

| Criterion | Artifact |
|---|---|
| M6.A.1 | `docs/features.md` § Family focus, § System events |
| M6.A.2 | `manual_testing_guide.md` § 7 |
| M6.A.3 | `src/frontend/src/data/version.ts` |
| M6.A.4 | this file |
