# UI Context

> **NOTE: No frontend exists yet.** The browser extension (`extension/`) is scaffolded with Manifest v3 but all source files are empty:
> - `extension/manifest.json` — empty
> - `extension/popup/index.html` — empty
> - `extension/popup/index.jsx` — empty
> - `extension/background/index.js` — empty
> - `extension/content/index.js` — empty
>
> This file should be filled in via a design conversation (per the ui-context generation prompt) once frontend work begins. Do not invent colors, typography, or layout patterns — they don't exist in the codebase.

---

## Theme

[Describe the overall visual language — e.g. Dark only. No light mode. The design language is a dark technical workspace — near-black backgrounds, layered surfaces, and vivid accent colors for interactive elements.]

## Colors

[Define your color tokens as CSS custom properties. All components must use these tokens — no hardcoded hex values.]

| Role            | CSS Variable       | Value    |
| --------------- | ------------------ | -------- |
| Page background | `--bg-base`        | `#[hex]` |
| Surface         | `--bg-surface`     | `#[hex]` |
| Primary text    | `--text-primary`   | `#[hex]` |
| Muted text      | `--text-muted`     | `#[hex]` |
| Primary accent  | `--accent-primary` | `#[hex]` |
| Border          | `--border-default` | `#[hex]` |
| Error           | `--state-error`    | `#[hex]` |
| Success         | `--state-success`  | `#[hex]` |

## Typography

| Role      | Font              | Variable      |
| --------- | ----------------- | ------------- |
| UI text   | [e.g. Geist Sans] | `--font-sans` |
| Code/mono | [e.g. Geist Mono] | `--font-mono` |

## Border Radius

| Context           | Class            |
| ----------------- | ---------------- |
| Inline / small UI | `rounded-[size]` |
| Cards / panels    | `rounded-[size]` |
| Modals / overlays | `rounded-[size]` |

## Component Library

[e.g. shadcn/ui on top of Tailwind. Components live in components/ui/. Use the CLI to add new components rather than writing from scratch.]

## Layout Patterns

- [Pattern — e.g. Editor: full-viewport split with left sidebar, center canvas, right sidebar]
- [Pattern — e.g. Sidebars: fixed width with border separator]
- [Pattern — e.g. Modals: centered overlay with backdrop blur]
- [Pattern — e.g. Navbar: top bar with bottom border]

## Icons

[e.g. Lucide React. Stroke-based icons only. Sizes: h-4 w-4 for inline, h-5 w-5 for buttons.]

---

## Extension Popup Requirements (From Project Overview)

When frontend work begins, the popup must implement:

1. **Save Form**: Pre-filled with current tab's URL, title, favicon (from content script). Optional category dropdown (user's categories + "Uncategorized"), optional tags input.
2. **Bookmarks List**: Grid/List toggle (persisted in `user.settings.defaultView`), filter by category, search by keyword (calls `GET /api/v1/bookmarks/search?q=`).
3. **Auth State**: If no valid access token → show sign-in form (calls `POST /api/v1/auth/login`). On success, store tokens in `chrome.storage`.
4. **Token Refresh**: Background script handles 401 → refresh token flow → retry original request.