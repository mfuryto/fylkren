# Enterprise AI assistance

## Purpose and supported first slice

Fylkren provides optional, bounded AI assistance as an Enterprise capability. It is disabled by default and the rest of Fylkren remains fully operational without a model or network connection. Platform Manager configures one OpenAI-compatible chat-completions endpoint, model and optional protected API key, selects the Sites allowed to use it, and enables any of four functions:

- summary and quality checks;
- planning, risk and decision drafts;
- analysis of learning points;
- questions about one work item.

The first slice is available from an open task. It returns text for human review and does not persist that text as domain content, change status, approve work, close risk, publish a plan, send a request or alter access. Later write assistance must use the existing authorized domain APIs and preserve their human approval boundaries.

## Architecture and data flow

`POST /api/ai/sites/{siteId}/work-items/{itemId}/assist` is the sole operational entry point. The API verifies the Enterprise `ai-assistance` entitlement, global enablement, explicit Site selection, browser antiforgery token, rate limit and the caller's ordinary work visibility before assembling context. Learning content is filtered again through the existing exact-level learning policy. The web client supplies its active supported locale, and the API repeats the required output language in both the trusted system instruction and after the untrusted context; older clients fall back to the installation language. The model never receives database access, a Fylkren credential, a tool interface or authority to choose another endpoint.

The configured endpoint must be an absolute HTTPS chat-completions address. Redirects and oversized responses are rejected. The provider request is non-streaming, contains no tools, permits at most 1,400 output tokens and has a 300-second deadline. Fylkren appends the Qwen-compatible `/no_think` switch to the user message so the bounded completion budget produces visible answer text instead of provider reasoning. Providers that do not implement the switch receive it as an ordinary instruction to return only the answer. Provider `429` responses are returned without an automatic duplicate request and preserve a bounded numeric `Retry-After` value when supplied. The existing outbound destination policy blocks prohibited addresses; a private/local model endpoint additionally requires an exact deployment-owned origin in `FYLKREN_OUTBOUND_PRIVATE_ORIGINS`. This supports an air-gapped local model over customer-controlled HTTPS without weakening the common outbound boundary.

The provider key is protected with the installation's ASP.NET Data Protection key ring, is never returned to the browser, and participates in the governed protected-value re-protection process. Configuration changes, connection tests and assistance requests are recorded in the existing security audit. Prompt and response bodies are not written to audit or activity history. No domain activity is created because generating an uncommitted suggestion is not a domain event.

## Trust and security boundaries

Work text is untrusted model input. The server system instruction tells the model to treat it as data, use only supplied facts, identify unsupported assumptions and never claim a Fylkren change. There is no model-controlled tool call, URL retrieval or permission choice. Requests and responses are bounded, and each response states the source work item's update time so users can detect stale output.

Selecting an external provider is a customer data-processing decision. The customer must assess the provider, contract, processing region, retention/training policy and the information classifications permitted to leave the installation. Fylkren's Site selection is a technical disclosure boundary; it does not replace that assessment. For restricted or air-gapped use, configure a locally operated compatible endpoint.

AI output is advisory. It may be incomplete or wrong. A human remains responsible for every decision, risk score, measure, plan, report and lifecycle action. Fylkren must not use this capability for identity decisions, authorization, security classification, personnel scoring, final approval, deletion or autonomous cross-Site/federated routing.

## Administration

Open **Platform Manager → AI**. Enter the full provider endpoint and model name, add the provider key when required, choose the allowed functions and Sites, then save and test the stored connection. The main switch immediately controls whether operational AI actions are available. Removing or losing the Enterprise entitlement blocks AI calls without deleting the stored setup.

For a private model, add its exact HTTPS origin (scheme, host and port, without a path) to `FYLKREN_OUTBOUND_PRIVATE_ORIGINS` in the deployment environment and restart the API after changing that deployment-owned outbound boundary. The full chat-completions path remains stored through Platform Manager.

### Local Llama example

Local Llama models are supported through a server that implements the OpenAI chat-completions contract. Ollama and vLLM both provide this interface. Fylkren does not install or operate the model runtime itself. Place the local endpoint behind customer-controlled HTTPS, make its name resolvable from the API container and approve only its exact origin. Example configuration:

```dotenv
FYLKREN_OUTBOUND_PRIVATE_ORIGINS=https://llama.internal:11443
```

Then configure Platform Manager with an endpoint such as `https://llama.internal:11443/v1/chat/completions`, the exact model name exposed by the runtime, and no API key when the protected local endpoint does not require one. The model and all disclosed task content can therefore remain inside the customer's own environment, including an air-gapped deployment.

## Requirement and verification traceability

| Requirement | Implementation | Verification evidence |
| --- | --- | --- |
| Enterprise-only and default off | `FeatureCatalog.AiAssistance`, `LicenseService`, `AiSettings.Enabled`, server endpoint filters | [`LicenseAgilityTests.cs`](../../tests/foundations/LicenseAgilityTests.cs), [`AiAssistanceTests.cs`](../../tests/foundations/AiAssistanceTests.cs), [`AiSettingsPage.test.tsx`](../../apps/web/src/platform/AiSettingsPage.test.tsx) and the Platform license-page test |
| Central Platform Manager control | `/api/platform/ai`, AI administration page, explicit Site rows and four function switches | API and web builds, generated migration/model parity, settings-page rendering and complete web test suite |
| No privileged AI bypass | `WorkItemVisibility`, `LearningPolicy`, existing antiforgery and authorization middleware | The AI endpoint calls the maintained authorization policies before context projection; the existing work-slice and learning-policy verification remains authoritative for those shared policies |
| Protected provider secret | Data Protection purpose `Fylkren.AiProviderApiKey.v1` and crypto re-protection inventory | [`AiAssistanceTests.cs`](../../tests/foundations/AiAssistanceTests.cs) verifies protected authentication and secret non-disclosure; [`CryptoReprotectionTests.cs`](../../tests/foundations/CryptoReprotectionTests.cs) verifies governed re-protection |
| Bounded provider connection | shared outbound transport, HTTPS validation, no redirects, 2 MB response, 300-second provider deadline and 330-second AI gateway margin | Provider-client test plus the maintained outbound HTTP tests for the shared destination and bounded-response controls |
| Advisory output only | read-only assistance endpoint and UI; no domain mutation or activity event | Endpoint review confirms that the only write is a security audit record; the assistant UI renders a suggestion and exposes no automatic save action |
| Clear provenance | response includes generation and source-update timestamps; audit identifies actor, Site, work item and function | API/web compilation, assistant rendering and audit construction review |

The focused implementation tests, full web suite, production web build, API build, migration/model parity, documentation links, localization structure and version checks passed on 2026-10-08. The final release candidate must still rerun the affected entitlement, outbound-connection, authorization, audit and migration checks in the maintained release environment. Existing completed ASVS evidence remains historical evidence; this new outbound and model-processing surface requires an affected-control review before release.
