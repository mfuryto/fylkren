# Primary-document import foundation — 2026-10-08

## Scope

Focused verification of the additive primary-document snapshot, passive extraction boundary, AI-context provenance, migration model and task-creation interface. This is implementation evidence for the changed surface, not a replacement release qualification.

## Results

| Check | Result |
| --- | --- |
| Strict file extension/media agreement and 8 MiB boundary | Passed |
| Bundled gateway permits 9 MiB request size for 8 MiB document plus multipart overhead | Passed by gateway source lock |
| UTF-8 text paragraph extraction and SHA-256 provenance | Passed |
| DOCX heading extraction, archive bounds and macro rejection | Passed |
| PDF text extraction and page provenance | Passed |
| Original source bytes absent from storage/download paths | Passed by focused source lock |
| Extracted plain text absent from end-user responses; structured JSON limited to the version-specific control endpoint and document managers | Passed by explicit response projection and authorization review |
| Green imported-version badge in the collapsed task header plus fixed imported/not-imported status rows in task and planning interfaces | Passed by web test and production build |
| Authorized link opens the exact structured block JSON used as AI source | Passed by API compilation and response review |
| Re-import for creator, current level manager or current claimed planner on an active task | Passed by authorization review and API compilation |
| EF migration snapshot versus current model, including source-link provenance | Passed against disposable PostgreSQL 18 |
| API compilation | Passed with zero warnings/errors |
| Web tests and production build | Passed |
| File inventory and malware-applicability locks | Passed |

The source snapshot stores extracted structured text, sanitized source name, canonical media type, digest, the task's validated original-document link, version, actor, AI-selection flag and timestamp. The source link remains visible with the imported version and in AI provenance. The newest selected version is added only after ordinary work visibility and AI Site authorization succeed. Prompts, extracted text and original bytes are not logged. Site portability includes every retained snapshot version.

Ordinary users continue to read the original document through its retained source link. The document read response exposes import metadata only; it does not expose extracted text or structured blocks. Those fields remain internal to the authorized AI context, apart from the separately authorized customer portability export.

## Remaining boundary

This slice imports a file explicitly selected by an authorized user. It does not retrieve the reference URL. A future internal connector still requires source-system user authorization, classification/disclosure policy and exact outbound controls before linked-document retrieval can be enabled.
