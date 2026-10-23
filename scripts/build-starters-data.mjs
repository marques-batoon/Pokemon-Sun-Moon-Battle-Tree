#!/usr/bin/env node
// Derives the data for the Generation 8 and 9 starter Pokémon (added on request, see DATA_NOTES.md) from Showdown's
// data:
//  - each one's moves from its debut game: Sword and Shield (with The Isle of Armor and The Crown Tundra) for
//    Generation 8's, Scarlet and Violet (with The Teal Mask and The Indigo Disk) for Generation 9's: the learnset
//    entries from that generation, its pre-evolutions' included (their egg moves and the moves they learn before
//    evolving carry over, as Showdown's validator counts them);
//  - which of those moves and which of their Abilities Gen 7 doesn't have (Showdown marks them "Future" there).
// Usage: node scripts/build-starters-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex } from '@pkmn/sim';

const out = new URL('../src/data/starters/starters.json', import.meta.url);
/** Every stage of each starter line, by the generation it debuted in. */
const LINES = {
  8: [['Grookey', 'Thwackey', 'Rillaboom'], ['Scorbunny', 'Raboot', 'Cinderace'], ['Sobble', 'Drizzile', 'Inteleon']],
  9: [['Sprigatito', 'Floragato', 'Meowscarada'], ['Fuecoco', 'Crocalor', 'Skeledirge'], ['Quaxly', 'Quaxwell', 'Quaquaval']],
};

const g7 = Dex.mod('gen7');
const species = Object.entries(LINES).flatMap(([gen, lines]) => lines.flat().map(name => {
  const s = Dex.species.get(name);
  if (!s.exists || s.gen !== Number(gen)) throw new Error(`${name} isn't a Generation ${gen} Pokémon`);
  const moves = new Set();
  for (let stage = s; stage.exists; stage = Dex.species.get(stage.prevo)) {
    const learnset = Dex.species.getLearnsetData(stage.id).learnset ?? {};
    for (const [id, sources] of Object.entries(learnset)) if (sources.some(src => src.startsWith(gen))) moves.add(Dex.moves.get(id).name);
    if (!stage.prevo) break;
  }
  return { name: s.name, gen: Number(gen), moves: [...moves].sort() };
}));
const newMoves = [...new Set(species.flatMap(s => s.moves).filter(m => g7.moves.get(m).isNonstandard))].sort();
const newAbilities = [...new Set(species.flatMap(s => Object.values(Dex.species.get(s.name).abilities)).filter(a => g7.abilities.get(a).isNonstandard))].sort();

const data = {
  source: {
    'pokemon-showdown-data': `@pkmn/sim ${JSON.parse(readFileSync(new URL('../node_modules/@pkmn/sim/package.json', import.meta.url))).version} (species; learnsets: the entries from each one's debut generation, i.e. Sword and Shield and their DLC for Generation 8, Scarlet and Violet and their DLC for Generation 9; moves and Abilities marked "Future" in Gen 7)`,
  },
  species,
  newMoves,
  newAbilities,
};
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(species.map(s => `${s.name}: ${s.moves.length} moves`).join(', '));
console.log(`new moves (${newMoves.length}): ${newMoves.join(', ')}`);
console.log(`new Abilities: ${newAbilities.join(', ')}`);
