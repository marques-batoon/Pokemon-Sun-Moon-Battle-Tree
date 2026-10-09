import setsJson from './sets.json';
import trainersJson from './trainers.json';
import bracketsJson from './brackets.json';
import bossesJson from './bosses.json';
import rulesJson from './rules.json';
import quotesJson from './trainer-quotes.json';
import gymLeadersJson from '../custom/gym-leaders.json';
import type { Boss, BracketsFile, RulesFile, SpecialTrainer, StatTable, Trainer, TrainerQuotes, TreeSet } from './types';

export * from './types';

const GAME_SETS = setsJson.sets as TreeSet[];
const GAME_TRAINERS = trainersJson.trainers as Trainer[];

interface CustomSet { species: string; item: string; ability: string; nature: string; evs: StatTable; moves: string[]; gender?: 'M' | 'F' }
interface CustomTrainer { name: string; class: string; classGender: 'M' | 'F'; region: string; sets: CustomSet[] }

/**
 * The Gym Leaders (custom special trainers designed by the user, see DATA_NOTES.md
 * "Custom additions"), appended after the game's sets and trainers so ids stay
 * array indices. Weight 7 in both versions, IV 31, like the game's special trainers.
 */
function customTrainers(list: CustomTrainer[]) {
  const sets: TreeSet[] = [];
  const trainers: SpecialTrainer[] = list.map((t, i) => {
    const roster = t.sets.map((s, j) => {
      const id = GAME_SETS.length + sets.length;
      sets.push({ id, label: `${s.species} (${t.name}${t.sets.length > 1 ? ` ${j + 1}` : ''})`, setNumber: j + 1, ...s });
      return id;
    });
    return {
      id: GAME_TRAINERS.length + i, name: t.name, class: t.class, classGender: t.classGender, iv: 31, roster, kind: 'special',
      number: null, versions: ['sun', 'moon'], weight: 7, custom: true, region: t.region,
      source: { sets: 'custom: data-sources/custom/gym-leaders.txt (designed by the user)' },
    };
  });
  return { sets, trainers };
}
const CUSTOM = customTrainers(gymLeadersJson.trainers as CustomTrainer[]);

export const SETS: TreeSet[] = [...GAME_SETS, ...CUSTOM.sets];
export const TRAINERS: Trainer[] = [...GAME_TRAINERS, ...CUSTOM.trainers];
const GAME_BRACKETS = bracketsJson as unknown as BracketsFile;
/** brackets.json, with the Gym Leaders in the special-trainer pool (Super Singles, Doubles and Multi). */
export const BRACKETS: BracketsFile = {
  ...GAME_BRACKETS,
  specialTrainerPool: { ...GAME_BRACKETS.specialTrainerPool, trainerIds: [...GAME_BRACKETS.specialTrainerPool.trainerIds, ...CUSTOM.trainers.map(t => t.id)] },
};

const trainerByName = (name: string) => TRAINERS.find(t => t.kind === 'special' && t.name === name)!;
/**
 * Special trainers who always battle together as opponents in Multi Battles (Tate and Liza),
 * each leading with one Pokémon of a pair (set ids, same order as `trainerIds`).
 */
export const TRAINER_PAIRS = gymLeadersJson.pairs.map(p => {
  const pair = p.trainers.map(trainerByName);
  return {
    trainerIds: pair.map(t => t.id),
    multiLeads: p.multiLeads.map(species => species.map((s, i) => pair[i].roster.find(id => SETS[id].species === s)!)),
  };
});
/** The trainer who must partner this one in a Multi Battle, if any. */
export function pairedTrainer(trainerId: number): { partnerId: number; pair: (typeof TRAINER_PAIRS)[number] } | null {
  for (const pair of TRAINER_PAIRS) {
    const i = pair.trainerIds.indexOf(trainerId);
    if (i >= 0) return { partnerId: pair.trainerIds[1 - i], pair };
  }
  return null;
}
export const BOSSES = bossesJson.bosses as Record<string, Boss>;
export const RULES = rulesJson as unknown as RulesFile;

/** Greetings and closing remarks, three sets per trainer name (written for this app; see trainer-quotes.json). */
export const TRAINER_QUOTES = quotesJson.quotes as Record<string, TrainerQuotes[]>;
/** Paired trainers' lines when they battle together in a Multi Battle (Tate and Liza), three sets each. */
export const TRAINER_MULTI_QUOTES = quotesJson.multi as Record<string, TrainerQuotes[]>;

/**
 * The set of lines a trainer uses in one battle: picked from their three by
 * `battleKey` (the battle's seed text), so the greeting on the opponent card,
 * the special-battle intro and the closing remark always belong together, and
 * a replayed battle gets the same lines. `alongside`: the other opposing trainer
 * in a Multi Battle; paired trainers fighting together use their team-up lines
 * (the same set for both, so they answer each other).
 */
export function trainerQuotes(trainer: Trainer, battleKey: string, alongside: readonly Trainer[] = []): TrainerQuotes | null {
  const paired = pairedTrainer(trainer.id);
  const together = !!paired && alongside.some(t => t.id === paired.partnerId);
  const sets = (together ? TRAINER_MULTI_QUOTES[trainer.name] : undefined) ?? TRAINER_QUOTES[trainer.name];
  if (!sets?.length) return null;
  // FNV-1a: a small, stable string hash.
  let hash = 0x811c9dc5;
  for (let i = 0; i < battleKey.length; i++) hash = Math.imul(hash ^ battleKey.charCodeAt(i), 0x01000193);
  return sets[(hash >>> 0) % sets.length];
}
