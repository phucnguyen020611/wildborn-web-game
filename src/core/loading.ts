export interface LoadProgress {
  done: number; // settled (loaded or failed)
  total: number;
  failed: number;
}

const state: LoadProgress = { done: 0, total: 0, failed: 0 };
const listeners = new Set<(p: LoadProgress) => void>();
const emit = () => listeners.forEach((fn) => fn({ ...state }));

/** Counts `p` toward the loading screen. Returns `p` unchanged so callers keep their own error handling. */
export function track<T>(p: Promise<T>): Promise<T> {
  state.total++;
  emit();
  p.then(
    () => {
      state.done++;
      emit();
    },
    () => {
      state.done++;
      state.failed++;
      emit();
    },
  );
  return p;
}

/** Calls `fn` now and after every change. */
export function onLoadProgress(fn: (p: LoadProgress) => void) {
  listeners.add(fn);
  fn({ ...state });
}
