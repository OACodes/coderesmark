# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Backend API: Core services complete, controllers/routes partially wired
- Frontend (Browser Extension): Not started

## Current Goal

- **Unit 1**: Wire bookmark controller + routes (connect service to HTTP layer)
  - Implement bookmark controller: getAll, create, search, update, delete (file is empty)
  - Wire bookmark routes with controller methods + verifyJWT middleware (stubs only)
  - Mount bookmark router in app.js (not mounted)
  - Manual curl verification of all 5 endpoints

## Completed

- [x] Project scaffold: Express + Mongoose + Redis + JWT + bcrypt
- [x] Environment config: dotenv with `.env.{NODE_ENV}.local` loading
- [x] Database connection with auto-seed of system "Uncategorized" category
- [x] User model: username, email, passwordHash, settings (defaultView, autoClassify)
- [x] Category model: userId, name, icon, color, isSystem + indexes
- [x] Bookmark model: userId, url, urlHash (unique per user), title, favicon, category, tags, aiMetadata, status + compound index (userId, status) + text index
- [x] AppError class: operational errors with statusCode + code
- [x] URL normalization: canonical form, blocks dangerous schemes, strips tracking params, sorts query params
- [x] URL hashing: SHA-256(userId + normalizedUrl) for per-user dedup
- [x] Auth service: register (transaction: user + default category), login, token generation (access + refresh in Redis)
- [x] Auth controller: register, login → returns { success, message, data: { accessToken, user } }
- [x] Auth routes: POST /api/v1/auth/register, POST /api/v1/auth/login (public)
- [x] JWT verify middleware: Bearer token → req.user = { userId }
- [x] Global error middleware: AppError → { success: false, message }
- [x] Category service: CRUD with ownership checks, system category protection
- [x] Category controller: getAll, getOne, create, update, delete with validation
- [x] Category routes: GET/POST/PATCH/DELETE /api/v1/category (all protected by verifyJWT)
- [x] Category validation: name required ≤50 chars, icon string, color hex format
- [x] Bookmark service: getAllUserBookmarks (capped 100), createBookmark (atomic upsert + dedup), updateBookmark (whitelist), deleteBookmark (atomic), searchBookmarks (text index, capped 50)
- [x] Bookmark validation: URL required ≤2048, title ≤200, favicon ≤2048, tags array ≤20 items ≤200 each, category valid ObjectId
- [x] Git history: commits show incremental feature delivery (auth → category → bookmark utils → bookmark service)

## In Progress

- [ ] Bookmark controller: implement all 5 methods (getAll, create, search, update, delete) — **controller file is empty**
- [ ] Bookmark routes: wire controller methods, apply verifyJWT middleware — **routes have empty handlers only**
- [ ] Mount bookmark router in app.js: `app.use('/api/v1/bookmarks', bookmarkRouter)` — **not mounted**
- [ ] Manual API verification: curl test all bookmark endpoints

## Next Up

1. **Bookmark Controller + Routes** (current) — connect service to HTTP
2. **Integration Tests** — test all endpoints end-to-end (auth → category → bookmark)
3. **Browser Extension: Manifest + Background** — MV3 manifest, service worker, chrome.storage for tokens, API client
4. **Browser Extension: Content Script** — extract title, favicon, og:image from current tab
5. **Browser Extension: Popup UI** — save form, bookmarks list, category filter, search, grid/list toggle
6. **AI Classification Worker** — background process polling `status: 'pending'` bookmarks, calling LLM, writing aiMetadata
7. **Refresh Token Endpoint** — POST /api/v1/auth/refresh (rotate refresh token in Redis)
8. **Sign Out Endpoint** — POST /api/v1/auth/logout (delete refresh token from Redis)

## Open Questions

- **AI Classification**: Which LLM provider? (OpenAI API key in env → `OPENAI_API_KEY` already defined but unused). What prompt template? How to handle rate limits/retries?
- **Refresh Token Rotation**: Current implementation stores refresh token in Redis but no refresh endpoint exists. Should rotation invalidate old token? (Security best practice: yes)
- **Favicon Handling**: Currently stored as external URL string. Should extension download and proxy? (MVP: no — store URL only)
- **Pagination**: List endpoints capped at 100/50. Need cursor-based pagination for >100 bookmarks? (MVP: no — caps are intentional)
- **Rate Limiting**: Not implemented. Add express-rate-limit before production?
- **CORS**: Not configured. Extension will need `Access-Control-Allow-Origin` for production domain.
- **HTTPS in Dev**: Extension may need `http://localhost` allowed in manifest `host_permissions`.

## Architecture Decisions

- **Per-user URL dedup via SHA-256(userId + normalizedUrl)** — not cross-user. Privacy: same URL saved by two users = two different hashes. No cross-user lookup possible. (Decided in `hashUrl.js` comments + `bookmark.model.js` unique index)
- **Atomic upsert with findOneAndUpdate(upsert:true)** — eliminates TOCTOU race on double-save. `lastErrorObject.updatedExisting` detects duplicate → 409. (Implemented in `bookmark.service.js:createBookmark`)
- **System "Uncategorized" category** — seeded on startup, `isSystem: true`, immutable. Every bookmark gets a category (fallback in service). (Implemented in `seed.js` + `bookmark.service.js`)
- **Update whitelist (UPDATABLE_FIELDS)** — only title, tags, category, favicon writable. System fields protected. (Implemented in `bookmark.service.js`)
- **Text index for search** — on title, aiMetadata.summary, tags. No vector/semantic search in MVP. (Defined in `bookmark.model.js`)
- **JWT access + refresh tokens** — access short-lived, refresh 7d in Redis. No rotation yet. (Implemented in `auth.service.js`)
- **Transaction for register** — user + default "General" category created atomically. (Implemented in `auth.service.js:register`)

## Session Notes

- **Branch**: `sprint-1/mvp` (main is behind)
- **Recent commits**:
  - `0f6109e` — feat: bookmark service implemented
  - `bce2415` — feat(api): create bookmark validation logic
  - `7fb600b` — feat URL bookmark utils function added
  - `d61d790` — feat: Category CRUD operations + validator implemented
  - `50933f0` — feat: Category CRUD (nottested), + AppError implementation
- **To resume**: Start with wiring `bookmark.controller.js` (currently empty) and `bookmark.routes.js` (stubs only). Mount in `app.js`. Test with curl.
- **Env file needed**: `api/.env.development.local` with PORT, NODE_ENV, MONGO_URI, REDIS_URL, JWT secrets, OPENAI_API_KEY