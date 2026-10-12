#!/usr/bin/env node
// Builds the custom trainers (designed by the user, see DATA_NOTES.md "Custom
// additions") from their Showdown exports in data-sources/custom/:
//  - gym-leaders.txt -> src/data/custom/gym-leaders.json (special trainers);
//  - elite-four.txt -> src/data/custom/elite-four.json (the Elite Four and Champions of
//    Generations 1-7 as special trainers, weight 3.5);
//  - evil-teams.txt -> src/data/custom/evil-teams.json (the evil teams' leaders and admins of
//    Generations 1-7 as special trainers, weight 3.5);
//  - battle-50-trainers.txt + battle-50-trainers.json -> src/data/custom/battle-50.json
//    (trainers who can take the Battle Legends' battle-50 slot).
//  - digidestined.txt + digidestined.json -> src/data/custom/digidestined.json (the DigiDestined and
//    other Digimon Tamers as special trainers: own sprite, a Pokémon that always leads, fixed Multi
//    Battle partners).
//  - "Brock 1" and "Brock 2" are one trainer (Brock) with all eight Pokémon.
//  - Abilities, items, natures, EVs, moves and genders come from the export;
//    IVs don't: like every Battle Tree trainer they use the trainer's IV
//    (31 for special trainers), so "IVs: 0 Spe" lines are ignored.
// Usage: npm run data:custom
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex, Teams } from '@pkmn/sim';

const dir = new URL('../data-sources/custom/', import.meta.url);
const outDir = new URL('../src/data/custom/', import.meta.url);

/**
 * The app's custom species and moves (the Digimon and their signature moves) aren't in @pkmn/sim's
 * own data: their names are read from src/data/custom/digimon.ts. Their sets are checked by the
 * app's tests, with the app's data.
 */
const toId = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const CUSTOM_NAMES = new Map([...readFileSync(new URL('../src/data/custom/digimon.ts', import.meta.url), 'utf8').matchAll(/name: '([^']+)'/g)].map(m => [toId(m[1]), m[1]]));
const customName = s => CUSTOM_NAMES.get(toId(s));

const FEMALE = new Set([
  'Misty', 'Erika', 'Janine', 'Sabrina', 'Whitney', 'Jasmine', 'Clair', 'Roxanne', 'Flannery', 'Winona', 'Liza',
  'Gardenia', 'Fantina', 'Maylene', 'Candice', 'Roxie', 'Elesa', 'Skyla', 'Lenora', 'Bianca',
]);
const REGION = {
  Kanto: ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Janine', 'Sabrina', 'Blaine', 'Giovanni'],
  Johto: ['Falkner', 'Bugsy', 'Whitney', 'Morty', 'Chuck', 'Jasmine', 'Pryce', 'Clair'],
  Hoenn: ['Roxanne', 'Brawly', 'Wattson', 'Flannery', 'Norman', 'Winona', 'Tate', 'Liza', 'Juan'],
  Sinnoh: ['Roark', 'Gardenia', 'Fantina', 'Maylene', 'Crasher Wake', 'Byron', 'Candice', 'Volkner'],
  Unova: ['Cheren', 'Roxie', 'Burgh', 'Elesa', 'Clay', 'Skyla', 'Drayden', 'Marlon', 'Chili', 'Cress', 'Cilan', 'Lenora', 'Brycen', 'Bianca'],
};
const regionOf = name => Object.keys(REGION).find(r => REGION[r].includes(name));
/** Bianca was never a Gym Leader: she battles as a Pokémon Trainer, as in Black 2 and White 2. */
const CLASS = { Bianca: 'Pokémon Trainer' };
/** Gym Leaders' weight in the special-trainer pool is 7, like the game's special trainers; Giovanni 1 (on request, 2026-10-11). */
const GYM_WEIGHT = { Giovanni: 1 };

/**
 * Tate and Liza battle together in Multi Battles, leading with one of these
 * pairs (Tate's Pokémon first). Designed by the user.
 */
const PAIRS = [{ trainers: ['Tate', 'Liza'], multiLeads: [['Solrock', 'Lunatone'], ['Gallade', 'Gardevoir']] }];

/**
 * The Elite Four and Champions (Generations 1-7; Cynthia and Grimsley are already the game's
 * special trainers, and Blue stays a Battle Legend). Region: the League they sit in (the Indigo
 * Plateau's Gen 1 members as Kanto, its Gen 2 members as Johto). Kukui battles as a Pokémon Professor,
 * as at the Alola League.
 */
const ELITE_FOUR = {
  Kanto: ['Lorelei', 'Bruno', 'Agatha', 'Lance'],
  Johto: ['Will', 'Koga', 'Karen'],
  Hoenn: ['Sidney', 'Phoebe', 'Glacia', 'Drake', 'Steven', 'Wallace'],
  Sinnoh: ['Aaron', 'Bertha', 'Flint', 'Lucian'],
  Unova: ['Shauntal', 'Caitlin', 'Marshal', 'Alder', 'Iris'],
  Kalos: ['Malva', 'Siebold', 'Wikstrom', 'Drasna', 'Diantha'],
  Alola: ['Hala', 'Olivia', 'Acerola', 'Kahili', 'Molayne', 'Kukui'],
};
const CHAMPIONS = new Set(['Lance', 'Steven', 'Wallace', 'Alder', 'Iris', 'Diantha']);
const ELITE_CLASS = name => (name === 'Kukui' ? 'Pokémon Professor' : CHAMPIONS.has(name) ? 'Champion' : 'Elite Four');
const ELITE_FEMALE = new Set([
  'Lorelei', 'Agatha', 'Karen', 'Phoebe', 'Glacia', 'Bertha', 'Shauntal', 'Caitlin', 'Iris', 'Malva', 'Drasna', 'Diantha', 'Olivia',
  'Acerola', 'Kahili',
]);
const eliteRegion = name => Object.keys(ELITE_FOUR).find(r => ELITE_FOUR[r].includes(name));

/**
 * The evil teams' leaders and admins (Generations 1-7), by export section title. Archie and Maxie
 * come twice, as in Ruby / Sapphire / Emerald and in Omega Ruby / Alpha Sapphire (the games'
 * classes tell them apart: "Aqua Leader" / "Team Aqua Leader"); the section title is their key
 * (lines, pictures, partners), `person` keeps the two versions apart in Multi Battles. Team Aqua's
 * Matt has a key too (Tai's partner Matt is a Battle Legend). Giovanni (a Gym Leader here), Guzma,
 * Plumeria and Colress are already special trainers.
 * Weight 1 each in the special-trainer pool (on request, 2026-10-11; they were 3.5), except Courtney: 7.
 */
const EVIL_WEIGHT = 1;
const EVIL_TEAMS = {
  'Archer': { class: 'Rocket Executive', region: 'Johto' },
  'Ariana': { class: 'Rocket Executive', region: 'Johto', female: true },
  'Proton': { class: 'Rocket Executive', region: 'Johto' },
  'Petrel': { class: 'Rocket Executive', region: 'Johto' },
  'Maxie (RSE)': { name: 'Maxie', person: 'Maxie', class: 'Magma Leader', region: 'Hoenn' },
  'Maxie (ORAS)': { name: 'Maxie', person: 'Maxie', class: 'Team Magma Leader', region: 'Hoenn' },
  'Tabitha': { class: 'Team Magma Admin', region: 'Hoenn' },
  'Courtney': { class: 'Team Magma Admin', region: 'Hoenn', female: true, weight: 7 },
  'Archie (RSE)': { name: 'Archie', person: 'Archie', class: 'Aqua Leader', region: 'Hoenn' },
  'Archie (ORAS)': { name: 'Archie', person: 'Archie', class: 'Team Aqua Leader', region: 'Hoenn' },
  'Matt (Team Aqua)': { name: 'Matt', class: 'Team Aqua Admin', region: 'Hoenn' },
  'Shelly': { class: 'Team Aqua Admin', region: 'Hoenn', female: true },
  'Cyrus': { class: 'Galactic Boss', region: 'Sinnoh' },
  'Mars': { class: 'Commander', region: 'Sinnoh', female: true },
  'Jupiter': { class: 'Commander', region: 'Sinnoh', female: true },
  'Saturn': { class: 'Commander', region: 'Sinnoh' },
  'Charon': { class: 'Commander', region: 'Sinnoh' },
  'N': { class: 'Pokémon Trainer', region: 'Unova' },
  'Ghetsis': { class: 'Team Plasma', region: 'Unova' },
  'Zinzolin': { class: 'Team Plasma', region: 'Unova' },
  'Lysandre': { class: 'Team Flare Boss', region: 'Kalos' },
  'Xerosic': { class: 'Team Flare Admin', region: 'Kalos' },
  'Bryony': { class: 'Team Flare Admin', region: 'Kalos', female: true },
  'Mable': { class: 'Team Flare Admin', region: 'Kalos', female: true },
  'Lusamine': { class: 'Aether President', region: 'Alola', female: true },
  'Faba': { class: 'Aether Branch Chief', region: 'Alola' },
};

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const problems = [];

/**
 * Showdown exports ("=== [format] Brock 1 ===" headers) as trainers: sections that differ
 * only by a trailing number are one trainer. IVs are left out (the trainer's IV applies);
 * a "Hidden Power [Fire]" keeps its type through the move's name.
 */
function parseExports(file, describe) {
  const text = readFileSync(new URL(file, dir), 'utf8');
  const blocks = [...text.matchAll(/^=== \[[^\]]+\] (.+?) ===\s*$([\s\S]*?)(?=^=== |(?![\s\S]))/gm)];
  const trainers = new Map();
  for (const [, title, body] of blocks) {
    const name = title.replace(/ \d+$/, '').trim();
    const sets = Teams.import(body.trim());
    if (!sets?.length) { problems.push(`${file} ${title}: no Pokémon`); continue; }
    const trainer = trainers.get(name) ?? { name, ...describe(name), sets: [] };
    for (const s of sets) {
      const species = Dex.species.get(s.species);
      const custom = customName(s.species);
      if (!species.exists && !custom) problems.push(`${file} ${title}: unknown species ${s.species}`);
      for (const m of s.moves) if (!Dex.moves.get(m).exists && !customName(m)) problems.push(`${file} ${title}: unknown move ${m}`);
      trainer.sets.push({
        species: custom ?? species.name,
        item: s.item,
        ability: s.ability,
        nature: s.nature || 'Serious',
        evs: Object.fromEntries(STATS.map(st => [st, s.evs?.[st] ?? 0])),
        moves: s.moves.map(m => customName(m) ?? (Dex.moves.get(m).name || m)),
        ...(s.gender ? { gender: s.gender } : {}),
      });
    }
    trainers.set(name, trainer);
  }
  return [...trainers.values()];
}

function save(file, data) {
  writeFileSync(new URL(file, outDir), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`${data.trainers.length} trainers, ${data.trainers.reduce((a, t) => a + t.sets.length, 0)} sets -> src/data/custom/${file}`);
}

// --- Gym Leaders ---
const gymLeaders = parseExports('gym-leaders.txt', name => ({
  class: CLASS[name] ?? 'Gym Leader',
  classGender: FEMALE.has(name) ? 'F' : 'M',
  region: regionOf(name),
  ...(GYM_WEIGHT[name] ? { weight: GYM_WEIGHT[name] } : {}),
}));
for (const t of gymLeaders) if (!t.region) problems.push(`${t.name}: no region`);

// --- Elite Four and Champions ---
const eliteFour = parseExports('elite-four.txt', name => ({
  class: ELITE_CLASS(name),
  classGender: ELITE_FEMALE.has(name) ? 'F' : 'M',
  region: eliteRegion(name),
}));
for (const t of eliteFour) if (!t.region) problems.push(`${t.name}: not in ELITE_FOUR`);
for (const t of eliteFour) if (gymLeaders.some(g => g.name === t.name)) problems.push(`${t.name}: already a Gym Leader`);

// --- Evil team leaders and admins ---
const evilTeams = parseExports('evil-teams.txt', title => {
  const info = EVIL_TEAMS[title];
  if (!info) { problems.push(`evil-teams.txt: ${title} isn't in EVIL_TEAMS`); return {}; }
  const name = info.name ?? title;
  return {
    name, ...(name !== title ? { key: title } : {}), ...(info.person ? { person: info.person } : {}),
    class: info.class, classGender: info.female ? 'F' : 'M', region: info.region, weight: info.weight ?? EVIL_WEIGHT,
  };
});
const takenNames = new Set([...gymLeaders, ...eliteFour].map(t => t.name));
for (const t of evilTeams) if (takenNames.has(t.key ?? t.name)) problems.push(`${t.key ?? t.name}: already a special trainer`);

// --- Battle-50 trainers ---
const battle50 = JSON.parse(readFileSync(new URL('battle-50-trainers.json', dir), 'utf8'));
const battle50Trainers = parseExports('battle-50-trainers.txt', name => {
  const info = battle50.trainers[name];
  if (!info) { problems.push(`battle-50-trainers.json: no entry for ${name}`); return {}; }
  return { class: info.class, classGender: info.gender, sprite: info.sprite, ...(info.lead ? { lead: info.lead } : {}) };
});
for (const t of battle50Trainers) {
  if (t.lead && !t.sets.some(s => s.species === t.lead)) problems.push(`battle-50-trainers.json: ${t.name}'s lead ${t.lead} isn't on their team`);
}
/** The game's Battle Legends (their Super teams), which battle-50 entries can also name. */
const GAME_LEGENDS = new Set(JSON.parse(readFileSync(new URL('../src/data/battle-tree/trainers.json', import.meta.url), 'utf8')).trainers
  .filter(t => t.kind === 'legend' && t.course === 'super').map(t => t.name));
for (const b of battle50.battles) {
  for (const n of b.trainers) {
    if (!battle50Trainers.some(t => t.name === n) && !GAME_LEGENDS.has(n)) problems.push(`battle-50-trainers.json: ${n} has no team in battle-50-trainers.txt (and isn't one of the game's Battle Legends)`);
  }
  if (b.trainers.length !== (b.format === 'multi' ? 2 : 1)) problems.push(`battle-50-trainers.json: a ${b.format} battle needs ${b.format === 'multi' ? 'two trainers' : 'one trainer'}`);
}

// --- The DigiDestined (special trainers) ---
const digidestined = JSON.parse(readFileSync(new URL('digidestined.json', dir), 'utf8'));
const digidestinedTrainers = parseExports('digidestined.txt', name => {
  const info = digidestined.trainers[name];
  if (!info) { problems.push(`digidestined.json: no entry for ${name}`); return {}; }
  return {
    class: info.class, classGender: info.gender, region: 'Digital World', sprite: info.sprite, weight: info.weight,
    ...(info.lead ? { lead: info.lead } : {}), ...(info.partners?.length ? { partners: info.partners } : {}),
  };
});
for (const t of digidestinedTrainers) {
  if (t.lead && !t.sets.some(s => s.species === t.lead)) problems.push(`digidestined.json: ${t.name}'s lead ${t.lead} isn't on their team`);
  if (!(t.weight > 0)) problems.push(`digidestined.json: ${t.name} needs a weight`);
  for (const p of t.partners ?? []) {
    if (!battle50Trainers.some(b => b.name === p) && !digidestinedTrainers.some(d => d.name === p)) problems.push(`digidestined.json: ${t.name}'s partner ${p} has no team`);
  }
  if ([...gymLeaders, ...eliteFour].some(o => o.name === t.name) || evilTeams.some(o => (o.key ?? o.name) === t.name)) problems.push(`${t.name}: already a special trainer`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

save('gym-leaders.json', {
  source: 'Designed by the user (2026-10-08), as Showdown exports in data-sources/custom/gym-leaders.txt; built by scripts/build-custom-trainers.mjs. Not from any game.',
  notes: [
    'Each trainer is one special trainer; "Brock 1" and "Brock 2" (Misty, Lt. Surge, Erika, Blaine likewise) are merged into one eight-Pokémon roster.',
    'IVs are the special-trainer IV (31) like every Battle Tree special trainer, per the user; IV lines in the exports are ignored.',
    'Abilities and genders are as exported (Battle Tree sets roll them instead).',
  ],
  trainers: gymLeaders,
  pairs: PAIRS,
});
save('elite-four.json', {
  source: 'Designed for the user (2026-10-10, on request): the Elite Four and Champions of Generations 1-7 as Showdown exports in data-sources/custom/elite-four.txt; built by scripts/build-custom-trainers.mjs. Not from any game.',
  notes: [
    'Each trainer is one special trainer with eight Pokémon, weight 3.5 (half a Gym Leader\'s), in Super Singles, Super Doubles and Super Multi (and All Star Mode).',
    'Cynthia and Grimsley are the game\'s own special trainers; Blue stays a Battle Legend. Kukui battles as a Pokémon Professor, as at the Alola League.',
    'IVs are the special-trainer IV (31); Abilities and genders are as exported. Every set passes the app\'s Gen 7 team validator.',
  ],
  trainers: eliteFour,
});
save('evil-teams.json', {
  source: 'Designed for the user (2026-10-11, on request): the evil teams\' leaders and admins of Generations 1-7 as Showdown exports in data-sources/custom/evil-teams.txt; built by scripts/build-custom-trainers.mjs. Not from any game.',
  notes: [
    'Each trainer is one special trainer with eight Pokémon, weight 1 (Courtney 7; changed on request 2026-10-11, they were 3.5), in Super Singles, Super Doubles and Super Multi (and All Star Mode).',
    'Archie and Maxie appear twice (Ruby / Sapphire / Emerald: no Megas; Omega Ruby / Alpha Sapphire: with their Megas); "key" tells them apart in the data, "person" keeps the two versions out of the same battle.',
    'Giovanni (a Gym Leader here), Guzma, Plumeria and Colress were already special trainers. IVs 31; Abilities and genders as exported. Every set passes the app\'s Gen 7 team validator.',
  ],
  trainers: evilTeams,
});
save('digidestined.json', {
  source: 'Designed by the user (2026-10-11): data-sources/custom/digidestined.txt (teams, built for the user) and digidestined.json (who, sprite, lead, weight, partners); built by scripts/build-custom-trainers.mjs. Not from any game.',
  notes: [
    'Special trainers in Super Singles, Super Doubles and Super Multi (and All Star Mode), at their own weight (Izzy and Kaito: 7).',
    '"lead": the species that always leads their team. "partners": in a Multi Battle they always battle alongside one of these (equal chance), who goes first (on the left).',
    'IV 31 like every special trainer; IV lines are ignored. Sprites are the user\'s own pixel art in public/trainers/.',
  ],
  trainers: digidestinedTrainers,
});
save('battle-50.json', {
  source: 'Designed by the user (2026-10-08): data-sources/custom/battle-50-trainers.txt (teams) and battle-50-trainers.json (who, where, weight); built by scripts/build-custom-trainers.mjs. Not from any game.',
  notes: [
    'They share the Battle Legends\' battle-50 slot by weight (Red / Blue are weight 7 in bosses.json); a Multi entry lists the first (left) trainer first.',
    'IV 31 like the Battle Legends; IV lines in the exports are ignored. Sprites are the user\'s own pixel art in public/trainers/.',
    'A trainer can appear in several entries (Tai and Matt: Super Singles, Super Doubles and, together, Super Multi). "lead": the species that always leads their team.',
  ],
  trainers: battle50Trainers,
  battles: battle50.battles,
});
