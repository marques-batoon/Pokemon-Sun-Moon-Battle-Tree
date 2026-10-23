#!/usr/bin/env node
// Derives the data for the Galarian legendary birds (added on request, see DATA_NOTES.md) from Showdown's data:
//  - each bird's moves from its debut game, Sword and Shield (with The Isle of Armor and The Crown Tundra):
//    the learnset entries from Generation 8;
//  - which of those moves Gen 7 doesn't have (Showdown marks them "Future" there).
// Usage: node scripts/build-galar-birds-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex } from '@pkmn/sim';

const out = new URL('../src/data/galar-birds/birds.json', import.meta.url);
const BIRDS = ['Articuno-Galar', 'Zapdos-Galar', 'Moltres-Galar'];

const g7 = Dex.mod('gen7');
const species = BIRDS.map(name => {
  const s = Dex.species.get(name);
  if (!s.exists) throw new Error(`Unknown Pokémon ${name}`);
  const learnset = Dex.species.getLearnsetData(s.id).learnset ?? {};
  const moves = Object.entries(learnset).filter(([, sources]) => sources.some(src => src.startsWith('8'))).map(([id]) => Dex.moves.get(id).name).sort();
  return { name: s.name, moves };
});
const newMoves = [...new Set(species.flatMap(s => s.moves).filter(m => g7.moves.get(m).isNonstandard))].sort();

const data = {
  source: {
    'pokemon-showdown-data': `@pkmn/sim ${JSON.parse(readFileSync(new URL('../node_modules/@pkmn/sim/package.json', import.meta.url))).version} (species; learnsets: Generation 8 entries, i.e. Sword and Shield and their DLC; moves marked "Future" in Gen 7)`,
  },
  species,
  newMoves,
};
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(species.map(s => `${s.name}: ${s.moves.length} moves`).join(', '));
console.log(`new moves: ${newMoves.join(', ')}`);
