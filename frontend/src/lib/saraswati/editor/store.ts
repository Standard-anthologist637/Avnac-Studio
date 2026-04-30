import { applyCommand } from "../commands/reducer";
import type { SaraswatiCommand } from "../commands/types";
import type { SaraswatiScene } from "../scene";

export type SaraswatiEditorState = {
  scene: SaraswatiScene;
  selectedIds: string[];
};

type Listener = (state: SaraswatiEditorState) => void;

export type SaraswatiEditorStore = {
  getState: () => SaraswatiEditorState;
  subscribe: (listener: Listener) => () => void;
  dispatch: (command: SaraswatiCommand) => void;
  setSelectedIds: (selectedIds: string[]) => void;
};

export function createSaraswatiEditorStore(
  initialScene: SaraswatiScene,
): SaraswatiEditorStore {
  let state: SaraswatiEditorState = {
    scene: initialScene,
    selectedIds: [],
  };
  const listeners = new Set<Listener>();

  function emit() {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(command) {
      const nextScene = applyCommand(state.scene, command);
      if (nextScene === state.scene) return;
      state = { ...state, scene: nextScene };
      emit();
    },
    setSelectedIds(selectedIds) {
      state = { ...state, selectedIds: [...selectedIds] };
      emit();
    },
  };
}
