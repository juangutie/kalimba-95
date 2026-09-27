// Per-level game state: which files are left, what's been filed where, score, mistakes, streaks.
import { correctFolder } from './items.js';

export function createGame(level, items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const remaining = new Set(byId.keys());
  const filed = new Map(); // folderId -> [item]
  let correct = 0;
  let mistakes = 0;
  let streak = 0;

  return {
    level,
    items,
    get remaining() { return remaining.size; },
    get correct() { return correct; },
    get mistakes() { return mistakes; },
    get streak() { return streak; },
    isComplete: () => remaining.size === 0,
    item: (id) => byId.get(id),
    /** Items already sorted into a folder, in the order they were filed. */
    filedIn: (folderId) => filed.get(folderId) ?? [],

    /** Count a mistake that isn't a misfiled file (e.g. running a virus). */
    penalize() {
      mistakes++;
      streak = 0;
    },

    /** Returns { result: 'correct' | 'wrong' | 'ignored', folder, count, complete, target } */
    drop(itemId, folderId) {
      const item = byId.get(itemId);
      if (!item || !remaining.has(itemId)) return { result: 'ignored' };
      const target = correctFolder(item);
      if (folderId !== target) {
        mistakes++;
        streak = 0;
        return { result: 'wrong', folder: folderId, target };
      }
      remaining.delete(itemId);
      correct++;
      streak++;
      if (!filed.has(folderId)) filed.set(folderId, []);
      filed.get(folderId).push(item);
      return { result: 'correct', folder: folderId, count: filed.get(folderId).length, complete: remaining.size === 0 };
    },

    score(timeLeft = 0) {
      return Math.max(0, correct * 100 - mistakes * 25 + timeLeft * 10);
    },
  };
}
