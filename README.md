# Avnac

Avnac is an open browser-based canvas for layouts, posters, and graphics.

It is built around a fast local workflow: open a file, design directly on the canvas, let the browser autosave your work, then export a PNG when you are ready.

## What It Does

- Create canvases from presets or custom dimensions
- Add and edit text, shapes, lines, arrows, and images
- Organize work with layers, selection tools, alignment controls, crop, blur, corner radius, and shadows
- Use vector boards for nested editable drawing areas
- Generate QR codes inside the editor
- Save files locally in the browser with a files view for reopening, duplicating, deleting, and JSON download
- Export PNGs with scale and transparency options
- Use the Magic panel for prompt-based edits

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Router
- Canvas/rendering: Fabric.js
- AI UI/runtime: `@tambo-ai/react`
- Analytics: PostHog
- Optional proxy/API layer: Elysia

## Project Layout

```text
frontend/   React app, editor UI, local file storage, export flow
backend/    Optional API used mainly for image and Unsplash proxy routes
```

## How Persistence Works

Avnac currently treats the browser as the primary workspace.

- Documents autosave into IndexedDB
- The `/files` page lists saved browser files
- Opening a file returns you to the editor with the same document id
- JSON download is available for local export of the document payload

If you are working on editor UX, canvas behavior, local files, or export, the frontend is the main place to look.

## Local Development

### Frontend Only

If you only want the editor, local files, and PNG export for existing local assets, running the frontend is enough.

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:3300`.

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

- `/unsplash/*` handles Unsplash discovery and download tracking
- `/media/proxy` fetches remote images through the app so exported canvases do not fail from cross-origin image tainting

In local development, the frontend dev server proxies `/api/*` to `http://localhost:3001`, so the browser can keep using same-origin `/api` calls.

In production, Vercel mounts the backend at `/api`.

## Backend Env

If you run the proxy backend locally, start from `backend/.env.example`.

The only variable you usually need to think about for editor features is `UNSPLASH_ACCESS_KEY`, and only if you want the Unsplash-powered image flow.

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

- Browser-first design editing
- Local file persistence
- PNG export
- Prompt-based canvas editing

The backend document/auth layer exists, but the main product experience is still centered on the frontend editor and browser-local files.

## Notes

- If you change backend proxy behavior, restart the backend server before testing from the frontend
- If you are debugging export issues involving external images, make sure the proxy backend is running
