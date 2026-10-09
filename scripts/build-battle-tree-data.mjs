#!/usr/bin/env node
/**
 * Builds src/data/battle-tree/*.json from the raw source extracts in
 * data-sources/battle-tree/. See data-sources/battle-tree/SOURCES.md and
 * DATA_NOTES.md for provenance. Run with: npm run data:build
 *
 * Every species / move / item / nature is resolved against @pkmn/dex (Gen 7);
 * the script throws on anything it cannot resolve instead of guessing.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dex } from '@pkmn/dex';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data-sources', 'battle-tree');
const OUT = join(ROOT, 'src', 'data', 'battle-tree');
const RETRIEVED = '2026-10-03';
const gen7 = Dex.forGen(7);

// ---------------------------------------------------------------------------
// Source registry. Records reference these keys in their `source` fields.
// ---------------------------------------------------------------------------
const SOURCES = {
  'tre-sm': {
    title: 'Team Rocket Elite, "SM full trainer and moveset data" (datamined from Pokémon Sun/Moon v1.1), tabs "Tree Pokemon" and "Tree Trainers"',
    url: 'https://docs.google.com/spreadsheets/d/1D7T0jCHBkDppjTB0_rJyK0houk8zE3wLmZ1DlVXEkXg/edit#gid=0',
    linkedFrom: 'https://www.smogon.com/forums/threads/battle-tree-discussion-and-records.3587215/',
    kind: 'datamine',
    retrieved: RETRIEVED,
  },
  'bulbapedia-trainers': {
    title: 'Bulbapedia, "List of Battle Tree Trainers" (bracket table + special trainer notes)',
    url: 'https://web.archive.org/web/20260817222050/https://bulbapedia.bulbagarden.net/wiki/List_of_Battle_Tree_Trainers',
    kind: 'wiki',
    retrieved: RETRIEVED,
  },
  'bulbapedia-battle-tree': {
    title: 'Bulbapedia, "Battle Tree" (courses, restrictions, BP table, Battle Legends, special trainers)',
    url: 'https://bulbapedia.bulbagarden.net/wiki/Battle_Tree',
    kind: 'wiki',
    retrieved: RETRIEVED,
  },
  'bulbapedia-pokemon': {
    title: 'Bulbapedia, "List of Battle Tree Pokémon" (SM-tagged rows)',
    url: 'https://web.archive.org/web/20260218191326/https://bulbapedia.bulbagarden.net/wiki/List_of_Battle_Tree_Pok%C3%A9mon',
    kind: 'wiki',
    retrieved: RETRIEVED,
  },
  'informant-sm': {
    title: 'Level 51, "SM Battle Tree Informant" (built on the Team Rocket Elite dump)',
    url: 'https://docs.google.com/spreadsheets/d/1FFsMrmL9WPVRsbWTE7mvKZ9mz_J4_E_aDCWguGLrKV0/edit',
    kind: 'community-sheet',
    retrieved: RETRIEVED,
  },
  'sadisticmystic-sheet': {
    title: 'SadisticMystic, "Trainer + Pokémon lookup spreadsheet" (USUM-based, with SM roster deltas, trainer ranges, IV tiers, special trainer notes)',
    url: 'https://docs.google.com/spreadsheets/d/1w-xYTGS9SW8np4Qxg9KjB99QkSxfPDhmjTzHk8GOT04/edit',
    kind: 'community-sheet',
    retrieved: RETRIEVED,
  },
  'tree-sets-app': {
    title: 'cristiannomartins/Tree-Sets (SM Battle Tree catalogue app data: trainer pools, classes)',
    url: 'https://github.com/cristiannomartins/Tree-Sets',
    kind: 'community-dataset',
    retrieved: RETRIEVED,
  },
  'atsync-iv-post': {
    title: 'atsync, Smogon Battle Tree Discussion thread, post #7392593 (opponent IV testing; "educated guess", not datamined)',
    url: 'https://www.smogon.com/forums/threads/battle-tree-discussion-and-records.3587215/page-83#post-7392593',
    kind: 'community-testing',
    retrieved: RETRIEVED,
  },
  'smogon-guide': {
    title: 'Smogon, "Battle Tree Mechanics and Guide" (team generation, ability odds, BP, banlist, AI behaviour)',
    url: 'https://www.smogon.com/forums/threads/battle-tree-mechanics-and-guide-gp-0-2.3613222/',
    kind: 'community-guide',
    retrieved: RETRIEVED,
  },
  'serebii-battle-tree': {
    title: 'Serebii, "Pokémon Sun & Moon - The Battle Tree" (Multi Battles: two trainers per side, scouting for 10 BP)',
    url: 'https://www.serebii.net/sunmoon/battletree.shtml',
    kind: 'community-guide',
    retrieved: RETRIEVED,
  },
  'kaphotics-usum-diff': {
    title: 'Pastebin listing SM→USUM Battle Tree set changes (confirms SM had 996 sets)',
    url: 'https://pastebin.com/jt9TQEdP',
    kind: 'community-diff',
    retrieved: RETRIEVED,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

const fail = msg => { throw new Error(`[build-battle-tree-data] ${msg}`); };

/** TRE label base name -> Showdown species name. Only explicit, documented mappings. */
const FORM_NAMES = {
  'Heat Rotom': 'Rotom-Heat',
  'Wash Rotom': 'Rotom-Wash',
  'Frost Rotom': 'Rotom-Frost',
  'Fan Rotom': 'Rotom-Fan',
  'Mow Rotom': 'Rotom-Mow',
  'Oricorio (Sensu)': 'Oricorio-Sensu',
  "Oricorio (Pa'u Style)": "Oricorio-Pa'u",
  'Oricorio (Pom-Pom)': 'Oricorio-Pom-Pom',
  'Lycanroc (Midnight)': 'Lycanroc-Midnight',
};
function toSpecies(base) {
  let name = FORM_NAMES[base] ?? base;
  if (name.startsWith('Alolan ')) name = `${name.slice('Alolan '.length)}-Alola`;
  const s = gen7.species.get(name);
  if (!s.exists) fail(`unknown species "${base}" -> "${name}"`);
  return s.name;
}

const STAT_KEYS = { HP: 'hp', Atk: 'atk', Def: 'def', SpA: 'spa', SpD: 'spd', Spd: 'spe' };
// TRE writes Speed as "Spd" and Sp. Def as "SpD". EV amounts per number of
// invested stats were verified against Bulbapedia's numeric EV columns (996/996).
const EV_PER_STAT_COUNT = { 2: 252, 3: 170, 4: 127 };
function parseEvs(spread, label) {
  const parts = spread.split('/');
  const amount = EV_PER_STAT_COUNT[parts.length];
  if (!amount) fail(`unexpected EV spread "${spread}" on ${label}`);
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const p of parts) {
    const k = STAT_KEYS[p];
    if (!k) fail(`unknown EV stat "${p}" on ${label}`);
    evs[k] = amount;
  }
  return evs;
}

function checkName(kind, table, name, label) {
  const e = table.get(name);
  if (!e.exists) fail(`unknown ${kind} "${name}" on ${label}`);
  if (e.name !== name) fail(`${kind} "${name}" resolves to "${e.name}" on ${label} (fix the source mapping)`);
  return e.name;
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------
const setRows = parseCsv(readFileSync(join(RAW, 'tre-sm-tree-pokemon.csv'), 'utf8')).slice(1);
if (setRows.length !== 996) fail(`expected 996 SM sets, got ${setRows.length}`);

const SET_NOTES = {
  204: 'Sun/Moon v1.1 data. In v1.0 this set had Shell Smash instead of Draco Meteor (Team Rocket Elite note, citing Kaphotics).',
  226: 'Sun/Moon v1.1 data. In v1.0 this set was a copy of Hawlucha-1 (Team Rocket Elite note, citing Kaphotics).',
};

const sets = setRows.map((r, i) => {
  const [idx, label, nature, item, m1, m2, m3, m4, spread] = r;
  if (Number(idx) !== i) fail(`set row ${i} has index ${idx}`);
  const m = /^(.*)-(\d)$/.exec(label);
  if (!m) fail(`bad set label "${label}"`);
  const species = toSpecies(m[1]);
  const moves = [m1, m2, m3, m4].filter(Boolean).map(x => checkName('move', gen7.moves, x, label));
  const set = {
    id: i,
    label,
    species,
    setNumber: Number(m[2]),
    nature: checkName('nature', gen7.natures, nature, label),
    item: checkName('item', gen7.items, item, label),
    moves,
    evs: parseEvs(spread, label),
  };
  const notes = [];
  if (SET_NOTES[i]) notes.push(SET_NOTES[i]);
  if (species === 'Gourgeist') notes.push('APPROXIMATION: no source states a size form; using Average (form 0 / Showdown "Gourgeist").');
  if (moves.length < 4) notes.push(`Set has only ${moves.length} move(s) in Sun/Moon (filled to 4 in USUM).`);
  if (notes.length) set.notes = notes;
  return set;
});
const setIdByLabel = new Map(sets.map(s => [s.label, s.id]));
if (setIdByLabel.size !== sets.length) fail('duplicate set labels');

// ---------------------------------------------------------------------------
// Trainers
// ---------------------------------------------------------------------------
const trainerLines = readFileSync(join(RAW, 'tre-sm-tree-trainers.txt'), 'utf8')
  .split(/\r?\n/).map(l => l.trim().replace(/^"|"$/g, '')).filter(Boolean);
if (trainerLines.length !== 205) fail(`expected 205 SM trainers, got ${trainerLines.length}`);

const brackets = JSON.parse(readFileSync(join(RAW, 'bulbapedia-trainer-brackets.json'), 'utf8'));
if (brackets.trainers.length !== 190) fail('expected 190 regular trainers in Bulbapedia bracket table');

/** Opponent IVs by Bulbapedia trainer number (atsync's tested estimate; matches SadisticMystic's IV-tier formula). */
function regularIv(number) {
  if (number <= 50) return 19;
  if (number <= 70) return 23;
  if (number <= 90) return 27;
  return 31;
}

const SPECIALS = {
  // id: [class, versions, weight, unlockNote]
  192: { name: 'Grimsley', class: 'Pokémon Trainer', versions: ['sun', 'moon'], weight: 7 },
  193: {
    name: 'Anabel', class: 'Pokémon Trainer', versions: ['sun', 'moon'], weight: 1,
    requires: 'lookerGuzzlordChapter',
    requiresNote: 'Only after the player has reached Guzzlord\'s chapter of the Looker episode; otherwise an ordinary Trainer battles instead (Bulbapedia).',
  },
  194: { name: 'Wally', class: 'Pokémon Trainer', versions: ['sun', 'moon'], weight: 7 },
  195: { name: 'Colress', class: 'Pokémon Trainer', versions: ['sun', 'moon'], weight: 7 },
  196: { name: 'Cynthia', class: 'Pokémon Trainer', versions: ['sun', 'moon'], weight: 7 },
  197: { name: 'Plumeria', class: 'Pokémon Trainer', versions: ['sun'], weight: 7 },
  198: { name: 'Guzma', class: 'Pokémon Trainer', versions: ['moon'], weight: 7 },
  199: { name: 'Kiawe', class: 'Captain', versions: ['sun'], weight: 7 },
  200: { name: 'Mallow', class: 'Captain', versions: ['moon'], weight: 7 },
  201: { name: 'Sina', class: 'Pokémon Trainer', versions: ['sun'], weight: 7 },
  202: { name: 'Dexio', class: 'Pokémon Trainer', versions: ['moon'], weight: 7 },
};
const LEGENDS = {
  190: { key: 'red-super', name: 'Red', format: 'singles', course: 'super' },
  191: { key: 'blue-super', name: 'Blue', format: 'doubles', course: 'super' },
  203: { key: 'red-normal', name: 'Red', format: 'singles', course: 'normal' },
  204: { key: 'blue-normal', name: 'Blue', format: 'doubles', course: 'normal' },
};

const trainers = trainerLines.map((line, id) => {
  const sep = line.indexOf(' - ');
  const name = line.slice(0, sep);
  const roster = line.slice(sep + 3).split(', ').map(label => {
    const sid = setIdByLabel.get(label.trim());
    if (sid === undefined) fail(`trainer ${name}: unknown set "${label}"`);
    return sid;
  });
  if (new Set(roster).size !== roster.length) fail(`trainer ${name}: duplicate set in roster`);

  if (id < 190) {
    const b = brackets.trainers[id];
    if (b.number !== id + 1 || b.name !== name) fail(`Bulbapedia row ${id} (${b.name}) != TRE trainer ${name}`);
    const g = /\s*([♂♀])$/.exec(b.class);
    return {
      id, number: b.number, name,
      class: g ? b.class.slice(0, g.index) : b.class,
      classGender: g ? (g[1] === '♂' ? 'M' : 'F') : null,
      kind: 'regular',
      iv: regularIv(b.number),
      bulbapediaBrackets: b.brackets,
      roster,
      source: { roster: 'tre-sm', identity: 'bulbapedia-trainers', iv: 'atsync-iv-post' },
    };
  }
  if (SPECIALS[id]) {
    const s = SPECIALS[id];
    if (s.name !== name) fail(`special trainer id ${id} expected ${s.name}, got ${name}`);
    const { name: _n, ...rest } = s;
    return {
      id, number: null, name, ...rest, classGender: null, kind: 'special', iv: 31, roster,
      source: {
        roster: 'tre-sm', identity: 'bulbapedia-battle-tree', class: 'sadisticmystic-sheet + tree-sets-app',
        weight: 'bulbapedia-trainers', iv: 'atsync-iv-post',
      },
    };
  }
  if (LEGENDS[id]) {
    const l = LEGENDS[id];
    if (l.name !== name) fail(`legend id ${id} expected ${l.name}, got ${name}`);
    return {
      id, number: null, name, class: 'Battle Legend', classGender: 'M', kind: 'legend',
      bossKey: l.key, format: l.format, course: l.course, iv: 31, roster,
      source: { roster: 'tre-sm', identity: 'bulbapedia-battle-tree', iv: 'atsync-iv-post' },
    };
  }
  return fail(`unclassified trainer id ${id} (${name})`);
});

// ---------------------------------------------------------------------------
// Brackets / schedule
// ---------------------------------------------------------------------------
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const POOLS = {
  'b01-10': { label: '1-10', trainerIds: range(0, 49) },
  'b11-19': { label: '11-19', trainerIds: range(30, 69) },
  'b21-29': { label: '21-29', trainerIds: range(50, 89) },
  'b31-39': { label: '31-39', trainerIds: range(70, 109) },
  'b41-49': { label: '41-49', trainerIds: range(90, 129) },
  'b51+': { label: '51+', trainerIds: range(90, 189) },
};
// Cross-check pool membership against Bulbapedia's ✔ marks.
for (const [key, pool] of Object.entries(POOLS)) {
  const fromBulba = brackets.trainers.filter(t => t.brackets.includes(pool.label)).map(t => t.number - 1);
  if (JSON.stringify(fromBulba) !== JSON.stringify(pool.trainerIds)) fail(`pool ${key} disagrees with Bulbapedia`);
}

const bracketsJson = {
  source: {
    pools: 'bulbapedia-trainers',
    poolsCrossCheck: 'sadisticmystic-sheet (min/max battle per trainer: identical index ranges)',
    schedule: 'bulbapedia-battle-tree',
    specialEveryTen: 'bulbapedia-battle-tree + bulbapedia-trainers ("Special Trainers appear only in ... Super Course challenges, during every ten battles")',
    normalUsesSameTrainers: 'bulbapedia-trainers (single table, no Normal/Super split) + atsync-iv-post (tested guess)',
    doubles: 'bulbapedia-battle-tree ("Blue is the Battle Legend for Double Battles and uses four Pokémon"; "In Super Battles, special Trainers appear every ten battles"; one BP table by win streak for every format) + bulbapedia-trainers (regular trainers: one table for every format)',
    multi: 'serebii-battle-tree (Double Battles against two Trainers, you pick two Pokémon) + smogon-guide (every trainer runs 2 Pokémon; the Battle Legends come "both at same time for Multis"; clauses apply per trainer). Only Super Multi exists in this app (app choice). APPROXIMATIONS: Red and Blue together at battle 50 (the guide only spells out battle 20 of Normal); special trainers come in pairs every ten battles (no source says how they are paired).',
  },
  trainerWeighting: {
    rule: 'uniform',
    source: 'bulbapedia-trainers ("Within each range, Trainers are selected randomly with equal weighting.")',
  },
  pools: Object.fromEntries(Object.entries(POOLS).map(([k, p]) => [k, {
    ...p,
    bulbapediaNumbers: `${String(p.trainerIds[0] + 1).padStart(3, '0')}-${String(p.trainerIds.at(-1) + 1).padStart(3, '0')}`,
  }])),
  singles: {
    normal: {
      length: 20,
      endsAfterLength: true,
      // Evaluated top-down; first match wins.
      schedule: [
        { battles: [20, 20], boss: 'red-normal' },
        { battles: [1, 10], pool: 'b01-10' },
        { battles: [11, 19], pool: 'b11-19' },
      ],
      specialTrainers: false,
    },
    super: {
      length: null,
      endsAfterLength: false,
      schedule: [
        { battles: [50, 50], boss: 'red-super' },
        { everyNth: 10, special: true },
        { battles: [1, 9], pool: 'b01-10' },
        { battles: [11, 19], pool: 'b11-19' },
        { battles: [21, 29], pool: 'b21-29' },
        { battles: [31, 39], pool: 'b31-39' },
        { battles: [41, 49], pool: 'b41-49' },
        { battles: [51, null], pool: 'b51+' },
      ],
      specialTrainers: true,
    },
  },
  // Doubles: the same trainer pools and special-trainer rule; Blue is the Battle Legend.
  doubles: {
    normal: {
      length: 20,
      endsAfterLength: true,
      schedule: [
        { battles: [20, 20], boss: 'blue-normal' },
        { battles: [1, 10], pool: 'b01-10' },
        { battles: [11, 19], pool: 'b11-19' },
      ],
      specialTrainers: false,
    },
    super: {
      length: null,
      endsAfterLength: false,
      schedule: [
        { battles: [50, 50], boss: 'blue-super' },
        { everyNth: 10, special: true },
        { battles: [1, 9], pool: 'b01-10' },
        { battles: [11, 19], pool: 'b11-19' },
        { battles: [21, 29], pool: 'b21-29' },
        { battles: [31, 39], pool: 'b31-39' },
        { battles: [41, 49], pool: 'b41-49' },
        { battles: [51, null], pool: 'b51+' },
      ],
      specialTrainers: true,
    },
  },
  // Multi: Super only in this app; same pools, special trainers in pairs, Red and Blue together at 50.
  multi: {
    super: {
      length: null,
      endsAfterLength: false,
      schedule: [
        { battles: [50, 50], boss: 'redblue-super' },
        { everyNth: 10, special: true },
        { battles: [1, 9], pool: 'b01-10' },
        { battles: [11, 19], pool: 'b11-19' },
        { battles: [21, 29], pool: 'b21-29' },
        { battles: [31, 39], pool: 'b31-39' },
        { battles: [41, 49], pool: 'b41-49' },
        { battles: [51, null], pool: 'b51+' },
      ],
      specialTrainers: true,
    },
  },
  specialTrainerPool: {
    weightsSource: 'bulbapedia-trainers ("All of these Trainers are equally likely to appear except Anabel, who appears only one-seventh as frequently") + sadisticmystic-sheet ("7x rarer")',
    versionsSource: 'bulbapedia-battle-tree (Special Trainers table, S/M columns)',
    trainerIds: Object.keys(SPECIALS).map(Number),
    anabelFallback: {
      rule: 'replace-with-regular-from-previous-bracket',
      approximation: true,
      note: 'Bulbapedia says a "random ordinary Trainer" replaces Anabel if she is locked, but does not say which bracket. The app uses the bracket of battle N-1 (e.g. battle 20 -> 11-19 pool).',
    },
  },
};

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------
const bossesJson = {
  source: {
    schedule: 'bulbapedia-battle-tree ("On the 20th battle of normal challenges and the 50th battle of Super challenges, a Battle Legend will be challenged")',
    teams: 'tre-sm (cross-checked: all 20 Red sets and all 34 Sun/Moon Blue sets identical to Bulbapedia Battle Tree page)',
    teamGeneration: 'smogon-guide (same random-from-roster rule as other trainers)',
    weight: 'App choice (2026-10-08): Battle Legends have a weight, so other trainers can share the battle-50 slot (custom ones in src/data/custom/battle-50.json). With only the game\'s, Red / Blue always appear.',
  },
  bosses: {
    'red-normal': { trainerId: 203, format: 'singles', course: 'normal', battle: 20, bp: 20, unlocks: 'singles-super', teamSize: 3, iv: 31 },
    'red-super': { trainerId: 190, format: 'singles', course: 'super', battle: 50, bp: 50, teamSize: 3, iv: 31, weight: 7 },
    'blue-normal': { trainerId: 204, format: 'doubles', course: 'normal', battle: 20, bp: 20, unlocks: 'doubles-super', teamSize: 4, iv: 31 },
    'blue-super': { trainerId: 191, format: 'doubles', course: 'super', battle: 50, bp: 50, teamSize: 4, iv: 31, weight: 7 },
    // Multi: Red and Blue together (smogon-guide), each with 2 Pokémon from their Super rosters. Battle 50: APPROXIMATION.
    'redblue-super': { trainerId: 190, partnerTrainerId: 191, format: 'multi', course: 'super', battle: 50, bp: 50, teamSize: 2, iv: 31, weight: 7 },
  },
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
const BANNED = ['Mewtwo', 'Mew', 'Lugia', 'Ho-Oh', 'Celebi', 'Kyogre', 'Groudon', 'Rayquaza', 'Jirachi', 'Deoxys',
  'Dialga', 'Palkia', 'Giratina', 'Phione', 'Manaphy', 'Darkrai', 'Shaymin', 'Arceus', 'Victini', 'Reshiram',
  'Zekrom', 'Kyurem', 'Keldeo', 'Meloetta', 'Genesect', 'Xerneas', 'Yveltal', 'Zygarde', 'Diancie', 'Hoopa',
  'Volcanion', 'Cosmog', 'Cosmoem', 'Solgaleo', 'Lunala', 'Necrozma', 'Magearna', 'Marshadow', 'Zeraora'];
for (const b of BANNED) checkName('species', gen7.species, b, 'banlist');

const rulesJson = {
  source: {
    restrictions: 'bulbapedia-battle-tree (Restrictions > Pokémon Sun and Moon; Special Pokémon list)',
    bp: 'bulbapedia-battle-tree (Battle Points table); consistent with smogon-guide',
    itemClauseScope: 'smogon-guide ("the Item Clause applies to the entire team box submitted")',
    levels: 'smogon-guide ("temporarily downleveled to 50 ... not leveled up to 50")',
    opponentGeneration: 'bulbapedia-battle-tree + smogon-guide',
  },
  game: 'sun-moon',
  level: { max: 50, scaleDownAbove: true, scaleUpBelow: false },
  clauses: {
    species: { scope: 'registered-team', source: 'bulbapedia-battle-tree' },
    item: { scope: 'registered-team', source: 'bulbapedia-battle-tree + smogon-guide' },
  },
  teamSize: {
    singles: { registeredMax: 6, registeredMin: 3, bring: 3 },
    doubles: { registeredMax: 6, registeredMin: 4, bring: 4 },
    multi: { registeredMax: 6, registeredMin: 2, bring: 2 },
  },
  multiPartners: {
    scoutCost: 10,
    scoutable: 'special Trainers you have beaten (not Battle Legends)',
    partnerTeam: 'the first two Pokémon the Trainer used in the battle where you beat them',
    source: 'serebii-battle-tree ("scout" a Trainer for 10 BP) + smogon-guide (scouting costs 10 BP; the partner uses "the first 2 Pokemon it had in that specific battle")',
    defaultPartners: ['Sina', 'Dexio'],
    defaultPartnersNote: 'App choice: the game starts you with Pokémon Breeder Rada.',
  },
  bannedSpecies: { includeAllForms: true, species: BANNED },
  battlePoints: {
    normal: [
      { battles: [1, 10], bp: 1 },
      { battles: [11, 19], bp: 2 },
      { battles: [20, 20], bp: 20, note: 'Battle Legend' },
    ],
    super: [
      { battles: [1, 10], bp: 2 },
      { battles: [11, 20], bp: 3 },
      { battles: [21, 30], bp: 4 },
      { battles: [31, 40], bp: 5 },
      { battles: [41, 49], bp: 6 },
      { battles: [50, 50], bp: 50, note: 'Battle Legend' },
      { battles: [51, null], bp: 7 },
    ],
  },
  betweenBattles: {
    fullHeal: true,
    restoreItems: true,
    resetPp: true,
    clearStatus: true,
    note: 'Each battle is a fresh battle (facility replicates link-battle rules; consumed items are not lost). Source: smogon-guide.',
  },
  opponentGeneration: {
    level: 50,
    ivs: 'per-trainer, equal in all six stats (see trainers.json `iv`)',
    teamPick: {
      rule: 'Pick roster sets uniformly at random one at a time, rejecting picks that would duplicate a species or a held item, until the team is full.',
      source: 'smogon-guide ("picks the required amount of Pokemon from its team one by one making sure that the Clauses are respected")',
      approximation: 'Rule described by the community guide, not taken from disassembled code. Uniform weighting is assumed.',
    },
    ability: {
      rule: 'Uniform over the three ability slots [ability1, ability2, hidden]; an empty slot repeats ability1 (so 1 normal + HA = 2/3 normal, 1/3 HA).',
      source: 'smogon-guide',
      approximation: 'Community-documented, not datamined.',
    },
    gender: { rule: 'random', source: 'bulbapedia-battle-tree', approximation: 'Ratio not documented; app uses the species gender ratio.' },
  },
  streakPrizes: {
    source: 'bulbapedia-battle-tree (Items table; awarded by the receptionist after a streak ends)',
    displayOnly: true,
    prizes: [
      { wins: 5, item: 'Moomoo Milk' }, { wins: 10, item: 'PP Up' }, { wins: 20, item: 'Rare Candy' },
      { wins: 30, item: 'Bottle Cap' }, { wins: 40, item: 'PP Max' }, { wins: 50, item: 'Ability Capsule' },
      { wins: 100, item: 'Lansat Berry' }, { wins: 200, item: 'Starf Berry' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
// Pretty-print, but keep arrays of primitives (rosters, moves, ranges) on one line.
const stringify = data => JSON.stringify(data, null, 2)
  .replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => `[${inner.split(/,\s+/).join(', ')}]`);
const write = (file, data) => writeFileSync(join(OUT, file), `${stringify(data)}\n`);

write('sources.json', SOURCES);
write('sets.json', {
  source: {
    primary: 'tre-sm',
    crossChecked: [
      'bulbapedia-pokemon: all 996 SM rows identical (item, moves, nature, EVs) in the same order',
      'informant-sm: identical',
      'kaphotics-usum-diff: confirms SM count of 996 and lists the USUM-only changes (not applied here)',
    ],
    evRule: '2 invested stats = 252 each, 3 = 170 each, 4 = 127 each (verified against Bulbapedia numbers)',
  },
  count: sets.length,
  sets,
});
write('trainers.json', {
  source: {
    rosters: 'tre-sm (cross-checked vs sadisticmystic-sheet USUM rosters + its SM deltas: 1 omission in that sheet, Kendra/Heat Rotom-1, resolved in favour of tre-sm by tree-sets-app pool data)',
    identities: 'bulbapedia-trainers (number, class, name, order: 190/190 match)',
    ivs: 'atsync-iv-post (APPROXIMATION: tested, not datamined; matches sadisticmystic-sheet IV tiers)',
  },
  count: trainers.length,
  trainers,
});
write('brackets.json', bracketsJson);
write('bosses.json', bossesJson);
write('rules.json', rulesJson);

console.log(`wrote ${sets.length} sets, ${trainers.length} trainers to ${OUT}`);
