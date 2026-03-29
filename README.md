# Notetakr

Notetakr is a Chrome extension that gives you a **side-panel notes app** while you browse.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `public/` folder in this repo

## What it does

- **Side panel notes editor** with `New`, `Open`, and `Save` to `.txt`
- **Highlight text on any webpage** → click **Add to notes** popup to append it
- **Per-line return icons (↩)** store the page URL + scroll position and can reopen that context
- **Add to search**: highlight text in notes, or hover a word, to search it in your current tab

## Files

- Extension entrypoint: `public/manifest.json`
- Background service worker: `public/sw.js`
- Shared constants: `public/shared/constants.js`
- Side panel UI: `public/panel.html`, `public/panel.css`, `public/panel/…`
- Webpage clipper popup: `public/clipper/…`, `public/clipper.css`
- Icon: `public/icon.png`

## Architecture at a glance

Notetakr is split into three execution environments (Chrome MV3):

- **Side panel page** (the notes UI): `public/panel.html` + `public/panel/…`
- **Content script** (runs on every site): `public/clipper/…`
- **Service worker** (background logic): `public/sw.js` + `public/sw/…`

### Data model

- **Draft note** lives in `chrome.storage.local` under the key `notes_draft_v1`.
- The draft contains:
  - `text`: the note body as a single string with `\n` newlines
  - `lineLinks`: an array aligned to the `text.split("\n")` lines, where each entry is either `null` or:
    - `{ url, scrollY, ts }`

Design choice: this keeps the editor simple (plain text) while still allowing per-line “return to source” links.

### How the pieces talk to each other

#### Side panel ↔ service worker (“API” calls)

The side panel can’t call a local Express server (offline extension), so it uses a tiny message-based API:

- `panel/api.js` sends `{ type: "apiFetch", url, method, body }`
- `sw/messages.js` handles it and routes to `sw/api.js` which implements:
  - `GET /api/notes/draft`
  - `PUT /api/notes/draft`
  - `POST /api/notes/draft/new`

This keeps panel code readable: it can look like normal `fetch("/api/…")` without a real server.

#### Webpage clipper → storage (direct write)

When you highlight text on a webpage and click **Add to notes**:

- `clipper/storage.js` writes directly to `chrome.storage.local` (`notes_draft_v1`)
- It appends the selected text to `draft.text`
- It stamps `{ url, scrollY }` into `draft.lineLinks` for each non-empty inserted line

Design choice: direct storage writes are the most reliable way to sync from a content script (no fragile background “append” pipeline).

#### “Return to source” + scroll restore

- The side panel gutter buttons (↩) call:
  - `{ type: "openContext", url, scrollY }`
- The service worker opens a tab and retries `srScrollTo` a few times (content scripts can lag while a tab loads).

The scroll helpers live in `clipper/scroll-messages.js`:
- `srGetScroll`: returns `{ url, scrollY }`
- `srScrollTo`: scrolls immediately and again after short delays for reliability

### Why the JS is split into many files

Chrome extension code runs in different contexts and has no bundler here.
So we split by responsibility and rely on **deterministic load order**:

- Side panel: multiple `<script defer>` tags in `panel.html`
- Content scripts: ordered `js: [...]` list in `manifest.json`
- Service worker: `importScripts(...)` in `public/sw.js`

This makes it easy to skim each area without scrolling through one 900-line file.


