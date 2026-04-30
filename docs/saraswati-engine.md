# Saraswati Engine

Saraswati is the core 2D scene engine that powers Avnac Studio.

It is the single source of truth for all document structure, state transitions, and rendering intent.

Saraswati is not a canvas wrapper and does not depend on Fabric, React, or any rendering technology.

The point of Saraswati is to keep Avnac's editor logic clean, deterministic, and portable while renderers and UI layers stay replaceable.

---

## Core Responsibility

Saraswati owns:

- Scene structure: what exists in the document
- State transitions: how that scene changes
- Interaction logic: how input turns into engine actions
- Rendering intent: what should be drawn

Saraswati does not own:

- Canvas APIs
- GPU access
- DOM manipulation
- UI components

---

## Architecture Overview

```text
User Input (mouse, keyboard)
	↓
React UI (toolbars, panels)
	↓
Editor Controller (interaction layer)
	↓
Saraswati Engine (scene + commands)
	↓
Render Commands (abstract draw instructions)
	↓
Renderer (Canvas2D / Pixi / GPU / Go-native)
```

This separation matters because Avnac should be able to change renderers without rewriting document logic, and it should be able to change UI structure without rewriting the engine.

---

## Scene Model

The scene is a versioned, serializable structure.

It must contain no Fabric-specific fields, no UI-only state, and no implicit behavior.

The model is expected to stay deterministic and portable.

Scene characteristics:

- Nodes stored by id
- Strict node types such as `rect`, `text`, `image`, and `group`
- Explicit transforms such as `x`, `y`, `width`, `height`, `rotation`, and scale
- Artboard metadata owned by the scene rather than a renderer

Current source-of-truth files in this repo:

- `frontend/src/lib/saraswati/types.ts`
- `frontend/src/lib/saraswati/scene.ts`

---

## Command System

All changes to the scene must go through commands.

Examples:

- `MOVE_NODE`
- `ADD_NODE`
- `DELETE_NODE`

Commands are:

- pure
- deterministic
- side-effect free

This is what makes undo or redo, time travel, testing, and predictable state updates possible.

Direct mutation of scene data is forbidden.

Current source-of-truth files in this repo:

- `frontend/src/lib/saraswati/commands/types.ts`
- `frontend/src/lib/saraswati/commands/reducer.ts`

---

## Render Pipeline

Saraswati does not render directly.

Instead, it produces `RenderCommands`.

Render commands describe what to draw, not how to draw it.

Examples:

- draw rectangle at `x/y`
- draw text with font size and style
- draw image with bounds and crop data

Renderers consume these commands.

Current source-of-truth files in this repo:

- `frontend/src/lib/saraswati/render/commands.ts`
- `frontend/src/lib/saraswati/render/canvas.ts`

---

## Renderer Layer

Renderers are replaceable implementations.

Examples:

- Canvas2D renderer for the current first slice
- Pixi or WebGL renderer in a future slice
- WebGPU renderer later if it becomes justified
- Go-native renderer only if there is a strong product reason

Renderers:

- must not contain business logic
- must not mutate scene state
- must stay output-only

Saraswati is renderer-agnostic by design. A renderer is an implementation detail, not the engine definition.

---

## Interaction Model

User input does not modify the scene directly.

Flow:

- pointer or keyboard events are captured
- those inputs are converted into commands
- commands are dispatched to the engine

This gives Avnac:

- consistent behavior
- predictable state
- easier debugging
- reusable interaction logic across UI surfaces

Current source-of-truth files in this repo:

- `frontend/src/lib/saraswati/editor/store.ts`
- `frontend/src/lib/saraswati/editor/interaction.ts`
- `frontend/src/lib/saraswati/spatial/index.ts`

---

## State Management

Saraswati is framework-agnostic.

State can be managed by:

- React-side stores such as Zustand
- Go runtime integration
- tests and scripts

The engine must run without React.

That rule matters because React is a delivery layer for interaction, not the definition of the editor state machine.

---

## Compatibility Layer

Legacy systems such as Fabric are supported through adapters.

Example:

- Fabric JSON or Fabric canvas data → Saraswati Scene

Adapters:

- must be read-only
- must not mutate the source model
- must not leak legacy structures into Saraswati internals

Current source-of-truth files in this repo:

- `frontend/src/lib/saraswati/compat/from-fabric.ts`
- `frontend/src/lib/saraswati/compat/from-avnac.ts`

---

## Compatibility Contract

### What stays compatible

Saraswati adapters must support:

- importing Fabric JSON
- mapping objects to Saraswati nodes
- preserving position, scale, text, and image data
- basic grouping

That is enough compatibility for migration.

### What should not be compatible

Saraswati must not inherit:

- Fabric object lifecycle
- Fabric event system
- Fabric selection model
- Fabric transform behavior quirks
- Fabric canvas state

If Saraswati tries to preserve those behaviors internally, the engine inherits Fabric's complexity forever.

### Key design rule

Compatibility lives at the edges, not inside the engine.

So the contract is:

- Fabric → adapter only
- Saraswati → clean and opinionated
- Renderer → independent

---

## Current Implementation In This Repo

The current Saraswati slice is preview-first and compatibility-first.

Today it already includes:

- a versioned scene graph
- a pure command reducer
- render-command generation
- a Canvas2D renderer
- a Fabric adapter
- a preview entry point that tries Saraswati first and falls back to Fabric when needed

Current fast-preview support is intentionally narrow:

- `rect`
- `text`
- `image`

Unsupported or richer Fabric content still falls back to Fabric preview instead of being silently dropped.

That is deliberate. Safety is more important than pretending the migration is complete.

The adapter boundary is also where basic grouping support belongs as compatibility expands. Grouping must remain adapter-scoped rather than becoming an engine-wide dependency on Fabric semantics.

---

## Non-Goals

- Saraswati is not a UI framework
- Saraswati is not tied to any renderer
- Saraswati does not directly use GPU APIs
- Saraswati is not a drop-in Fabric replacement
- Saraswati v1 is not a big-bang rewrite of the live editor

---

## Key Rules

1. The scene is the single source of truth.
2. All changes go through commands.
3. Rendering is abstracted via `RenderCommands`.
4. Saraswati must remain renderer-agnostic.
5. No direct mutation of scene data.
6. No renderer logic inside the engine.
7. No UI logic inside the engine.

---

## Mental Model

Saraswati is the brain.

Renderers are the eyes.

UI is the hands.

Do not mix these responsibilities.
