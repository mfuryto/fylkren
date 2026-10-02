# Localization terminology

This term base is authoritative for interface translation and automated localization QA. It prevents generic translation engines from changing Fylkren product concepts into unrelated web, geographic or commercial terms.

## Reserved product terms

The following names remain unchanged in every interface language, apart from normal grammatical punctuation around them:

- `Fylkren`
- `Site`
- `Sites`
- `Site Manager`
- `Site Managers`
- `Platform Manager`
- `Community`
- `Enterprise`
- `AD`
- `LDAP`
- `OIDC`
- `SAML`
- `WebAuthn`

`Site` is Fylkren's organizational and authorization boundary. It must never be translated as website, web page, physical construction site or an Internet domain. Role names built from this term are likewise product roles, not generic website administrators.

## Context-sensitive terms

- **Task** is an operational work item, not a software background process.
- **Request** is a formal request routed inside Fylkren, not an HTTP request unless the text explicitly discusses the API.
- **Planning** and **Execution** are workflow phases.
- **Federation** is trusted instance-to-instance interoperability.
- **Identity provider** means the configured authentication authority.
- **Imperial** and **Metric** name measurement systems; `Imperial` must never be translated as an empire, emperor or royal status.
- **License** is a software entitlement unless the surrounding text explicitly identifies an external certificate or permit.
- Customer-defined classification names are data and are never translated by the interface catalog.

Security-sensitive actions must preserve their force. Delete, deactivate, revoke, reject, cancel and remove are not interchangeable. Labels use the target language's normal imperative UI form; explanatory text states the resulting effect explicitly.

## Translate the workflow meaning

Use the Norwegian catalog and the actual workflow behavior to resolve ambiguous source words. The English catalog remains the technical key and placeholder source; its individual words are not a sufficient translation specification.

| Concept | Meaning to preserve | Misinterpretations to reject |
| --- | --- | --- |
| Execution | Carrying out an operational task | Capital punishment, a computer process, or an executor role |
| Under review | Initial assessment of a received task | Already reviewed or completed |
| In review | Completed work awaiting verification | Initial intake assessment or a showcase |
| On hold | Work is paused or awaiting a dependency | Continue, stop command, or cancellation |
| Due date | Deadline for completing the task | Payment due date, event date, or expiry date |
| Withdrawn by sender | Sender has withdrawn their request | Deletion of the sender, an extract, or editing the request |
| Recorded workload | Registered operational tasks over time | Audio recording, recruitment, staffing, or available capacity |

Read the surrounding page, help text and state transitions before choosing the target-language wording. Status labels describe a state; action buttons describe an action. Keep this distinction even when English uses the same word for both. Review task assessment and completed-work verification separately.
