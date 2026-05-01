import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import SceneEditorPage from "@/features/scene-editor/scene-editor-page";
import { useSceneEditorStore } from "@/features/scene-editor/store";

type SceneSearch = {
  id?: string;
};

export const Route = createFileRoute("/scene")({
  validateSearch: (raw: Record<string, unknown>): SceneSearch => ({
    id:
      typeof raw.id === "string" && raw.id.length > 0 ? raw.id : undefined,
  }),
  component: ScenePage,
});

function ScenePage() {
  const { id } = Route.useSearch();
  const load = useSceneEditorStore((s) => s.load);
  const reset = useSceneEditorStore((s) => s.reset);

  useEffect(() => {
    if (id) void load(id);
    return () => {
      reset();
    };
  }, [id, load, reset]);

  return <SceneEditorPage documentId={id ?? null} />;
}
