import { describe, expect, it } from 'vitest';
import { CHAMPIONS_MEGAS, CHAMPIONS_SPRITES, NEW_BASE_SPECIES } from '../data/champions';
import { animatedSprite, staticSprite } from './sprites';

describe('Pokémon Champions sprites', () => {
  it('has a front image for every Champions Mega and new Pokémon', () => {
    for (const name of [...CHAMPIONS_MEGAS.map(m => m.species), ...NEW_BASE_SPECIES, 'Floette-Eternal']) {
      expect(CHAMPIONS_SPRITES[name], name).toBeDefined();
      const a = CHAMPIONS_SPRITES[name];
      expect(a.ani ?? a.gen5, name).not.toBeNull();
    }
  });

  it('uses the animated sprite when there is one, then the static one', () => {
    expect(animatedSprite('Clefable-Mega', 'p2').url).toBe('https://play.pokemonshowdown.com/sprites/ani/clefable-mega.gif');
    expect(animatedSprite('Clefable-Mega', 'p1').url).toBe('https://play.pokemonshowdown.com/sprites/ani-back/clefable-mega.gif');
    expect(staticSprite('Clefable-Mega', 'p1').url).toBe('https://play.pokemonshowdown.com/sprites/gen5-back/clefable-mega.png');
    // Only a static front sprite exists for Mega Lucario Z.
    expect(animatedSprite('Lucario-Mega-Z', 'p2')).toMatchObject({ url: 'https://play.pokemonshowdown.com/sprites/gen5/lucario-megaz.png', pixelated: true });
  });

  it('mirrors the front sprite when no back sprite exists', () => {
    expect(animatedSprite('Lucario-Mega-Z', 'p1')).toMatchObject({ url: 'https://play.pokemonshowdown.com/sprites/gen5/lucario-megaz.png', mirrored: true });
    // Mega Raichu X only has an animated front sprite.
    expect(staticSprite('Raichu-Mega-X', 'p1')).toMatchObject({ url: 'https://play.pokemonshowdown.com/sprites/ani/raichu-megax.gif', mirrored: true });
    expect(animatedSprite('Chandelure-Mega', 'p1')).toMatchObject({ url: 'https://play.pokemonshowdown.com/sprites/gen5-back/chandelure-mega.png' });
  });

  it('leaves other Pokémon to @pkmn/img', () => {
    expect(animatedSprite('Garchomp', 'p2').url).toBe('https://play.pokemonshowdown.com/sprites/ani/garchomp.gif');
  });
});

describe('Digimon sprites', () => {
  it('uses the images shipped with the app, flipped for the back view', () => {
    expect(animatedSprite('Agumon', 'p2')).toMatchObject({ url: '/pokemon/agumon.png', pixelated: false });
    expect(animatedSprite('Agumon', 'p2').mirrored).toBeUndefined();
    expect(animatedSprite('Agumon', 'p1')).toMatchObject({ url: '/pokemon/agumon.png', mirrored: true });
    expect(staticSprite('WarGreymon', 'p1')).toMatchObject({ url: '/pokemon/wargreymon.png', mirrored: true });
  });
});
