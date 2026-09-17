# Code Standards

## General

- **ES Modules only**: `"type": "module"` in package.json. Use `import`/`export`, never `require`/`module.exports`.
- **Single responsibility per file**: One class/function per file, named after its export.
- **Explicit over implicit**: No magic globals, no monkey-patching. Dependencies imported at top.
- **Fail fast, fail loud**: Validate inputs at boundaries (controllers, service entry points). Throw `AppError` with specific `code` for operational failures.
- **No `console.log` in production paths**: Use structured logging (not yet implemented) or `console.error` only for genuine errors.
- **Async/await everywhere**: No raw Promise chains. `try/catch` in controllers → `next(err)`. Services throw; controllers don't try/catch for flow control.

## JavaScript / Node.js

- **Strict mode**: Implied by ESM. No `use strict` needed.
- **Node built-ins with `node:` prefix**: `import { createHash } from 'node:crypto'` — always.
- **Environment config via `env.js` only**: Never `process.env.X` directly in business logic. `config/env.js` loads `.env.{NODE_ENV}.local` and exports named constants.
- **No top-level await in modules that export functions**: `connectToDatabase()` returns a Promise; `app.js` awaits it before mounting routes.
- **Mongoose**: Use `mongoose.Schema` with explicit types, validation messages, and indexes. `timestamps: true` on all models. `lean()` on read-only queries returning plain objects.
- **ObjectId comparisons**: Always `.toString()` both sides — `ObjectId === String` is always `false` even for same value.

## Express Conventions

### Route Structure
```
routes/
  {resource}.routes.js    # Router instance, mounts controllers, applies middleware
controllers/
  {resource}.controller.js # Thin handlers: validate → service → res.json / next(err)
services/
  {resource}.service.js   # Business logic, throws AppError
```

### Controller Pattern
```js
const handler = async (req, res, next) => {
  try {
    const result = await serviceMethod(req.params.id, req.user.userId, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error); // Let errorMiddleware handle AppError → JSON
  }
};
```
- **Never** `res.status(400).json(...)` in controllers for validation errors — throw `AppError` and let middleware unify responses.
- **Never** `try/catch` just to re-throw. Only catch to add context or translate plain `Error` → `AppError`.

### Middleware Order (in `app.js`)
1. `express.json()` + `express.urlencoded()`
2. Route mounts (`app.use('/api/v1/auth', authRouter)`)
3. `errorMiddleware` **last** — catches everything from above

### Response Shape (Enforced by Controllers + Error Middleware)
```json
// Success
{ "success": true, "message": "Optional human message", "data": {} }

// Error (from errorMiddleware)
{ "success": false, "message": "Error message" }
```
- No envelope wrapping beyond this. No `error: { code, details }` in MVP.

## Data & Storage

### Mongoose Models
- **Schema-first**: Define all fields, validation, indexes in the model file.
- **Unique indexes for business keys**: `(userId, urlHash)` on Bookmark prevents duplicates at DB level.
- **Text index for search**: `{ title: 'text', 'aiMetadata.summary': 'text', tags: 'text' }` — defined in model, used by `searchBookmarks`.
- **Compound indexes for common queries**: `{ userId: 1, status: 1 }` for filtered lists.
- **No virtuals in MVP** — keep it flat.

### Service Layer Rules
- **Transactions for multi-document writes**: `auth.service.js` register uses `mongoose.startSession()` + `session.startTransaction()` for user + default category creation.
- **Atomic upsert for dedup**: `Bookmark.findOneAndUpdate({ userId, urlHash }, { $setOnInsert: ... }, { upsert: true, includeResultMetadata: true })` — `lastErrorObject.updatedExisting` tells us if it was a duplicate.
- **Whitelist updates**: `UPDATABLE_FIELDS` Set in `bookmark.service.js` — any key not in set throws `400 FIELD_NOT_UPDATEABLE`.
- **Category ownership check on every bookmark write**: If `category` provided, verify it exists AND `category.userId === userId`.
- **Fallback to system "Uncategorized"**: When `category` is null/omitted, resolve `Category.findOne({ isSystem: true, name: 'Uncategorized' })` and use its `_id`.

### Validation Strategy
| Layer | Tool | Throws |
|-------|------|--------|
| Controller (request body) | `validateBookmarkInput` / `validateCategoryInput` | `AppError` (400, specific code) |
| Service (business rules) | Inline checks | `AppError` (400/403/404/409/500, specific code) |
| Utils (pure functions) | `normalizeUrl`, `hashUrl` | Plain `Error` with `.code` (service translates) |
| Database | Mongoose validators + unique indexes | Mongoose errors (caught → `AppError` in service) |

## File Organization

```
api/
├── server.js                 # Entry: import app, listen PORT
├── package.json              # API dependencies only
├── .env.development.local    # Local dev secrets (gitignored)
├── .env.production.local     # Prod secrets (gitignored, not in repo)
├── src/
│   ├── app.js                # Express factory
│   ├── config/               # Singleton clients + env exports
│   ├── controllers/          # HTTP handlers only
│   ├── middleware/           # Cross-cutting (auth, errors)
│   ├── models/               # Mongoose schemas
│   ├── routes/               # Router definitions
│   ├── services/             # Business logic
│   └── utils/                # Pure functions, AppError
```

**Naming Conventions**
- Files: `kebab-case.js` (`bookmark.service.js`, `normalizeUrl.js`)
- Exports: named exports for utilities (`export const normalizeUrl`), default export for singletons/classes (`export default connectToDatabase`, `export default AppError`)
- Collections: plural, lowercase (`users`, `categories`, `bookmarks`)
- Indexes: defined in model file, not migration scripts

## API Route Conventions

### Versioning
- All routes under `/api/v1/` — `app.use('/api/v1/auth', authRouter)` etc.

### Auth Routes (Public)
| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/auth/register` | `register` | Create account, return tokens |
| POST | `/api/v1/auth/login` | `login` | Verify credentials, return tokens |

### Category Routes (Protected — `verifyJWT`)
| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/category/` | `getAllUserCategories` | List all user's categories |
| GET | `/api/v1/category/details/:id` | `getSingleCategory` | Get one by ID |
| POST | `/api/v1/category/` | `createCategory` | Create new category |
| PATCH | `/api/v1/category/:id` | `updateCategory` | Update name/icon/color |
| DELETE | `/api/v1/category/:id` | `deleteCategory` | Delete (not system) |

### Bookmark Routes (To Be Wired — Protected)
| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/v1/bookmarks/` | `getAllUserBookmarks` | List recent (max 100) |
| POST | `/api/v1/bookmarks/` | `createBookmark` | Save new (dedup) |
| GET | `/api/v1/bookmarks/search?q=` | `searchBookmarks` | Full-text search (max 50) |
| PATCH | `/api/v1/bookmarks/:id` | `updateBookmark` | Update whitelisted fields |
| DELETE | `/api/v1/bookmarks/:id` | `deleteBookmark` | Delete own bookmark |

### Error Codes (from `AppError.code`)
| Code | HTTP | Meaning |
|------|------|---------|
| `USER_EXISTS` | 409 | Email already registered |
| `USER_NOT_FOUND` | 404 | Login email not found |
| `INVALID_PASSWORD` | 401 | Wrong password |
| `UNAUTHORIZED_OWNER` | 403 | Not owner of resource |
| `CATEGORY_NOT_FOUND` | 404 | Category ID invalid |
| `CATEGORY_INVALID` | 400 | Category ID not ObjectId |
| `SYSTEM_CATEGORY_IMMUTABLE` | 403 | Cannot delete system category |
| `BOOKMARK_DUPLICATE` | 409 | URL already saved by user |
| `BOOKMARK_NOT_FOUND` | 404 | Bookmark ID invalid or not owned |
| `BOOKMARK_ID_INVALID` | 400 | Bookmark ID not ObjectId |
| `FIELD_NOT_UPDATEABLE` | 400 | Update key not in whitelist |
| `URL_REQUIRED` | 400 | Missing URL in body |
| `URL_INVALID` | 400 | Malformed URL |
| `URL_BLOCKED_SCHEME` | 400 | javascript:/file:/etc. |
| `URL_UNSUPPORTED_SCHEME` | 400 | ftp:/mailto:/etc. |
| `QUERY_REQUIRED` | 400 | Empty search query |
| `UNCATEGORIZED_MISSING` | 500 | Seed didn't run |

## Styling (Frontend — Not Yet Applicable)

> **Note**: No frontend code exists yet. The browser extension (`extension/`) is scaffolded but all source files are empty. This section will be populated when frontend implementation begins. See `ui-context.md` for design tokens (also not yet defined).

## Protected Files (Do Not Modify Without Explicit Instruction)

- `node_modules/` — vendor code
- `package-lock.json` — lockfile (managed by npm)
- `.env.*.local` — secrets (gitignored)
- Generated/migration files (none yet — if added, protect them)