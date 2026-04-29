export const topBarShellClass = [
  "relative z-[70] flex min-h-14 items-center gap-2 overflow-visible rounded-[1.75rem] border border-black/[0.08] bg-white/92 px-2.5 py-2",
  "shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-xl",
].join(" ");

export const topBarGroupClass = [
  "flex items-center gap-1 rounded-full border border-black/[0.06] bg-black/[0.02] p-1",
  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]",
].join(" ");

export const pageIconButtonClass = [
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors",
  "hover:bg-black/[0.08] hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-subtle)",
].join(" ");

export const pageActionButtonClass = [
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium",
  "text-neutral-800 transition-colors hover:bg-black/[0.08]",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

export const topBarHomeLinkClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-700 no-underline transition-colors hover:bg-black/[0.08] hover:text-neutral-900";

export const actionMenuPopoverClass =
  "absolute right-0 top-full z-[140] mt-2 w-56 p-1.5";

export const destructiveIconButtonClass = [
  pageIconButtonClass,
  "text-neutral-500 hover:bg-red-500/[0.08] hover:text-red-600",
].join(" ");

export const pageTabButtonClass = [
  "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-medium transition-[background,color,box-shadow]",
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

export const topBarDividerClass = "h-6 w-px shrink-0 bg-black/[0.06]";

export const tabRailFadeClass =
  "pointer-events-none absolute inset-y-0 z-10 w-5 bg-gradient-to-r from-white via-white/90 to-transparent";

export const titleFieldClass = [
  "min-w-0 rounded-full bg-white/85 px-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
  "transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_0_0_3px_rgba(24,119,242,0.08)]",
].join(" ");

export const tabRailClass = [
  "flex min-w-max items-center gap-1 rounded-full bg-white/72 px-1 py-0.5",
  "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
].join(" ");

export const actionMenuButtonClass = [
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-neutral-800",
  "hover:bg-black/[0.06] disabled:pointer-events-none disabled:opacity-40",
].join(" ");

export const actionMenuSeparatorClass = "my-1 border-t border-black/[0.06]";

export const pngCardClass =
  "mx-1 mb-1 rounded-xl bg-(--surface-subtle) px-3 pb-3 pt-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]";

export function tabButtonStateClass(active: boolean): string {
  return active
    ? "bg-white text-(--text) shadow-[0_4px_14px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.04)]"
    : "text-neutral-700 hover:bg-white/72 hover:text-neutral-900";
}

export function actionChevronClass(open: boolean): string {
  return open ? "rotate-180 transition-transform" : "transition-transform";
}

export function shouldIgnoreShortcutTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, [contenteditable="true"], [data-avnac-chrome]',
    ),
  );
}

export type PageTabItem = {
  index: number;
  label: string;
  active: boolean;
};

export function buildPageTabs(
  pageCount: number,
  currentPage: number,
): PageTabItem[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    index,
    label: `Page ${index + 1}`,
    active: index === currentPage,
  }));
}
