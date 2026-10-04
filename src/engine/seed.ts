import type { PRNGSeed } from '@pkmn/sim';

/**
 * Turns any text into a Showdown Gen 5 RNG seed ("a,b,c,d", four 16-bit words).
 * The same text always gives the same seed, so a battle can be replayed by
 * re-entering its seed and making the same choices. (No simulator import: safe
 * on the UI thread.)
 */
export function seedFromString(text: string): PRNGSeed {
  // FNV-1a over UTF-16 code units, run with 4 different offsets.
  const words = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b9].map(offset => {
    let h = offset >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h ^ (h >>> 16)) & 0xffff;
  });
  return words.join(',') as PRNGSeed;
}

/** A fresh random seed, as a short string the user can copy and re-enter. */
export function randomSeedText(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36);
}
