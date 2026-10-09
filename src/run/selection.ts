import { BOSSES, BRACKETS, RULES, SETS, TRAINERS, type Course, type CourseSchedule, type Format, type SpecialTrainer, type Trainer } from '../data/battle-tree';
import { pickTeamSets, treeSetToPokemonSet } from './opponent';
import { Rng } from './rng';
import type { PlannedOpponent, PlannedTrainer, RunSettings } from './types';

export type ScheduleSlot =
  | { type: 'boss'; bossKey: string }
  | { type: 'special' }
  | { type: 'pool'; poolKey: string };

/** A course's schedule (brackets.json). Multi has only Super. */
export function courseSchedule(format: Format, course: Course): CourseSchedule {
  const schedule = BRACKETS[format][course];
  if (!schedule) throw new Error(`There's no ${course} ${format} course.`);
  return schedule;
}

/** Which kind of opponent battle N of a course is, per brackets.json (first matching rule wins). */
export function scheduleSlot(format: Format, course: Course, battle: number): ScheduleSlot {
  const schedule = courseSchedule(format, course);
  if (schedule.length !== null && battle > schedule.length) throw new Error(`${course} course has only ${schedule.length} battles`);
  for (const rule of schedule.schedule) {
    if ('everyNth' in rule) {
      if (battle % rule.everyNth === 0) return { type: 'special' };
      continue;
    }
    const [from, to] = rule.battles;
    if (battle < from || (to !== null && battle > to)) continue;
    return 'boss' in rule ? { type: 'boss', bossKey: rule.boss } : { type: 'pool', poolKey: rule.pool };
  }
  throw new Error(`No schedule rule for ${course} battle ${battle}`);
}

/**
 * Special trainers with their relative weights. There's no game version to choose: each draw is as
 * if the version were picked at random, so trainers in both versions keep their weight and each
 * version-exclusive trainer gets half of it (Plumeria / Guzma, Kiawe / Mallow and Sina / Dexio are
 * equally likely, and together as likely as one of them would be in its own version).
 */
export function specialPool(): { trainer: SpecialTrainer; weight: number }[] {
  return BRACKETS.specialTrainerPool.trainerIds
    .map(id => TRAINERS[id] as SpecialTrainer)
    .map(trainer => ({ trainer, weight: (trainer.weight * trainer.versions.length) / 2 }));
}

/**
 * The regular-trainer pool used when a locked Anabel is rolled: the bracket of
 * the previous battle (APPROXIMATION, see brackets.json anabelFallback).
 */
export function anabelFallbackPool(format: Format, course: Course, battle: number): string {
  for (let n = battle - 1; n >= 1; n--) {
    const slot = scheduleSlot(format, course, n);
    if (slot.type === 'pool') return slot.poolKey;
  }
  throw new Error(`No regular pool before ${course} battle ${battle}`);
}

export interface TrainerChoice {
  trainer: Trainer;
  replacedAnabel: boolean;
}

/**
 * Draws the opponent trainer for battle N (uniform within pools; special pool by weight).
 * `exclude`: trainer ids that can't be drawn (Multi: the player's partner and the first opponent).
 */
export function chooseTrainer(
  format: Format, course: Course, battle: number, settings: RunSettings, rng: Rng, exclude: ReadonlySet<number> = new Set(),
): TrainerChoice {
  const slot = scheduleSlot(format, course, battle);
  const allowed = (ids: number[]) => ids.filter(id => !exclude.has(id));
  if (slot.type === 'boss') return { trainer: TRAINERS[BOSSES[slot.bossKey].trainerId], replacedAnabel: false };
  if (slot.type === 'pool') return { trainer: TRAINERS[rng.pick(allowed(BRACKETS.pools[slot.poolKey].trainerIds))], replacedAnabel: false };

  const special = rng.weighted(specialPool().filter(t => !exclude.has(t.trainer.id)), t => t.weight).trainer;
  if (special.requires === 'lookerGuzzlordChapter' && !settings.anabelUnlocked) {
    const pool = allowed(BRACKETS.pools[anabelFallbackPool(format, course, battle)].trainerIds);
    return { trainer: TRAINERS[rng.pick(pool)], replacedAnabel: true };
  }
  return { trainer: special, replacedAnabel: false };
}

/** Opponents bring as many as the player: 3 in Singles, 4 in Doubles, 2 each in Multi (Battle Legends per bosses.json). */
export function teamSizeFor(trainer: Trainer, format: Format = 'singles'): number {
  // Red and Blue reuse their Super trainers in Multi, where every trainer brings 2.
  if (format === 'multi') return RULES.teamSize.multi.bring;
  if (trainer.kind === 'legend') return BOSSES[trainer.bossKey].teamSize;
  return RULES.teamSize[format].bring;
}

export const displayName = (t: Trainer) => `${t.class} ${t.name}`;

/** Seed text of battle N in a run; the simulator and opponent rolls both derive from the run seed. */
export const battleSeedText = (runSeed: string, battle: number) => `${runSeed}|battle-${battle}`;

function planTrainer({ trainer, replacedAnabel }: TrainerChoice, format: Format, rng: Rng): PlannedTrainer {
  const sets = pickTeamSets(trainer, teamSizeFor(trainer, format), rng);
  return {
    trainerId: trainer.id,
    displayName: displayName(trainer),
    kind: trainer.kind,
    replacedAnabel,
    setIds: sets.map(s => s.id),
    team: sets.map(s => treeSetToPokemonSet(s, trainer.iv, rng)),
  };
}

/**
 * Fully determines battle N's opponent from the run seed: trainer, team sets,
 * abilities and genders. Same inputs -> same opponent.
 * Multi: two different trainers (Red and Blue together at 50), never the player's partner.
 */
export function planOpponent(
  runSeed: string, format: Format, course: Course, battle: number, settings: RunSettings, partnerId?: number,
): PlannedOpponent {
  const seedText = battleSeedText(runSeed, battle);
  const rng = new Rng(`${seedText}|opponent`);
  const exclude = new Set(partnerId === undefined ? [] : [partnerId]);
  const first = planTrainer(chooseTrainer(format, course, battle, settings, rng, exclude), format, rng);
  if (format !== 'multi') return { battle, ...first, seedText };

  exclude.add(first.trainerId);
  const slot = scheduleSlot(format, course, battle);
  const second = slot.type === 'boss'
    ? { trainer: TRAINERS[BOSSES[slot.bossKey].partnerTrainerId!], replacedAnabel: false }
    : chooseTrainer(format, course, battle, settings, rng, exclude);
  return { battle, ...first, seedText, second: planTrainer(second, format, rng) };
}

/** BP for winning battle N (rules.json battlePoints). */
export function bpForWin(course: Course, battle: number): number {
  const row = RULES.battlePoints[course].find(r => battle >= r.battles[0] && (r.battles[1] === null || battle <= r.battles[1]));
  if (!row) throw new Error(`No BP entry for ${course} battle ${battle}`);
  return row.bp;
}

export const setLabel = (id: number) => SETS[id].label;
