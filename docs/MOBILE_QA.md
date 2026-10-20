# Mobile UI Verification

## Search And Training Update (2026-10-20)

The current implementation supersedes the older training checks below:
training category controls appear only in Hybrid, with six groups in the
existing 3-by-2 grid. Flat has the same six isolated ingredients and individual
search, without category controls. Groups 1-3 and the single training task,
including its gold profile, are unchanged. Groups 4-6 reuse local ingredients:

| Group | Ingredient IDs |
| --- | --- |
| 1 | E322, E440 |
| 2 | E330, E331 |
| 3 | E300, E500 |
| 4 | E300, E322 |
| 5 | E330, E440 |
| 6 | E331, E500 |

No ingredient or canonical name was added. Overlaps exercise the existing
provenance model: removing a group preserves other category/manual sources;
profile removal excludes the ingredient from every active source, and re-add
restores the counts without duplicates. E300 is still outside target group 2.

The shared inline search supports explicit BHA/BHT aliases in Cyrillic and
the Russian keyboard layout. Numeric E-code queries accept optional Latin or
Cyrillic E, whitespace and a hyphen; exact numeric matches precede partial
matches. Normalization never globally converts Russian letters into Latin.

Source captions are explicit category data, shared by the pre-start heading
and the closed-by-default working disclosure. Source lists, task instructions,
gold profiles, metrics, logging, and export formats are unchanged. Both
pre-start views use the same neutral instruction about reopening the list.

Verification for this update:

- `npm run check`: secret hygiene, lint, 44 tests, type check, production build,
  and production-service isolation passed.
- Browser: 42 search cases passed across Flat and Hybrid.
- Browser: all six main scenarios in both conditions (12 submissions) retained
  their exact gold profiles and `exact_success: true`.
- Both training conditions retained `[E300, E330, E331]`, exact success, and
  `is_training: true`. Keep training attempts outside the main analysis.
- Exclusion/restoration logs for E322 retained both overlapping group sources.
- 390-by-844 viewport: the training grid has three columns/two rows, no
  horizontal overflow, and existing 44 px category controls.
- Explicit keyboard simulation: search and the matching result remain above
  the simulated keyboard, the expanded source remains open, and the footer
  returns after closure. This is not a physical Android/iOS keyboard test.
- No browser warnings/errors were observed.

Screenshots and the test-only browser export are outside Git under
`../outputs/research-search-training-20261020/`.

## Scope

This change belongs to `dev` in the standalone research repository. Publish
only a `dev` preview for a physical-phone check; do not change `main` or the
stable research deployment yet. Before pushing, verify that Vercel tracks
`main` as the production branch for `toxicheck-research-experiment`. Do not
merge an unverified interface into the stable main-study branch. The separate
ToxiCheck product repository and deployment are outside this change's scope.

Individual list items now toggle membership in the final profile. Both the
list and profile removal call the existing `removeProfileIngredient` operation.
Category exclusions, overlapping category sources, independent manual sources,
and restoration remain handled by the existing provenance model.

The normal instruction and fixed instruction are two presentations of the
same scenario. Only one is visible/accessibility-exposed at a time. Both
include the source disclosure, sharing one expanded/collapsed state. Search,
scrolling and keyboard activation do not collapse an expanded source list;
the visible copy remains interactive. The source composition is not the gold
profile.

Training is titled "Тренировочное задание" rather than the target group name.
Six isolated training groups are available only in Hybrid. Main Flat tasks
still have no category controls; main Hybrid tasks retain their existing six
choices. Training instructions, ingredients and gold profile are unchanged.

Keyboard detection combines an editable search field, touch capability, a
substantial viewport reduction, and separate opening/closing thresholds.
`visualViewport.resize` and `.scroll` account for visible height and offset;
window resize is the fallback without VisualViewport. Focus alone does not
hide the footer, and pinch zoom is not interpreted as keyboard activation.
Callbacks are batched with requestAnimationFrame and cleaned up on unmount.

Short search results require reserved page height to remain scrollable above
the keyboard. Space is reclaimed at the page top rather than forcing a scroll
reset when the keyboard closes. No nested scrolling container is introduced.

## Changed Files

- `src/research/components/ResearchIngredientOption.vue`: selected items remain
  enabled and remove themselves from the final profile on a second tap.
- `src/research/components/ResearchIngredientSearch.vue`: shared toggle wiring,
  a sticky search field below the instruction, 16 px input text to avoid iOS
  focus zoom, and one custom clear control.
- `src/research/components/ResearchTaskCard.vue`: compact normal instruction,
  compact fixed variant, closed source disclosure and 28 px source rows.
- `src/research/components/ResearchWorkspace.vue`: compact header/footer,
  shared removal logging with catalog/profile origins, viewport integration.
- `src/research/composables/useResearchViewport.ts`: UI-only viewport handling,
  keyboard heuristics, instruction position, and search visibility.
- `tests/researchProfile.test.mjs`: extra toggle/provenance regressions.
- `tests/researchViewport.test.mjs`: keyboard and short-result geometry tests.
- `tests/researchWorkspace.test.mjs`: rendered training title/group controls,
  unchanged main-condition category availability and both disclosure copies.
- `tests/fixtures/research-mobile.html`: development-only browser test harness.
- `docs/MOBILE_QA.md`: this report and physical-device checklist.

The original mobile-only pass made no changes to research data/scenarios, storage/export, session flow,
training intro views, metric formulas, profile rendering, or the main 3-by-2
category grid. Category selection now accepts Hybrid training attempts only;
Flat selection is blocked. AST comparison with `main` confirms these
workspace functions are unchanged:
`setsEqual`, `buildAttempt`, `submitTask`, `abandonTask`, `updateQuery`,
`addIngredient`, `removeCategory`.

## Checks Performed

- `npm run check`: secret/file hygiene, lint, 36 passing tests, type check,
  production build, and production-service isolation scan.
- Browser at 390 x 844: compact workspace, expanded source composition,
  scrolling, one visible instruction, fixed footer approximately 91 px high,
  primary action 48 px high.
- Simulated visual viewport reduction of 320 px: visible instruction, search,
  one result, multiple results, no results; entire footer hidden.
- Profile of eight ingredients: four matching rows remain visible together
  with the search field and instruction in the simulated keyboard viewport.
- List-based Hybrid removal: 4/4 -> 3/4; restoration: 3/4 -> 4/4; no duplicates.
- Keyboard closure preserves query, profile and measured page scroll position.
- Three rapid simulated open/close cycles preserve state and restore footer.
- 320 x 740 with simulated viewport offsetTop 80: instruction follows the
  offset, search/results are not covered, no horizontal overflow.
- Desktop 1280 x 900: focusing the search leaves the footer visible.
- Successful browser submissions for Flat T1-S1 and Hybrid T3-S2: actual
  profiles equal gold profiles and `exact_success` is true. Removal events
  identify the catalog origin and retain the existing event types.
- No browser console warnings/errors were observed during the final checks.

Screenshots and QA exports are outside Git under
`../outputs/research-mobile-20261019/`. All harness events use the test-only
participant ID `QA_MOBILE_ONLY`; never include them in participant analysis.
The fixture is not an entry point of the production build.

## Earlier Training And Source Follow-Up

- Four additional rendering regressions pass: three training groups for both
  starting conditions, the training title, main Flat without categories, main
  Hybrid with six categories, and the controlled disclosure in both copies.
- Browser training beginning in Flat: all three groups can be selected and
  removed. Group 2 plus E300 still yields `exact_success: true` with
  `actual_profile: [E300, E330, E331]` and `is_training: true`.
- Flat T1 source stays expanded before/during/after simulated keyboard use;
  closing/reopening the pinned disclosure synchronizes both copies.
- Hybrid T3 at 320 x 740 with simulated viewport offset 80: expanded source
  stays visible; the E214 result ends at 416 px, above the simulated keyboard
  edge at 420 px. No horizontal overflow was observed.
- Screenshots and test-only exports for this follow-up are outside Git under
  `../outputs/research-followup-20261020/`. Keyboard pictures are simulations,
  not screenshots of a physical Android keyboard.

## Not Yet Verified On Physical Devices

**The keyboard pictures use an explicitly labelled viewport simulation. They
are not screenshots of a real Android/iOS software keyboard.** Desktop viewport
emulation cannot establish physical-device correctness.

Before releasing a preview to study participants, check on Android Chrome:

1. Open a long T3 task and the source composition; select 4-8 ingredients.
2. Focus search and open the Russian software keyboard.
3. Search `E214`, select a result, remove it with the check mark, and re-add it.
4. Check category 4/4 -> 3/4 -> 4/4 and profile synchronization.
5. Check multiple results, no results, and repeated keyboard open/close.
6. Dismiss the keyboard with Android Back: query/profile stay intact, footer
   returns, the page does not jump to the top, and the timer keeps running.
7. Repeat in Telegram WebView and iPhone Safari when available.

Floating or overlay-only keyboards that do not produce any viewport-size
signal cannot be detected reliably by this heuristic. Without reliable signals
the footer stays visible rather than treating every desktop input focus as an
open keyboard. Physical browser/WebView behavior remains a release check.

## References

- [Chrome viewport resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior/)
- [VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
