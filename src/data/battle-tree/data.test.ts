import { describe, expect, it } from 'vitest';
import { Dex } from '@pkmn/dex';
import { BOSSES, BRACKETS, RULES, SETS, TRAINERS, type SpecialTrainer, type Trainer } from './index';

const gen7 = Dex.forGen(7);
const byName = (name: string) => TRAINERS.find(t => t.name === name && t.kind !== 'legend') as Trainer;
const labels = (t: Trainer) => t.roster.map(id => SETS[id].label);

/** Largest team a roster can field under Species Clause + Item Clause (capped at `cap`). */
function maxClauseTeam(roster: number[], cap: number): number {
  let best = 0;
  const species = new Set<string>();
  const items = new Set<string>();
  const rec = (start: number, size: number) => {
    best = Math.max(best, size);
    if (best >= cap) return;
    for (let i = start; i < roster.length; i++) {
      const set = SETS[roster[i]];
      const base = gen7.species.get(set.species).baseSpecies;
      if (species.has(base) || items.has(set.item)) continue;
      species.add(base);
      items.add(set.item);
      rec(i + 1, size + 1);
      species.delete(base);
      items.delete(set.item);
    }
  };
  rec(0, 0);
  return best;
}

describe('sets.json', () => {
  it('has the 996 Sun/Moon sets, then the 292 Gym Leader sets and 6 battle-50 sets, with sequential ids', () => {
    expect(SETS).toHaveLength(996 + 292 + 6);
    SETS.forEach((s, i) => expect(s.id).toBe(i));
    // Only custom sets fix their Ability (the game rolls it).
    expect(SETS.slice(0, 996).some(s => s.ability)).toBe(false);
    expect(SETS.slice(996).every(s => s.ability)).toBe(true);
  });

  it('resolves every species, move, item and nature in Gen 7', () => {
    for (const s of SETS) {
      expect(gen7.species.get(s.species).exists, s.label).toBe(true);
      expect(gen7.items.get(s.item).exists, s.label).toBe(true);
      expect(gen7.natures.get(s.nature).exists, s.label).toBe(true);
      expect(s.moves.length, s.label).toBeGreaterThan(0);
      for (const m of s.moves) expect(gen7.moves.get(m).exists, `${s.label} ${m}`).toBe(true);
    }
  });

  it('keeps EVs within 510 total / 252 per stat', () => {
    for (const s of SETS) {
      const evs = Object.values(s.evs);
      expect(evs.reduce((a, b) => a + b, 0), s.label).toBeLessThanOrEqual(510);
      expect(Math.max(...evs), s.label).toBeLessThanOrEqual(252);
    }
  });

  it('uses Sun/Moon v1.1 data, not USUM', () => {
    const get = (label: string) => SETS.find(s => s.label === label)!;
    // USUM changed Lurantis-1's Smooth Rock to Heat Rock (pastebin jt9TQEdP).
    expect(get('Lurantis-1').item).toBe('Smooth Rock');
    // USUM gave Aerodactyl-1 three extra moves.
    expect(get('Aerodactyl-1').moves).toEqual(['Rock Slide']);
    // v1.1 patch (Kaphotics): Kommo-o-4 has Draco Meteor, not Shell Smash.
    expect(get('Kommo-o-4').moves).toContain('Draco Meteor');
  });
});

describe('trainers.json', () => {
  it('has 190 regular, 11 special and 4 legend trainers from the game, then 47 custom Gym Leaders and 2 battle-50 trainers', () => {
    const count = (k: Trainer['kind']) => TRAINERS.filter(t => t.kind === k).length;
    expect(TRAINERS).toHaveLength(205 + 47 + 2);
    expect([count('regular'), count('special'), count('legend')]).toEqual([190, 11 + 47, 4 + 2]);
    expect(TRAINERS.slice(205, 252).every(t => t.kind === 'special' && t.custom && t.weight === 7 && t.iv === 31 && t.versions.length === 2)).toBe(true);
    expect(TRAINERS.slice(252).map(t => [t.name, t.kind, t.custom, t.iv, t.sprite])).toEqual([
      ['Marques', 'legend', true, 31, '/trainers/marques.png'],
      ['Thomas', 'legend', true, 31, '/trainers/thomas.png'],
    ]);
  });

  it("lets every Gym Leader field 4 Pokémon under the clauses (Doubles)", () => {
    for (const t of TRAINERS.filter(x => x.kind === 'special' && x.custom)) expect(maxClauseTeam(t.roster, 4), t.name).toBe(4);
  });

  it('only references existing sets, without duplicates', () => {
    for (const t of TRAINERS) {
      expect(new Set(t.roster).size, t.name).toBe(t.roster.length);
      for (const id of t.roster) expect(SETS[id], `${t.name} -> ${id}`).toBeDefined();
    }
  });

  it('lets every trainer field a clause-legal team of 3 (and 4 for Doubles)', () => {
    // Multi-only trainers (battle 50 of Super Multi) only need 2.
    for (const t of TRAINERS) {
      const need = t.kind === 'legend' && t.format === 'multi' ? 2 : 4;
      expect(maxClauseTeam(t.roster, need), t.name).toBe(need);
    }
  });

  it('assigns IVs by trainer tier (19 / 23 / 27 / 31)', () => {
    for (const t of TRAINERS) {
      if (t.kind !== 'regular') expect(t.iv, t.name).toBe(31);
      else if (t.number <= 50) expect(t.iv).toBe(19);
      else if (t.number <= 70) expect(t.iv).toBe(23);
      else if (t.number <= 90) expect(t.iv).toBe(27);
      else expect(t.iv).toBe(31);
    }
  });

  it('gives Colress, Dexio, Kiawe and Sina only the Alolan regional forms (Bulbapedia lists both; 3 other sources agree on Alolan only)', () => {
    expect(labels(byName('Colress')).filter(l => l.includes('Muk'))).toEqual(['Alolan Muk-1', 'Alolan Muk-2']);
    expect(labels(byName('Dexio')).filter(l => l.includes('Ninetales'))).toEqual(['Alolan Ninetales-2']);
    expect(labels(byName('Kiawe')).filter(l => l.includes('Marowak'))).toEqual(['Alolan Marowak-2']);
    expect(labels(byName('Sina')).filter(l => l.includes('Sandslash'))).toEqual(['Alolan Sandslash-2']);
  });

  it('includes Heat Rotom-1 for Kendra (SadisticMystic omitted it; same pool as Rocky per Tree-Sets)', () => {
    expect(labels(byName('Kendra'))).toContain('Heat Rotom-1');
    expect([...byName('Kendra').roster].sort()).toEqual([...byName('Rocky').roster].sort());
  });
});

describe('brackets.json', () => {
  it('pools are contiguous Bulbapedia ranges containing only regular trainers', () => {
    const expected: Record<string, [number, number]> = {
      'b01-10': [1, 50], 'b11-19': [31, 70], 'b21-29': [51, 90],
      'b31-39': [71, 110], 'b41-49': [91, 130], 'b51+': [91, 190],
    };
    for (const [key, [from, to]] of Object.entries(expected)) {
      const nums = BRACKETS.pools[key].trainerIds.map(id => {
        const t = TRAINERS[id];
        expect(t.kind).toBe('regular');
        return t.kind === 'regular' ? t.number : -1;
      });
      expect(nums).toEqual(Array.from({ length: to - from + 1 }, (_, i) => from + i));
    }
  });

  it('special pool has the game\'s 8 trainers per version (Anabel at 1/50 of their weight), plus every Gym Leader', () => {
    const all = BRACKETS.specialTrainerPool.trainerIds.map(id => TRAINERS[id] as SpecialTrainer);
    expect(all.filter(t => t.custom).map(t => t.id)).toEqual(TRAINERS.filter(t => t.kind === 'special' && t.custom).map(t => t.id));
    const specials = all.filter(t => !t.custom);
    for (const v of ['sun', 'moon'] as const) {
      const pool = specials.filter(t => t.versions.includes(v));
      expect(pool).toHaveLength(8);
      const total = pool.reduce((a, t) => a + t.weight, 0);
      expect(pool.find(t => t.name === 'Anabel')!.weight / total).toBeCloseTo(1 / 50);
    }
    const names = (v: 'sun' | 'moon') => specials.filter(t => t.versions.length === 1 && t.versions[0] === v).map(t => t.name).sort();
    expect(names('sun')).toEqual(['Kiawe', 'Plumeria', 'Sina']);
    expect(names('moon')).toEqual(['Dexio', 'Guzma', 'Mallow']);
  });
});

describe('bosses.json / rules.json', () => {
  it('schedules Red at battle 20 (Normal) and 50 (Super)', () => {
    expect(BOSSES['red-normal']).toMatchObject({ battle: 20, trainerId: 203, bp: 20 });
    expect(BOSSES['red-super']).toMatchObject({ battle: 50, trainerId: 190, bp: 50 });
    expect(TRAINERS[203]).toMatchObject({ name: 'Red', kind: 'legend', course: 'normal' });
    expect(TRAINERS[190]).toMatchObject({ name: 'Red', kind: 'legend', course: 'super' });
  });

  it('BP tables cover every battle exactly once', () => {
    const cover = (course: 'normal' | 'super', upTo: number) => {
      for (let n = 1; n <= upTo; n++) {
        const hits = RULES.battlePoints[course].filter(r => n >= r.battles[0] && (r.battles[1] === null || n <= r.battles[1]));
        expect(hits, `${course} battle ${n}`).toHaveLength(1);
      }
    };
    cover('normal', 20);
    cover('super', 200);
  });

  it('bans only species that exist, and no AI set uses one', () => {
    const banned = new Set(RULES.bannedSpecies.species);
    for (const s of RULES.bannedSpecies.species) expect(gen7.species.get(s).exists, s).toBe(true);
    for (const s of SETS) expect(banned.has(gen7.species.get(s.species).baseSpecies), s.label).toBe(false);
  });
});

describe('trainer-art.json', () => {
  it('covers every special trainer and Battle Legend (artwork or a reason why not), and nobody else', async () => {
    const art = (await import('./trainer-art.json')).default as { named: Record<string, { url: string }>; missing: Record<string, string> };
    // Custom trainers with their own sprite (pixel art) don't need artwork.
    const named = new Set(TRAINERS.filter(t => t.kind !== 'regular' && !t.sprite).map(t => t.name));
    const covered = [...Object.keys(art.named), ...Object.keys(art.missing)];
    expect(new Set(covered)).toEqual(named);
    expect(covered.length).toBe(named.size); // no name in both lists
    for (const { url } of Object.values(art.named)) expect(url).toMatch(/^https:\/\/cdn\.pidgi\.net\/images\/thumb\//);
  });
});

describe('trainer-quotes.json', () => {
  it('gives every trainer (by name) three sets of greeting + both closing remarks, no line shared', async () => {
    const { TRAINER_MULTI_QUOTES, TRAINER_QUOTES } = await import('./index');
    const names = new Set(TRAINERS.map(t => t.name));
    expect(new Set(Object.keys(TRAINER_QUOTES))).toEqual(names);
    // Team-up lines for the paired trainers (Tate and Liza) in Multi Battles.
    expect(Object.keys(TRAINER_MULTI_QUOTES).sort()).toEqual(['Liza', 'Tate']);
    const sets = [...Object.values(TRAINER_QUOTES), ...Object.values(TRAINER_MULTI_QUOTES)];
    // Three sets each, except the user's battle-50 trainers (as many as they wrote; the same for both of a pair).
    for (const [name, trainerSets] of Object.entries(TRAINER_QUOTES)) {
      const t = TRAINERS.find(x => x.name === name)!;
      if (t.sprite) expect(trainerSets.length, name).toBeGreaterThanOrEqual(1);
      else expect(trainerSets, name).toHaveLength(3);
    }
    expect(TRAINER_QUOTES.Marques.length).toBe(TRAINER_QUOTES.Thomas.length);
    const lines = sets.flat().flatMap(q => [q.greeting, q.trainerWins, q.trainerLoses]);
    for (const text of lines) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(120);
    }
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('never names a Pokémon or a type', async () => {
    const { TRAINER_MULTI_QUOTES, TRAINER_QUOTES } = await import('./index');
    const names = [...new Set([...Dex.species.all()].map(s => s.baseSpecies))].filter(n => n.length > 2);
    const pokemon = new RegExp(`(?<![\\w-])(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\\w)`);
    const types = new RegExp(`\\b(${[...Dex.types.all()].map(t => t.name).join('|')})(-| )types?\\b`, 'i');
    for (const q of [...Object.values(TRAINER_QUOTES), ...Object.values(TRAINER_MULTI_QUOTES)].flat()) {
      for (const text of [q.greeting, q.trainerWins, q.trainerLoses]) {
        expect(text).not.toMatch(pokemon);
        expect(text).not.toMatch(types);
      }
    }
  });

  it('has pair greetings for special trainers who share a region or a type: one per trainer, no Pokémon named', async () => {
    const { TRAINER_PAIR_GREETINGS, TRAINER_QUOTES } = await import('./index');
    const special = new Set(TRAINERS.filter(t => t.kind === 'special').map(t => t.name));
    const names = [...new Set([...Dex.species.all()].map(s => s.baseSpecies))].filter(n => n.length > 2);
    const pokemon = new RegExp(`(?<![\\w-])(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\\w)`);
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const [label, entry] of Object.entries(TRAINER_PAIR_GREETINGS)) {
      const who = Object.keys(entry);
      expect(who, label).toHaveLength(2);
      for (const name of who) expect(special.has(name), `${label}: ${name}`).toBe(true);
      // Tate and Liza only ever battle together (they have their own team-up lines).
      expect(who.some(n => n === 'Tate' || n === 'Liza'), label).toBe(false);
      const key = [...who].sort().join('|');
      expect(seen.has(key), label).toBe(false);
      seen.add(key);
      lines.push(...Object.values(entry));
    }
    expect(seen.size).toBeGreaterThanOrEqual(317);
    const usual = Object.values(TRAINER_QUOTES).flat().map(q => q.greeting);
    for (const text of lines) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(120);
      // Their shared type may come up (that's the point), but never a Pokémon on their team.
      expect(text).not.toMatch(pokemon);
      expect(usual).not.toContain(text);
    }
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('greets you with pair lines when two such special trainers battle together, keeping their usual closing remarks', async () => {
    const { trainerQuotes, TRAINER_PAIR_GREETINGS } = await import('./index');
    const [brock, misty, surge, cynthia, florian] = ['Brock', 'Misty', 'Lt. Surge', 'Cynthia', 'Florian'].map(byName);
    const key = 'run-9|battle-10';
    const together = trainerQuotes(brock, key, [brock, misty])!;
    const alone = trainerQuotes(brock, key)!;
    expect(together.greeting).toBe(TRAINER_PAIR_GREETINGS['Brock & Misty'].Brock);
    expect(trainerQuotes(misty, key, [brock, misty])!.greeting).toBe(TRAINER_PAIR_GREETINGS['Brock & Misty'].Misty);
    expect(together.trainerWins).toBe(alone.trainerWins);
    expect(together.trainerLoses).toBe(alone.trainerLoses);
    // Same type, different regions.
    expect(trainerQuotes(surge, key, [surge, byName('Volkner')])!.greeting).toMatch(/Volkner/);
    // Nothing in common (Kanto Leader and Sinnoh's Champion), or a regular trainer: their usual lines.
    expect(trainerQuotes(brock, key, [brock, cynthia])).toBe(alone);
    expect(trainerQuotes(brock, key, [brock, florian])).toBe(alone);
  });

  it('picks one set per battle, the same every time for that battle, and uses all three', async () => {
    const { trainerQuotes } = await import('./index');
    const florian = TRAINERS[0];
    expect(trainerQuotes(florian, 'run-1|battle-3')).toBe(trainerQuotes(florian, 'run-1|battle-3'));
    // The quote pick (sent online instead of the secret seed) chooses the same lines as the seed text.
    const { quotePick } = await import('./index');
    for (let i = 1; i <= 20; i++) expect(trainerQuotes(florian, quotePick(`run-1|battle-${i}`))).toBe(trainerQuotes(florian, `run-1|battle-${i}`));
    const picked = new Set(Array.from({ length: 30 }, (_, i) => trainerQuotes(florian, `run-1|battle-${i + 1}`)?.greeting));
    expect(picked.size).toBe(3);
  });

  it('gives Tate and Liza matching team-up lines when they battle together, and their own lines apart', async () => {
    const { trainerQuotes, TRAINER_MULTI_QUOTES, TRAINER_QUOTES } = await import('./index');
    const tate = byName('Tate');
    const liza = byName('Liza');
    for (let i = 0; i < 12; i++) {
      const key = `run|battle-${i}`;
      const t = trainerQuotes(tate, key, [tate, liza])!;
      const l = trainerQuotes(liza, key, [tate, liza])!;
      expect(TRAINER_MULTI_QUOTES.Tate.indexOf(t)).toBe(TRAINER_MULTI_QUOTES.Liza.indexOf(l));
      expect(TRAINER_QUOTES.Tate).toContain(trainerQuotes(tate, key));
      expect(TRAINER_QUOTES.Tate).toContain(trainerQuotes(tate, key, [tate, byName('Brock')]));
    }
  });
});
