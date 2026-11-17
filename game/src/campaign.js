// Mosslight Courier — campaign progression and save format.
//
// Pure logic over plain objects: the unlock chain, per-region records, and a
// strictly validated save string. The browser (main.js) only wraps these with
// localStorage; Node tests run them directly. No DOM access in this module.

import { REGION_COUNT } from './regions.js';
import { GRADES } from './config.js';
import { gradeFor } from './world.js';

export const SAVE_VERSION = 2;

/** A fresh campaign: only the first grove is open. */
export function createCampaign() {
  return {
    version: SAVE_VERSION,
    regions: Array.from({ length: REGION_COUNT }, () => ({
      cleared: false,
      bestScore: 0,
      bestGrade: null,
    })),
    runs: 0,
  };
}

/** Rank of a grade letter; lower is better, unknown letters rank last. */
export function gradeRank(letter) {
  const i = GRADES.findIndex((g) => g.letter === letter);
  return i === -1 ? GRADES.length : i;
}

/** Region idx is playable when it is the first and only when every predecessor is cleared. */
export function isUnlocked(camp, idx) {
  if (idx <= 0) return idx === 0;
  if (idx >= REGION_COUNT) return false;
  for (let i = 0; i < idx; i++) {
    const prev = camp.regions[i];
    if (!prev || !prev.cleared) return false;
  }
  return true;
}

/** How many regions have been cleared. */
export function totalCleared(camp) {
  return camp.regions.filter((r) => r && r.cleared).length;
}

/** The first region not yet cleared; a finished route replays its last grove. */
export function firstIncomplete(camp) {
  for (let i = 0; i < REGION_COUNT; i++) {
    if (!camp.regions[i].cleared) return i;
  }
  return REGION_COUNT - 1;
}

/**
 * Merges a finished run into the campaign: records never regress, a win marks
 * the region cleared, and a first clearing opens the next region. A result for
 * a locked region is ignored outright — nothing is recorded and the run is not
 * counted. Returns { newBest, openedNext } for the UI and sound cues.
 */
export function recordResult(camp, idx, summary) {
  const i = Math.max(0, Math.min(REGION_COUNT - 1, idx | 0));
  if (!isUnlocked(camp, i)) return { newBest: false, openedNext: false };
  const rec = camp.regions[i] ?? (camp.regions[i] = { cleared: false, bestScore: 0, bestGrade: null });
  const newBest = summary.score > rec.bestScore;
  if (newBest) rec.bestScore = summary.score;
  const letter = gradeFor(summary.score);
  if (rec.bestGrade === null || gradeRank(letter) < gradeRank(rec.bestGrade)) rec.bestGrade = letter;
  let openedNext = false;
  if (summary.won && !rec.cleared) {
    rec.cleared = true;
    const next = i + 1;
    openedNext = next < REGION_COUNT && !camp.regions[next].cleared;
  }
  camp.runs++;
  return { newBest, openedNext };
}

/** The save is a plain JSON string; it must round-trip exactly. */
export function serialize(camp) {
  return JSON.stringify(camp);
}

/**
 * Reads a save string. Anything malformed, mistyped, tampered with, or from a
 * different version returns null and the caller starts a fresh campaign — a
 * corrupted save never crashes the route.
 */
export function deserialize(text) {
  if (typeof text !== 'string' || !text) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.version !== SAVE_VERSION) return null;
  if (!Array.isArray(raw.regions) || raw.regions.length !== REGION_COUNT) return null;
  const regions = [];
  for (const r of raw.regions) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    if (typeof r.bestScore !== 'number' || !Number.isFinite(r.bestScore) || r.bestScore < 0) return null;
    if (typeof r.cleared !== 'boolean') return null;
    if (r.bestGrade !== null && (typeof r.bestGrade !== 'string' || gradeRank(r.bestGrade) >= GRADES.length)) {
      return null;
    }
    regions.push({ cleared: r.cleared, bestScore: Math.floor(r.bestScore), bestGrade: r.bestGrade });
  }
  // The unlock chain is a strict prefix: a cleared region implies every region
  // before it is cleared too. Anything else is a tampered save.
  let seenUncleared = false;
  for (const r of regions) {
    if (!r.cleared) seenUncleared = true;
    else if (seenUncleared) return null;
  }
  const runs =
    typeof raw.runs === 'number' && Number.isFinite(raw.runs) && raw.runs >= 0 ? Math.floor(raw.runs) : 0;
  return { version: SAVE_VERSION, regions, runs };
}
