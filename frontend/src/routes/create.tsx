import { createFileRoute, redirect } from "@tanstack/react-router";

type CreateSearch = {
  id?: string;
  w?: number;
  h?: number;
};

function parseSearchDimension(v: unknown): number | undefined {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(16000, Math.max(100, Math.round(n)));
}

/**
 * /create is retired — redirect to /scene with the same id/w/h params.
 */
export const Route = createFileRoute("/create")({
  validateSearch: (raw: Record<string, unknown>): CreateSearch => {
    const id = raw.id;
    return {
      id: typeof id === "string" && id.length > 0 ? id : undefined,
      w: parseSearchDimension(raw.w),
      h: parseSearchDimension(raw.h),
    };
  },
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/scene",
      search: { id: search.id, w: search.w, h: search.h },
      replace: true,
    });
  },
  component: () => null,
});
