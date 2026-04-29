import EditorRangeSlider from "@/components/editor/shared/editor-range-slider";

type CanvasZoomSliderProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onFitRequest?: () => void;
  disabled?: boolean;
};

export default function CanvasZoomSlider({
  value,
  min = 5,
  max = 100,
  onChange,
  onFitRequest,
  disabled,
}: CanvasZoomSliderProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-full border border-black/[0.08] bg-white/90 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-xl"
      title="Drag to zoom. Click the percentage to fit the page in view."
    >
      <EditorRangeSlider
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={onChange}
        aria-label="Canvas zoom"
        trackClassName="w-[9.5rem] sm:w-40"
      />
      {onFitRequest ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onFitRequest}
          className="min-w-[2.75rem] text-left text-sm tabular-nums text-neutral-600 outline-none hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40"
        >
          {value}%
        </button>
      ) : (
        <span className="min-w-[2.75rem] text-sm tabular-nums text-neutral-600">
          {value}%
        </span>
      )}
    </div>
  );
}
