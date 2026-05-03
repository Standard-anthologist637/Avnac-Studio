# Architecture Decisions

## Who this is for

Avnac Studio is a web-based design editor built in React and TypeScript. It lets users create, edit, and export vector graphics and layouts. This document explains why we made four specific architecture decisions and what trade-offs they represent.

This is written for engineers building or maintaining the editor, and for anyone considering whether these patterns might apply to their own canvas editor project. It assumes familiarity with React, TypeScript, and the problems of building interactive graphics software. It is not a tutorial on how to build a canvas editor from scratch — it is a record of decisions we made when we inherited one built on Fabric and needed to make it portable, testable, and independent.

Each decision was made because we hit a real wall. Understanding the wall makes it easier to defend the decision when it feels inconvenient, and easier to know when we should violate it.

---

## 1. The Fabric migration story — what was wrong, how we fixed it

This is where the other three decisions come from. If we had never migrated from Fabric, we would never have discovered the constraints. So we start here.

### What was wrong

Fabric was the original renderer for Avnac. It was also, unintentionally, the document model.

When you saved a document in the old editor, you called `canvas.toJSON()`. What came back was a Fabric JSON blob — an object that described Fabric's internal representation of the canvas. It contained fields that were meaningful to Fabric and meaningless to anything else: `type: "ActiveSelection"`, `cornerStrokeColor`, `transparentCorners`, `hasControls`.

The consequence:

- **Every load was a Fabric load.** You could not load a document without Fabric running. You could not inspect a document without instantiating a canvas. There was no scene you could reason about independently.
- **Every operation required Fabric state.** Getting the position of a node meant calling `object.getBoundingRect()` on a live Fabric object. There was no pure math for bounds. The renderer was required to answer spatial questions.
- **Tests were impossible.** You could not unit-test any document operation because the document existed only inside Fabric's runtime.
- **Export required a live canvas.** Even producing a PNG required a Fabric canvas to be alive and painted. The export path had implicit dependencies on the rendering environment.
- **Coordinate systems diverged.** Fabric's internal coordinates, its exported JSON coordinates, and what was rendered on screen were related but not identical. Fabric applied additional transforms during rendering that were not reflected in the data model. Developers working on the editor encountered persistent bugs where a node's stored X/Y did not match its visible position.

### The hardest bug we faced

The most concrete problem was coordinate mapping. Fabric uses a local-origin transform model where an object's `left` and `top` refer to its visual center when `originX` and `originY` are `"center"`, but to its top-left corner when they are `"left"` and `"top"`. Whether the visual center and the transform origin are the same point depends on the object's `originX`/`originY` setting — which varied per object in the legacy data.

The practical result: a shape that appeared at position (400, 300) on screen might have `left: 500, top: 400` in Fabric's JSON if the object's origin was `"center"` and the shape was 200×200.

When we tried to port that position directly into a Saraswati node, the rendered position was wrong by exactly half the shape's dimensions.

The fix required reading the origin fields from the Fabric export and computing the actual top-left corner during adaptation:

```ts
// In the compatibility adapter:
const x =
  fabricObj.left - (fabricObj.originX === "center" ? fabricObj.width / 2 : 0);
const y =
  fabricObj.top - (fabricObj.originY === "center" ? fabricObj.height / 2 : 0);
```

Once this was normalised at the boundary, Saraswati nodes have consistent semantics: `x` and `y` are always the top-left of the untransformed bounding box. This bug is why we have the constraints we do in the next three sections.

### How we fixed it

The fix was Saraswati. But the important part of the fix was not the new engine — it was establishing what the document model actually is.

The core insight: **the scene must be a value, not a runtime**.

A `SaraswatiScene` is a plain JavaScript object. It contains nodes with explicit transforms. It does not depend on Fabric being alive. It does not contain renderer-specific fields. It is the document.

```ts
type SaraswatiRectNode = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  fill: BgValue;
  stroke: BgValue | null;
  strokeWidth: number;
  // ...
};
```

This is the whole node. There is no renderer object attached. There is no Fabric prototype. You can clone it, diff it, serialize it, and test it without a canvas.

**Spatial operations became pure.** `getNodeBounds(node)` is a pure function. It takes a node and returns bounds with no external dependencies. This became the single source of truth for all hit testing, all inspector panel coordinates, and all selection overlays. Before this function existed, three different parts of the codebase computed bounds independently and got different answers.

**The migration was incremental.** Fabric was not removed in a single pass. The workspace layer (`scene-workspace/`) was introduced as a boundary where both the old Fabric editor and the new Saraswati stage could live at the same time. The Saraswati stage replaced Fabric's visible surface progressively while the document migration happened underneath.

**A compatibility adapter handles legacy documents.** The adapter converts Fabric JSON to `SaraswatiScene`. It is read-only and isolated. Fabric's types do not leak past it. Once a document is loaded through the adapter and expressed as a `SaraswatiScene`, it is a Saraswati document. It does not carry Fabric's shapes forward.

### What the migration resolved

- You can now load and inspect any document without a live renderer.
- Bounds computation is a deterministic function. The inspector, the selection overlay, and hit testing all read from `getNodeBounds`. Coordinates match.
- Tests run in a plain Node environment. No DOM, no canvas, no Fabric.
- Export does not require a live canvas. Render commands are built from the scene and passed to a headless backend.
- The document format is Avnac's format, not Fabric's format.

---

## 2. Why a command/reducer pattern in a canvas editor

The Fabric problem taught us that direct mutation is a liability. Once you decouple the scene from the renderer, you need a deterministic way to change the scene. That is where the command pattern comes in.

### The problem it replaced

Before Saraswati, mutations to the canvas were direct. When a user moved a shape, a handler function reached into the canvas state and changed the object. When they resized, another handler mutated a different field. When multiple operations composed, you had to trace through several call sites to know what had actually changed.

This created three practical problems:

**Undo was fragile.** You could not replay a history entry because history was recorded as a diff after the fact, not as an intent before the fact. Reverting an undo meant reversing side effects that had already happened, and some of those were hard to reverse accurately.

**Interaction logic was scattered.** The drag handler, the toolbar handler, the keyboard shortcut handler, and the import handler all had their own paths to mutate state. Changing how rotation worked meant hunting down every place that touched rotation. Some were missed. Bugs stayed inconsistent.

**Testing was painful.** Because mutations reached directly into canvas objects, you could not write a test without constructing a real canvas or mocking the runtime. Tests were slow, environment-sensitive, and brittle.

### The decision

All changes to the scene must go through a command.

A command is a plain data object that describes what is being requested:

```ts
{ type: "MOVE_NODE", id: "abc", dx: 10, dy: 0 }
{ type: "ROTATE_NODE", id: "abc", rotation: 45 }
{ type: "RESIZE_NODE", id: "abc", x: 20, y: 30, width: 200, height: 100 }
```

Commands are passed to a reducer — a pure function — that takes the current scene and the command, and returns a new scene:

```ts
function applyCommand(
  scene: SaraswatiScene,
  command: SaraswatiCommand,
): SaraswatiScene;
```

The reducer is the only place mutation logic lives. Every caller, regardless of which surface triggered the change, sends the same command through the same function.

### What this buys you

**Undo becomes tractable.** Because every change is expressed as a command with a known intent, you record the command. Undo replays the inverse. Time-travel debugging is the same operation at a different index. (Implementing the inverse for complex operations like group transforms is genuinely hard, but at least there is a clear implementation path.)

**Interaction logic is centralised.** Drag, keyboard, inspector, import — all of them produce commands. There is one place to fix rotation logic. There is one place to fix resize math. You are not chasing multiple implementations.

**The engine is pure and testable.** `applyCommand` takes a scene and returns a scene. No canvas, no DOM, no renderer. You can test the entire document logic with plain objects. The 18 tests that run in this repo test exactly this.

**Serialisation falls out for free.** A command list is a complete description of how a document was built. You can replay commands to regenerate any historical state. You can send commands over a wire. You can store them.

### The constraint you must preserve

Once you start adding direct mutation paths — a handler that skips the command system and writes to the store directly because it feels faster to write — you will undo most of these benefits. The value of the pattern depends on it being the only path.

If you need a new operation, add a command type. Do not add a bypass.

---

## 3. Why the RenderCommand abstraction exists and what it buys you

The migration to a value-based scene model meant we also needed a value-based rendering contract. RenderCommands are to rendering what SaraswatiCommands are to state. They decouple what we draw from how we draw it.

### The problem it replaced

When Avnac ran on Fabric, the scene _was_ Fabric. When you stored a shape, you stored a `fabric.Rect`. When you loaded a document, you called `canvas.loadFromJSON`. When you needed to know where something was, you asked Fabric.

This was fine for a single-renderer world. It became a problem as soon as the renderer needed to change.

There is no way to swap Fabric for Canvas2D, WebGL, or a Go-native renderer when the document model is made of Fabric objects. You would have to rewrite the entire document layer to swap the renderer. The renderer is no longer interchangeable — it is load-bearing.

The second problem was that any logic that needed to read scene data was dependent on the renderer being alive. You could not compute bounds without a live Fabric canvas. You could not run a test without instantiating Fabric. Anything that touched the scene pulled in everything.

### The decision

Saraswati separates what to draw from how to draw it.

The engine produces `RenderCommands` — plain data structures that describe a drawing instruction:

```ts
type SaraswatiRenderCommand =
  | { type: "rect"; x: number; y: number; width: number; height: number; fill: BgValue; ... }
  | { type: "text"; text: string; fontSize: number; fontFamily: string; ... }
  | { type: "image"; src: string; cropX: number; cropY: number; ... }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; ... }
```

The `buildRenderCommands(scene)` function walks the scene and produces this list. It lives in Saraswati. It knows nothing about Canvas2D, Pixi, or WebGL.

Renderers receive this list and interpret it:

```ts
// Canvas2D backend
function render(
  commands: SaraswatiRenderCommand[],
  ctx: CanvasRenderingContext2D,
): void;

// Pixi backend (future)
function render(
  commands: SaraswatiRenderCommand[],
  app: PIXI.Application,
): void;
```

Both backends implement the same contract. The thing being swapped is only the interpreter.

### What this buys you

**Renderer is genuinely replaceable.** The current implementation uses Canvas2D. The abstraction is already set up so that future renderers (Pixi, WebGL, GPU, Go-native) can be added without touching any scene logic. The engine does not care which backend is chosen.

**Scene logic does not branch by backend.** There is no `if (renderer === "pixi")` in the command system. There is no renderer-specific import at the top of the spatial module. The engine is a closed system.

**The artboard is first-class.** The artboard is just another render command (`__artboard__`). It is not a special renderer concept. It comes from the scene, flows through the same pipeline, and can be tested the same way.

**Export is independent.** Because the document is expressed in render commands, you can produce an export render without running the live renderer. You build the commands from the scene and send them to a headless backend. No canvas needs to be visible.

### The constraint you must preserve

The direction of dependency must stay one-way: Saraswati defines `RenderCommands`, renderers depend on `RenderCommands`, and Saraswati must not depend on any renderer.

If a renderer-specific type (a Pixi `DisplayObject`, a Fabric `Object`, a Canvas2D path) ever leaks into a `RenderCommand` field, the abstraction is broken. The command becomes an adapter for one renderer, not a language shared by all.

If renderer objects are stored in Saraswati state to avoid rebuilding them each frame, the renderer has become the scene model. This is the original Fabric problem repeated.

The rule is: backend-specific types must not appear in the command model, the scene model, or anything Saraswati owns.

---

## 4. The Avnac format portability decision

Once the scene is a value and the renderer is an interpreter, the format follows. The Avnac document format must be owned by Avnac, not by any dependency.

### The problem being solved

If the document format is tied to one renderer, you can never change the renderer without a breaking change to every saved file. Every user document becomes a hostage to the technology stack that created it.

This was the Fabric situation. Fabric JSON was useful for Fabric. It was useless for anything else and contained fields no other system could interpret.

The portability decision is: **the Avnac document format must be owned by Avnac, not by any dependency**.

### What the format is

The Avnac document is a serialised `SaraswatiScene`. It contains:

- an artboard with explicit dimensions and background
- a flat map of nodes, each with an explicit type and explicit transforms
- no renderer-specific fields
- no runtime objects
- no implicit behaviour

Every field in the format has a clear meaning that can be reimplemented by any system that reads the spec. There are no hidden conventions from Fabric, from Canvas2D, or from Pixi that a reader needs to know about to get correct results.

### What portability enables

**Multiple rendering backends against the same format.** The Canvas2D renderer is the current implementation. The format is designed so that future backends (Pixi, WebGL, Go-native) can all render from the same `SaraswatiScene` without format changes.

**Go-native rendering for export.** The export pipeline in the Wails build targets a Go-native render path. This works because the format the Go side receives is a plain JSON structure with explicit semantics. A Go implementation does not need to know about Fabric or JavaScript Canvas to interpret the document.

**Cross-platform consistency.** A document saved on desktop should produce identical output in a future web or mobile build. Because the format captures intent (a rect at this position with this fill) rather than renderer state (a Fabric object with this internal transform), any compliant renderer produces the same result.

**Longevity.** Renderer technology changes. WebGL superseded Canvas2D for many use cases. WebGPU is superseding WebGL. A format tied to a specific renderer ages poorly as the renderer is replaced. A format that describes document intent is independent of those changes.

### The constraint you must preserve

The format must not acquire renderer-specific fields. If Canvas2D uses a particular coordinate convention for a feature, the format must not store that convention — it must store the intent and let the renderer apply its own convention when interpreting.

If a field exists in the format only because it is what a particular backend happens to store, that field is a leak. The question to ask before adding a field to the scene model is: could a completely different renderer implement this correctly from this field alone, without knowing anything about the backend that wrote it?

If the answer is no, the field belongs in the renderer's layer, not in the scene.

### The practical constraint on migration

The flip side of format portability is format stability. Once documents are saved in the Avnac format, those documents become a compatibility surface. A schema change that breaks existing documents is a user-visible regression regardless of how clean the internal change is.

The current practice is that the compatibility adapter — which converts any older format into the current `SaraswatiScene` schema — is the place where migration logic lives. The scene model can evolve; the adapter absorbs the conversion. User documents should never stop loading.
