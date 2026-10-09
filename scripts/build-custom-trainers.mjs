#!/usr/bin/env node
// Builds the custom trainers (designed by the user, see DATA_NOTES.md "Custom
// additions") from their Showdown exports in data-sources/custom/:
//  - gym-leaders.txt -> src/data/custom/gym-leaders.json (special trainers);
//  - battle-50-trainers.txt + battle-50-trainers.json -> src/data/custom/battle-50.json
//    (trainers who can take the Battle Legends' battle-50 slot).
//  - "Brock 1" and "Brock 2" are one trainer (Brock) with all eight Pokémon.
//  - Abilities, items, natures, EVs, moves and genders come from the export;
//    IVs don't: like every Battle Tree trainer they use the trainer's IV
//    (31 for special trainers), so "IVs: 0 Spe" lines are ignored.
// Usage: npm run data:custom
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex, Teams } from '@pkmn/sim';

const dir = new URL('../data-sources/custom/', import.meta.url);
const outDir = new URL('../src/data/custom/', import.meta.url);

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

/**
 * Tate and Liza battle together in Multi Battles, leading with one of these
 * pairs (Tate's Pokémon first). Designed by the user.
 */
const PAIRS = [{ trainers: ['Tate', 'Liza'], multiLeads: [['Solrock', 'Lunatone'], ['Gallade', 'Gardevoir']] }];

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
      if (!species.exists) problems.push(`${file} ${title}: unknown species ${s.species}`);
      for (const m of s.moves) if (!Dex.moves.get(m).exists) problems.push(`${file} ${title}: unknown move ${m}`);
      trainer.sets.push({
        species: species.name,
        item: s.item,
        ability: s.ability,
        nature: s.nature || 'Serious',
        evs: Object.fromEntries(STATS.map(st => [st, s.evs?.[st] ?? 0])),
        moves: s.moves.map(m => Dex.moves.get(m).name || m),
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
}));
for (const t of gymLeaders) if (!t.region) problems.push(`${t.name}: no region`);

// --- Battle-50 trainers ---
const battle50 = JSON.parse(readFileSync(new URL('battle-50-trainers.json', dir), 'utf8'));
const battle50Trainers = parseExports('battle-50-trainers.txt', name => {
  const info = battle50.trainers[name];
  if (!info) { problems.push(`battle-50-trainers.json: no entry for ${name}`); return {}; }
  return { class: info.class, classGender: info.gender, sprite: info.sprite };
});
for (const b of battle50.battles) {
  for (const n of b.trainers) if (!battle50Trainers.some(t => t.name === n)) problems.push(`battle-50-trainers.json: ${n} has no team in battle-50-trainers.txt`);
  if (b.trainers.length !== (b.format === 'multi' ? 2 : 1)) problems.push(`battle-50-trainers.json: a ${b.format} battle needs ${b.format === 'multi' ? 'two trainers' : 'one trainer'}`);
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
save('battle-50.json', {
  source: 'Designed by the user (2026-10-08): data-sources/custom/battle-50-trainers.txt (teams) and battle-50-trainers.json (who, where, weight); built by scripts/build-custom-trainers.mjs. Not from any game.',
  notes: [
    'They share the Battle Legends\' battle-50 slot by weight (Red / Blue are weight 7 in bosses.json); a Multi entry lists the first (left) trainer first.',
    'IV 31 like the Battle Legends; IV lines in the exports are ignored. Sprites are the user\'s own pixel art in public/trainers/.',
  ],
  trainers: battle50Trainers,
  battles: battle50.battles,
});
