# CodeResMark

## Overview

CodeResMark is a developer-focused bookmark manager for saving, organizing, and rediscovering code-related resources (articles, libraries, tutorials, documentation). It consists of a REST API backend and a browser extension for one-click saving from any page. The core value is AI-assisted classification: when a user saves a URL, the system extracts metadata (purpose, languages, difficulty, summary) to make bookmarks searchable by intent, not just keywords.

Primary user: individual developers who accumulate hundreds of coding resources and need to find them later by "what problem does this solve?"

## Goals

1. **MVP Backend Complete**: REST API with auth, categories, bookmarks (CRUD + search + AI metadata) fully functional and tested
2. **Browser Extension MVP**: Popup to save current tab, list user's bookmarks with category filter, open saved links
3. **AI Classification Pipeline**: Background job that processes new bookmarks (status: pending → classified/failed) using an LLM to extract structured metadata
4. **Search That Works**: Full-text + semantic search across title, AI summary, and tags returning relevant results in <200ms

## Core User Flow

1. User installs browser extension and signs in (register → receives JWT access + refresh tokens)
2. User visits a coding resource (GitHub repo, blog post, docs page)
3. Clicks extension icon → popup shows pre-filled URL/title/favicon → user optionally picks category/tags → clicks Save
4. Extension calls `POST /api/v1/bookmarks` → backend normalizes URL, computes per-user SHA-256 hash, upserts atomically (dedup)
5. Bookmark created with `status: 'pending'` → background worker picks up, calls LLM, updates with AI metadata + `status: 'classified'`
6. Later, user opens extension → sees bookmarks list (grid/list toggle) filtered by category, searches by keyword → clicks to open original URL

## Features

### Authentication
- Email/password register and login
- JWT access tokens (short-lived) + refresh tokens (7-day TTL in Redis)
- Protected routes via `Authorization: Bearer <accessToken>` header
- Passwords hashed with bcrypt (cost factor 10)

### Categories
- User-created categories with name, emoji icon, hex color
- System category "Uncategorized" (seeded, immutable, owned by no user)
- Full CRUD: list all, get one, create, update, delete
- Ownership enforced: users can only access their own categories; system categories cannot be deleted

### Bookmarks
- Save URL with optional title, favicon, tags (array, max 20, each ≤200 chars), category (ObjectId)
- URL normalization: lowercases host, strips default ports, removes tracking params (utm_*, fbclid, gclid, ref*), strips fragment, collapses trailing slash, sorts query params alphabetically
- Per-user deduplication: SHA-256(userId + normalizedUrl) stored as `urlHash`; unique compound index on (userId, urlHash) prevents duplicates
- Atomic upsert via `findOneAndUpdate(upsert:true)` — double-save returns 409, not 500
- AI metadata fields (populated by background worker): purpose, languages[], difficulty (beginner/intermediate/advanced), summary, classifiedAt, confidence (0–1)
- Status enum: `pending` (default) | `classified` | `failed` | `needs-review`
- Full-text search via MongoDB text index on title + aiMetadata.summary + tags
- List capped at 100 most recent; search capped at 50 top-scored results
- Updateable fields whitelist: title, tags, category, favicon (userId, url, urlHash, status, aiMetadata, timestamps are system-managed)

### Browser Extension (Not Yet Implemented)
- Manifest v3: popup (save current tab), background (auth token storage, API calls), content script (extract title/favicon/meta)
- Popup: save form, bookmarks list with category filter, grid/list view toggle (persisted in user settings)

## Scope

### In Scope (MVP)
- Express.js REST API with the endpoints above
- MongoDB data models with indexes as implemented
- JWT auth with refresh token rotation in Redis
- Browser extension (popup + background + content script) for save/list/open
- AI classification background worker (separate process, polls pending bookmarks)
- Unit/integration tests for API

### Out of Scope
- Social features (sharing, collaboration, public profiles)
- Teams/workspaces/multi-user ownership
- Browser sync across devices (extension uses API, not browser sync API)
- Import/export (JSON, HTML, Pocket, Raindrop, etc.)
- Web dashboard (extension popup is the only UI for MVP)
- Real-time updates (WebSockets, SSE)
- Rate limiting, audit logging, admin panel
- OAuth providers (GitHub, Google) — email/password only for MVP
- Payment/subscription billing

## Success Criteria

1. A new user can register, log in, and receive valid access + refresh tokens
2. A signed-in user can create, list, update, delete categories (but not the system "Uncategorized")
3. A signed-in user can save a bookmark via `POST /api/v1/bookmarks` and receive the created document with `status: 'pending'`
4. Saving the same URL twice returns 409 BOOKMARK_DUPLICATE (not 500)
5. A signed-in user can list their bookmarks (most recent first, capped at 100)
6. A signed-in user can search their bookmarks by keyword (full-text, capped at 50, relevance-sorted)
7. A signed-in user can update a bookmark's title, tags, category, favicon (whitelisted fields only)
8. A signed-in user can delete their own bookmarks
9. Extension popup: save current tab → appears in list → click opens original URL
10. Background worker: picks up `pending` bookmarks, calls LLM, writes AI metadata, sets `classified` or `failed`