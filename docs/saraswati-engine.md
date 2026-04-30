# Saraswati Engine

Saraswati is Avnac Studio's long-term 2D scene engine.

The goal is not to replace Fabric in one risky rewrite. The goal is to move Avnac Studio toward a versioned scene model, pure render primitives, and a builder-friendly editor runtime while preserving desktop-native behavior through Wails and Go.

## Principles

1. Saraswati v1 is a 2D engine.
2. Migration is dual-engine first, cutover later.
3. Go remains the native shell, persistence layer, export bridge, and media proxy layer.
4. The interactive renderer lives in the frontend for v1.
5. Unsupported content must fall back safely instead of being silently dropped.
6. The scene model must be explicit, versioned, and usable by builders on top of Avnac.

## Renderer Choice

Saraswati should keep its own scene graph, command model, compatibility layer, and editor state regardless of the rendering backend.

- Default v1 renderer: custom Canvas2D with DOM or HTML overlays for text editing, selection chrome, and editor UI.
- Future option: add a Pixi renderer backend for dense scenes after the scene model and interaction model are stable.
- Do not build Saraswati on top of Konva.
- Do not couple the scene model to Pixi types or Pixi nodes.

That means the route is still our own route. If Pixi becomes useful later, it should be a renderer backend under Saraswati, not the definition of Saraswati itself.

## Folder Layout

The Saraswati source of truth should live under `frontend/src/lib/saraswati/`.

- `types.ts` owns the strict scene and node graph types.
- `scene.ts` owns scene creation, cloning, traversal, and validation helpers.
- `commands/` owns command definitions and the pure reducer.
- `render/commands.ts` owns Scene -> RenderCommand[] conversion.
- `render/canvas.ts` owns dumb Canvas2D drawing.
- `editor/` owns the store boundary and pointer-to-command interaction layer.
- `spatial/` owns basic hit-test and snapping support.
- `compat/` owns backward-compatible Fabric adapters.
- `preview/` owns the safe entry point for real preview rendering.
- `utils/` owns pure engine-domain helpers such as placement math, snapping or alignment math, input classification, and text or object normalization.
- old flat file paths stay as shims during transition so imports do not break while the engine is being reorganized.

React-only styling helpers and Fabric-instance helpers stay outside Saraswati. Saraswati owns the brain. React stays the hands.

## Product References

- Figma: scene graph discipline, precise transforms, snapping, direct manipulation.
- Canva: fast previews, deterministic export, approachable object model, builder/template friendliness.

## Current Local Boundaries

- Current persisted document: `frontend/src/lib/avnac-document.ts`
- Current Fabric runtime: `frontend/src/components/fabric-editor/index.tsx`
- Existing safe migration boundary: `frontend/src/lib/avnac-document-preview.ts`
- Existing non-Fabric proof point: `frontend/src/components/editor/vector-boards/vector-board-workspace.tsx`

## First Engine Slice

This initial implementation introduces:

1. A canonical Saraswati scene graph in `frontend/src/lib/saraswati/types.ts` and `frontend/src/lib/saraswati/scene.ts`
2. A pure command or reducer layer in `frontend/src/lib/saraswati/commands/`
3. A render-command bridge in `frontend/src/lib/saraswati/render/commands.ts`
4. A dumb Canvas renderer in `frontend/src/lib/saraswati/render/canvas.ts`
5. A Fabric bridge in `frontend/src/lib/saraswati/compat/from-fabric.ts`
6. A safe preview entry point in `frontend/src/lib/saraswati/preview/render.ts`

This means the first Saraswati code path is real, but still low-risk: it powers fast previews for supported Fabric-backed documents and falls back to Fabric for unsupported ones.

Backward compatibility remains a hard requirement. Existing user files continue to load through the compatibility adapter rather than forcing a breaking file-format cutover.

## Minimal Architecture Verdict

The separation is strong long term. The exact tiny schema example is not enough for Avnac as-is.

- Good: scene graph, command reducer, render commands, dumb renderer, adapter boundary, React as a boundary instead of the source of truth.
- Not enough by itself: Avnac still needs artboard background, transform data, preview fallback, and compatibility handling for unsupported Fabric content.

So Saraswati now follows the architecture, but with those minimum corrections applied. That keeps the design durable instead of forcing another rewrite when rotation, scale, backgrounds, or old files matter.

## Migration Order

1. Freeze the current behavior contract.
2. Define the canonical scene document.
3. Build migration adapters.
4. Extract engine-neutral math and paint helpers.
5. Build Saraswati render, hit-test, bounds, and selection primitives.
6. Introduce a store-driven editor runtime.
7. Swap the editor backend behind the existing UI shell.
8. Migrate by capability slices.
9. Remove Fabric only after real parity and escape hatches exist.

## Non-Goals For V1

- Go-native interactive rendering
- 3D editing runtime
- Big-bang Fabric replacement

## Immediate Next Tasks

1. Add fixture documents for scene conversion and preview golden checks.
2. Expand Saraswati preview support to images and vector-board instances.
3. Define the command model and editor store boundary.
4. Begin extracting snapping, arrow, and text layout primitives into engine-neutral modules.
5. Keep moving pure, non-Fabric editor math and normalization helpers into `saraswati/utils/` while leaving React view helpers in component-local modules.
