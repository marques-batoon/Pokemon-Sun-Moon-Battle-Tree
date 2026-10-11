import { describe, expect, it } from 'vitest';
import { CHAMPIONS_MEGAS, CHAMPIONS_SPRITES, NEW_BASE_SPECIES } from '../data/champions';
import { warpStageScale } from '../data/custom/digimon';
import { animatedSprite, animatedSpriteBoost, hasSkyBattleAnimation, isAnimatedSprite, staticSprite, WING_FLAPPERS } from './sprites';

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
    expect(animatedSprite('Gabumon', 'p2')).toMatchObject({ url: '/pokemon/gabumon.png' });
    expect(animatedSprite('MetalGarurumon', 'p1')).toMatchObject({ url: '/pokemon/metalgarurumon.png', mirrored: true });
  });

  it('draws each warp form at its own size on the stage', () => {
    expect(warpStageScale('WarGreymon')).toBe(1.5);
    expect(warpStageScale('MetalGarurumon')).toBe(1.2954);
    expect(warpStageScale('Agumon')).toBe(1);
    expect(warpStageScale('Charizard-Mega-X')).toBe(1);
  });
});

describe('larger animated sprites', () => {
  it('knows which Pokémon have Sky Battle (flying) animations', () => {
    for (const name of ['Charizard', 'Pidgeot', 'Gyarados', 'Talonflame', 'Togekiss', 'Skarmory', 'Gastly', 'Weezing', 'Rotom-Wash', 'Bronzong', 'Hydreigon', 'Landorus-Therian', 'Vivillon-Fancy']) {
      expect(hasSkyBattleAnimation(name), name).toBe(true);
    }
    // Their X & Y / ORAS Megas, even when the Mega loses the Flying type.
    for (const name of ['Charizard-Mega-X', 'Charizard-Mega-Y', 'Gyarados-Mega', 'Aerodactyl-Mega', 'Pidgeot-Mega', 'Altaria-Mega', 'Salamence-Mega']) {
      expect(hasSkyBattleAnimation(name), name).toBe(true);
    }
    // Kept out of Sky Battles, not fliers, or from after X & Y.
    for (const name of ['Pidgey', 'Doduo', 'Farfetch’d', 'Hawlucha', 'Gengar', 'Gengar-Mega', 'Pinsir-Mega', 'Shaymin-Sky', 'Garchomp', 'Toucannon', 'Celesteela', 'Vikavolt', 'Dragonite-Mega', 'Skarmory-Mega', 'Agumon']) {
      expect(hasSkyBattleAnimation(name), name).toBe(false);
    }
  });

  it('draws Alolan Exeggutor and Raging Bolt 50% larger, and the wing-flapping Sky Battle Pokémon 35%, only as animated 3D sprites', () => {
    for (const name of ['Exeggutor-Alola', 'Raging Bolt']) expect(animatedSpriteBoost(name), name).toBe(1.5);
    for (const name of ['Charizard', 'Charizard-Mega-Y', 'Pidgeot', 'Talonflame', 'Zubat', 'Yveltal']) expect(animatedSpriteBoost(name), name).toBe(1.35);
    for (const name of WING_FLAPPERS) {
      expect(hasSkyBattleAnimation(name), name).toBe(true);
      expect(animatedSpriteBoost(name), name).toBe(1.35);
    }
    // Sky Battle Pokémon that float, glide or hover without big wing flaps keep their size.
    for (const name of ['Gyarados', 'Gyarados-Mega', 'Salamence', 'Salamence-Mega', 'Pidgeot-Mega', 'Charizard-Mega-X', 'Rotom-Heat', 'Bronzong', 'Latios', 'Skarmory', 'Koffing', 'Togekiss', 'Vivillon']) {
      expect(animatedSpriteBoost(name), name).toBe(1);
    }
    for (const name of ['Exeggutor', 'Raikou', 'Garchomp', 'WarGreymon']) expect(animatedSpriteBoost(name), name).toBe(1);
    expect(isAnimatedSprite(animatedSprite('Charizard', 'p2'))).toBe(true);
    expect(isAnimatedSprite(animatedSprite('Charizard', 'p1'))).toBe(true);
    expect(isAnimatedSprite(animatedSprite('Raging Bolt', 'p2'))).toBe(true);
    expect(isAnimatedSprite(staticSprite('Charizard', 'p2'))).toBe(false);
    expect(isAnimatedSprite(animatedSprite('Agumon', 'p2'))).toBe(false);
  });
});
