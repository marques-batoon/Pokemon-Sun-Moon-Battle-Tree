import { describe, expect, it } from 'vitest';
import { Battle, Teams } from '@pkmn/sim';
import { applyFlatRules, FORMAT_IDS, registerBattleTreeFormats } from '../engine/format';
import { seedFromString } from '../engine/seed';
import { clauseConflicts } from './checks';
import { eligibleSpecies, gen7, learnableMoves } from './dex';
import { calcStats, changeSpecies, evTotal, hiddenPowerType, newSet, withEv, withIv } from './sets';
import { exportShowdownText, importShowdownText } from './showdown-text';
import type { PokemonSet } from './types';

const spread = (s: Partial<PokemonSet['evs']>) => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...s });
const set = (species: string, patch: Partial<PokemonSet> = {}): PokemonSet => ({ ...newSet(species), ...patch });

describe('Lv. 50 stat calculation', () => {
  it('matches hand-computed values', () => {
    // Garchomp 108/130/95/80/85/102, Jolly, 4 HP / 252 Atk / 252 Spe, 31 IVs.
    const chomp = set('Garchomp', { nature: 'Jolly', evs: spread({ hp: 4, atk: 252, spe: 252 }) });
    expect(calcStats(chomp)).toEqual({ hp: 184, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
    // Shedinja always has 1 HP.
    expect(calcStats(set('Shedinja', { evs: spread({ hp: 252 }) })).hp).toBe(1);
    // 0 IV / Brave lowers Speed: Aegislash base 60 Spe -> floor((120+0+0)*50/100)+5 = 65, * 0.9 = 58.
    expect(calcStats(set('Aegislash', { nature: 'Brave', ivs: { ...newSet('Aegislash').ivs, spe: 0 } })).spe).toBe(58);
  });

  it('uses the battle level: Lv. 100 is computed at 50, lower levels as-is', () => {
    const at100 = set('Garchomp', { level: 100, nature: 'Jolly', evs: spread({ atk: 252 }) });
    const at50 = set('Garchomp', { level: 50, nature: 'Jolly', evs: spread({ atk: 252 }) });
    expect(calcStats(at100)).toEqual(calcStats(at50));
    expect(calcStats(set('Garchomp', { level: 30 })).hp).toBe(Math.floor((2 * 108 + 31) * 30 / 100) + 30 + 10);
  });

  it('agrees with the simulator for a whole team', () => {
    registerBattleTreeFormats();
    const team = [
      set('Garchomp', { nature: 'Jolly', evs: spread({ hp: 4, atk: 252, spe: 252 }), ability: 'Rough Skin', moves: ['Earthquake'] }),
      set('Chansey', { nature: 'Bold', evs: spread({ hp: 252, def: 252, spd: 4 }), ivs: { ...newSet('Chansey').ivs, atk: 0 }, ability: 'Natural Cure', moves: ['Seismic Toss'] }),
      set('Rotom-Wash', { nature: 'Modest', level: 100, evs: spread({ hp: 252, spa: 252, spe: 4 }), ability: 'Levitate', moves: ['Hydro Pump'] }),
      set('Kartana', { nature: 'Jolly', level: 42, evs: spread({ atk: 252, spe: 252, hp: 6 }), ability: 'Beast Boost', moves: ['Leaf Blade'] }),
    ];
    const battle = new Battle({ formatid: FORMAT_IDS.singles as never, seed: seedFromString('stats') });
    battle.setPlayer('p1', { name: 'A', team: Teams.pack(applyFlatRules(team as never)) });
    battle.setPlayer('p2', { name: 'B', team: Teams.pack(applyFlatRules(team as never)) });
    battle.p1.pokemon.forEach((p, i) => {
      const mine = calcStats(team[i]);
      expect(p.maxhp, team[i].species).toBe(mine.hp);
      expect(p.storedStats, team[i].species).toEqual({ atk: mine.atk, def: mine.def, spa: mine.spa, spd: mine.spd, spe: mine.spe });
    });
  });
});

describe('EV / IV editing', () => {
  it('clamps EVs to 252 per stat and 510 total', () => {
    let s = newSet('Garchomp');
    s = withEv(s, 'atk', 300);
    expect(s.evs.atk).toBe(252);
    s = withEv(s, 'spe', 252);
    s = withEv(s, 'hp', 100);
    expect(s.evs.hp).toBe(6);
    expect(evTotal(s)).toBe(510);
    s = withEv(s, 'hp', -5);
    expect(s.evs.hp).toBe(0);
  });

  it('clamps IVs to 0-31', () => {
    expect(withIv(newSet('Garchomp'), 'spe', 40).ivs.spe).toBe(31);
    expect(withIv(newSet('Garchomp'), 'spe', -1).ivs.spe).toBe(0);
  });

  it('derives the Hidden Power type from IVs', () => {
    expect(hiddenPowerType(newSet('Magnezone'))).toBe('Dark');
    const fire = { ...newSet('Magnezone').ivs, ...gen7.types.get('Fire')!.HPivs };
    expect(hiddenPowerType({ ...newSet('Magnezone'), ivs: fire })).toBe('Fire');
  });

  it('keeps a compatible ability when changing species', () => {
    const s = changeSpecies(set('Gengar', { ability: 'Levitate' }), 'Rotom-Wash');
    expect(s.ability).toBe('Levitate');
    expect(changeSpecies(set('Garchomp', { ability: 'Rough Skin' }), 'Salamence').ability).toBe('Intimidate');
  });
});

describe('species and move lists', () => {
  const names = new Set<string>(eligibleSpecies().map(s => s.name));

  it('excludes banned (all formes), USUM-only, battle-only and Totem formes', () => {
    for (const n of ['Mewtwo', 'Giratina-Origin', 'Necrozma', 'Marshadow', 'Naganadel', 'Lycanroc-Dusk', 'Charizard-Mega-X', 'Aegislash-Blade', 'Mimikyu-Totem', 'Greninja-Ash']) {
      expect(names.has(n), n).toBe(false);
    }
  });

  it('includes Tapus, Ultra Beasts, regional and appliance formes', () => {
    for (const n of ['Tapu Koko', 'Kartana', 'Pheromosa', 'Ninetales-Alola', 'Rotom-Wash', 'Lycanroc-Midnight', 'Oricorio-Sensu', 'Gourgeist-Super']) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it('lists learnable Gen 7 moves', async () => {
    const chomp = (await learnableMoves('Garchomp')).map(m => m.name);
    expect(chomp).toContain('Earthquake');
    expect(chomp).toContain('Swords Dance');
    expect(chomp).not.toContain('Spore');
    // Form-specific move comes through for appliance Rotom.
    expect((await learnableMoves('Rotom-Wash')).map(m => m.name)).toContain('Hydro Pump');
    // Smeargle can Sketch almost anything.
    expect((await learnableMoves('Smeargle')).length).toBeGreaterThan(600);
    // Custom extra move (DATA_NOTES "Custom additions"), listed once and only for Poliwrath.
    const wrath = (await learnableMoves('Poliwrath')).map(m => m.name);
    expect(wrath.filter(m => m === 'Drain Punch')).toHaveLength(1);
    expect((await learnableMoves('Politoed')).map(m => m.name)).not.toContain('Drain Punch');
  });
});

describe('clause highlighting', () => {
  it('groups slots sharing a species or an item', () => {
    const team = [set('Chansey', { item: 'Eviolite' }), set('Blissey', { item: 'Leftovers' }), set('Chansey', { item: 'Leftovers' })];
    expect(clauseConflicts(team)).toEqual({ species: [[0, 2]], items: [[1, 2]] });
  });
});

describe('Showdown import / export', () => {
  const TEXT = `
Tapu Lele @ Choice Specs
Ability: Psychic Surge
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
IVs: 0 Atk
- Psychic
- Moonblast
- Focus Blast
- Hidden Power [Fire]

Bisharp (M) @ Life Orb
Ability: Defiant
Level: 50
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Sucker Punch
- Iron Head
- Knock Off
- Swords Dance`;

  it('imports sets with Showdown defaults (missing Level -> 100) and round-trips through export', () => {
    const { teams, warnings } = importShowdownText(TEXT);
    expect(warnings).toEqual([]);
    expect(teams).toHaveLength(1);
    const [lele, bisharp] = teams[0].sets;
    expect(lele.level).toBe(100);
    expect(bisharp.level).toBe(50);
    expect(bisharp.gender).toBe('M');
    expect(lele.moves).toContain('Hidden Power');
    // IVs were given (0 Atk), so the HP-Fire spread is not forced; type follows the IVs.
    expect(lele.ivs.atk).toBe(0);

    const again = importShowdownText(exportShowdownText(teams[0].sets));
    expect(again.teams[0].sets).toEqual(teams[0].sets);
  });

  it('exports and re-imports a single Pokémon (Export / Paste from Showdown in the builder)', () => {
    const [, bisharp] = importShowdownText(TEXT).teams[0].sets;
    const one = exportShowdownText([bisharp]);
    expect(one.split('\n\n')).toHaveLength(1);
    expect(importShowdownText(one).teams[0].sets).toEqual([bisharp]);
  });

  it('applies the standard Hidden Power IVs when none are given', () => {
    const { teams } = importShowdownText('Magnezone\nAbility: Magnet Pull\n- Hidden Power [Fire]');
    const s = teams[0].sets[0];
    expect(hiddenPowerType(s)).toBe('Fire');
    expect(exportShowdownText([s])).toContain('Hidden Power [Fire]');
  });

  it('warns about unknown entries instead of guessing', () => {
    const { teams, warnings } = importShowdownText('Fakemon @ Leftovers\n- Tackle\n\nGarchomp @ Mystery Orb\n- Earthquake\n- Laser Beam');
    expect(teams[0].sets.map(s => s.species)).toEqual(['Garchomp']);
    expect(teams[0].sets[0].item).toBe('');
    expect(teams[0].sets[0].moves).toEqual(['Earthquake']);
    expect(warnings.join('\n')).toMatch(/fakemon/i);
    expect(warnings.join('\n')).toMatch(/Mystery Orb/);
    expect(warnings.join('\n')).toMatch(/Laser Beam/);
  });

  it('imports several teams from a Showdown backup', () => {
    const { teams } = importShowdownText('=== [gen7] Rain ===\n\nPelipper @ Damp Rock\nAbility: Drizzle\n- Scald\n\n=== [gen7] Sun ===\n\nTorkoal @ Heat Rock\nAbility: Drought\n- Lava Plume\n');
    expect(teams.map(t => t.name)).toEqual(['Rain', 'Sun']);
    expect(teams[1].sets[0].species).toBe('Torkoal');
  });
});

describe('groupProblems', () => {
  it('joins parenthetical detail lines onto the previous problem', async () => {
    const { groupProblems } = await import('./problems');
    expect(groupProblems(['A.', '(detail)', 'B.'])).toEqual(['A. (detail)', 'B.']);
  });
});

describe('effectiveness hints', () => {
  it('labels matchups like the in-game move hints (abilities ignored)', async () => {
    const { effectivenessLabel } = await import('./effectiveness');
    expect(effectivenessLabel('Ground', ['Fire', 'Steel'])).toBe('Super effective');
    expect(effectivenessLabel('Fire', ['Water'])).toBe('Not very effective');
    expect(effectivenessLabel('Ground', ['Flying'])).toBe('No effect');
    expect(effectivenessLabel('Normal', ['Ghost'])).toBe('No effect');
    expect(effectivenessLabel('Water', ['Normal'])).toBeNull();
  });
});

describe('export / import all teams', () => {
  it('round-trips several teams through a Showdown backup, keeping names and order', async () => {
    const { exportShowdownBackup, BACKUP_FORMAT } = await import('./showdown-text');
    const rain = importShowdownText('Pelipper @ Damp Rock\nAbility: Drizzle\nLevel: 50\n- Scald\n- Hurricane\n\nKingdra @ Choice Specs\nAbility: Swift Swim\nLevel: 50\n- Hydro Pump').teams[0].sets;
    const sun = importShowdownText('Torkoal @ Heat Rock\nAbility: Drought\nLevel: 50\n- Lava Plume').teams[0].sets;
    const text = exportShowdownBackup([
      { name: 'Rain', sets: rain },
      { name: 'Empty draft', sets: [] },
      { name: 'Sun\nteam', sets: sun },
    ]);
    expect(text).toContain(`=== [${BACKUP_FORMAT}] Rain ===`);
    expect(text).not.toContain('Empty draft');

    const back = importShowdownText(text);
    expect(back.warnings).toEqual([]);
    expect(back.teams.map(t => t.name)).toEqual(['Rain', 'Sun team']);
    expect(back.teams[0].sets).toEqual(rain);
    expect(back.teams[1].sets).toEqual(sun);
  });
});
