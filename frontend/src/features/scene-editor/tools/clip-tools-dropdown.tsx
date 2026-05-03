import { CropIcon, Delete02Icon, UndoIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { isSaraswatiRenderableNode } from "@/lib/saraswati";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSceneEditorStore } from "../store";

type ClipMenuItem = {
  label: string;
  icon: typeof CropIcon;
  action: () => void;
  enabled: boolean;
};

export default function ClipToolsDropdown() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectedIds = useSceneEditorStore((s) => s.selectedIds);
  const addClipToSelection = useSceneEditorStore((s) => s.addClipToSelection);
  const removeClipFromSelection = useSceneEditorStore(
    (s) => s.removeClipFromSelection,
  );
  const resetClipOnSelection = useSceneEditorStore(
    (s) => s.resetClipOnSelection,
  );

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !anchorRef.current) return;
      if (!anchorRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const state = useMemo(() => {
    if (!scene || selectedIds.length !== 1) {
      return { canAdd: false, canRemove: false, canReset: false };
    }
    const node = scene.nodes[selectedIds[0]!];
    if (!node || !isSaraswatiRenderableNode(node) || node.type === "line") {
      return { canAdd: false, canRemove: false, canReset: false };
    }
    const hasClip = Boolean(node.clipPath);
    return {
      canAdd: !hasClip,
      canRemove: hasClip,
      canReset: hasClip,
    };
  }, [scene, selectedIds]);

  const items: ClipMenuItem[] = [
    {
      label: "Add clip",
      icon: CropIcon,
      action: () => {
        addClipToSelection();
        setOpen(false);
      },
      enabled: state.canAdd,
    },
    {
      label: "Reset clip",
      icon: UndoIcon,
      action: () => {
        resetClipOnSelection();
        setOpen(false);
      },
      enabled: state.canReset,
    },
    {
      label: "Remove clip",
      icon: Delete02Icon,
      action: () => {
        removeClipFromSelection();
        setOpen(false);
      },
      enabled: state.canRemove,
    },
  ];

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] text-neutral-700 transition",
          "hover:bg-black/[0.05] hover:text-neutral-900",
          open ? "bg-black/[0.05] text-neutral-900" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setOpen((current) => !current)}
        title="Clip tools"
        aria-label="Clip tools"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <HugeiconsIcon icon={CropIcon} size={18} strokeWidth={1.75} />
      </button>
      {open ? (
        <div className="absolute bottom-full right-0 z-[90] mb-2 w-44 overflow-hidden rounded-xl border border-black/[0.08] bg-white py-1 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Clip
          </p>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] font-medium text-neutral-800 hover:bg-black/[0.04] disabled:pointer-events-none disabled:opacity-35"
              disabled={!item.enabled}
              onClick={item.action}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={15}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
