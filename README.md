# Avnac

Avnac is a desktop-first design canvas for layouts, posters, social graphics, and visual documents.

The app is built for a local workflow:

1. Create or open a file
2. Edit directly on the canvas
3. Autosave to native app storage
4. Export PNGs or portable workspace/page files

## What The App Does

- Create canvases from presets or custom sizes
- Edit text, shapes, lines, arrows, and images
- Use layers, alignment tools, crop, blur, shadows, and corner radius controls
- Build multi-page workspaces
- Use vector boards for nested editable drawing areas
- Generate QR codes in-editor
- Reopen, duplicate, delete, import, and download workspace data from the Files screen
- Export PNG with scale and transparency options
- Use the Magic panel for prompt-based editing actions

Avnac is not split across a separate backend anymore. The desktop app, native file storage, Unsplash config, export flow, and media proxy all run through the Wails app runtime in this repository.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Router
- Desktop runtime: Wails + Go
- Canvas engine: Fabric.js
- AI UI/runtime: `@tambo-ai/react`
- Analytics: PostHog

## Project Structure

```text
frontend/       React UI, editor, routes, native client wrappers
avnac-system/   Go services for config, IO, workspace storage, and media proxy
app.go          Wails app bootstrap and service wiring
main.go         Wails runtime setup and bindings
```

## Native Workspace Storage

Avnac stores document state in the app config directory (not browser storage).

Each file gets a dedicated workspace folder:

```text
<UserConfigDir>/avnac-studio/documents/<workspace-id>/
  meta.json
  document.json
  pages.json
  vector-boards.json
  vector-board-docs.json
```

How this works:

- `meta.json` powers the Files list quickly without loading full canvas data
- `document.json` stores the main Fabric document payload
- `pages.json` stores page-level workspace state
- `vector-boards.json` and `vector-board-docs.json` store vector board state
- A one-time migration clears old browser storage so stale IndexedDB/localStorage data does not compete with native workspace files

This keeps large payloads out of IndexedDB/localStorage and aligns persistence with a desktop-native app model.

## Media Proxy

Avnac includes a native media proxy middleware in the Wails runtime for remote image loading.

- Endpoint used by the webview: `/media/proxy?url=...`
- Purpose: prevent cross-origin image tainting issues during canvas export

No separate backend service is required for this repository.

## Development

### Prerequisites

- Go (compatible with this repo's `go.mod`)
- Node.js + npm
- Wails CLI v2

Install Wails CLI if you do not already have it:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

Optional sanity check:

```bash
wails doctor
```

### Frontend Development (UI-focused)

```bash
cd frontend
npm install
npm run dev
```

Vite runs at `http://localhost:3300`.

Use this mode for UI and interaction work only. Native dialogs, native storage, export dialogs, Unsplash config, and other runtime-bound features should be validated in the Wails app.

### Desktop App Development (Recommended)

Install frontend dependencies first, then run the desktop app from the repository root:

```bash
cd frontend
npm install
cd ..
```

Then:

```bash
wails dev
```

This runs the full desktop app with native bindings, native workspace storage, and the built-in Wails media proxy.

### Production Build

From the repository root:

```bash
wails build
```

Build artifacts are generated under `build/`.

## Useful Commands

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run test
npm exec tsc -- --noEmit --pretty false
```

Go:

```bash
go build ./...
```

## Recent Studio Work

- Native workspace persistence migration from IndexedDB/localStorage to per-file directories
- Multi-page editor support and workspace/page import-export split
- Native desktop export flow via Wails IO manager with browser fallback where needed
- Files screen updates for import and desktop-native interactions
- One-time legacy browser workspace cleanup during migration to native storage
- Editor shell improvements around page tabs and unified header controls

## Where To Work In The Codebase

- Editor UI and behavior: `frontend/src/components/`
- Routes and navigation: `frontend/src/routes/`
- Frontend storage wrappers and document logic: `frontend/src/lib/`
- Native IO, config, and workspace services: `avnac-system/`

## Notes

- Unsplash credentials/settings are managed through app config in the desktop runtime
- Wails v2 refresh/reload can drop `window.go` bindings unless the Wails runtime scripts are present in `frontend/index.html`
- If you modify native Go bindings or IO behavior, rerun and validate through `wails dev`
