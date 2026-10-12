import setsJson from './sets.json';
import trainersJson from './trainers.json';
import bracketsJson from './brackets.json';
import bossesJson from './bosses.json';
import rulesJson from './rules.json';
import quotesJson from './trainer-quotes.json';
import gymLeadersJson from '../custom/gym-leaders.json';
import battle50Json from '../custom/battle-50.json';
import eliteFourJson from '../custom/elite-four.json';
import evilTeamsJson from '../custom/evil-teams.json';
import digidestinedJson from '../custom/digidestined.json';
import type { Boss, BracketsFile, Course, CourseSchedule, Format, LegendTrainer, RulesFile, SpecialTrainer, StatTable, Trainer, TrainerQuotes, TreeSet } from './types';

export * from './types';

const GAME_SETS = setsJson.sets as TreeSet[];
const GAME_TRAINERS = trainersJson.trainers as Trainer[];
/** The game's Super Battle Legends (Red, Blue), by name: battle-50 entries can name them too. */
const gameLegend = (name: string) => GAME_TRAINERS.find(t => t.kind === 'legend' && t.course === 'super' && t.name === name);

interface CustomSet { species: string; item: string; ability: string; nature: string; evs: StatTable; moves: string[]; gender?: 'M' | 'F' }
interface CustomTrainer {
  name: string; key?: string; person?: string; class: string; classGender: 'M' | 'F'; region: string; sets: CustomSet[];
  /** The DigiDestined: own sprite, the species that always leads, own weight, fixed Multi Battle partners (by name). */
  sprite?: string; lead?: string; weight?: number; partners?: string[];
}

/** A trainer's unique name for data lookups (lines, pictures, partners): `key` if two share a name. */
export const trainerKey = (t: Pick<Trainer, 'name' | 'key'>) => t.key ?? t.name;
/** Whether two trainers are the same character (two versions of Archie or Maxie, or the very same trainer). */
export const samePerson = (a: Trainer, b: Trainer) => a.id === b.id || (a.person ?? trainerKey(a)) === (b.person ?? trainerKey(b));

/**
 * Custom special trainers (see DATA_NOTES.md "Custom additions"), appended after the sets and
 * trainers before them so ids stay array indices: the Gym Leaders (weight 7, like the game's
 * special trainers), the Elite Four and Champions and the evil teams (weight 3.5). Both versions, IV 31.
 */
function customTrainers(list: CustomTrainer[], firstSet: number, firstTrainer: number, weight: number, file: string) {
  const sets: TreeSet[] = [];
  const trainers: SpecialTrainer[] = list.map((t, i) => {
    const roster = t.sets.map((s, j) => {
      const id = firstSet + sets.length;
      sets.push({ id, label: `${s.species} (${trainerKey(t)}${t.sets.length > 1 ? ` ${j + 1}` : ''})`, setNumber: j + 1, ...s });
      return id;
    });
    const lead = t.lead ? roster.find(id => sets[id - firstSet].species === t.lead) : undefined;
    return {
      id: firstTrainer + i, name: t.name, ...(t.key ? { key: t.key } : {}), ...(t.person ? { person: t.person } : {}),
      class: t.class, classGender: t.classGender, iv: 31, roster, kind: 'special',
      number: null, versions: ['sun', 'moon'], weight: t.weight ?? weight, custom: true, region: t.region,
      ...(t.sprite ? { sprite: t.sprite } : {}), ...(lead !== undefined ? { leadSetId: lead } : {}),
      source: { sets: `custom: data-sources/custom/${file}` },
    };
  });
  return { sets, trainers };
}
const CUSTOM = customTrainers(gymLeadersJson.trainers as CustomTrainer[], GAME_SETS.length, GAME_TRAINERS.length, 7, 'gym-leaders.txt (designed by the user)');

interface Battle50Entry { format: Format; course: Course; battle: number; trainers: string[]; weight: number }

/**
 * Custom trainers who can take a Battle Legend slot (battle 50), designed by the user
 * (src/data/custom/battle-50.json). Each entry becomes a boss that shares the slot with
 * the Battle Legends by weight; in Multi the first trainer is p2 (shown on the left).
 * A trainer can be in several entries (Tai: Super Singles, Super Doubles, and Super Multi
 * with Matt), and can have a Pokémon that always leads (`lead`).
 */
function battle50Trainers(firstSet: number, firstTrainer: number) {
  const sets: TreeSet[] = [];
  const list = battle50Json.trainers as (CustomTrainer & { sprite?: string; lead?: string })[];
  const entries = battle50Json.battles as Battle50Entry[];
  const bossKey = (e: Battle50Entry) => `${e.trainers.map(n => n.toLowerCase()).join('-')}-${e.format}-${e.course}`;
  const trainers: LegendTrainer[] = list.map((t, i) => {
    const entry = entries.find(e => e.trainers.includes(t.name))!;
    const roster = t.sets.map((s, j) => {
      const id = firstSet + sets.length;
      sets.push({ id, label: `${s.species} (${t.name}${t.sets.length > 1 ? ` ${j + 1}` : ''})`, setNumber: j + 1, ...s });
      return id;
    });
    const lead = t.lead ? roster.find(id => sets[id - firstSet].species === t.lead) : undefined;
    return {
      id: firstTrainer + i, name: t.name, class: t.class, classGender: t.classGender, iv: 31, roster, kind: 'legend', number: null,
      bossKey: bossKey(entry), format: entry.format, course: entry.course, custom: true, sprite: t.sprite,
      ...(lead !== undefined ? { leadSetId: lead } : {}),
      source: { sets: 'custom: data-sources/custom/battle-50-trainers.txt (designed by the user)' },
    };
  });
  // Custom trainers, or the game's Battle Legends in another slot (Red at battle 50 of Super Doubles...).
  const idOf = (name: string) => (trainers.find(t => t.name === name) ?? gameLegend(name))!.id;
  const bosses: Record<string, Boss> = Object.fromEntries(entries.map(e => [bossKey(e), {
    trainerId: idOf(e.trainers[0]), ...(e.trainers[1] ? { partnerTrainerId: idOf(e.trainers[1]) } : {}),
    format: e.format, course: e.course, battle: e.battle, bp: 50, teamSize: e.format === 'multi' ? 2 : e.format === 'doubles' ? 4 : 3, iv: 31, weight: e.weight,
  } satisfies Boss]));
  return { sets, trainers, bosses };
}
const BATTLE_50 = battle50Trainers(GAME_SETS.length + CUSTOM.sets.length, GAME_TRAINERS.length + CUSTOM.trainers.length);
/** The Elite Four and Champions of Generations 1-7, after everything else (earlier ids, kept in saved runs, don't move). */
const ELITE_FOUR = customTrainers(
  eliteFourJson.trainers as CustomTrainer[],
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length, GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length,
  3.5, 'elite-four.txt (designed for the user)',
);

/** The evil teams' leaders and admins of Generations 1-7, after the Elite Four (earlier ids don't move). */
const EVIL_TEAMS = customTrainers(
  evilTeamsJson.trainers as CustomTrainer[],
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length,
  3.5, 'evil-teams.txt (designed for the user)',
);

/** The DigiDestined (Izzy), after the evil teams (earlier ids don't move): weight as given (3.5), own sprite and lead. */
const DIGIDESTINED_LIST = digidestinedJson.trainers as CustomTrainer[];
const DIGIDESTINED = customTrainers(
  DIGIDESTINED_LIST,
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length + EVIL_TEAMS.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length + EVIL_TEAMS.trainers.length,
  3.5, 'digidestined.txt (designed by the user)',
);

export const SETS: TreeSet[] = [...GAME_SETS, ...CUSTOM.sets, ...BATTLE_50.sets, ...ELITE_FOUR.sets, ...EVIL_TEAMS.sets, ...DIGIDESTINED.sets];
export const TRAINERS: Trainer[] = [...GAME_TRAINERS, ...CUSTOM.trainers, ...BATTLE_50.trainers, ...ELITE_FOUR.trainers, ...EVIL_TEAMS.trainers, ...DIGIDESTINED.trainers];

/**
 * Trainers who, as opponents in a Multi Battle, always battle alongside one of their partners (Izzy: Tai), who
 * goes first (on the left). The partner is picked with equal chance; a partner can be a Battle Legend (Tai only
 * appears as one otherwise). By trainer id: partner ids.
 */
const MULTI_PARTNERS = new Map(DIGIDESTINED_LIST.flatMap((t, i) => (t.partners?.length
  ? [[DIGIDESTINED.trainers[i].id, t.partners.map(name => TRAINERS.find(o => o.custom && (o.kind === 'legend' || o.kind === 'special') && o.name === name)!.id)]] as [number, number[]][]
  : [])));
/** The partners a trainer always battles alongside as an opponent in a Multi Battle (empty: none). */
export const multiPartners = (trainerId: number): readonly number[] => MULTI_PARTNERS.get(trainerId) ?? [];
const GAME_BRACKETS = bracketsJson as unknown as BracketsFile;

/**
 * App changes to the game's Super schedules: the battle-50 Battle Legend draw comes back every 50
 * battles (100, 150, ...; the game has it only at 50). Its rule is listed first, so it also takes the
 * place of the special trainers at those battles.
 */
function recurringLegends(schedule: CourseSchedule): CourseSchedule {
  return { ...schedule, schedule: schedule.schedule.map(r => ('boss' in r && 'battles' in r && r.battles[0] === 50 ? { everyNth: 50, boss: r.boss } : r)) };
}
/** The Super course's battle-50 boss key (its draw includes everyone who shares that slot). */
const superBossKey = (schedule: CourseSchedule) => {
  const rule = schedule.schedule.find(r => 'boss' in r);
  if (!rule || !('boss' in rule)) throw new Error('No Battle Legend in the Super schedule');
  return rule.boss;
};
/** All Star Mode (custom, unrated): special trainers in every battle, and every 5th the battle-50 draw. */
function allStar(superSchedule: CourseSchedule): CourseSchedule {
  return {
    length: null, endsAfterLength: false, specialTrainers: true,
    schedule: [{ everyNth: 5, boss: superBossKey(superSchedule) }, { battles: [1, null], special: true }],
  };
}
const withModes = <T extends Partial<Record<Course, CourseSchedule>>>(courses: T): T & Record<'super' | 'allstar', CourseSchedule> => ({
  ...courses, super: recurringLegends(courses.super!), allstar: allStar(courses.super!),
});

/**
 * brackets.json, with the Gym Leaders, the Elite Four and Champions and the evil teams in the special-trainer pool
 * (Super Singles, Doubles and Multi), the Battle Legends every 50 battles of Super, and All Star Mode.
 */
export const BRACKETS: BracketsFile = {
  ...GAME_BRACKETS,
  singles: withModes(GAME_BRACKETS.singles),
  doubles: withModes(GAME_BRACKETS.doubles),
  multi: withModes(GAME_BRACKETS.multi),
  specialTrainerPool: {
    ...GAME_BRACKETS.specialTrainerPool,
    trainerIds: [
      ...GAME_BRACKETS.specialTrainerPool.trainerIds, ...CUSTOM.trainers.map(t => t.id), ...ELITE_FOUR.trainers.map(t => t.id),
      ...EVIL_TEAMS.trainers.map(t => t.id), ...DIGIDESTINED.trainers.map(t => t.id),
    ],
  },
};

const trainerByName = (name: string) => TRAINERS.find(t => t.kind === 'special' && trainerKey(t) === name)!;
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
/** The Battle Legends (bosses.json) and the custom trainers who share their battle-50 slot. */
export const BOSSES: Record<string, Boss> = { ...(bossesJson.bosses as Record<string, Boss>), ...BATTLE_50.bosses };
export const RULES = rulesJson as unknown as RulesFile;

/** Greetings and closing remarks, three sets per trainer name (written for this app; see trainer-quotes.json). */
export const TRAINER_QUOTES = quotesJson.quotes as Record<string, TrainerQuotes[]>;
/** Paired trainers' lines when they battle together in a Multi Battle (Tate and Liza), three sets each. */
export const TRAINER_MULTI_QUOTES = quotesJson.multi as Record<string, TrainerQuotes[]>;
/**
 * Greetings for two special trainers drawn together in a Multi Battle who share a region or a type
 * (written for this app): each entry holds one greeting per trainer, by name.
 */
export const TRAINER_PAIR_GREETINGS = quotesJson.pairs as Record<string, Record<string, string>>;
/**
 * Team-up lines for a trainer and their Multi Battle partner (Izzy with Tai), three sets each in matching order,
 * by the two names: used whenever those two battle together (written for this app).
 */
export const TRAINER_DUO_QUOTES = quotesJson.duos as Record<string, Record<string, TrainerQuotes[]>>;
const pairKey = (a: string, b: string) => [a, b].sort().join('|');
const PAIR_GREETINGS = new Map(Object.values(TRAINER_PAIR_GREETINGS).map(entry => {
  const [a, b] = Object.keys(entry);
  return [pairKey(a, b), entry] as const;
}));
const DUO_QUOTES = new Map(Object.values(TRAINER_DUO_QUOTES).map(entry => {
  const [a, b] = Object.keys(entry);
  return [pairKey(a, b), entry] as const;
}));
/**
 * Trainers who always battle together as opponents in Multi Battles: Tate and Liza, and the custom
 * battle-50 duos (Marques and Thomas, Tai and Matt). Their team-up lines (TRAINER_MULTI_QUOTES)
 * are used when they battle together.
 */
const DUO_PARTNER = new Map<number, number>([
  ...TRAINER_PAIRS.flatMap(p => [[p.trainerIds[0], p.trainerIds[1]], [p.trainerIds[1], p.trainerIds[0]]] as [number, number][]),
  ...Object.values(BATTLE_50.bosses).filter(b => b.partnerTrainerId !== undefined)
    .flatMap(b => [[b.trainerId, b.partnerTrainerId!], [b.partnerTrainerId!, b.trainerId]] as [number, number][]),
]);

/** What `trainer` says to greet you when battling alongside `other` (null: no special greeting for this pair). */
export function pairGreeting(trainer: Trainer, other: Trainer): string | null {
  if (samePerson(trainer, other)) return null;
  return PAIR_GREETINGS.get(pairKey(trainerKey(trainer), trainerKey(other)))?.[trainerKey(trainer)] ?? null;
}

/** Number of distinct quote picks: divisible by every list length up to 10, so each line is equally likely. */
export const QUOTE_PICKS = 2520;

/**
 * Which lines a battle uses, as a small number (0 to QUOTE_PICKS - 1) from its
 * seed text. Online, the host sends this instead of the seed, which stays secret
 * (it decides the opponents' teams), so both players see the same lines.
 */
export function quotePick(battleKey: string): number {
  // FNV-1a: a small, stable string hash.
  let hash = 0x811c9dc5;
  for (let i = 0; i < battleKey.length; i++) hash = Math.imul(hash ^ battleKey.charCodeAt(i), 0x01000193);
  return (hash >>> 0) % QUOTE_PICKS;
}

/**
 * The set of lines a trainer uses in one battle: picked from their three by
 * `battleKey` (the battle's seed text, or its quotePick), so the greeting on the
 * opponent card, the special-battle intro and the closing remark always belong
 * together, and a replayed battle gets the same lines. `alongside`: the other
 * opposing trainer in a Multi Battle; paired trainers fighting together use their
 * team-up lines (the same set for both, so they answer each other), and two
 * special trainers who share a region or a type greet you with lines about each
 * other (TRAINER_PAIR_GREETINGS; their closing remarks stay their usual ones). A trainer with
 * their fixed Multi Battle partner (Izzy and Tai) uses their team-up lines (TRAINER_DUO_QUOTES).
 */
export function trainerQuotes(trainer: Trainer, battleKey: string | number, alongside: readonly Trainer[] = []): TrainerQuotes | null {
  const partner = DUO_PARTNER.get(trainer.id);
  const together = partner !== undefined && alongside.some(t => t.id === partner);
  // A trainer with their Multi Battle partner (Izzy and Tai): their own team-up lines.
  const teammate = alongside.find(t => t.id !== trainer.id);
  const duo = teammate ? DUO_QUOTES.get(pairKey(trainerKey(trainer), trainerKey(teammate)))?.[trainerKey(trainer)] : undefined;
  const sets = duo ?? (together ? TRAINER_MULTI_QUOTES[trainerKey(trainer)] : undefined) ?? TRAINER_QUOTES[trainerKey(trainer)];
  if (!sets?.length) return null;
  const pick = typeof battleKey === 'number' ? battleKey : quotePick(battleKey);
  const lines = sets[pick % sets.length];
  if (duo || together || trainer.kind !== 'special') return lines;
  const other = alongside.find(t => t.id !== trainer.id && t.kind === 'special');
  const greeting = other ? pairGreeting(trainer, other) : null;
  return greeting ? { ...lines, greeting } : lines;
}
