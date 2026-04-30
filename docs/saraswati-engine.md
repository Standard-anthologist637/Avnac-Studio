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
- `frontend/src/lib/renderer/`

---

## Renderer Backends

Renderer implementations should not live inside Saraswati.

Saraswati owns the render language. The renderer layer interprets that language.

Current structure:

```text
frontend/src/lib/
	saraswati/
		render/
			commands.ts
	renderer/
		types.ts
		backends/
			canvas2d/
				renderer.ts
				text.ts
				shapes.ts
				shared.ts
			pixi/
				renderer.ts
				text.ts
				shapes.ts
```

The important rule is not the folder shape. The important rule is the contract.

Both renderers must implement the same `RenderCommand` language.

Conceptually:

```ts
type RenderCommand =
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "text"; text: string; x: number; y: number; fontSize: number }
  | {
      type: "image";
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
```

The real command types in this repo carry more detail such as paint, stroke, crop, scale, origin, and rotation, but the rule stays the same: backend-specific types must not leak into the command model.

If Pixi introduces Pixi-specific scene objects into Saraswati state, abstraction is already broken.

This is the correct dependency direction:

- Saraswati can define `RenderCommands`
- renderer backends can depend on `RenderCommands`
- Saraswati should not own Canvas2D or Pixi implementation files

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

What swappable renderer really means:

- Saraswati logic does not change
- scene logic does not branch by backend
- command generation stays identical
- only the interpreter changes

In practice, the thing being swapped is this shape of responsibility:

- `render(commands, canvasContext)`
- `render(commands, pixiApp)`

Everything above that boundary should remain the same.

Canvas2D backend responsibilities:

- `fillRect` or path drawing for shapes
- `fillText` or `strokeText` for text
- `drawImage` for images
- simple transforms and paint application

Pixi backend responsibilities:

- `Graphics` or equivalent for shapes
- `Text` for text
- `Sprite` for images
- GPU-friendly batching and display-tree output

What not to do:

- do not put scene logic inside the Pixi folder
- do not let Pixi nodes become the scene model
- do not store Pixi or Canvas objects in Saraswati state
- do not branch engine logic with renderer conditionals such as `if (renderer === "pixi")`

That would turn the renderer from an interpreter into a second engine, which is exactly what Saraswati is trying to avoid.

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

## Runtime Flow

The intended runtime loop is:

```text
UI → Commands → Engine → Renderer → UI reflects result
```

This means:

- UI gathers intent
- Saraswati converts intent into deterministic state changes
- render commands are produced from state
- a backend interprets those commands
- the UI reflects the updated scene state rather than owning it

---

## Workspace Migration Layer

The migration should not jump straight from `FabricEditor` to a final Saraswati editor.

There needs to be a workspace layer where editor orchestration can live while the runtime underneath is still changing.

Current workspace boundary:

- `frontend/src/components/scene-workspace/workspace.tsx`
- `frontend/src/components/scene-workspace/store.ts`
- `frontend/src/components/scene-workspace/stage.tsx`

Responsibilities of this layer:

- own workspace-level UI state that does not belong in Saraswati
- reduce prop drilling with Zustand where shell state is shared
- keep Fabric-specific runtime details behind a boundary while the Saraswati stage grows
- provide the place where Saraswati stage rendering can replace Fabric incrementally instead of through a big-bang swap

What belongs here:

- sidebar or panel state
- renderer mode selection
- workspace-level chrome and orchestration
- migration glue between legacy editor runtime and Saraswati stage

What does not belong here:

- scene truth
- renderer-specific object models
- Fabric lifecycle semantics

This layer exists so maintainers can keep porting behavior out of `FabricEditor` without forcing Saraswati to absorb UI shell concerns.

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
- an external renderer backend layer under `frontend/src/lib/renderer/`
- a new scene-editor workspace boundary under `frontend/src/components/scene-workspace/`
- a Canvas2D backend renderer
- a Pixi placeholder backend with no engine coupling
- a Fabric adapter
- a preview entry point that tries Saraswati first and falls back to Fabric when needed

Current fast-preview support is intentionally narrow:

- `rect`
- `text`
- `image`

Unsupported or richer Fabric content still falls back to Fabric preview instead of being silently dropped.

That is deliberate. Safety is more important than pretending the migration is complete.

The adapter boundary is also where basic grouping support belongs as compatibility expands. Grouping must remain adapter-scoped rather than becoming an engine-wide dependency on Fabric semantics.

The current live editor is still Fabric-backed. The renderer backend work starts at the preview boundary first because that is the safest place to prove the abstraction before the interactive editor is migrated.

Moving the backend layer out of Saraswati is also part of moving away from Fabric the right way: Avnac now has a renderer layer that does not belong to Fabric and does not belong to the engine. That gives the migration a clean place to grow without leaking renderer concerns back into Saraswati.

---

## Non-Goals

- Saraswati is not a UI framework
- Saraswati is not tied to any renderer
- Saraswati does not directly use GPU APIs
- Saraswati is not a drop-in Fabric replacement
- Saraswati v1 is not a big-bang rewrite of the live editor

---

## Phased Renderer Plan

### Phase 1

- Canvas2D renderer only
- strict `RenderCommand` system
- clean scene model
- preview boundary integration first

### Phase 2

- plug in Pixi using the same commands
- keep command generation identical
- measure where Pixi actually helps dense scenes

### Phase 3

- choose backend dynamically or by performance profile
- keep the engine unchanged while interpreters vary

The key point is that Saraswati does not swap engines. It swaps interpreters of the same language.

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
