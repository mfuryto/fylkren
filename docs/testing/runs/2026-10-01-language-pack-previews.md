# Complete language-pack previews - 2026-10-01

Run ID: `language-pack-previews-2026-10-01`. This run records the first complete
preview catalogs produced after the English source migration gate passed.

## Scope

The run covers Swedish, Danish, Finnish, German, French, Polish, Spanish,
Italian, Ukrainian, Dutch, Portuguese, Czech, Romanian, Estonian, Latvian and
Lithuanian. Icelandic is intentionally outside the approved roster.

Every preview mirrors the `en-US` section structure and contains all 2,006
source messages. Dynamic placeholders are kept outside machine translation and
reinserted in their original order. A maintained terminology pass replaces
ambiguous short translations for primary navigation, Enterprise licensing and
sign-in/sign-out actions. Language choices are displayed by native name.

## Verification

| Control | Result |
| --- | --- |
| Exact key parity for all registered catalogs | Pass |
| Exact interpolation-placeholder parity | Pass |
| No empty translated values | Pass |
| No translation sentinels or generated outer whitespace | Pass |
| BCP 47 normalization and unsupported-region fallback | Pass |
| Date, number, plural-rule and collation construction for every locale | Pass |
| Native language names rendered by the Appearance page | Pass |
| Web typecheck, complete tests and production build | Pass |
| API build | Pass; zero warnings and zero errors |
| Repository language, documentation-link, structure and version checks | Pass |

## Acceptance boundary

The catalogs are bundled and selectable so the product owner and language
reviewers can evaluate the complete interface. They are not advertised as
publicly supported until a native-language reviewer has approved terminology,
grammar, accessibility wording, email, reports and PDF output for that locale.
Technical completeness does not replace linguistic acceptance.
