# Architecture Context

## Stack

| Layer          | Technology           | Version     | Role |
| -------------- | -------------------- | ----------- | ---- |
| Runtime        | Node.js              | 20+ (ESM)   | Server runtime |
| Framework      | Express              | 5.2.1       | HTTP routing, middleware |
| Database       | MongoDB              | (via Mongoose 9.3.3) | Primary data store |
| ODM            | Mongoose             | 9.3.3       | Schema, validation, indexes |
| Cache/Queue    | Redis                | (via ioredis 5.10.1) | Refresh token store (TTL), future job queue |
| Auth           | jsonwebtoken         | 9.0.3       | JWT access/refresh token signing |
| Password Hash  | bcryptjs             | 3.0.3       | bcrypt cost 10 |
| Config         | dotenv               | 17.3.1      | `.env.{NODE_ENV}.local` loading |
| Dev Tool       | nodemon              | 3.1.14      | Auto-reload in development |

## System Boundaries

```
api/
├── server.js                    # Entry point: creates Express app, connects DB, starts HTTP server
├── src/
│   ├── app.js                   # Express app factory: middleware, routes, error handler
│   ├── config/
│   │   ├── db.js                # Mongoose connection + seed system categories
│   │   ├── env.js               # dotenv config → exports typed env constants
│   │   ├── redis.js             # ioredis client singleton
│   │   └── seed.js              # Seeds 'Uncategorized' system category on startup
│   ├── controllers/             # Request handlers (thin: validate → service → respond)
│   │   ├── auth.controller.js   # login, register
│   │   ├── category.controller.js # CRUD for categories
│   │   └── bookmark.controller.js # (stub — not yet wired)
│   ├── middleware/
│   │   ├── auth.middleware.js   # verifyJWT: extracts Bearer token, verifies, sets req.user
│   │   └── error.middleware.js  # Global error handler: maps AppError → JSON response
│   ├── models/                  # Mongoose schemas + indexes
│   │   ├── user.model.js        # User: username, email, passwordHash, settings
│   │   ├── category.model.js    # Category: userId, name, icon, color, isSystem
│   │   └── bookmark.model.js    # Bookmark: userId, url, urlHash, title, favicon, category, tags, aiMetadata, status
│   ├── routes/                  # Router mounting + route definitions
│   │   ├── auth.routes.js       # POST /register, POST /login (public)
│   │   ├── category.routes.js   # CRUD under /api/v1/category (all protected by verifyJWT)
│   │   └── bookmark.routes.js   # Stubs for GET/POST/PATCH/DELETE (not yet protected/wired)
│   ├── services/                # Business logic, data access, external calls
│   │   ├── auth.service.js      # register, login, generateTokens (JWT + Redis)
│   │   ├── category.service.js  # CRUD with ownership checks
│   │   └── bookmark.service.js  # Core bookmark logic: create, list, search, update, delete
│   └── utils/
│       ├── AppError.js          # Operational error class with statusCode + code
│       ├── normalizeUrl.js      # Canonical URL form (security + dedup)
│       ├── hashUrl.js           # SHA-256(userId + normalizedUrl) for per-user dedup
│       ├── validateBookmark.js  # Controller-layer request validation (throws AppError)
│       └── validator.js         # Category input validation (returns error array)
```

**Responsibility Rules**
- **Controllers**: HTTP concerns only — parse req, call service, format res, `next(err)` on failure. No business logic.
- **Services**: Pure business logic — data access, validation, external calls, transactions. Throw `AppError` for operational failures.
- **Models**: Schema definition, indexes, virtuals. No business logic.
- **Middleware**: Cross-cutting concerns (auth, errors, logging). `verifyJWT` is the only auth gate.
- **Utils**: Pure functions, no side effects. `normalizeUrl`/`hashUrl` throw plain `Error` (service translates to `AppError`); `validateBookmark` throws `AppError` directly (called from controller).

## Storage Model

### MongoDB (Primary)
| Collection | Purpose | Key Indexes |
|------------|---------|-------------|
| `users` | Authentication + settings | `email` (unique), `username` (unique) |
| `categories` | User-defined + system categories | `userId` (index), compound queries by owner |
| `bookmarks` | Saved resources + AI metadata | `(userId, urlHash)` **unique** (dedup), `(userId, status)` compound, **text index** on `title`, `aiMetadata.summary`, `tags` |

**Data Ownership**: Every document in `categories` and `bookmarks` has a `userId` (ObjectId ref → `users`). All queries filter by `userId` — the filter IS the authorization. System categories have `isSystem: true` and no `userId` (or a sentinel); they are readable by all, writable by none.

### Redis (Cache/Queue)
- **Refresh tokens**: `SET refreshToken userId EX 604800` (7 days). Lookup on refresh (not yet implemented).
- **Future**: BullMQ job queue for AI classification worker.

### File/Blob Storage
- **None in MVP**. Favicons stored as external URLs (not downloaded). No uploads.

## Auth and Access Model

### Authentication
- **Register**: `POST /api/v1/auth/register` → creates user, hashes password (bcrypt 10), creates default "General" category in same transaction, issues access + refresh tokens.
- **Login**: `POST /api/v1/auth/login` → verifies bcrypt, issues new access + refresh tokens.
- **Access Token**: JWT signed with `JWT_ACCESS_SECRET`, payload `{ userId }`, expiry from `JWT_ACCESS_EXPIRY` (e.g. `15m`).
- **Refresh Token**: JWT signed with `JWT_REFRESH_SECRET`, payload `{ userId }`, expiry from `JWT_REFRESH_EXPIRY` (e.g. `7d`), stored in Redis keyed by token string.
- **Token Verification**: `verifyJWT` middleware reads `Authorization: Bearer <token>`, verifies with `JWT_ACCESS_SECRET`, sets `req.user = { userId }`.

### Authorization
- **Categories**: Every service method takes `authUserId` and compares `category.userId.toString() === authUserId.toString()`. Throws `403 UNAUTHORIZED_OWNER` on mismatch. System categories (`isSystem: true`) cannot be deleted (`403 SYSTEM_CATEGORY_IMMUTABLE`).
- **Bookmarks**: Service methods take `userId` and filter `{ userId }` in queries. `updateBookmark`/`deleteBookmark` also verify `bookmark.userId.toString() === userId.toString()` before mutation. `createBookmark` resolves category ownership if category provided.
- **No Role-Based Access**: Single-user ownership only. No teams, collaborators, or admin roles.

### Security Boundaries
- Passwords never returned (`select: false` in schema).
- URL normalization blocks `javascript:`, `file:`, `data:`, `vbscript:`, `chrome:`, `chrome-extension:` schemes.
- Only `http:` and `https:` schemes allowed.
- Input validation at controller boundary (whitelist approach for updates).

## Invariants

1. **Auth at Every Mutation Boundary**: No controller mutates data without `verifyJWT` middleware. Category routes apply it at router level (`categoryRouter.use(verifyJWT)`); bookmark routes must do the same when wired.

2. **Ownership Enforced in Service Layer**: Controllers pass `req.user.userId` to services; services re-verify ownership before any write. The database filter `{ userId }` is the primary gate; explicit `.toString()` comparison is the defense-in-depth check.

3. **Per-User Deduplication Is Atomic**: Bookmark creation uses `findOneAndUpdate({ userId, urlHash }, { $setOnInsert: ... }, { upsert: true })` with the unique compound index on `(userId, urlHash)`. No separate "check then insert" — the DB serializes concurrent saves.

4. **System Categories Are Immutable**: `isSystem: true` categories cannot be deleted or modified by users. The seed ensures "Uncategorized" exists; fallback logic in `createBookmark`/`updateBookmark` always resolves to it when category is null/omitted.

5. **Update Whitelist Is Enforced**: `bookmark.service.js` defines `UPDATABLE_FIELDS = new Set(['title', 'tags', 'category', 'favicon'])`. Any key outside this set in an update payload throws `400 FIELD_NOT_UPDATEABLE`. System fields (`userId`, `url`, `urlHash`, `status`, `aiMetadata`, timestamps) are never writable from requests.

6. **Error Handling Uses AppError Exclusively**: All operational errors (validation, not found, unauthorized, duplicate) are thrown as `AppError(message, statusCode, code)`. The global `errorMiddleware` maps these to consistent JSON: `{ success: false, message }`. Unhandled exceptions become 500.

7. **URL Canonicalization Is the Single Source of Truth for Identity**: `normalizeUrl` runs before `hashUrl`; the same normalized URL always produces the same `urlHash` for a given user. Tracking params are stripped; host is lowercased; default ports removed; query params sorted; fragment dropped; trailing slash collapsed.

8. **Database Indexes Match Query Patterns**: 
   - `(userId, urlHash)` unique → dedup enforcement
   - `(userId, status)` compound → list by status (pending/classified)
   - Text index on `title`, `aiMetadata.summary`, `tags` → full-text search
   - `userId` on categories → list user's categories

## Extension Architecture (Planned)

```
extension/
├── manifest.json          # MV3: permissions (activeTab, storage, host_permissions), background service worker, popup
├── background/
│   └── index.js           # Service worker: auth token storage (chrome.storage), API client, context menu / omnibox
├── content/
│   └── index.js           # Content script: extract <title>, <meta property="og:image">, favicon link
└── popup/
    ├── index.html         # Mount point for React/Vue/Svelte app (or vanilla)
    └── index.jsx          # Entry: save form, bookmarks list (grid/list), category filter, search
```

- Extension calls API at `http://localhost:PORT/api/v1` (dev) or production URL.
- Access token stored in `chrome.storage.session` (ephemeral); refresh token in `chrome.storage.local` (persistent).
- Popup communicates with background via `chrome.runtime.sendMessage`.