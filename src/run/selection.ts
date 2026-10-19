import { ALL_STAR_LEGEND_EVERY, BOSSES, BRACKETS, multiPartners, pairedTrainer, pairGreetingPartners, RULES, samePerson, SETS, TRAINER_PAIRS, TRAINERS, type Boss, type Course, type CourseSchedule, type Format, type SpecialTrainer, type Trainer } from '../data/battle-tree';
import { canField, pickTeamSets, treeSetToPokemonSet } from './opponent';
import { Rng } from './rng';
import type { PlannedOpponent, PlannedTrainer } from './types';

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

export interface TrainerChoice {
  trainer: Trainer;
}

/**
 * Draws the opponent trainer for battle N (uniform within pools; special pool by weight).
 * `exclude`: trainer ids that can't be drawn (Multi: the player's partner and the first opponent).
 * Anabel is always in the special pool (app choice, 2026-10-17: in the game she needs Guzzlord's chapter of the
 * Looker episode; the option to leave her out was removed on request).
 */
export function chooseTrainer(
  format: Format, course: Course, battle: number, rng: Rng, exclude: ReadonlySet<number> = new Set(),
): TrainerChoice {
  const slot = scheduleSlot(format, course, battle);
  const allowed = (ids: number[]) => ids.filter(id => !exclude.has(id));
  if (slot.type === 'boss') return { trainer: TRAINERS[chooseBoss(slot.bossKey, rng).trainerId] };
  if (slot.type === 'pool') return { trainer: TRAINERS[rng.pick(allowed(BRACKETS.pools[slot.poolKey].trainerIds))] };
  return { trainer: rng.weighted(specialPool().filter(t => !exclude.has(t.trainer.id)), t => t.weight).trainer };
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
/** `exclude`: trainers who can't appear (Multi: your partner, who may be a Battle Legend you bought). */
function chooseBoss(bossKey: string, rng: Rng, exclude: ReadonlySet<number> = new Set()): Boss {
  const all = bossCandidates(bossKey);
  const allowed = all.filter(c => !exclude.has(c.boss.trainerId) && (c.boss.partnerTrainerId === undefined || !exclude.has(c.boss.partnerTrainerId)));
  const candidates = allowed.length ? allowed : all;
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
 * (TRAINER_PAIRS, in the order given), custom battle-50 duos (Marques and Thomas), and a DigiDestined
 * with their partner, who goes first (Tai and Izzy; with several partners, debug mode uses the first).
 */
export function multiDuo(trainerId: number): [number, number] | null {
  const twins = pairedTrainer(trainerId);
  if (twins) return [trainerId, twins.partnerId];
  const partners = multiPartners(trainerId);
  if (partners.length) return [partners[0], trainerId];
  const boss = Object.values(BOSSES).find(b => b.format === 'multi' && b.partnerTrainerId !== undefined && TRAINERS[b.trainerId].custom
    && (b.trainerId === trainerId || b.partnerTrainerId === trainerId));
  return boss ? [boss.trainerId, boss.partnerTrainerId!] : null;
}

export const displayName = (t: Trainer) => `${t.class} ${t.name}`;

/**
 * Multi Battles: the chance that the second opponent is someone the first has pair greetings with (Brock and
 * Misty...), on request; otherwise it's an ordinary weighted draw (which can still pair them).
 */
export const PAIR_TEAMMATE_CHANCE = 0.3;

/** A trainer and any other version of the same character (both Archies): never two of them in one battle. */
const samePersonIds = (id: number) => TRAINERS.filter(t => samePerson(t, TRAINERS[id])).map(t => t.id);

/** Seed text of battle N in a run; the simulator and opponent rolls both derive from the run seed. */
export const battleSeedText = (runSeed: string, battle: number) => `${runSeed}|battle-${battle}`;

/** `lead`: a set that must lead (Tate and Liza's pairs); otherwise the trainer's own lead, if any (Tai's Agumon). */
function planTrainer({ trainer }: TrainerChoice, format: Format, rng: Rng, lead?: number): PlannedTrainer {
  const leadId = lead ?? trainer.leadSetId;
  const sets = pickTeamSets(trainer, teamSizeFor(trainer, format), rng, leadId === undefined ? undefined : SETS[leadId]);
  return {
    trainerId: trainer.id,
    displayName: displayName(trainer),
    kind: trainer.kind,
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
  runSeed: string, format: Format, course: Course, battle: number, partnerId?: number,
): PlannedOpponent {
  const seedText = battleSeedText(runSeed, battle);
  const rng = new Rng(`${seedText}|opponent`);
  const multi = format === 'multi';
  // Your partner (and any other version of them: two Archies) can't be an opponent.
  const exclude = new Set(partnerId === undefined ? [] : samePersonIds(partnerId));
  const partnersTwin = multi && partnerId !== undefined ? pairedTrainer(partnerId) : null;
  if (partnersTwin) exclude.add(partnersTwin.partnerId);
  const slot = scheduleSlot(format, course, battle);
  if (slot.type === 'boss') {
    // A Battle Legend you have as your partner isn't drawn: another battle-50 pair comes instead.
    const boss = chooseBoss(slot.bossKey, rng, exclude);
    const first = planTrainer({ trainer: TRAINERS[boss.trainerId] }, format, rng);
    if (!multi) return { battle, ...first, seedText };
    return { battle, ...first, seedText, second: planTrainer({ trainer: TRAINERS[boss.partnerTrainerId!] }, format, rng) };
  }
  // A trainer whose every Multi Battle partner is out (your partner) can't be drawn either.
  if (multi) for (const t of TRAINERS) if (multiPartners(t.id).length && multiPartners(t.id).every(id => exclude.has(id))) exclude.add(t.id);
  const firstChoice = chooseTrainer(format, course, battle, rng, exclude);
  const partners = multi ? multiPartners(firstChoice.trainer.id).filter(id => !exclude.has(id)) : [];
  if (partners.length) {
    // Izzy brings his partner (Tai), who goes first.
    const partner = planTrainer({ trainer: TRAINERS[partners.length === 1 ? partners[0] : rng.pick(partners)] }, format, rng);
    return { battle, ...partner, seedText, second: planTrainer(firstChoice, format, rng) };
  }
  const pair = multi ? pairedTrainer(firstChoice.trainer.id) : null;
  if (pair) {
    const leads = rng.pick(pair.pair.multiLeads);
    const at = (id: number) => leads[pair.pair.trainerIds.indexOf(id)];
    const first = planTrainer(firstChoice, format, rng, at(firstChoice.trainer.id));
    const second = planTrainer({ trainer: TRAINERS[pair.partnerId] }, format, rng, at(pair.partnerId));
    return { battle, ...first, seedText, second };
  }
  const first = planTrainer(firstChoice, format, rng);
  if (!multi) return { battle, ...first, seedText };

  for (const id of samePersonIds(first.trainerId)) exclude.add(id);
  // A paired trainer can't be the second opponent without their partner (Tate and Liza; Izzy and Tai).
  for (const p of TRAINER_PAIRS) p.trainerIds.forEach(id => exclude.add(id));
  for (const t of TRAINERS) if (multiPartners(t.id).length) exclude.add(t.id);
  // 30% of the time (on request; 15% until 2026-10-18), the teammate is someone the first opponent has pair greetings with (by weight).
  if (slot.type === 'special') {
    const friends = new Set(pairGreetingPartners(first.trainerId));
    const candidates = specialPool().filter(p => friends.has(p.trainer.id) && !exclude.has(p.trainer.id));
    if (candidates.length && rng.next() < PAIR_TEAMMATE_CHANCE) {
      const friend = rng.weighted(candidates, p => p.weight).trainer;
      return { battle, ...first, seedText, second: planTrainer({ trainer: friend }, format, rng) };
    }
  }
  const second = chooseTrainer(format, course, battle, rng, exclude);
  return { battle, ...first, seedText, second: planTrainer(second, format, rng) };
}

/**
 * Debug: battle N against special trainers or Battle Legends you choose (one; two in a Multi
 * Battle) instead of the drawn opponent. Teams are drawn as usual. Pairs stay paired in Multi:
 * choosing Tate or Liza brings the other (leading with one of their pairs), choosing Marques
 * or Thomas brings the other, Marques first, and choosing Izzy brings Tai, Tai first.
 */
export function planChosenOpponent(runSeed: string, format: Format, battle: number, trainerIds: readonly number[]): PlannedOpponent {
  const seedText = battleSeedText(runSeed, battle);
  const rng = new Rng(`${seedText}|chosen|${trainerIds.join(',')}`);
  const choose = (id: number): TrainerChoice => {
    const trainer = TRAINERS[id];
    if (trainer?.kind !== 'special' && trainer?.kind !== 'legend') throw new Error('Choose special trainers or Battle Legends.');
    const size = teamSizeFor(trainer, format);
    if (!canField(trainer, size)) throw new Error(`${displayName(trainer)} can't field ${size} Pokémon here.`);
    return { trainer };
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

/**
 * BP for winning battle N (rules.json battlePoints). A Super Battle Legend battle pays like battle 50 whenever it
 * comes back. All Star Mode (app choice, on request 2026-10-11: it earns BP) pays as Super, its Battle Legend
 * battles (every 10th) like battle 50.
 */
export function bpForWin(course: Course, battle: number): number {
  const table = course === 'allstar' ? 'super' : course;
  const legend = (course === 'super' && battle % 50 === 0) || (course === 'allstar' && battle % ALL_STAR_LEGEND_EVERY === 0);
  const at = legend ? 50 : battle;
  const row = RULES.battlePoints[table].find(r => at >= r.battles[0] && (r.battles[1] === null || at <= r.battles[1]));
  if (!row) throw new Error(`No BP entry for ${course} battle ${battle}`);
  return row.bp;
}

export const setLabel = (id: number) => SETS[id].label;
