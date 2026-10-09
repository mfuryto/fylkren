# AI planning-template tolerance — 2026-10-09

## Scope

Focused verification of AI plan generation against varying workflow templates and common harmless JSON variations from local OpenAI-compatible models.

## Results

| Check | Result |
| --- | --- |
| Exact numbered step objects | Passed |
| Tagged step blocks with multiline Markdown | Passed |
| Step-name headings, repeated headings and model-added step-title headings removed | Passed |
| Genuine template subheadings retained | Passed |
| Numeric-string and name-based step identification | Passed |
| Ordered arrays and objects keyed by dynamic template names | Passed |
| Extra model metadata and fenced/surrounded JSON | Passed |
| Different two- and three-step templates | Passed |
| Missing steps or missing template markers | Rejected |
| API compilation | Passed with zero warnings/errors |
| Web tests and production build | Passed |

The parser tolerates representation differences but does not weaken plan placement. Every active template step must occur exactly once. The interface renders the step name, so the generated content omits a matching heading while retaining the remaining template headings and checklist markers in order. The provider prompt also receives the actual step count and a dynamic output budget so a local model is less likely to truncate a multi-step response.
