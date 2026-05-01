# Scene Workspace Tasks

- [x] Revert runtime toggle experiment and keep SceneWorkspace as the preview/workspace boundary.
- [x] Make full SceneWorkspace fill the workspace area instead of rendering as a floating preview card.
- [x] Wire a local Saraswati editor controller into full SceneWorkspace.
- [x] Support scene-side pointer selection.
- [x] Support scene-side drag-to-move for selected nodes.
- [x] Render visible selection outlines in SceneWorkspace.
- [x] Lift scene interaction state into a shared scene workspace store.
- [x] Add transform handles and resize/rotate commands.
- [x] Move layer visibility and rename into scene-native commands.
- [x] Add scene-native hover/snap/measurement overlays.
- [x] Add scene-native clip editing handles and clip creation action.
- [x] Add render duration/command telemetry in SceneWorkspace footer (non-blocking).
- [x] Add scene-native insert flows for shapes, text, images, and vector boards.
- [~] Connect all scene workspace commands back to document persistence/history (Scene store now serializes via `toAvnacDocument`; autosave and compatibility hardening remain).
- [ ] Replace Fabric-only sidebar/toolbars with runtime-agnostic scene controllers.

## Phase 4 - Direct Avnac Pipeline

- [x] Schema contract signed off with web port maintainer.
- [ ] Implement versioned Avnac schema module (shared desktop/web contract).
- [ ] Implement chainable migration runner (pure per-version transforms).
- [~] Implement direct Avnac -> Saraswati adapter in `compat/from-avnac.ts` (direct mapper implemented with no `from-fabric` dependency; active imports rewired; parity tests added in `frontend/tests/saraswati/from-avnac-parity.test.ts`).
- [~] Implement Saraswati -> Avnac serializer in `to-avnac.ts` (baseline serializer implemented in `frontend/src/lib/saraswati/compat/to-avnac.ts` with round-trip tests in `frontend/tests/saraswati/to-avnac.test.ts`).
- [~] Wire Scene load/save to direct adapters (Scene store save path now serializes current scene with `toAvnacDocument`; clip-only patch file is now inactive and can be removed after final cleanup).
- [ ] Move `compat/from-fabric.ts` to legacy-only import paths.
- [ ] Add autosave on Scene command dispatch using direct serializer.
- [ ] Validate backward/forward compatibility with web-generated files.
- [~] Task 5.5 Dual-run validation: side-by-side render comparison harness added for fixtures + stored user docs (`frontend/src/lib/saraswati/validation/dual-run.ts`), with console summary/table + outlier helpers for debugging.
