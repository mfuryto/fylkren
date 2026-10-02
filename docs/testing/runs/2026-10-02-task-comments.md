# Task comments — 2026-10-02

Implementation based on `62e2cd0`, adding persistent operational comments to task cards, Planning and Execution. The maintained behavior is described in the [user manual](../../administration/USER_MANUAL.md) and [domain model](../../product/DOMAIN_MODEL.md).

## Environment and evidence

Frontend validation: Node 24, pnpm 11, Vitest; 117 tests in 35 files passed, along with workspace typechecks and production builds. API validation: .NET 10 Release build, zero warnings/errors. The isolated `fylkren-edition-e2e` Docker Compose harness provisions a disposable PostgreSQL database and Community/Enterprise fixtures. No production endpoint or production data is used.

Assertions live in `tools/e2e/task-comments.mjs`, `tools/e2e/portability.mjs` and `apps/web/src/tasks/TaskCommentsButton.test.tsx`. The API fixture creates a plain member of the task's Leadership unit without a leader role or task claim; the original responsible leader remains separate. Denied actors include a sibling-unit leader, an unrelated Site leader and a Platform Manager without operational access.

| Control | Expected and observed result | Status |
| --- | --- | --- |
| Unassigned contribution | Ordinary operational reader posts a comment and the existing leader reads it | Passed |
| Attribution and storage | Server supplies contributor ID, name snapshot and timestamp; trimmed multiline text is retained | Passed |
| Access boundaries | Sibling, unrelated Site and platform-only identities cannot list or post comments | Passed |
| Site substitution | Task ID paired with another Site cannot be read or commented on | Passed |
| Validation | Null, empty, whitespace and overlong text rejected | Passed |
| Antiforgery | Authenticated POST without token rejected | Passed |
| Pagination | 21 comments produce pages of 20 and 1, newest first, with no duplicated IDs | Passed |
| Portable export | Task comments and all referenced authors included; package remains valid | Passed |
| Safe rendered content | HTML-looking comment and author name render as escaped text, retaining line breaks | Passed |
| Compact interface | Dialog action shown without assignment and editor stays absent until opened | Passed |
| Catalog coverage | All 19 catalogs satisfy source-key, placeholder and terminology checks | Passed |

Repository structure, documentation links, language boundaries and whitespace checks also pass. The production build retains its existing bundle-size warning.

## Deviation and rerun

The first full integration run passed the comment and portability scenarios but later failed in the existing identity/session lifecycle scenario: its reset-login request returned HTTP 429 rather than 204. Additional synthetic-user authentication exhausted the shared limiter window. Both lifecycle login requests now use the existing `authenticationPost` retry helper, which waits for limiter recovery. Production authentication and rate-limit behavior were not changed. The clean full rerun exited successfully and reported `taskComments`, `portability`, identity/session lifecycle, Community/Enterprise transitions and the existing authorization regressions as passed. All disposable containers and volumes were removed.

## Limits

No new interactive-browser, notification-delivery, PDF or production checks were performed. The Compose harness validates migrations and a backup/restore of the initial database before comment fixtures are created; it does not claim restored comment-content verification. Comments do not change formal task status or approval results and do not have editing/deletion controls. Temporary local command logs are not retained release artifacts. The harness removes its disposable containers and volumes on completion.
