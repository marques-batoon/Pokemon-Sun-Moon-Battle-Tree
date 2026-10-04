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
const { trainers } = JSON.parse(readFileSync(join(DATA, 'trainers.json'), 'utf8'));

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
