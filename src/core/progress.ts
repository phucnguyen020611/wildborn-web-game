import { ACTS, type ActId } from '../config/acts';
import { emptyInventory, ITEMS, SPEAR_TIERS, type Inventory } from '../config/items';

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

/** What a rest at a camp fire keeps for the next visit to the act. */
export interface Bag {
  inventory: Inventory;
  spearTier: number;
  camp: number;
}

/** A stored bag, or null when there is none or it doesn't look right. */
export function parseBag(raw: string | null): Bag | null {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (data?.v !== VERSION) return null;
    const inventory = emptyInventory();
    for (const id of ITEMS) {
      const n = data.inventory?.[id];
      if (Number.isInteger(n) && n >= 0) inventory[id] = n;
    }
    const tier = Number.isInteger(data.spearTier) ? data.spearTier : 0;
    const camp = Number.isInteger(data.camp) && data.camp >= 0 ? data.camp : 0;
    return { inventory, spearTier: Math.max(0, Math.min(SPEAR_TIERS.length - 1, tier)), camp };
  } catch {
    return null;
  }
}

const bagKey = (act: ActId) => `wildborn.bag.${act}`;

export function loadBag(act: ActId) {
  try {
    return parseBag(localStorage.getItem(bagKey(act)));
  } catch {
    return null;
  }
}

export function saveBag(act: ActId, bag: Bag) {
  try {
    localStorage.setItem(bagKey(act), JSON.stringify({ v: VERSION, ...bag }));
  } catch {
    // storage blocked or full: the bag lasts this session only
  }
}
