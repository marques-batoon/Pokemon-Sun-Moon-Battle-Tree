import { BOSSES, BRACKETS, pairedTrainer, RULES, SETS, TRAINER_PAIRS, TRAINERS, type Boss, type Course, type CourseSchedule, type Format, type SpecialTrainer, type Trainer } from '../data/battle-tree';
import { canField, pickTeamSets, treeSetToPokemonSet } from './opponent';
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
      if (battle % rule.everyNth === 0) return 'boss' in rule ? { type: 'boss', bossKey: rule.boss } : { type: 'special' };
      continue;
    }
    const [from, to] = rule.battles;
    if (battle < from || (to !== null && battle > to)) continue;
    return 'boss' in rule ? { type: 'boss', bossKey: rule.boss } : 'pool' in rule ? { type: 'pool', poolKey: rule.pool } : { type: 'special' };
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
  if (slot.type === 'boss') return { trainer: TRAINERS[chooseBoss(slot.bossKey, rng).trainerId], replacedAnabel: false };
  if (slot.type === 'pool') return { trainer: TRAINERS[rng.pick(allowed(BRACKETS.pools[slot.poolKey].trainerIds))], replacedAnabel: false };

  // All Star Mode has no regular trainers to stand in for a locked Anabel: she just isn't drawn.
  const locked = (t: SpecialTrainer) => course === 'allstar' && t.requires === 'lookerGuzzlordChapter' && !settings.anabelUnlocked;
  const special = rng.weighted(specialPool().filter(t => !exclude.has(t.trainer.id) && !locked(t.trainer)), t => t.weight).trainer;
  if (special.requires === 'lookerGuzzlordChapter' && !settings.anabelUnlocked) {
    const pool = allowed(BRACKETS.pools[anabelFallbackPool(format, course, battle)].trainerIds);
    return { trainer: TRAINERS[rng.pick(pool)], replacedAnabel: true };
  }
  return { trainer: special, replacedAnabel: false };
}

/**
 * Who appears at a Battle Legend battle: the scheduled boss and every other boss for the same
 * format, course and battle (custom battle-50 trainers), drawn by weight. With one candidate
 * (every Normal course, and Super Singles / Doubles for now) no random number is used.
 */
export function bossCandidates(bossKey: string): { key: string; boss: Boss; weight: number }[] {
  const scheduled = BOSSES[bossKey];
  return Object.entries(BOSSES)
    .filter(([, b]) => b.format === scheduled.format && b.course === scheduled.course && b.battle === scheduled.battle)
    .map(([key, boss]) => ({ key, boss, weight: boss.weight ?? 7 }));
}
function chooseBoss(bossKey: string, rng: Rng): Boss {
  const candidates = bossCandidates(bossKey);
  return candidates.length === 1 ? candidates[0].boss : rng.weighted(candidates, c => c.weight).boss;
}

/** Opponents bring as many as the player: 3 in Singles, 4 in Doubles, 2 each in Multi (Battle Legends per bosses.json). */
export function teamSizeFor(trainer: Trainer, format: Format = 'singles'): number {
  // Red and Blue reuse their Super trainers in Multi, where every trainer brings 2.
  if (format === 'multi') return RULES.teamSize.multi.bring;
  // A Battle Legend brings its boss team size in its own format (debug can put one elsewhere).
  if (trainer.kind === 'legend' && BOSSES[trainer.bossKey]?.format === format) return BOSSES[trainer.bossKey].teamSize;
  return RULES.teamSize[format].bring;
}

/**
 * Trainers who only battle as a pair in Multi Battles, first (left) trainer first: Tate and Liza
 * (TRAINER_PAIRS, in the order given) and custom battle-50 duos (Marques and Thomas).
 */
export function multiDuo(trainerId: number): [number, number] | null {
  const twins = pairedTrainer(trainerId);
  if (twins) return [trainerId, twins.partnerId];
  const boss = Object.values(BOSSES).find(b => b.format === 'multi' && b.partnerTrainerId !== undefined && TRAINERS[b.trainerId].custom
    && (b.trainerId === trainerId || b.partnerTrainerId === trainerId));
  return boss ? [boss.trainerId, boss.partnerTrainerId!] : null;
}

export const displayName = (t: Trainer) => `${t.class} ${t.name}`;

/** Seed text of battle N in a run; the simulator and opponent rolls both derive from the run seed. */
export const battleSeedText = (runSeed: string, battle: number) => `${runSeed}|battle-${battle}`;

/** `lead`: a set that must lead (Tate and Liza's pairs); otherwise the trainer's own lead, if any (Tai's Agumon). */
function planTrainer({ trainer, replacedAnabel }: TrainerChoice, format: Format, rng: Rng, lead?: number): PlannedTrainer {
  const leadId = lead ?? trainer.leadSetId;
  const sets = pickTeamSets(trainer, teamSizeFor(trainer, format), rng, leadId === undefined ? undefined : SETS[leadId]);
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
 * Paired trainers (Tate and Liza) only ever battle together there, leading with one of
 * their pairs (TRAINER_PAIRS); with one of them as your partner, the other doesn't appear.
 */
export function planOpponent(
  runSeed: string, format: Format, course: Course, battle: number, settings: RunSettings, partnerId?: number,
): PlannedOpponent {
  const seedText = battleSeedText(runSeed, battle);
  const rng = new Rng(`${seedText}|opponent`);
  const multi = format === 'multi';
  const exclude = new Set(partnerId === undefined ? [] : [partnerId]);
  const partnersTwin = multi && partnerId !== undefined ? pairedTrainer(partnerId) : null;
  if (partnersTwin) exclude.add(partnersTwin.partnerId);
  const slot = scheduleSlot(format, course, battle);
  if (slot.type === 'boss') {
    const boss = chooseBoss(slot.bossKey, rng);
    const first = planTrainer({ trainer: TRAINERS[boss.trainerId], replacedAnabel: false }, format, rng);
    if (!multi) return { battle, ...first, seedText };
    return { battle, ...first, seedText, second: planTrainer({ trainer: TRAINERS[boss.partnerTrainerId!], replacedAnabel: false }, format, rng) };
  }
  const firstChoice = chooseTrainer(format, course, battle, settings, rng, exclude);
  const pair = multi ? pairedTrainer(firstChoice.trainer.id) : null;
  if (pair) {
    const leads = rng.pick(pair.pair.multiLeads);
    const at = (id: number) => leads[pair.pair.trainerIds.indexOf(id)];
    const first = planTrainer(firstChoice, format, rng, at(firstChoice.trainer.id));
    const second = planTrainer({ trainer: TRAINERS[pair.partnerId], replacedAnabel: false }, format, rng, at(pair.partnerId));
    return { battle, ...first, seedText, second };
  }
  const first = planTrainer(firstChoice, format, rng);
  if (!multi) return { battle, ...first, seedText };

  exclude.add(first.trainerId);
  // A paired trainer can't be the second opponent without their partner.
  for (const p of TRAINER_PAIRS) p.trainerIds.forEach(id => exclude.add(id));
  const second = chooseTrainer(format, course, battle, settings, rng, exclude);
  return { battle, ...first, seedText, second: planTrainer(second, format, rng) };
}

/**
 * Debug: battle N against special trainers or Battle Legends you choose (one; two in a Multi
 * Battle) instead of the drawn opponent. Teams are drawn as usual. Pairs stay paired in Multi:
 * choosing Tate or Liza brings the other (leading with one of their pairs), and choosing Marques
 * or Thomas brings the other, Marques first.
 */
export function planChosenOpponent(runSeed: string, format: Format, battle: number, trainerIds: readonly number[]): PlannedOpponent {
  const seedText = battleSeedText(runSeed, battle);
  const rng = new Rng(`${seedText}|chosen|${trainerIds.join(',')}`);
  const choose = (id: number): TrainerChoice => {
    const trainer = TRAINERS[id];
    if (trainer?.kind !== 'special' && trainer?.kind !== 'legend') throw new Error('Choose special trainers or Battle Legends.');
    const size = teamSizeFor(trainer, format);
    if (!canField(trainer, size)) throw new Error(`${displayName(trainer)} can't field ${size} Pokémon here.`);
    return { trainer, replacedAnabel: false };
  };
  const chosen = choose(trainerIds[0]);
  if (format !== 'multi') return { battle, ...planTrainer(chosen, format, rng), seedText };
  const twins = pairedTrainer(chosen.trainer.id);
  if (twins) {
    const leads = rng.pick(twins.pair.multiLeads);
    const at = (id: number) => leads[twins.pair.trainerIds.indexOf(id)];
    return {
      battle, ...planTrainer(chosen, format, rng, at(chosen.trainer.id)), seedText,
      second: planTrainer(choose(twins.partnerId), format, rng, at(twins.partnerId)),
    };
  }
  const duo = multiDuo(chosen.trainer.id);
  const [firstId, secondId] = duo ?? [chosen.trainer.id, trainerIds[1]];
  if (secondId === undefined || secondId === firstId) throw new Error('Choose two different trainers.');
  const secondsDuo = duo ? null : multiDuo(secondId);
  if (secondsDuo) throw new Error(`${TRAINERS[secondId].name} only battles alongside ${TRAINERS[secondsDuo[0] === secondId ? secondsDuo[1] : secondsDuo[0]].name}.`);
  return { battle, ...planTrainer(choose(firstId), format, rng), seedText, second: planTrainer(choose(secondId), format, rng) };
}

/** BP for winning battle N (rules.json battlePoints). */
export function bpForWin(course: Course, battle: number): number {
  // All Star Mode earns no BP; a Super Battle Legend battle pays like battle 50 whenever it comes back.
  if (course === 'allstar') return 0;
  const at = course === 'super' && battle % 50 === 0 ? 50 : battle;
  const row = RULES.battlePoints[course].find(r => at >= r.battles[0] && (r.battles[1] === null || at <= r.battles[1]));
  if (!row) throw new Error(`No BP entry for ${course} battle ${battle}`);
  return row.bp;
}

export const setLabel = (id: number) => SETS[id].label;
