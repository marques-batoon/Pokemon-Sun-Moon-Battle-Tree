import setsJson from './sets.json';
import trainersJson from './trainers.json';
import bracketsJson from './brackets.json';
import bossesJson from './bosses.json';
import rulesJson from './rules.json';
import quotesJson from './trainer-quotes.json';
import type { Boss, BracketsFile, RulesFile, Trainer, TrainerQuotes, TreeSet } from './types';

export * from './types';

export const SETS = setsJson.sets as TreeSet[];
export const TRAINERS = trainersJson.trainers as Trainer[];
export const BRACKETS = bracketsJson as unknown as BracketsFile;
export const BOSSES = bossesJson.bosses as Record<string, Boss>;
export const RULES = rulesJson as unknown as RulesFile;

/** Greetings and closing remarks, three sets per trainer name (written for this app; see trainer-quotes.json). */
export const TRAINER_QUOTES = quotesJson.quotes as Record<string, TrainerQuotes[]>;

/**
 * The set of lines a trainer uses in one battle: picked from their three by
 * `battleKey` (the battle's seed text), so the greeting on the opponent card,
 * the special-battle intro and the closing remark always belong together, and
 * a replayed battle gets the same lines.
 */
export function trainerQuotes(trainer: Trainer, battleKey: string): TrainerQuotes | null {
  const sets = TRAINER_QUOTES[trainer.name];
  if (!sets?.length) return null;
  // FNV-1a: a small, stable string hash.
  let hash = 0x811c9dc5;
  for (let i = 0; i < battleKey.length; i++) hash = Math.imul(hash ^ battleKey.charCodeAt(i), 0x01000193);
  return sets[(hash >>> 0) % sets.length];
}
