import { PRNG, type PRNGSeed } from '@pkmn/sim';
import { seedFromString } from './seed';

/** Independent RNG stream derived from a battle seed (e.g. for the AI). */
export function derivedPrng(seed: PRNGSeed, purpose: string): PRNG {
  return new PRNG(seedFromString(`${seed}|${purpose}`));
}
