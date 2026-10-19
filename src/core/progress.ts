import { ACTS, type ActId } from '../config/acts';

const KEY = 'wildborn.progress';
const VERSION = 1;

/** Acts whose main boss has fallen, from stored JSON; anything unexpected counts as no progress. */
export function parseProgress(raw: string | null): ActId[] {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (data?.v !== VERSION || !Array.isArray(data.done)) return [];
    return ACTS.map((a) => a.id).filter((id) => data.done.includes(id));
  } catch {
    return [];
  }
}

let done: ActId[] = (() => {
  try {
    return parseProgress(localStorage.getItem(KEY));
  } catch {
    return []; // storage blocked: progress lasts this session only
  }
})();

export const completedActs = (): readonly ActId[] => done;

/** An act is open once every act before it is done. */
export const isUnlocked = (id: ActId) => {
  const i = ACTS.findIndex((a) => a.id === id);
  return ACTS.slice(0, i).every((a) => done.includes(a.id));
};

export function completeAct(id: ActId) {
  if (done.includes(id)) return;
  done = parseProgress(JSON.stringify({ v: VERSION, done: [...done, id] })); // keeps act order
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, done }));
  } catch {
    // storage blocked or full: keep it in memory
  }
}
