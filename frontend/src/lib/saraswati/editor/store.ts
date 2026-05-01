import { applyCommand } from "../commands/reducer";
import type { SaraswatiCommand } from "../commands/types";
import type { SaraswatiScene } from "../scene";

export type SaraswatiEditorState = {
  scene: SaraswatiScene;
};

type Listener = (state: SaraswatiEditorState) => void;

export type SaraswatiEditorStore = {
  getState: () => SaraswatiEditorState;
  subscribe: (listener: Listener) => () => void;
  dispatch: (command: SaraswatiCommand) => void;
};

export function createSaraswatiEditorStore(
  initialScene: SaraswatiScene,
): SaraswatiEditorStore {
  let state: SaraswatiEditorState = {
    scene: initialScene,
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
  };
}
