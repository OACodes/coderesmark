# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. Context files define what to build, how to build it, and the current state of progress. Always implement against these specs — do not infer or invent behavior from scratch. Each unit of work should be verifiable end-to-end before moving to the next.

## Scoping Rules

- Work on one feature unit at a time (one spec file = one implementation session).
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step (e.g., don't mix controller wiring + service logic + model changes in one prompt).
- If a change cannot be verified with a single `curl` command or test run, the scope is too broad — split it.

## When to Split Work

Split an implementation step if it combines:
- **Controller wiring + Service logic** — wire routes first with stub handlers, then implement service
- **Multiple unrelated API resources** — e.g., categories and bookmarks in one step
- **Database schema changes + business logic** — migrate schema first, then logic
- **Behavior not clearly defined in context files** — resolve in the relevant context file before implementing

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing.
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing.
- **Never assume**: "The user probably wants X" → stop, ask, or document as open question.

## Protected Files

Do not modify the following unless explicitly instructed:

- `node_modules/` — vendor code
- `package-lock.json` / `api/package-lock.json` — lockfiles (managed by npm)
- `.env.*.local` — secrets (gitignored, not in repo)
- `api/src/config/env.js` — only to add new exported constants with matching `.env` entries
- `api/src/models/*.js` — schema changes require explicit spec (indexes, fields, validation)
- `api/src/utils/AppError.js` — error class contract; changes affect all error handling
- Generated files (none yet — if migrations, codegen, or build artifacts appear, protect them)

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- **System architecture or boundaries** → `architecture.md`
- **Storage model decisions** (new collections, indexes, Redis keys) → `architecture.md`
- **Code conventions or standards** (new patterns, naming, response shapes) → `code-standards.md`
- **Feature scope** (in/out of scope, success criteria) → `project-overview.md`
- **Workflow rules** (new protected files, split criteria) → `ai-workflow-rules.md`
- **Progress** (completed, in-progress, next up, open questions) → `progress-tracker.md`

**Rule**: If you change code that makes a context file inaccurate, update the context file in the same session.

## Before Moving to the Next Unit

1. The current unit works end-to-end within its defined scope (manual `curl` test or automated test passes).
2. No invariant defined in `architecture.md` was violated (check: auth at mutation boundary, ownership in service, atomic dedup, system category immutable, update whitelist, AppError usage, URL canonicalization, indexes match queries).
3. `progress-tracker.md` reflects the completed work (move from "In Progress" to "Completed", update "Next Up").
4. `npm run build` passes (currently no build step — `npm run dev` starts server without error).
5. No `console.log` in production paths (controllers, services, middleware).
6. All new `AppError` codes documented in `code-standards.md` error codes table.

## Verification Checklist Per Unit

- [ ] Controller exists and uses `next(err)` for all errors
- [ ] Service exists and throws `AppError` with correct statusCode + code
- [ ] Routes mounted in `app.js` with correct prefix (`/api/v1/...`)
- [ ] Protected routes use `verifyJWT` middleware (router-level or per-route)
- [ ] Ownership checks in service (not just controller)
- [ ] Input validation at controller boundary (whitelist for updates)
- [ ] Response shape matches `{ success: true, data }` / `{ success: false, message }`
- [ ] Error codes documented in `code-standards.md`
- [ ] Manual test: `curl -X POST ...` returns expected JSON