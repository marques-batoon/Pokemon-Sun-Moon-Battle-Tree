import { describe, expect, it } from 'vitest';
import { DIGIMON_BASE_MOVES, WARP_DIGIMON } from '../data/custom/digimon';
import { canHoldItem } from '../data/custom/paradox';
import { allMoves, eligibleSpecies, gen7, learnableMoves, speciesAbilities } from './dex';
import { calcStats, changeSpecies, megaFormForSet, newSet, statForms } from './sets';

describe('Agumon in the team builder', () => {
  it('offers Agumon as a team member, but not WarGreymon (Warp Digivolution only)', () => {
    const names = eligibleSpecies().map(s => s.name);
    expect(names).toContain('Agumon');
    expect(names).not.toContain('WarGreymon');
    expect(gen7.species.get('WarGreymon')?.types).toEqual(['Fire', 'Dragon']);
    expect(gen7.items.get('Wargreyite')?.shortDesc).toMatch(/Warp Digivolve/);
    expect(gen7.moves.get('Pepper Breath')?.basePower).toBe(65);
  });

  it('learns its own list (Gen 8-9 TMs included), and only it gets the signature moves', async () => {
    const moves = (await learnableMoves('Agumon')).map(m => m.name);
    for (const m of ['Pepper Breath', 'Gaia Force', 'Scratch', 'Giga Impact', 'Tera Blast', 'Scorching Sands', 'Temper Flare', 'Solar Blade', 'X-Scissor']) expect(moves).toContain(m);
    expect(moves).not.toContain('Thunderbolt');
    // Every listed move exists (none dropped as unknown).
    expect(moves).toHaveLength(new Set(DIGIMON_BASE_MOVES.Agumon).size);
    expect(allMoves().map(m => m.name)).not.toContain('Pepper Breath');
    expect((await learnableMoves('Smeargle')).map(m => m.name)).not.toContain('Gaia Force');
  });

  it('keeps Wargreyite for Agumon', () => {
    expect(canHoldItem('Agumon', 'Wargreyite')).toBe(true);
    expect(canHoldItem('Charizard', 'Wargreyite')).toBe(false);
    expect(changeSpecies({ ...newSet('Agumon'), item: 'Wargreyite' }, 'Charizard').item).toBe('');
  });

  it('battles as Agumon until it warps (its stats are still its own)', () => {
    const set = { ...newSet('Agumon'), item: 'Wargreyite' };
    expect(calcStats(set).hp).toBe(calcStats(newSet('Agumon')).hp);
  });
});

describe('Gabumon in the team builder', () => {
  it('offers Gabumon, not MetalGarurumon, with its three Abilities', () => {
    const names = eligibleSpecies().map(s => s.name);
    expect(names).toContain('Gabumon');
    expect(names).not.toContain('MetalGarurumon');
    expect(gen7.species.get('MetalGarurumon')?.types).toEqual(['Ice', 'Steel']);
    expect(speciesAbilities('Gabumon')).toEqual(['Thick Fat', 'Snow Cloak', 'Flash Fire']);
  });

  it('learns its own list, and only it gets Fox Fire and Cocytus Pulse', async () => {
    const moves = (await learnableMoves('Gabumon')).map(m => m.name);
    for (const m of ['Fox Fire', 'Cocytus Pulse', 'Powder Snow', 'Steel Beam', 'Chilling Water', 'Ice Spinner', 'Snowscape', 'Zen Headbutt']) expect(moves).toContain(m);
    expect(moves).toHaveLength(new Set(WARP_DIGIMON[1].moves).size);
    expect(moves).not.toContain('Pepper Breath');
    expect((await learnableMoves('Agumon')).map(m => m.name)).not.toContain('Fox Fire');
    expect(allMoves().map(m => m.name)).not.toContain('Cocytus Pulse');
  });

  it('keeps Metalgaruruite for Gabumon, and shows MetalGarurumon when it holds it', () => {
    expect(canHoldItem('Gabumon', 'Metalgaruruite')).toBe(true);
    expect(canHoldItem('Agumon', 'Metalgaruruite')).toBe(false);
    expect(canHoldItem('Gabumon', 'Wargreyite')).toBe(false);
    expect(megaFormForSet({ species: 'Gabumon', item: 'Metalgaruruite' })).toBe('MetalGarurumon');
    expect(megaFormForSet({ species: 'Gabumon', item: 'Wargreyite' })).toBeNull();
  });
});

describe('megaFormForSet (builder BST and the "after Mega Evolution" section)', () => {
  it('finds the Mega or warp form for a matching stone, and nothing otherwise', () => {
    expect(megaFormForSet({ species: 'Agumon', item: 'Wargreyite' })).toBe('WarGreymon');
    expect(megaFormForSet({ species: 'Charizard', item: 'Charizardite X' })).toBe('Charizard-Mega-X');
    expect(megaFormForSet({ species: 'Charizard', item: 'Charizardite Y' })).toBe('Charizard-Mega-Y');
    expect(megaFormForSet({ species: 'Politoed', item: 'Politoedite' })).toBe('Politoed-Mega');
    expect(megaFormForSet({ species: 'Venusaur', item: 'Charizardite X' })).toBeNull();
    expect(megaFormForSet({ species: 'Agumon', item: 'Charcoal' })).toBeNull();
    expect(megaFormForSet({ species: 'Agumon', item: '' })).toBeNull();
  });
});

describe('Agumon\'s warp items change what it learns', () => {
  it('adds Dramon Breaker with Wargreyite, and learns BlackWarGreymon\'s list with Blackwargreyite', async () => {
    const own = (await learnableMoves('Agumon')).map(m => m.name);
    const war = (await learnableMoves('Agumon', 'Wargreyite')).map(m => m.name);
    const black = (await learnableMoves('Agumon', 'Blackwargreyite')).map(m => m.name);
    expect(own).not.toContain('Dramon Breaker');
    expect(war).toEqual([...own, 'Dramon Breaker'].sort((a, b) => a.localeCompare(b)));
    const list = WARP_DIGIMON.find(d => d.item === 'Blackwargreyite')!.moves;
    expect(black).toHaveLength(new Set(list).size);
    for (const m of ['Dark Gaia Force', 'Dramon Destroyer', 'Lash Out', 'Knock Off', 'Nasty Plot', 'Night Slash']) expect(black).toContain(m);
    for (const m of ['Gaia Force', 'Dramon Breaker', 'Dragon Breath', 'Fly']) expect(black).not.toContain(m);
    // Someone else's warp item leaves its own list.
    expect((await learnableMoves('Agumon', 'Metalgaruruite')).map(m => m.name)).toEqual(own);
    expect(allMoves().map(m => m.name)).not.toContain('Dark Gaia Force');
  });

  it('shows BlackWarGreymon when it holds Blackwargreyite', () => {
    expect(canHoldItem('Agumon', 'Blackwargreyite')).toBe(true);
    expect(canHoldItem('Gabumon', 'Blackwargreyite')).toBe(false);
    expect(megaFormForSet({ species: 'Agumon', item: 'Blackwargreyite' })).toBe('BlackWarGreymon');
    expect(eligibleSpecies().map(s => s.name)).not.toContain('BlackWarGreymon');
    expect(gen7.species.get('BlackWarGreymon')?.types).toEqual(['Dragon', 'Dark']);
  });
});

describe('Tentomon in the team builder', () => {
  it('offers Tentomon, not HerculesKabuterimon, with its own list and Electromorphosis after warping', async () => {
    const names = eligibleSpecies().map(s => s.name);
    expect(names).toContain('Tentomon');
    expect(names).not.toContain('HerculesKabuterimon');
    expect(speciesAbilities('Tentomon')).toEqual(['Static']);
    expect(megaFormForSet({ species: 'Tentomon', item: 'Herculeskabuterite' })).toBe('HerculesKabuterimon');
    expect(gen7.abilities.get('Electromorphosis')?.exists).toBe(true);
    const moves = (await learnableMoves('Tentomon')).map(m => m.name);
    expect(moves).toHaveLength(new Set(DIGIMON_BASE_MOVES.Tentomon).size);
    for (const m of ['Super Shocker', 'Giga Blaster', 'Hard Press', 'Pounce', 'Trailblaze', 'Skitter Smack', 'Quiver Dance', 'Signal Beam', 'Hidden Power']) expect(moves).toContain(m);
    // On request: no Tera Blast (the other Digimon keep theirs), and Hidden Power instead.
    expect(moves).not.toContain('Tera Blast');
    expect((await learnableMoves('Tentomon', 'Herculeskabuterite')).map(m => m.name)).toEqual(moves);
    expect(allMoves().map(m => m.name)).not.toContain('Giga Blaster');
  });
});

describe('Guilmon in the team builder', () => {
  it('offers Guilmon, not Gallantmon (Matrix Evolution only)', () => {
    const names = eligibleSpecies().map(s => s.name);
    expect(names).toContain('Guilmon');
    expect(names).not.toContain('Gallantmon');
    expect(speciesAbilities('Guilmon')).toEqual(['Strong Jaw']);
    expect(gen7.items.get('Gallantite')?.shortDesc).toMatch(/Matrix Evolve into Gallantmon/);
  });

  it('learns its own list, and Gallantmon\'s instead while holding Gallantite', async () => {
    const own = (await learnableMoves('Guilmon')).map(m => m.name);
    for (const m of ['Pyro Fang', 'Scratch', 'Outrage', 'Breaking Swipe', 'Temper Flare', 'Tera Blast', 'Trailblaze', 'Will-O-Wisp']) expect(own).toContain(m);
    expect(own).not.toContain('Lightning Joust');
    expect(own).toHaveLength(new Set(DIGIMON_BASE_MOVES.Guilmon).size);
    const gallant = (await learnableMoves('Guilmon', 'Gallantite')).map(m => m.name);
    for (const m of ['Lightning Joust', 'Shield of Just', 'Pyro Fang', "King's Shield", 'Supercell Slam', 'Body Press', 'Thunderbolt']) expect(gallant).toContain(m);
    expect(gallant).not.toContain('Flamethrower');
    expect(gallant).toHaveLength(new Set(WARP_DIGIMON.find(d => d.item === 'Gallantite')!.moves).size);
    expect(allMoves().map(m => m.name)).not.toContain('Shield of Just');
  });

  it('keeps Gallantite for Guilmon and shows Gallantmon, as a Matrix Evolution', () => {
    expect(canHoldItem('Guilmon', 'Gallantite')).toBe(true);
    expect(canHoldItem('Agumon', 'Gallantite')).toBe(false);
    expect(canHoldItem('Guilmon', 'Wargreyite')).toBe(false);
    expect(megaFormForSet({ species: 'Guilmon', item: 'Gallantite' })).toBe('Gallantmon');
    expect(statForms({ species: 'Guilmon', item: 'Gallantite' })).toMatchObject({ evolved: 'Gallantmon', change: 'Matrix Evolution', battlesAs: 'base' });
    expect(statForms({ species: 'Agumon', item: 'Blackwargreyite' }).change).toBe('Dark Warp Digivolution');
  });
});

describe('Terriermon in the team builder', () => {
  it('offers Terriermon, not MegaGargomon, and learns MegaGargomon\'s list while holding Megagargoite', async () => {
    const names = eligibleSpecies().map(s => s.name);
    expect(names).toContain('Terriermon');
    expect(names).not.toContain('MegaGargomon');
    expect(speciesAbilities('Terriermon')).toEqual(['Technician']);
    expect(gen7.abilities.get('Elevate')?.shortDesc).toMatch(/highest base stat/);
    const own = (await learnableMoves('Terriermon')).map(m => m.name);
    for (const m of ['Petit Twister', 'Boomburst', 'Vacuum Wave', 'Tera Blast', 'Work Up']) expect(own).toContain(m);
    expect(own).toHaveLength(new Set(DIGIMON_BASE_MOVES.Terriermon).size);
    const garg = (await learnableMoves('Terriermon', 'Megagargoite')).map(m => m.name);
    for (const m of ['Burst Shot', 'Giant Missile', 'Petit Twister', 'Zing Zap', 'Steel Roller', 'Supercell Slam']) expect(garg).toContain(m);
    expect(garg).not.toContain('Boomburst');
    expect(garg).toHaveLength(new Set(WARP_DIGIMON.find(d => d.item === 'Megagargoite')!.moves).size);
    expect(megaFormForSet({ species: 'Terriermon', item: 'Megagargoite' })).toBe('MegaGargomon');
    expect(statForms({ species: 'Terriermon', item: 'Megagargoite' }).change).toBe('Matrix Evolution');
    expect(canHoldItem('Guilmon', 'Megagargoite')).toBe(false);
  });
});
