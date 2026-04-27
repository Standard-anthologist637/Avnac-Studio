# Avnac

Avnac is a desktop-first canvas for layouts, posters, and graphics.

It is built around a fast local workflow: open a file, design directly on the canvas, autosave into native app storage, then export a PNG or workspace file when you are ready.

## What It Does

- Create canvases from presets or custom dimensions
- Add and edit text, shapes, lines, arrows, and images
- Organize work with layers, selection tools, alignment controls, crop, blur, corner radius, and shadows
- Use vector boards for nested editable drawing areas
- Generate QR codes inside the editor
- Save files into native app storage with a files view for reopening, duplicating, deleting, importing, and JSON download
- Export PNGs with scale and transparency options
- Use the Magic panel for prompt-based edits

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Router
- Desktop shell/runtime: Wails + Go
- Canvas/rendering: Fabric.js
- AI UI/runtime: `@tambo-ai/react`
- Analytics: PostHog
- Optional proxy/API layer: Elysia

## Project Layout

```text
frontend/   React app, editor UI, native workspace client, export flow
backend/    Optional API used mainly for image and Unsplash proxy routes
avnac-system/ Native Wails services for config, export dialogs, and workspace storage
```

## How Persistence Works

Avnac now treats the desktop app data directory as the primary workspace store.

- Each file gets its own workspace directory under the app config data path
- Lightweight `meta.json` files power the `/files` list without loading whole canvases
- Full editor state lives in separate files such as `document.json`, `pages.json`, `vector-boards.json`, and `vector-board-docs.json`
- Opening a file loads only that workspace into memory
- Legacy browser document storage is cleared on startup so the desktop runtime starts from a clean slate

This keeps large documents and embedded assets out of IndexedDB and localStorage, reduces browser pressure, and matches the desktop-native workflow more closely.

If you are working on editor UX, canvas behavior, workspace storage, or export, the frontend and `avnac-system` are the main places to look.

## Local Development

### Frontend Only

If you only want the editor, local files, and PNG export for existing local assets, running the frontend is enough.

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:3300`.

The plain frontend is still useful for UI work, but native workspace storage, native export dialogs, and desktop settings require the Wails app runtime.

### Frontend + Proxy Backend

Run the backend when you want:

- Unsplash search and download tracking
- Remote image proxying for export-safe third-party images
- Local dev to mirror the production `/api` routing setup

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
bun install
cp .env.example .env
bun run dev
```

The backend runs on `http://localhost:3001`.

## Proxy Notes

The backend is intentionally small in the day-to-day frontend workflow. Its most important job right now is proxying external resources so the editor can safely use them in-browser.

- `/media/proxy` fetches remote images through the app so exported canvases do not fail from cross-origin image tainting

In local development, the frontend dev server proxies `/api/*` to `http://localhost:3001`, so the browser can keep using same-origin `/api` calls.

In production, Vercel mounts the backend at `/api`.

## Backend Env

If you run the proxy backend locally, start from `backend/.env.example`.

Unsplash configuration for the desktop editor now lives in the Wails app config, not the Bun backend env. Update it from the Files screen inside the desktop app.

## Common Scripts

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

Backend:

```bash
cd backend
bun run dev
bun run check
```

## Current Focus Areas

The repo is strongest today around:

- Desktop-first design editing
- Native workspace persistence
- PNG export
- Prompt-based canvas editing

The backend document/auth layer exists, but the main product experience is centered on the frontend editor plus the native Wails storage/runtime layer.

## Recent Changes (Studio Branch)

This branch adds desktop-first workspace features for the Wails app while preserving existing editor behavior.

- Multi-page editor support via isolated wrapper architecture (`frontend/src/extensions/editor-pages/*`)
- Workspace/page import-export split:
  - Workspace files: `.workspace.avnac`
  - Single page files: `.page.avnac`
  - Legacy JSON imports remain supported for compatibility
- Native download flow in desktop mode using Wails IO manager (`ExportFile`) with browser fallback
- File list updates:
  - Added Import workspace action
  - Removed Open in new tab flow to keep interactions native to the desktop app
- Native workspace persistence:
  - Removed IndexedDB/localStorage document storage for files, pages, and vector-board state
  - Moved workspace state into per-file directories under the app config path
  - Files list now reads lightweight metadata while full workspace payloads load only when opened
  - Legacy browser document storage is wiped on startup to avoid stale duplicate state
- Editor create shell updates:
  - Page tabs with horizontal overflow support
  - Unified editor header in container (home, title, workspace/page actions)

## Notes

- If you change backend proxy behavior, restart the backend server before testing from the frontend
- If you are debugging export issues involving external images, make sure the proxy backend is running
