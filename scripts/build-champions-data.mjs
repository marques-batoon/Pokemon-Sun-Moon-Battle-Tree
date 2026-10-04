#!/usr/bin/env node
// Derives the Pokémon Champions additions from the sourced Mega list
// (src/data/champions/megas.json, from Serebii's Champions Pokédex):
//  - which species, moves and abilities have to be made available in Gen 7
//    (Showdown marks them "Future" there), and
//  - which sprites Pokémon Showdown's sprite server has for each new forme,
//    with their pixel sizes (@pkmn/img's tables predate these formes).
// Usage: node scripts/build-champions-data.mjs   (needs network access)
import { readFileSync, writeFileSync } from 'node:fs';
import { Dex } from '@pkmn/sim';

const dir = new URL('../src/data/champions/', import.meta.url);
const megas = JSON.parse(readFileSync(new URL('megas.json', dir), 'utf8'));

/** Base Pokémon that aren't in Sun & Moon but are needed for their Champions Megas (approved: allowed). */
const NEW_BASE = ['Falinks', 'Scovillain', 'Glimmora', 'Baxcalibur'];
/** Floettite needs Eternal Flower Floette, which exists in Gen 7 data but was never obtainable there. */
const UNLOCKED_FORMES = ['Floette-Eternal'];

const g7 = Dex.mod('gen7');
const toId = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const isFuture = d => !!d.isNonstandard;

// These learn their moves from their newest learnsets (Gen 9 / Legends: Z-A data).
const moves = new Set();
for (const name of [...NEW_BASE, ...UNLOCKED_FORMES]) {
  const learnset = Dex.species.getLearnsetData(toId(name)).learnset ?? {};
  for (const id of Object.keys(learnset)) if (isFuture(g7.moves.get(id))) moves.add(g7.moves.get(id).name);
}

const abilities = new Set();
for (const name of [...NEW_BASE, ...UNLOCKED_FORMES]) {
  for (const a of Object.values(Dex.species.get(name).abilities)) if (isFuture(g7.abilities.get(a))) abilities.add(a);
}
for (const m of megas.megas) {
  const a = g7.abilities.get(m.ability);
  if (a.exists && isFuture(a)) abilities.add(a.name);
}

// Sprites: probe the server and read image sizes from the file headers.
const BASE_URL = 'https://play.pokemonshowdown.com/sprites';
const spriteId = name => {
  const s = Dex.species.get(name);
  const forme = s.forme ? '-' + toId(s.forme) : '';
  return toId(s.baseSpecies) + forme;
};
async function size(url) {
  const res = await fetch(url, { headers: { Range: 'bytes=0-31' } });
  if (!res.ok) return null;
  const b = new Uint8Array(await res.arrayBuffer());
  if (b[0] === 0x47) return [b[6] | (b[7] << 8), b[8] | (b[9] << 8)]; // GIF: little-endian width, height
  if (b[0] === 0x89) { const v = new DataView(b.buffer); return [v.getUint32(16), v.getUint32(20)]; } // PNG IHDR
  return null;
}
const sprites = {};
for (const name of [...megas.megas.map(m => m.species), ...NEW_BASE, ...UNLOCKED_FORMES]) {
  const id = spriteId(name);
  const [ani, aniBack, gen5, gen5Back] = await Promise.all([
    size(`${BASE_URL}/ani/${id}.gif`), size(`${BASE_URL}/ani-back/${id}.gif`),
    size(`${BASE_URL}/gen5/${id}.png`), size(`${BASE_URL}/gen5-back/${id}.png`),
  ]);
  sprites[name] = { id, ani, aniBack, gen5, gen5Back };
}

const derived = {
  source: {
    'pokemon-showdown-data': `@pkmn/sim ${JSON.parse(readFileSync(new URL('../node_modules/@pkmn/sim/package.json', import.meta.url))).version} (moves/abilities marked "Future" in Gen 7)`,
    'pokemon-showdown-sprites': `${BASE_URL}/{ani,ani-back,gen5,gen5-back}/<id> (probed ${new Date().toISOString().slice(0, 10)})`,
  },
  newBaseSpecies: NEW_BASE,
  unlockedFormes: UNLOCKED_FORMES,
  moves: [...moves].sort(),
  abilities: [...abilities].sort(),
  sprites,
};
writeFileSync(new URL('derived.json', dir), JSON.stringify(derived, null, 2) + '\n');
console.log(`moves ${moves.size}, abilities ${abilities.size}, sprites ${Object.keys(sprites).length}`);
for (const [n, s] of Object.entries(sprites)) console.log(n.padEnd(20), JSON.stringify(s));
