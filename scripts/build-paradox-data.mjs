#!/usr/bin/env node
// Derives the data for Paradox Evolution (a custom addition, see DATA_NOTES.md
// "Custom additions") from Showdown's data:
//  - the Paradox Pokémon whose original Pokémon is in Sun & Moon, and which
//    Gen 8-9 moves their learnsets need (Showdown marks them "Future" in Gen 7);
//  - which sprites Pokémon Showdown's sprite server has for each Paradox form,
//    with their pixel sizes (@pkmn/img's tables predate them).
// Usage: node scripts/build-paradox-data.mjs   (needs network access)
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex } from '@pkmn/sim';

const out = new URL('../src/data/custom/paradox.json', import.meta.url);

/**
 * Each Paradox Pokémon and the Pokémon it's the ancient / future counterpart of.
 * Koraidon and Miraidon are left out: Cyclizar isn't in Sun & Moon (and they're
 * restricted legendaries).
 */
const FORMS = [
  { form: 'Great Tusk', kind: 'ancient', bases: ['Donphan'] },
  { form: 'Scream Tail', kind: 'ancient', bases: ['Jigglypuff'] },
  { form: 'Brute Bonnet', kind: 'ancient', bases: ['Amoonguss'] },
  { form: 'Flutter Mane', kind: 'ancient', bases: ['Misdreavus'] },
  { form: 'Slither Wing', kind: 'ancient', bases: ['Volcarona'] },
  { form: 'Sandy Shocks', kind: 'ancient', bases: ['Magneton'] },
  { form: 'Roaring Moon', kind: 'ancient', bases: ['Salamence'] },
  { form: 'Walking Wake', kind: 'ancient', bases: ['Suicune'] },
  { form: 'Gouging Fire', kind: 'ancient', bases: ['Entei'] },
  { form: 'Raging Bolt', kind: 'ancient', bases: ['Raikou'] },
  { form: 'Iron Treads', kind: 'future', bases: ['Donphan'] },
  { form: 'Iron Bundle', kind: 'future', bases: ['Delibird'] },
  { form: 'Iron Hands', kind: 'future', bases: ['Hariyama'] },
  { form: 'Iron Jugulis', kind: 'future', bases: ['Hydreigon'] },
  { form: 'Iron Moth', kind: 'future', bases: ['Volcarona'] },
  { form: 'Iron Thorns', kind: 'future', bases: ['Tyranitar'] },
  { form: 'Iron Valiant', kind: 'future', bases: ['Gardevoir', 'Gallade'] },
  { form: 'Iron Leaves', kind: 'future', bases: ['Virizion'] },
  { form: 'Iron Boulder', kind: 'future', bases: ['Terrakion'] },
  { form: 'Iron Crown', kind: 'future', bases: ['Cobalion'] },
];

const g7 = Dex.mod('gen7');
const toId = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

for (const f of FORMS) {
  if (!Dex.species.get(f.form).exists) throw new Error(`Unknown Paradox Pokémon ${f.form}`);
  for (const b of f.bases) if (g7.species.get(b).isNonstandard) throw new Error(`${b} isn't in Gen 7`);
}

// Moves the Paradox forms learn (newest learnsets) that Gen 7 doesn't have.
const moves = new Set();
for (const f of FORMS) {
  for (const id of Object.keys(Dex.species.getLearnsetData(toId(f.form)).learnset ?? {})) {
    if (g7.moves.get(id).isNonstandard) moves.add(g7.moves.get(id).name);
  }
}

// Sprites: probe the server and read image sizes from the file headers.
const BASE_URL = 'https://play.pokemonshowdown.com/sprites';
async function size(url) {
  const res = await fetch(url, { headers: { Range: 'bytes=0-31' } });
  if (!res.ok) return null;
  const b = new Uint8Array(await res.arrayBuffer());
  if (b[0] === 0x47) return [b[6] | (b[7] << 8), b[8] | (b[9] << 8)]; // GIF: little-endian width, height
  if (b[0] === 0x89) { const v = new DataView(b.buffer); return [v.getUint32(16), v.getUint32(20)]; } // PNG IHDR
  return null;
}
const sprites = {};
for (const { form } of FORMS) {
  const id = toId(form);
  const [ani, aniBack, gen5, gen5Back] = await Promise.all([
    size(`${BASE_URL}/ani/${id}.gif`), size(`${BASE_URL}/ani-back/${id}.gif`),
    size(`${BASE_URL}/gen5/${id}.png`), size(`${BASE_URL}/gen5-back/${id}.png`),
  ]);
  sprites[form] = { id, ani, aniBack, gen5, gen5Back };
}

const data = {
  source: {
    'pokemon-showdown-data': `@pkmn/sim ${JSON.parse(readFileSync(new URL('../node_modules/@pkmn/sim/package.json', import.meta.url))).version} (species, learnsets; moves marked "Future" in Gen 7)`,
    'pokemon-showdown-sprites': `${BASE_URL}/{ani,ani-back,gen5,gen5-back}/<id> (probed ${new Date().toISOString().slice(0, 10)})`,
  },
  forms: FORMS,
  moves: [...moves].sort(),
  sprites,
};
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`forms ${FORMS.length}, new moves ${moves.size}`);
console.log(data.moves.join(', '));
