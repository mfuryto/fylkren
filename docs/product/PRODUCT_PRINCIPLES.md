# Product principles

## Purpose

Fylkren provides digital support for how a real organization receives, assesses, plans, delegates, directs, executes, follows up, reports and documents assignments. It must work for small organizations as well as large, hierarchical or temporary structures.

The product has an operational focus and is particularly relevant to organizations with clear tasking and reporting lines. Preparedness, defence, police and civil-protection organizations are examples, but the same model also applies to other public, private and voluntary organizations. Relevance does not imply certification for safety-critical use.

## Governing principles

1. **The organization comes before the tool.** The system adapts to real structures, roles and working practices. Absence, personnel changes or slow central identity administration must not stop the work.
2. **Mission command rather than micromanagement.** Superior levels communicate assignments and constraints; subordinate levels decide local execution and report consolidated status upward.
3. **Keep simple work simple.** A primary task may stand alone. Subtasks, deliverables, decisions and process templates are used only when they add value.
4. **Templates suggest; live work decides.** Workflows may evolve during execution without rewriting history.
5. **API-first with server-owned business rules.** Clients use explicit APIs. Authorization, valid transitions and audit events are enforced by the backend.
6. **History and traceability by default.** Events remain understandable over time while lawful sanitization and removal of user content remain possible.
7. **Offline operation is a baseline requirement.** Core functionality, language resources, authentication options, operations and updates must work without internet access.
8. **One codebase across deployment sizes.** The current product does not maintain a separate enterprise codebase.
9. **Modular and developer-friendly.** Architecture, APIs and adapter boundaries support continued work on identity, integrations, reporting, workflows and UI without bypassing the core.
10. **Natural in Windows-oriented workplaces.** The web application should feel familiar in modern enterprise environments without becoming platform-dependent.
11. **White-label by design.** Controlled branding is built in without creating an unrestricted theme builder.
12. **Incremental federation without disruption.** Independent sites can be attached, moved and detached in a multi-level hierarchy after deployment. New work follows the current organization; established task chains retain their original routing and reporting links.

## A defining strength

Fylkren does not require the whole organization to adopt the platform at once or to know the final organization chart in advance. A site can begin independently, later join a parent, acquire child sites, move to another branch or become independent again without moving its local users, roles, workflows or history.

Organizational changes control where new work is routed but never rewrite the return path of work already sent. Tasks preserve immutable snapshots of their type, source type, sender, sending site and registering person. The receiver's local registries remain unchanged, and final reports return through durable task links one level at a time.

## Continuous operational learning

Learning follows status in the operational chain and feeds forward into subsequent work: **priority → delegation → status → learning → …**. Positive practices and shortcomings become internal, assignment-linked observations that people discuss, prioritize and treat with actions, deadlines and recorded outcomes. This feedback is part of operational work, not only administration. Learning stays at the reporting level and remains separate from official reports sent upwards. Closing an assignment or a point preserves experience for future assessment, plans and execution.

## Deliberate boundaries

- Fylkren is not a document archive; it stores references while final documents may remain outside the platform.
- It is not a complete BPM or general process engine.
- It is not a records-management or legal-compliance suite.
- Classification is information marking, not an authorization system.
- It is not intended to become a large general BI platform.
- It does not adopt microservices without a demonstrated need.
- Percentage completion is not the default management signal; status, deadline, blocking and attention requirements are more honest indicators.
