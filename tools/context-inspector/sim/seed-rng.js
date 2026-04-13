/**
 * Seeded PRNG — mulberry32 algorithm
 * Deterministic: same seed always produces same sequence.
 */

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed = Date.now()) {
  const next = mulberry32(seed);

  return {
    /** Random float in [0, 1) */
    random: next,

    /** Random integer in [min, max] inclusive */
    randomInt(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },

    /** Random float in [min, max) */
    randomFloat(min, max) {
      return min + next() * (max - min);
    },

    /** Pick a random element from array */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },

    /** Pick N unique random elements from array */
    pickN(arr, n) {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, Math.min(n, shuffled.length));
    },

    /** Shuffle array in place (Fisher-Yates) */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    /** Random value from Gaussian distribution (Box-Muller) */
    gaussian(mean = 0, std = 1) {
      const u1 = next();
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
      return mean + z * std;
    },

    /** Returns true with given probability [0, 1] */
    chance(probability) {
      return next() < probability;
    },
  };
}

module.exports = { createRng };
