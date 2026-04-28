# Contributing to Avnac Studio

Thanks for your interest in contributing. Avnac Studio is the native desktop port of [Avnac](https://github.com/akinloluwami/avnac), built with Wails + Go. Contributions to the desktop-specific layer are welcome.

---

## Before You Start

- All desktop-specific work lives on the **`studio`** branch — this is the default branch. Do **not** target `main`; that branch mirrors the upstream web app.
- For bugs or feature requests, [open an issue](https://github.com/striker561/Avnac-Studio/issues) first so we can align before you invest time in a PR.
- For changes to the canvas editor or core UI, check whether the change belongs here or upstream at [akinloluwami/avnac](https://github.com/akinloluwami/avnac).

---

## Setting Up Locally

### Prerequisites

- [Go](https://go.dev/dl/) — see `go.mod` for the required version
- [Node.js](https://nodejs.org/) + npm
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor
```

### Run the full desktop app

```bash
cd frontend
npm install
cd ..
wails dev
```

### Run the frontend only (UI work)

```bash
cd frontend
npm install
npm run dev
```

Vite starts at `http://localhost:3300`. Native features (file storage, export dialogs, Unsplash config) are only available in the full Wails runtime.

---

## Where Things Live

| Area | Path |
|---|---|
| Editor UI and behavior | `frontend/src/components/` |
| Routes and navigation | `frontend/src/routes/` |
| Frontend storage and document logic | `frontend/src/lib/` |
| Native IO, config, and workspace services | `avnac-system/` |
| Wails app bootstrap | `app.go`, `main.go` |

---

## Useful Commands

**Frontend:**

```bash
cd frontend
npm run dev        # start dev server
npm run build      # production build
npm run test       # run tests
npm exec tsc -- --noEmit --pretty false  # type-check
```

**Go:**

```bash
go build ./...     # verify Go compiles
```

**Production build:**

```bash
wails build        # output goes to build/bin/
```

---

## Pull Request Guidelines

- Target the **`studio`** branch.
- Keep PRs focused — one concern per PR.
- If your change touches the Go backend (`avnac-system/`), include a brief note on what service or file is affected and why.
- If your change touches the canvas editor, test with at least one of: text, shape, image, and multi-select.
- Run `npm exec tsc -- --noEmit` and `go build ./...` before submitting — the PR should have no type errors or build failures.

---

## Maintainers

- [@striker561](https://github.com/striker561)
- [@d3uceY](https://github.com/d3uceY)

Original Avnac web app by [@akinloluwami](https://github.com/akinloluwami).
