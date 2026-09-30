# User interface and white-label design

## Product rules

The interface is compact, professional and suitable for operational work. Complexity is disclosed progressively: a simple task remains simple, while plans, execution history, delegation and reports appear only when relevant.

The fixed product name appears only as `Fylkren (version)` in the navigation footer. Help text, empty states and functional explanations must not use product branding. Configured installation branding identifies the customer's deployment but is not used as a narrator in functional copy.

Page content must remain within the viewport. Long timelines and tables use their own bounded scrolling area; they must not create horizontal page scrolling. Top and side navigation remain stable while content scrolls.

## Overview

Overview prioritizes items requiring action, active workload, deadlines and subordinate capacity. Operational signals are visually stronger than annual statistics. Subordinate units and child sites use compact cards or a user-selected list view, with recursively aggregated workload but no leakage of internal details.

Platform Manager selects a supported overview presentation per site during site creation or editing. Presentation changes appearance only; data, authorization, profile colors and subordinate/statistics sections remain consistent. Site design must be resolved before branded content renders, so refresh or concurrent sessions never flash another site's design.

The page heading uses the site name. `Oversikt` remains the navigation label.

## Navigation and responsive layout

Desktop uses a fixed top bar and left navigation. A simple divider separates operational pages from administration without an “Administration” heading. Users see only pages they may access.

On narrow screens and low-height touch landscape, the permanent sidebar becomes a hamburger-controlled overlay. It never pushes page content downward. Background scrolling is locked while open; Escape, backdrop, close button or page selection closes it. Focus is trapped inside and restored to the trigger.

Application dialogs fit the dynamic viewport, include safe-area spacing and provide internal scrolling between a visible header and action row. Forms keep consistent spacing and sufficient text-field padding. Mobile layout must expose the full page and all dialog actions in both orientations.

The profile button opens a small menu containing Profile and Log out. Internal back/forward controls navigate application pages without relying on browser history that may leave the application.

## Lists, cards and actions

Long task, planning, execution and report queues use bounded-width list columns, newest-first ordering, search/filtering and pagination. A personal preference may switch subordinate overview content between cards and lists.

Task cards are collapsed initially. Metadata uses compact, consistently colored badges/icons. One clear control opens the content. Contextual actions are collected in one `Next step` area; completed work has no next-step area. Destructive chain cancellation remains a separate, final danger action.

Links to tasks, planning, execution and reports use compact permalink icons and language-neutral IDs. Opening a permalink selects the exact entity without changing the user's unrelated saved filter.

## Workflows and rich text

Template libraries and workflow administration use scannable lists; complete content opens in a dialog. Templates are selected while configuring a workflow, never while actively processing it.

Rich text displays headings and lists as formatted content rather than Markdown markers. Page headings remain visually dominant. Content heading sizes never fall below body text; lower levels use weight or underline where necessary. Numbered lists restart after a real break such as a new heading.

A configured timeline appears before other fields in its step. Editing uses Date and Event rows; reading uses a horizontally scaled timeline whose point spacing reflects actual elapsed time. Planning and execution share the same timeline behavior.

## White-label configuration

Platform Manager controls a limited global set:

- product and installation names;
- logo and favicon;
- light, dark or system theme;
- controlled profile and accent colors;
- top-bar background and text colors.

The default installation logo is `assets/branding/fylkren-logo-web-256.png`. Uploaded logos may be PNG, JPEG or WebP up to 2 MiB. The API verifies that MIME type matches the file signature and stores content without a client-controlled public path.
The favicon derives from this same stored logo, including the seeded default logo on the first page load. The browser renders a centered 64×64 PNG while preserving the logo's aspect ratio; replacing the logo updates the favicon without rebuilding the application. When the logo is removed, the favicon falls back to the configured product name's initial and primary color.

The light theme uses white primary surfaces, a very light page background, visible field/card boundaries and accessible contrast across different displays. Geometry is modern and restrained rather than excessively rounded.

## Localization

Repository language and UI language are separate concerns. Repository-facing content is English. English is the source catalog and mandatory fallback; Norwegian Bokmål (`nb-NO`) is a separate complete language pack. Missing keys must render the English source text, never a mixture caused by hard-coded Norwegian text. Dates, times and numbers follow the configured locale and IANA time zone, while the clock and measurement systems follow explicit platform defaults. User-generated content is not translated automatically.

Platform Manager changes the language, IANA time zone, 12/24-hour clock and metric/imperial measurement defaults under **Appearance**. The database is authoritative and changes apply without an API restart. Timestamps remain stored in UTC, and measurement preferences affect presentation rather than the meaning of stored values. All language resources ship locally for air-gapped operation. Routes, API contracts, persistent identifiers and permalinks remain language-neutral.

## Classification display

When classification marking is enabled, relevant operational text can use the configured full label and abbreviation. Organization, personnel, links and templates do not show classification controls. Reports render the report's full classification label in the header and footer of every printed/PDF page, not inside report content.
