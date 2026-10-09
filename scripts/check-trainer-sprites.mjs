#!/usr/bin/env node
/**
 * Verifies that every trainer has a sprite mapping and that each sprite URL
 * exists on Pokémon Showdown's server (network required).
 * Run with: node scripts/check-trainer-sprites.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'battle-tree');
const sprites = JSON.parse(readFileSync(join(DATA, 'trainer-sprites.json'), 'utf8'));
const { trainers: gameTrainers } = JSON.parse(readFileSync(join(DATA, 'trainers.json'), 'utf8'));
// The Gym Leaders (custom special trainers) from src/data/custom/gym-leaders.json.
const gymLeaders = JSON.parse(readFileSync(join(DATA, '..', 'custom', 'gym-leaders.json'), 'utf8')).trainers.map(t => ({ ...t, kind: 'special' }));
const trainers = [...gameTrainers, ...gymLeaders];

const missing = [];
for (const t of trainers) {
  const key = t.kind === 'regular' ? (sprites.classes[`${t.class}|${t.classGender}`] ? `${t.class}|${t.classGender}` : t.class) : null;
  const id = key ? sprites.classes[key] : sprites.named[t.name];
  if (!id) missing.push(`${t.class} ${t.name}`);
}
if (missing.length) {
  console.error('No sprite mapping for:', missing.join(', '));
  process.exitCode = 1;
}

const ids = [...new Set([...Object.values(sprites.classes), ...Object.values(sprites.named)])];
const results = await Promise.all(ids.map(async id => {
  const res = await fetch(`https://play.pokemonshowdown.com/sprites/trainers/${id}.png`, { method: 'HEAD' });
  return [id, res.status];
}));
const bad = results.filter(([, status]) => status !== 200);
console.log(`${ids.length - bad.length}/${ids.length} sprite URLs OK`);
if (bad.length) {
  console.error('Missing on server:', bad.map(([id, s]) => `${id} (${s})`).join(', '));
  process.exitCode = 1;
}

// Opponent-card artwork (special trainers and Battle Legends; Pokémon Wiki CDN).
const art = JSON.parse(readFileSync(join(DATA, 'trainer-art.json'), 'utf8'));
const namedTrainers = new Set(trainers.filter(t => t.kind !== 'regular').map(t => t.name));
const unknown = [...Object.keys(art.named), ...Object.keys(art.missing)].filter(n => !namedTrainers.has(n));
const uncovered = [...namedTrainers].filter(n => !art.named[n] && !art.missing[n]);
if (unknown.length || uncovered.length) {
  console.error('trainer-art.json: unknown names', unknown, '/ neither art nor a reason for', uncovered);
  process.exitCode = 1;
}
const artResults = await Promise.all(Object.entries(art.named).map(async ([name, { url }]) => {
  const res = await fetch(url, { headers: { Referer: 'https://example.com/' } });
  return [name, res.status, res.headers.get('content-type')];
}));
const badArt = artResults.filter(([, status, type]) => status !== 200 || !type?.startsWith('image/'));
console.log(`${artResults.length - badArt.length}/${artResults.length} artwork URLs OK`);
if (badArt.length) {
  console.error('Artwork not loading:', badArt.map(([n, s, t]) => `${n} (${s} ${t})`).join(', '));
  process.exitCode = 1;
}
