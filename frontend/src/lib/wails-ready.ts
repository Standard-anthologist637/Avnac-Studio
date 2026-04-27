/**
 * wails-ready.ts
 *
 * Exposes `onWailsReady(fn)` — a reliable way to run code only after the
 * Wails IPC channel is fully connected.
 *
 * Go emits the "avnac:ready" event from `OnDomReady` (which fires every
 * page load/reload, after the IPC connection is established). We register
 * the Wails EventsOn listener at module-evaluation time — before any
 * React component renders — so we never miss the event.
 *
 * If the Wails runtime is not present (plain browser dev without Go), the
 * module marks itself ready immediately so app code still runs.
 */

import { EventsOn } from "../../wailsjs/runtime/runtime";

let ready = false;
const queue: Array<() => void> = [];

function drain() {
  const fns = queue.splice(0);
  for (const fn of fns) fn();
}

try {
  // EventsOn fires every time the event is emitted, which is what we want:
  // once per page load / hot-reload, Go calls domReady → emits "avnac:ready".
  EventsOn("avnac:ready", () => {
    ready = true;
    drain();
  });
} catch {
  // window.runtime not available — running outside Wails (e.g. `npm run dev`
  // without the Go backend). Treat as immediately ready.
  ready = true;
}

/**
 * Calls `fn` as soon as the Wails backend signals it is ready.
 * If already ready (event already received), calls `fn` synchronously.
 *
 * Returns a cancel function: call it to remove `fn` from the queue if the
 * component that registered it unmounts before the event fires.
 */
export function onWailsReady(fn: () => void): () => void {
  if (ready) {
    fn();
    return () => {};
  }
  queue.push(fn);
  return () => {
    const i = queue.indexOf(fn);
    if (i >= 0) queue.splice(i, 1);
  };
}
