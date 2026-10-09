#!/usr/bin/env node
// Builds the Gym Leader special trainers (a custom addition designed by the
// user, see DATA_NOTES.md "Custom additions") from their Showdown exports in
// data-sources/custom/gym-leaders.txt.
//  - "Brock 1" and "Brock 2" are one trainer (Brock) with all eight Pokémon.
//  - Abilities, items, natures, EVs, moves and genders come from the export;
//    IVs don't: like every Battle Tree trainer they use the trainer's IV
//    (31 for special trainers), so "IVs: 0 Spe" lines are ignored.
// Usage: node scripts/build-gym-leaders.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex, Teams } from '@pkmn/sim';

const src = new URL('../data-sources/custom/gym-leaders.txt', import.meta.url);
const out = new URL('../src/data/custom/gym-leaders.json', import.meta.url);

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
const text = readFileSync(src, 'utf8');
const blocks = [...text.matchAll(/^=== \[[^\]]+\] (.+?) ===\s*$([\s\S]*?)(?=^=== |(?![\s\S]))/gm)];

const trainers = new Map();
const problems = [];
for (const [, title, body] of blocks) {
  const name = title.replace(/ \d+$/, '').trim();
  const sets = Teams.import(body.trim());
  if (!sets?.length) { problems.push(`${title}: no Pokémon`); continue; }
  const trainer = trainers.get(name) ?? {
    name,
    class: CLASS[name] ?? 'Gym Leader',
    classGender: FEMALE.has(name) ? 'F' : 'M',
    region: regionOf(name),
    sets: [],
  };
  for (const s of sets) {
    const species = Dex.species.get(s.species);
    if (!species.exists) problems.push(`${title}: unknown species ${s.species}`);
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
for (const t of trainers.values()) if (!t.region) problems.push(`${t.name}: no region`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

writeFileSync(out, `${JSON.stringify({
  source: 'Designed by the user (2026-10-08), as Showdown exports in data-sources/custom/gym-leaders.txt; built by scripts/build-gym-leaders.mjs. Not from any game.',
  notes: [
    'Each trainer is one special trainer; "Brock 1" and "Brock 2" (Misty, Lt. Surge, Erika, Blaine likewise) are merged into one eight-Pokémon roster.',
    'IVs are the special-trainer IV (31) like every Battle Tree special trainer, per the user; IV lines in the exports are ignored.',
    'Abilities and genders are as exported (Battle Tree sets roll them instead).',
  ],
  trainers: [...trainers.values()],
  pairs: PAIRS,
}, null, 1)}\n`);
console.log(`${trainers.size} trainers, ${[...trainers.values()].reduce((a, t) => a + t.sets.length, 0)} sets -> ${out.pathname}`);
