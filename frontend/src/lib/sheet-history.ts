/**
 * Lets the Android/browser back button close the top-most open sheet instead of leaving the page.
 * Each open sheet owns one history entry; closing it any other way removes that entry again.
 */
type Entry = { id: number; close: () => void; pushed: boolean };

const stack: Entry[] = [];
let waiters: Array<() => void> = [];
let pendingPops = 0;
let listening = false;
let seq = 0;
let fallbackTimer: number | undefined;

function flush() {
  window.clearTimeout(fallbackTimer);
  pendingPops = 0;
  const run = waiters;
  waiters = [];
  run.forEach((fn) => fn());
}

function onPopState() {
  if (pendingPops > 0) {
    // This pop is the one we triggered ourselves while closing a sheet programmatically.
    pendingPops -= 1;
    if (pendingPops === 0) flush();
    return;
  }
  stack.pop()?.close();
}

/** Runs `fn` once no sheet-triggered history.back() is still in flight (safe moment to navigate). */
export function afterSheetHistorySettled(fn: () => void) {
  if (pendingPops === 0) fn();
  else waiters.push(fn);
}

export function pushSheetEntry(close: () => void) {
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  const entry: Entry = { id: ++seq, close, pushed: false };
  stack.push(entry);
  // If another sheet is still unwinding its entry (one closes as the next opens), wait for it,
  // otherwise that pending back() would remove the entry we are about to add.
  afterSheetHistorySettled(() => {
    if (!stack.includes(entry)) return; // closed again before it ever got an entry
    window.history.pushState({ ...(window.history.state ?? {}), __sheet: entry.id }, "");
    entry.pushed = true;
  });
  return entry.id;
}

export function releaseSheetEntry(id: number) {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index === -1) return; // already consumed by the back button
  const [entry] = stack.splice(index, 1);
  if (!entry.pushed || window.history.state?.__sheet !== id) return; // nothing of ours on top
  pendingPops += 1;
  window.clearTimeout(fallbackTimer);
  fallbackTimer = window.setTimeout(flush, 600);
  window.history.back();
}
