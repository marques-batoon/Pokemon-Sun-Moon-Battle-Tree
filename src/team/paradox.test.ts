import { describe, expect, it } from 'vitest';
import { canHoldItem, paradoxFormForSet } from '../data/custom/paradox';
import { slotConflicts } from './checks';
import { allMoves, eligibleSpecies, gen7, learnableMoves } from './dex';
import { battleSpecies, calcStats, changeSpecies, newSet } from './sets';

describe('Paradox Evolution in the team builder', () => {
  it('knows the Paradox forms for display but never offers them as team members', () => {
    expect(gen7.species.get('Great Tusk')?.types).toEqual(['Ground', 'Fighting']);
    expect(gen7.abilities.get('Protosynthesis')?.shortDesc).toMatch(/1\.3x/);
    expect(eligibleSpecies().map(s => s.name)).not.toContain('Great Tusk');
    expect(eligibleSpecies().map(s => s.name)).toContain('Donphan');
  });

  it("offers each Paradoxorb only to Pokémon with that kind of form", () => {
    expect(canHoldItem('Donphan', 'Paradoxorb-A')).toBe(true);
    expect(canHoldItem('Donphan', 'Paradoxorb-F')).toBe(true);
    expect(canHoldItem('Delibird', 'Paradoxorb-A')).toBe(false);
    expect(canHoldItem('Pikachu', 'Paradoxorb-F')).toBe(false);
    expect(canHoldItem('Pikachu', 'Leftovers')).toBe(true);
    expect(paradoxFormForSet('Gardevoir', 'Paradoxorb-F')).toBe('Iron Valiant');
  });

  it("switches the move list to the Paradox form's moves", async () => {
    const plain = (await learnableMoves('Donphan')).map(m => m.name);
    const tusk = (await learnableMoves('Donphan', 'Paradoxorb-A')).map(m => m.name);
    expect(plain).not.toContain('Headlong Rush');
    expect(plain).toContain('Brutal Swing');
    expect(tusk).toContain('Headlong Rush');
    expect(tusk).not.toContain('Brutal Swing');
    // The new moves aren't for anyone else (Smeargle included).
    expect(allMoves().map(m => m.name)).not.toContain('Headlong Rush');
  });

  it("shows the Paradox form's stats", () => {
    const set = { ...newSet('Donphan'), item: 'Paradoxorb-A' };
    expect(battleSpecies(set)).toBe('Great Tusk');
    expect(calcStats(set).hp).toBeGreaterThan(calcStats(newSet('Donphan')).hp); // 115 base HP vs 90
  });

  it('drops a Paradoxorb that no longer fits after a species change, and exempts orbs from Item Clause', () => {
    expect(changeSpecies({ ...newSet('Donphan'), item: 'Paradoxorb-A' }, 'Snorlax').item).toBe('');
    expect(changeSpecies({ ...newSet('Donphan'), item: 'Paradoxorb-A' }, 'Salamence').item).toBe('Paradoxorb-A');
    const team = [{ ...newSet('Donphan'), item: 'Paradoxorb-A' }, { ...newSet('Salamence'), item: 'Paradoxorb-A' }];
    expect(slotConflicts(team).items.size).toBe(0);
  });
});
