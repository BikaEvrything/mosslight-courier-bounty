// Seeded deterministic RNG (mulberry32). The same seed always produces the
// same sequence, so world spawns and motion reproduce exactly for the Node
// tests and the screenshot fixtures. No DOM access in this module.

export function createRng(seed) {
  let s = seed >>> 0;
  const rng = {
    /** Next float in [0, 1). */
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Float in [min, max). */
    range(min, max) {
      return min + (max - min) * rng.next();
    },
    /** Integer in [min, max], both ends inclusive. */
    int(min, max) {
      return Math.floor(min + (max + 1 - min) * rng.next());
    },
    /** A uniform element of an array. */
    pick(arr) {
      return arr[Math.floor(rng.next() * arr.length)];
    },
    /** True with probability p. */
    chance(p) {
      return rng.next() < p;
    },
    /** Current 32-bit state, so a run can be snapshotted. */
    get state() {
      return s;
    },
    set state(v) {
      s = v >>> 0;
    },
  };
  return rng;
}
