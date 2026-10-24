import setsJson from './sets.json';
import trainersJson from './trainers.json';
import bracketsJson from './brackets.json';
import bossesJson from './bosses.json';
import rulesJson from './rules.json';
import quotesJson from './trainer-quotes.json';
import duoTitlesJson from './duo-titles.json';
import gymLeadersJson from '../custom/gym-leaders.json';
import battle50Json from '../custom/battle-50.json';
import eliteFourJson from '../custom/elite-four.json';
import evilTeamsJson from '../custom/evil-teams.json';
import digidestinedJson from '../custom/digidestined.json';
import regularTrainersJson from '../custom/regular-trainers.json';
import specialTrainersJson from '../custom/special-trainers.json';
import type { Boss, BracketsFile, Course, CourseSchedule, Format, LegendTrainer, RegularTrainer, RulesFile, SpecialTrainer, StatTable, Trainer, TrainerQuotes, TreeSet } from './types';

export * from './types';

const GAME_SETS = setsJson.sets as TreeSet[];
/**
 * App changes to the game's special-trainer weights, on request (the game's own stay in trainers.json):
 * Anabel 3.5 (2026-10-11; the game: 1, a seventh of the others').
 */
const WEIGHT_CHANGES: Record<string, number> = { Anabel: 3.5 };
/**
 * App changes to the game's trainers' names, on request, by trainer id (the game's own stay in trainers.json):
 * Youth Athlete Hilario (#153, female) is Hilary (2026-10-23).
 */
const NAME_CHANGES: Record<number, string> = { 152: 'Hilary' };
const GAME_TRAINERS = (trainersJson.trainers as Trainer[])
  .map(t => (t.kind === 'special' && t.name in WEIGHT_CHANGES ? { ...t, weight: WEIGHT_CHANGES[t.name] } : t))
  .map(t => (NAME_CHANGES[t.id] ? { ...t, name: NAME_CHANGES[t.id] } : t));
/** The game's Super Battle Legends (Red, Blue), by name: battle-50 entries can name them too. */
const gameLegend = (name: string) => GAME_TRAINERS.find(t => t.kind === 'legend' && t.course === 'super' && t.name === name);

interface CustomSet {
  species: string; item: string; ability: string; nature: string; evs: StatTable; moves: string[]; gender?: 'M' | 'F';
  /** A battle-50 trainer's Pokémon added later ("(block 2)" in battle-50-trainers.txt): its set comes after everyone else's. */
  block?: number;
}
interface CustomTrainer {
  name: string; key?: string; person?: string; class: string; classGender: 'M' | 'F'; region: string; sets: CustomSet[];
  /** The DigiDestined: own sprite, the species that always leads, own weight, fixed Multi Battle partners (by name). */
  sprite?: string; lead?: string; weight?: number; partners?: string[];
  /** A Digimon Tamer who is a Battle Legend (Takato, Henry): where and how often in battle-50.json. */
  legend?: boolean;
}

/** A trainer's unique name for data lookups (lines, pictures, partners): `key` if two share a name. */
export const trainerKey = (t: Pick<Trainer, 'name' | 'key'>) => t.key ?? t.name;
/** Whether two trainers are the same character (two versions of Archie or Maxie, or the very same trainer). */
export const samePerson = (a: Trainer, b: Trainer) => a.id === b.id || (a.person ?? trainerKey(a)) === (b.person ?? trainerKey(b));

/** The game's own special trainers have no class gender in its data (the custom ones do): theirs, by name. */
const SPECIAL_GENDER: Record<string, 'M' | 'F'> = {
  Grimsley: 'M', Anabel: 'F', Wally: 'M', Colress: 'M', Cynthia: 'F', Plumeria: 'F', Guzma: 'M', Kiawe: 'M', Mallow: 'F', Sina: 'F', Dexio: 'M',
};
/** A trainer's gender, when known. */
export const trainerGender = (t: Trainer): 'M' | 'F' | null => t.classGender ?? SPECIAL_GENDER[trainerKey(t)] ?? null;
/** Trainers who only ever team up with female trainers as opponents in Multi Battles (on request, 2026-10-19). */
const FEMALE_TEAMMATES_ONLY = new Set(['Courtney']);
/** Whether two trainers may battle side by side as opponents (Courtney only alongside female trainers). */
export function canTeamUp(a: Trainer, b: Trainer): boolean {
  const ok = (x: Trainer, y: Trainer) => !FEMALE_TEAMMATES_ONLY.has(trainerKey(x)) || trainerGender(y) === 'F';
  return ok(a, b) && ok(b, a);
}

/**
 * Custom special trainers (see DATA_NOTES.md "Custom additions"), appended after the sets and
 * trainers before them so ids stay array indices: the Gym Leaders (weight 7, like the game's
 * special trainers), the Elite Four and Champions (3.5), the evil teams (1, Courtney 7) and the
 * DigiDestined and Digimon Tamers (7). A trainer's own `weight` wins over the group's. Both versions, IV 31.
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
 * with Matt or Takato), and can have a Pokémon that always leads (`lead`). The bosses are
 * made once every trainer exists (battle50Bosses): an entry can also name a Digimon Tamer
 * (Takato), a special trainer who comes later. Pokémon added to a trainer's team later (`block` 2: Thomas's and
 * Marques's, 2026-10-23) get their sets after everyone else's (laterSets), so no other set's id moves.
 */
/** The battle-50 trainers (battle-50.json), with `block` 2 for the Battle Legends added later (Elio, Kris...). */
const BATTLE_50_LIST = battle50Json.trainers as (CustomTrainer & { sprite?: string; lead?: string; block?: number })[];
function battle50Trainers(list: typeof BATTLE_50_LIST, firstSet: number, firstTrainer: number) {
  const sets: TreeSet[] = [];
  const later: { block: number; roster: number[]; label: string; setNumber: number; set: Omit<CustomSet, 'block'> }[] = [];
  const entries = battle50Json.battles as Battle50Entry[];
  const bossKey = (e: Battle50Entry) => `${e.trainers.map(n => n.toLowerCase()).join('-')}-${e.format}-${e.course}`;
  const trainers: LegendTrainer[] = list.map((t, i) => {
    const entry = entries.find(e => e.trainers.includes(t.name))!;
    const roster: number[] = [];
    t.sets.forEach(({ block, ...s }, j) => {
      const label = `${s.species} (${t.name}${t.sets.length > 1 ? ` ${j + 1}` : ''})`;
      if ((block ?? 1) !== 1) return void later.push({ block: block!, roster, label, setNumber: j + 1, set: s });
      const id = firstSet + sets.length;
      sets.push({ id, label, setNumber: j + 1, ...s });
      roster.push(id);
    });
    const lead = t.lead ? roster.find(id => sets[id - firstSet].species === t.lead) : undefined;
    return {
      id: firstTrainer + i, name: t.name, class: t.class, classGender: t.classGender, iv: 31, roster, kind: 'legend', number: null,
      bossKey: bossKey(entry), format: entry.format, course: entry.course, custom: true, sprite: t.sprite,
      ...(lead !== undefined ? { leadSetId: lead } : {}),
      source: { sets: 'custom: data-sources/custom/battle-50-trainers.txt (designed by the user)' },
    };
  });
  /**
   * The later sets, with ids from `first` on, each joining its trainer's roster: by block (a block 3 added some day
   * comes after every block 2 set), then in trainer order.
   */
  const laterSets = (first: number): TreeSet[] => [...later].sort((a, b) => a.block - b.block).map(({ roster, label, setNumber, set }, k) => {
    roster.push(first + k);
    return { id: first + k, label, setNumber, ...set };
  });
  return { sets, trainers, entries, bossKey, laterSets };
}
/**
 * The battle-50 bosses: custom trainers, the game's Battle Legends in another slot (Red at battle 50 of Super
 * Doubles...), or a Digimon Tamer (Takato, alongside Tai), by name.
 */
function battle50Bosses(tamers: Trainer[]): Record<string, Boss> {
  const idOf = (name: string) => ([...BATTLE_50.trainers, ...LEGENDS_LATER.trainers].find(t => t.name === name) ?? gameLegend(name) ?? tamers.find(t => t.name === name))!.id;
  return Object.fromEntries(BATTLE_50.entries.map(e => [BATTLE_50.bossKey(e), {
    trainerId: idOf(e.trainers[0]), ...(e.trainers[1] ? { partnerTrainerId: idOf(e.trainers[1]) } : {}),
    format: e.format, course: e.course, battle: e.battle, bp: 50, teamSize: e.format === 'multi' ? 2 : e.format === 'doubles' ? 4 : 3, iv: 31, weight: e.weight,
  } satisfies Boss]));
}
const BATTLE_50 = battle50Trainers(BATTLE_50_LIST.filter(t => (t.block ?? 1) === 1), GAME_SETS.length + CUSTOM.sets.length, GAME_TRAINERS.length + CUSTOM.trainers.length);
/** The Elite Four and Champions of Generations 1-7, after everything else (earlier ids, kept in saved runs, don't move). */
const ELITE_FOUR = customTrainers(
  eliteFourJson.trainers as CustomTrainer[],
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length, GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length,
  3.5, 'elite-four.txt (designed for the user)',
);

/** The evil teams' leaders and admins of Generations 1-7, after the Elite Four (earlier ids don't move): weight 1, Courtney 7. */
const EVIL_TEAMS = customTrainers(
  evilTeamsJson.trainers as CustomTrainer[],
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length,
  1, 'evil-teams.txt (designed for the user)',
);

/**
 * The DigiDestined and Digimon Tamers (Izzy, Kaito, Takato...), after the evil teams (earlier ids don't move): weight as
 * given (7), own sprite and lead. Takato and Henry are Battle Legends (on request, 2026-10-18; special trainers before,
 * kept here so their ids don't move): they battle where battle-50.json puts them.
 */
const DIGIDESTINED_LIST = digidestinedJson.trainers as CustomTrainer[];
const DIGIDESTINED_TRAINERS = customTrainers(
  DIGIDESTINED_LIST,
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length + EVIL_TEAMS.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length + EVIL_TEAMS.trainers.length,
  3.5, 'digidestined.txt (designed by the user)',
);
/** A Digimon Tamer made a Battle Legend: their first battle-50 entry says their own format and course. */
function asBattleLegend(t: SpecialTrainer): LegendTrainer {
  const entry = BATTLE_50.entries.find(e => e.trainers.includes(t.name));
  if (!entry) throw new Error(`${t.name} is a Battle Legend, but no battle-50 entry names them`);
  const { versions: _versions, weight: _weight, region: _region, ...rest } = t;
  return { ...rest, kind: 'legend', number: null, bossKey: BATTLE_50.bossKey(entry), format: entry.format, course: entry.course };
}
const DIGIDESTINED = {
  sets: DIGIDESTINED_TRAINERS.sets,
  trainers: DIGIDESTINED_TRAINERS.trainers.map((t, i): Trainer => (DIGIDESTINED_LIST[i].legend ? asBattleLegend(t) : t)),
};

/**
 * Custom regular trainers (Veteran Mildred, the Paradox trainers), after the DigiDestined (earlier ids don't move): they
 * join the regular trainers' pool from their `fromBattle` on (REGULAR_FROM) at their weight against the game's trainers'
 * 1 (1.1 from battle 100, 1.5 from battle 200), with their own Showdown sprite. IV 31, as
 * every regular trainer from battle 51. A Paradox trainer (`alwaysParadox`) always brings one of their sets holding a
 * Paradoxorb (`alwaysOneOf`). `block` 2 (the Ace Trainers and Beauties): added after Lillie, Hau, Lana and Marley, so they
 * come after them.
 */
type CustomRegular = Omit<CustomTrainer, 'region'> & { spriteId: string; fromBattle: number; weights: { fromBattle: number; weight: number }[]; alwaysParadox?: boolean; block?: number };
const REGULAR_LIST = regularTrainersJson.trainers as CustomRegular[];
function customRegularTrainers(list: CustomRegular[], firstSet: number, firstTrainer: number) {
  const sets: TreeSet[] = [];
  const trainers: RegularTrainer[] = list.map((t, i) => {
    const roster = t.sets.map((s, j) => {
      const id = firstSet + sets.length;
      sets.push({ id, label: `${s.species} (${t.name}${t.sets.length > 1 ? ` ${j + 1}` : ''})`, setNumber: j + 1, ...s });
      return id;
    });
    const always = t.alwaysParadox ? roster.filter(id => sets[id - firstSet].item.startsWith('Paradoxorb-')) : [];
    return {
      id: firstTrainer + i, name: t.name, class: t.class, classGender: t.classGender, iv: 31, roster, kind: 'regular', number: null,
      bulbapediaBrackets: [], custom: true, spriteId: t.spriteId, fromBattle: t.fromBattle, poolWeights: t.weights, ...(always.length ? { alwaysOneOf: always } : {}),
      source: { sets: 'custom: data-sources/custom/regular-trainers.txt (designed for the user)' },
    };
  });
  return { sets, trainers };
}
const REGULAR = customRegularTrainers(
  REGULAR_LIST.filter(t => (t.block ?? 1) === 1),
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length + EVIL_TEAMS.sets.length + DIGIDESTINED.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length + EVIL_TEAMS.trainers.length + DIGIDESTINED.trainers.length,
);

/** Other special trainers added on request (Lillie, Hau, Lana, Marley), after everyone else (earlier ids don't move): weight 7, IV 31. */
const MORE_SPECIALS = customTrainers(
  specialTrainersJson.trainers as CustomTrainer[],
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length + EVIL_TEAMS.sets.length + DIGIDESTINED.sets.length + REGULAR.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length + EVIL_TEAMS.trainers.length + DIGIDESTINED.trainers.length + REGULAR.trainers.length,
  7, 'special-trainers.txt (designed for the user)',
);

/** Custom regular trainers added after Lillie, Hau, Lana and Marley (`block` 2: the Ace Trainers and Beauties), after them. */
const REGULAR_LATER = customRegularTrainers(
  REGULAR_LIST.filter(t => t.block === 2),
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length + EVIL_TEAMS.sets.length + DIGIDESTINED.sets.length + REGULAR.sets.length + MORE_SPECIALS.sets.length,
  GAME_TRAINERS.length + CUSTOM.trainers.length + BATTLE_50.trainers.length + ELITE_FOUR.trainers.length + EVIL_TEAMS.trainers.length + DIGIDESTINED.trainers.length + REGULAR.trainers.length + MORE_SPECIALS.trainers.length,
);
/** Pokémon added to the battle-50 trainers' teams later (Thomas's and Marques's, 2026-10-23), after every other set. */
const BATTLE_50_LATER = BATTLE_50.laterSets(
  GAME_SETS.length + CUSTOM.sets.length + BATTLE_50.sets.length + ELITE_FOUR.sets.length + EVIL_TEAMS.sets.length + DIGIDESTINED.sets.length + REGULAR.sets.length + MORE_SPECIALS.sets.length + REGULAR_LATER.sets.length,
);
/**
 * Everything added since is appended in the order it came, so no earlier trainer's or set's id moves: each group starts
 * where the one before it ends.
 */
const after = (groups: { sets: unknown[]; trainers: unknown[] }[], earlierSets: number, earlierTrainers: number) => [
  earlierSets + groups.reduce((n, g) => n + g.sets.length, 0), earlierTrainers + groups.reduce((n, g) => n + g.trainers.length, 0),
] as const;
const [SETS_SO_FAR, TRAINERS_SO_FAR] = after(
  [CUSTOM, BATTLE_50, ELITE_FOUR, EVIL_TEAMS, DIGIDESTINED, REGULAR, MORE_SPECIALS, REGULAR_LATER, { sets: BATTLE_50_LATER, trainers: [] }],
  GAME_SETS.length, GAME_TRAINERS.length,
);
/** Custom regular trainers added after that (`block` 3: Percival, 2026-10-23). */
const REGULAR_BLOCK3 = customRegularTrainers(REGULAR_LIST.filter(t => t.block === 3), SETS_SO_FAR, TRAINERS_SO_FAR);
/** Battle Legends added after that (`block` 2 in battle-50.json: Elio, Kris, Brendan, May, Dawn, Rosa, Gloria; 2026-10-23). */
const LEGENDS_LATER = battle50Trainers(BATTLE_50_LIST.filter(t => t.block === 2), ...after([REGULAR_BLOCK3], SETS_SO_FAR, TRAINERS_SO_FAR));
/** Custom regular trainers added after that (`block` 4: Bronson, Ignatius, Delta; 2026-10-23). */
const REGULAR_BLOCK4 = customRegularTrainers(REGULAR_LIST.filter(t => t.block === 4), ...after([REGULAR_BLOCK3, LEGENDS_LATER], SETS_SO_FAR, TRAINERS_SO_FAR));
/** Every custom regular trainer (all blocks): the late pools take them all. */
const CUSTOM_REGULAR = [...REGULAR.trainers, ...REGULAR_LATER.trainers, ...REGULAR_BLOCK3.trainers, ...REGULAR_BLOCK4.trainers];

export const SETS: TreeSet[] = [
  ...GAME_SETS, ...CUSTOM.sets, ...BATTLE_50.sets, ...ELITE_FOUR.sets, ...EVIL_TEAMS.sets, ...DIGIDESTINED.sets, ...REGULAR.sets, ...MORE_SPECIALS.sets, ...REGULAR_LATER.sets,
  ...BATTLE_50_LATER, ...REGULAR_BLOCK3.sets, ...LEGENDS_LATER.sets, ...REGULAR_BLOCK4.sets,
];
export const TRAINERS: Trainer[] = [
  ...GAME_TRAINERS, ...CUSTOM.trainers, ...BATTLE_50.trainers, ...ELITE_FOUR.trainers, ...EVIL_TEAMS.trainers, ...DIGIDESTINED.trainers, ...REGULAR.trainers,
  ...MORE_SPECIALS.trainers, ...REGULAR_LATER.trainers, ...REGULAR_BLOCK3.trainers, ...LEGENDS_LATER.trainers, ...REGULAR_BLOCK4.trainers,
];

/**
 * Trainers who, as opponents in a Multi Battle, always battle alongside one of their partners (Izzy: Tai, Colress or Cheren), who
 * goes first (on the left). The partner is picked with equal chance; a partner can be a Battle Legend (Tai only
 * appears as one otherwise). By trainer id: partner ids.
 */
/**
 * A Multi Battle partner named in digidestined.json: a custom special trainer or Battle Legend first (Tai, Takato,
 * Cheren...), else one of the game's own special trainers (Colress).
 */
function multiPartnerByName(name: string): Trainer {
  const named = TRAINERS.filter(o => (o.kind === 'legend' || o.kind === 'special') && o.name === name);
  const found = named.find(o => o.custom) ?? named[0];
  if (!found) throw new Error(`No special trainer or Battle Legend named ${name} (a Multi Battle partner in digidestined.json)`);
  return found;
}
const MULTI_PARTNERS = new Map(DIGIDESTINED_LIST.flatMap((t, i) => (t.partners?.length
  ? [[DIGIDESTINED.trainers[i].id, t.partners.map(name => multiPartnerByName(name).id)]] as [number, number[]][]
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

/** The game's pool for battles 51 and up, which custom regular trainers join from their `fromBattle` on. */
const LATE_POOL = 'b51+';
/** The battles from which the late pool grows (100: Veteran Mildred), each with its own pool ("b100+"). */
const REGULAR_FROM = [...new Set(CUSTOM_REGULAR.map(t => t.fromBattle!))].sort((a, b) => a - b);
const latePoolKey = (from: number) => `b${from}+`;
/** The late pool from battle `from` on: the game's 100 trainers, and every custom regular trainer who's joined by then. */
function latePool(from: number): BracketsFile['pools'][string] {
  const pool = GAME_BRACKETS.pools[LATE_POOL];
  return {
    label: `Battles ${from}+`, bulbapediaNumbers: pool.bulbapediaNumbers,
    trainerIds: [...pool.trainerIds, ...CUSTOM_REGULAR.filter(t => t.fromBattle! <= from).map(t => t.id)],
  };
}
/** Super schedules: from each `fromBattle` on, the late pool with those custom regular trainers in it (rules just before the game's 51+ rule; the latest first). */
function withLatePools(schedule: CourseSchedule): CourseSchedule {
  const rules = schedule.schedule.flatMap(r => ('pool' in r && r.pool === LATE_POOL
    ? [...[...REGULAR_FROM].reverse().map(from => ({ battles: [from, null] as [number, null], pool: latePoolKey(from) })), r]
    : [r]));
  return { ...schedule, schedule: rules };
}
/** The Super course's battle-50 boss key (its draw includes everyone who shares that slot). */
const superBossKey = (schedule: CourseSchedule) => {
  const rule = schedule.schedule.find(r => 'boss' in r);
  if (!rule || !('boss' in rule)) throw new Error('No Battle Legend in the Super schedule');
  return rule.boss;
};
/** All Star Mode: the Battle Legends' draw (battle 50 of Super) comes every 10th battle (every 5th before 2026-10-11). */
export const ALL_STAR_LEGEND_EVERY = 10;
/** All Star Mode (custom, unrated): special trainers in every battle, and every 10th the battle-50 draw. */
function allStar(superSchedule: CourseSchedule): CourseSchedule {
  return {
    length: null, endsAfterLength: false, specialTrainers: true,
    schedule: [{ everyNth: ALL_STAR_LEGEND_EVERY, boss: superBossKey(superSchedule) }, { battles: [1, null], special: true }],
  };
}
const withModes = <T extends Partial<Record<Course, CourseSchedule>>>(courses: T): T & Record<'super' | 'allstar', CourseSchedule> => ({
  ...courses, super: withLatePools(recurringLegends(courses.super!)), allstar: allStar(courses.super!),
});

/**
 * brackets.json, with the Gym Leaders, the Elite Four and Champions and the evil teams in the special-trainer pool
 * (Super Singles, Doubles and Multi), the Battle Legends every 50 battles of Super, All Star Mode, and the custom
 * regular trainers in the regular pool from their battle on (Veteran Mildred: 100).
 */
export const BRACKETS: BracketsFile = {
  ...GAME_BRACKETS,
  pools: { ...GAME_BRACKETS.pools, ...Object.fromEntries(REGULAR_FROM.map(from => [latePoolKey(from), latePool(from)])) },
  singles: withModes(GAME_BRACKETS.singles),
  doubles: withModes(GAME_BRACKETS.doubles),
  multi: withModes(GAME_BRACKETS.multi),
  specialTrainerPool: {
    ...GAME_BRACKETS.specialTrainerPool,
    trainerIds: [
      ...GAME_BRACKETS.specialTrainerPool.trainerIds, ...CUSTOM.trainers.map(t => t.id), ...ELITE_FOUR.trainers.map(t => t.id),
      ...EVIL_TEAMS.trainers.map(t => t.id), ...DIGIDESTINED.trainers.filter(t => t.kind === 'special').map(t => t.id),
      ...MORE_SPECIALS.trainers.map(t => t.id),
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
const BATTLE_50_BOSSES = battle50Bosses(DIGIDESTINED.trainers);
export const BOSSES: Record<string, Boss> = { ...(bossesJson.bosses as Record<string, Boss>), ...BATTLE_50_BOSSES };
export const RULES = rulesJson as unknown as RulesFile;

/** Greetings and closing remarks, three sets per trainer name (written for this app; see trainer-quotes.json). */
export const TRAINER_QUOTES = quotesJson.quotes as Record<string, TrainerQuotes[]>;
/** Paired trainers' lines when they battle together in a Multi Battle (Tate and Liza), three sets each. */
export const TRAINER_MULTI_QUOTES = quotesJson.multi as Record<string, TrainerQuotes[]>;
/**
 * Lines for two special trainers drawn together in a Multi Battle who share a region or a type
 * (written for this app): each entry holds one set per trainer, by name (a greeting and both closing remarks).
 */
export const TRAINER_PAIR_QUOTES = quotesJson.pairs as Record<string, Record<string, TrainerQuotes[]>>;
/**
 * Team-up lines for a trainer and their Multi Battle partner (Izzy with Tai), three sets each in matching order,
 * by the two names: used whenever those two battle together (written for this app).
 */
export const TRAINER_DUO_QUOTES = quotesJson.duos as Record<string, Record<string, TrainerQuotes[]>>;
const pairKey = (a: string, b: string) => [a, b].sort().join('|');
/** Each duo's team title in the All Star Duo Tournament ("The Mystic Combination"), by pair. */
const DUO_TITLES = new Map(Object.entries(duoTitlesJson.titles).map(([label, title]) => {
  const [a, b] = label.split(' & ');
  return [pairKey(a, b), title] as const;
}));
/**
 * A duo's team title in the All Star Duo Tournament: the title of that pair, whichever speaks first (on request,
 * 2026-10-23: one for each pair, not built from each trainer's own). Every pair a tournament can draw has one
 * (tested); any other pair is just their names.
 */
export const duoTitle = (a: Trainer, b: Trainer): string => DUO_TITLES.get(pairKey(trainerKey(a), trainerKey(b))) ?? `${a.name} & ${b.name}`;
/** Your team's title, with any partner (on request, 2026-10-23). */
export const PLAYER_DUO_TITLE = 'Rising Champions';
const PAIR_QUOTES = new Map(Object.values(TRAINER_PAIR_QUOTES).map(entry => {
  const [a, b] = Object.keys(entry);
  return [pairKey(a, b), entry] as const;
}));
const DUO_QUOTES = new Map(Object.values(TRAINER_DUO_QUOTES).map(entry => {
  const [a, b] = Object.keys(entry);
  return [pairKey(a, b), entry] as const;
}));
/**
 * Trainers who always battle together as opponents in Multi Battles: Tate and Liza, and the custom
 * battle-50 duos (Marques and Thomas, Tai and Matt, Tai and Takato). Their team-up lines (TRAINER_MULTI_QUOTES)
 * are used when they battle together. By trainer id: the partners they have such lines with (Tai: Matt and Takato).
 */
const DUO_PARTNERS = new Map<number, Set<number>>();
for (const [a, b] of [
  ...TRAINER_PAIRS.map(p => p.trainerIds as [number, number]),
  ...Object.values(BATTLE_50_BOSSES).filter(b => b.partnerTrainerId !== undefined).map(b => [b.trainerId, b.partnerTrainerId!] as [number, number]),
]) {
  for (const [x, y] of [[a, b], [b, a]]) DUO_PARTNERS.set(x, (DUO_PARTNERS.get(x) ?? new Set()).add(y));
}

/** Trainers who always battle together (Tate and Liza, the battle-50 duos), first (left) trainer first. */
const FIXED_ORDER: [number, number][] = [
  ...TRAINER_PAIRS.map(p => p.trainerIds as [number, number]),
  ...Object.values(BATTLE_50_BOSSES).filter(b => b.partnerTrainerId !== undefined).map(b => [b.trainerId, b.partnerTrainerId!] as [number, number]),
];

/**
 * Whether `a` should stand first (left) when battling beside `b` as opponents in a Multi Battle. Lines written for the
 * two of them together (pair lines, team-up lines) are read in order: the first named speaks first and the other
 * answers, on the opponent card, in the entrance and in the closing remarks. So they're lined up that way, and
 * trainers who always battle together keep their usual order (Tate before Liza, Tai first). Others: as they are.
 */
export function speaksFirst(a: Trainer, b: Trainer): boolean {
  const key = pairKey(trainerKey(a), trainerKey(b));
  const entry = PAIR_QUOTES.get(key) ?? DUO_QUOTES.get(key);
  if (entry) return Object.keys(entry)[0] !== trainerKey(b);
  const fixed = FIXED_ORDER.find(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id));
  return !fixed || fixed[0] === a.id;
}

/** Special trainers who have pair lines with this one (TRAINER_PAIR_QUOTES), by id. */
export function pairGreetingPartners(trainerId: number): number[] {
  const me = trainerKey(TRAINERS[trainerId]);
  return Object.values(TRAINER_PAIR_QUOTES)
    .filter(entry => me in entry)
    .flatMap(entry => Object.keys(entry).filter(name => name !== me))
    .map(name => TRAINERS.find(t => t.kind === 'special' && trainerKey(t) === name)?.id)
    .filter((id): id is number => id !== undefined && !samePerson(TRAINERS[id], TRAINERS[trainerId]));
}

/**
 * What `trainer` says when battling alongside `other`: greeting and closing remarks (null: no lines for this pair).
 * `pick` (a quote pick) chooses one of their sets; both use the same one, so they answer each other.
 */
export function pairQuotes(trainer: Trainer, other: Trainer, pick = 0): TrainerQuotes | null {
  if (samePerson(trainer, other)) return null;
  const sets = PAIR_QUOTES.get(pairKey(trainerKey(trainer), trainerKey(other)))?.[trainerKey(trainer)];
  return sets?.length ? sets[pick % sets.length] : null;
}

/** What `trainer` says to greet you when battling alongside `other` (null: no special greeting for this pair). */
export function pairGreeting(trainer: Trainer, other: Trainer, pick = 0): string | null {
  return pairQuotes(trainer, other, pick)?.greeting ?? null;
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
 * other, and close with remarks about it too (TRAINER_PAIR_QUOTES). A trainer with
 * their fixed Multi Battle partner (Izzy and Tai) uses their team-up lines (TRAINER_DUO_QUOTES).
 */
export function trainerQuotes(trainer: Trainer, battleKey: string | number, alongside: readonly Trainer[] = []): TrainerQuotes | null {
  const partners = DUO_PARTNERS.get(trainer.id);
  const together = !!partners && alongside.some(t => partners.has(t.id));
  // A trainer with their Multi Battle partner (Izzy and Tai): their own team-up lines.
  const teammate = alongside.find(t => t.id !== trainer.id);
  const duo = teammate ? DUO_QUOTES.get(pairKey(trainerKey(trainer), trainerKey(teammate)))?.[trainerKey(trainer)] : undefined;
  const sets = duo ?? (together ? TRAINER_MULTI_QUOTES[trainerKey(trainer)] : undefined) ?? TRAINER_QUOTES[trainerKey(trainer)];
  if (!sets?.length) return null;
  const pick = typeof battleKey === 'number' ? battleKey : quotePick(battleKey);
  const lines = sets[pick % sets.length];
  if (duo || together || trainer.kind !== 'special') return lines;
  const other = alongside.find(t => t.id !== trainer.id && t.kind === 'special');
  return (other && pairQuotes(trainer, other, pick)) || lines;
}

/** A trainer's line, said in the battle log. */
export interface TrainerLine { trainer: Trainer; line: string }

const linesOf = (trainers: readonly Trainer[], battleKey: string | number, pick: (q: TrainerQuotes) => string): TrainerLine[] =>
  trainers.flatMap(trainer => {
    const quotes = trainerQuotes(trainer, battleKey, trainers);
    const line = quotes && pick(quotes);
    return line ? [{ trainer, line }] : [];
  });

/** What the opposing trainers say as the battle begins, in the order they speak (trainers without lines are left out). */
export const greetingsOf = (trainers: readonly Trainer[], battleKey: string | number): TrainerLine[] => linesOf(trainers, battleKey, q => q.greeting);

/** Their closing remarks, which go with those greetings: `won` is whether these trainers won the battle. */
export const closingsOf = (trainers: readonly Trainer[], battleKey: string | number, won: boolean): TrainerLine[] =>
  linesOf(trainers, battleKey, q => (won ? q.trainerWins : q.trainerLoses));
