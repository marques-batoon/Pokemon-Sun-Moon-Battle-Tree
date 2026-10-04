import { describe, expect, it } from 'vitest';
import { classifyMove } from './move-class';

describe('classifyMove', () => {
  it.each([
    ['Swords Dance', 'powerup'],
    ['Dragon Dance', 'powerup'],
    ['Calm Mind', 'powerup'],
    ['Belly Drum', 'powerup'],
    ['Growl', 'debuff'],
    ['Screech', 'debuff'],
    ['Protect', 'protect'],
    ["King's Shield", 'protect'],
    ['Spiky Shield', 'protect'],
    ['Baneful Bunker', 'protect'],
    ['Recover', 'heal'],
    ['Roost', 'heal'],
    ['Rest', 'heal'],
    ['Roar', 'phaze'],
    ['Whirlwind', 'phaze'],
    ['Earthquake', 'attack'],
    ['Tectonic Rage', 'z'],
    ['Splintered Stormshards', 'z'],
  ])('%s → %s', (move, kind) => {
    expect(classifyMove(move).kind).toBe(kind);
  });

  it('records the status or volatile an inflicting move applies', () => {
    expect(classifyMove('Thunder Wave')).toMatchObject({ kind: 'inflict', condition: 'par' });
    expect(classifyMove('Will-O-Wisp')).toMatchObject({ kind: 'inflict', condition: 'brn' });
    expect(classifyMove('Toxic')).toMatchObject({ kind: 'inflict', condition: 'tox' });
    expect(classifyMove('Spore')).toMatchObject({ kind: 'inflict', condition: 'slp' });
    expect(classifyMove('Confuse Ray')).toMatchObject({ kind: 'inflict', condition: 'confusion' });
    expect(classifyMove('Leech Seed')).toMatchObject({ kind: 'inflict', condition: 'leechseed' });
  });

  it('sorts field moves by flavour', () => {
    expect(classifyMove('Stealth Rock')).toMatchObject({ kind: 'field', field: 'hazard' });
    expect(classifyMove('Reflect')).toMatchObject({ kind: 'field', field: 'screen' });
    expect(classifyMove('Rain Dance')).toMatchObject({ kind: 'field', field: 'weather' });
    expect(classifyMove('Electric Terrain')).toMatchObject({ kind: 'field', field: 'terrain' });
    expect(classifyMove('Trick Room')).toMatchObject({ kind: 'field', field: 'room' });
    expect(classifyMove('Tailwind')).toMatchObject({ kind: 'field', field: 'tailwind' });
  });

  it('keeps the type and physical/special split of attacks', () => {
    expect(classifyMove('Earthquake')).toMatchObject({ type: 'Ground', category: 'Physical' });
    expect(classifyMove('Earth Power')).toMatchObject({ type: 'Ground', category: 'Special' });
    expect(classifyMove('Shadow Ball')).toMatchObject({ type: 'Ghost', category: 'Special' });
  });

  it('falls back to "other" for unknown names', () => {
    expect(classifyMove('Not A Move').kind).toBe('other');
  });
});
