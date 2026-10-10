import { describe, expect, it } from 'vitest';
import { WARP_DIGIMON } from '../data/custom/digimon';
import { canHoldItem } from '../data/custom/paradox';
import { allMoves, eligibleSpecies, gen7, learnableMoves } from './dex';
import { calcStats, changeSpecies, megaFormForSet, newSet } from './sets';

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
    expect(moves).toHaveLength(new Set(WARP_DIGIMON[0].moves).size);
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
