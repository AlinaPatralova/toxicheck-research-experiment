# Training Ingredients

The six training groups are practice sets, not chemical classifications.
Groups 1-3 and the single training scenario are unchanged. Groups 4-6 use
separate ingredients and have no overlap with the main scenario sets.

| Group | Ingredient 1 | Ingredient 2 |
| --- | --- | --- |
| 1 | E322: Лецитины | E440: Пектины |
| 2 | E330: Лимонная кислота | E331: Цитраты натрия |
| 3 | E300: Аскорбиновая кислота | E500: Карбонаты натрия |
| 4 | E270: Молочная кислота | E406: Агар |
| 5 | E414: Гуммиарабик | E415: Ксантановая камедь |
| 6 | E296: Яблочная кислота | E160a: Каротины |

E414 replaces the initially proposed E202 because E202 is an exclusion in
T3-S1. The training task remains group 2 plus E300, with the gold profile
`[E300, E330, E331]`. E300 is not part of group 2. Training attempts keep
`is_training: true` and must not be included in the main analysis.

## Identification Sources

The new code/name pairs were checked against the official additive lists
on 2026-10-20. These references establish identification, not a current
jurisdiction-specific permission or a safety recommendation.

| Code | Name in the official list |
| --- | --- |
| E270 | Lactic acid |
| E406 | Agar |
| E414 | Gum arabic (acacia gum) |
| E415 | Xanthan gum |
| E296 | Malic acid |
| E160a | Carotenes |

- [Commission Regulation (EU) No 1129/2011, official EUR-Lex text](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32011R1129).
- [Regulation (EC) No 1333/2008, official UK publication, 2019 consolidated text](https://www.legislation.gov.uk/eur/2008/1333/pdfs/eur_20081333_2019-10-23_en.pdf).

Russian labels use the user-provided names; the replacement E414 is labelled
Гуммиарабик, with gum arabic/acacia gum search aliases.

## Catalog Boundary

`researchIngredients` is still the original 34-item main catalog. The six
new records are separate training additions. `trainingIngredients` combines
the original six practice ingredients with these additions, giving 12 items
in both Flat and Hybrid training. Category buttons appear only in Hybrid.
The shared ingredient registry resolves every training item to its code and
name without making new items available in main tasks.

E160a retains its letter suffix and is found by `160`, `160a`, `E160a`,
`Е160a`, `E 160a`, `E-160a`, and its name. Canonical IDs are unchanged by search.

## Verification

`npm run check` passes 47 tests, lint, type check, build, secret hygiene, and
build isolation. Regressions cover exact group compositions, 12 unique
training IDs, absence of main-scenario ingredients in training, the unchanged
34-item main catalog, training gold profile, source provenance, and formatted
search for all six additions. Generic overlapping-source tests remain in
`researchProfile.test.mjs`, although the actual training groups are disjoint.
