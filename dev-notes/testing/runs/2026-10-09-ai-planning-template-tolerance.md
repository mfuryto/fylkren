# AI planning-template tolerance — 2026-10-09

## Scope

Focused verification of AI plan generation against varying workflow templates and common harmless JSON variations from local OpenAI-compatible models.

## Results

| Check | Result |
| --- | --- |
| Exact numbered step objects | Passed |
| Tagged step blocks with multiline Markdown | Passed |
| Numbered Markdown sections matching every dynamic step name | Passed |
| Step-name headings, repeated headings and model-added step-title headings removed | Passed |
| Genuine template subheadings retained | Passed |
| Numeric-string and name-based step identification | Passed |
| Ordered arrays and objects keyed by dynamic template names | Passed |
| Extra model metadata and fenced/surrounded JSON | Passed |
| Different two- and three-step templates | Passed |
| Omitted final closing tag and omitted internal headings | Accepted when every numbered step is present |
| Missing, duplicate or empty steps | Rejected |
| API compilation | Passed with zero warnings/errors |
| Web tests and production build | Passed |

The parser tolerates representation differences but does not weaken plan placement. Every active template step must occur exactly once and contain text. Internal headings are presentation structure and are therefore not used to decide which plan step owns the content. The interface renders the step name, so the generated content omits a matching heading while retaining genuine subheadings. The provider prompt also receives the actual step count and a dynamic output budget so a local model is less likely to truncate a multi-step response.
