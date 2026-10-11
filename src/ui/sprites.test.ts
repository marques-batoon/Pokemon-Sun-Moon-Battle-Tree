import { describe, expect, it } from 'vitest';
import { CHAMPIONS_MEGAS, CHAMPIONS_SPRITES, NEW_BASE_SPECIES } from '../data/champions';
import { warpStageScale } from '../data/custom/digimon';
import { DEFAULT_APP_SETTINGS } from '../settings/settings-store';
import { animatedSprite, animatedSpriteBoost, artworkSprite, hasBackSprite, hasSkyBattleAnimation, isAnimatedSprite, spriteCandidates, staticSprite, WING_FLAPPERS } from './sprites';

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
    // Pixel art in a 96-px box, sized like a Pokémon's 2D sprite but scaled smoothly (high-resolution file).
    expect(animatedSprite('Agumon', 'p2')).toMatchObject({ url: '/pokemon/agumon.png', w: 96, h: 96, pixelated: true, smooth: true });
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
    // Mega Latios, Mega Latias and Mega Charizard X: 5% over the usual Mega size; the base formes keep theirs.
    for (const name of ['Latios-Mega', 'Latias-Mega', 'Charizard-Mega-X']) expect(animatedSpriteBoost(name), name).toBe(1.05);
    for (const name of ['Latios', 'Latias']) expect(animatedSpriteBoost(name), name).toBe(1);
    // Mega Charizard Y flaps its wings (35%), then 5% more. Noivern (back to its usual size with the bats) and Mega Metagross: 10%.
    expect(animatedSpriteBoost('Charizard-Mega-Y')).toBeCloseTo(1.35 * 1.05);
    expect(animatedSpriteBoost('Noivern')).toBeCloseTo(1.1);
    expect(animatedSpriteBoost('Metagross-Mega')).toBeCloseTo(1.1);
    expect(animatedSpriteBoost('Metagross')).toBe(1);
    for (const name of ['Charizard', 'Pidgeot', 'Talonflame', 'Yveltal']) expect(animatedSpriteBoost(name), name).toBe(1.35);
    for (const name of WING_FLAPPERS) {
      expect(hasSkyBattleAnimation(name), name).toBe(true);
      expect(animatedSpriteBoost(name), name).toBeCloseTo(name === 'Charizard-Mega-Y' ? 1.35 * 1.05 : 1.35);
    }
    // Sky Battle Pokémon that float, glide or hover without big wing flaps keep their size.
    for (const name of ['Archeops', 'Zubat', 'Golbat', 'Crobat', 'Woobat', 'Swoobat', 'Noibat', 'Gyarados', 'Gyarados-Mega', 'Salamence', 'Salamence-Mega', 'Pidgeot-Mega', 'Rotom-Heat', 'Bronzong', 'Latios', 'Skarmory', 'Koffing', 'Togekiss', 'Vivillon']) {
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

describe('sprite style', () => {
  it('defaults to 2D pixel sprites, then artwork, then 3D; 3D keeps the pixel sprite as its fallback', () => {
    expect(DEFAULT_APP_SETTINGS.spriteStyle).toBe('2d');
    const urls = (style: '2d' | '3d', side: 'p1' | 'p2' = 'p2') => spriteCandidates('Garchomp', side, style).map(s => s.url.replace('https://play.pokemonshowdown.com/sprites/', ''));
    expect(urls('2d')).toEqual(['gen5/garchomp.png', 'dex/garchomp.png', 'ani/garchomp.gif']);
    expect(urls('3d')).toEqual(['ani/garchomp.gif', 'gen5/garchomp.png']);
    expect(urls('2d', 'p1')).toEqual(['gen5-back/garchomp.png', 'dex/garchomp.png', 'ani-back/garchomp.gif']);
    // Artwork only exists facing forward: the back view is it flipped.
    expect(artworkSprite('Garchomp', 'p1').mirrored).toBe(true);
    expect(artworkSprite('Clefable-Mega', 'p2').url).toBe('https://play.pokemonshowdown.com/sprites/dex/clefable-mega.png');
    // Shiny pixel sprites.
    expect(spriteCandidates('Garchomp', 'p2', '2d', { shiny: true })[0].url).toContain('gen5-shiny/garchomp.png');
    // The Digimon bring their own picture, whatever the style.
    expect(spriteCandidates('Agumon', 'p2', '2d')[0].url).toBe('/pokemon/agumon.png');
  });

  it('only enlarges sprites (Sky Battle fliers, Alolan Exeggutor...) when the animated 3D one is shown', () => {
    expect(animatedSpriteBoost('Charizard')).toBe(1.35);
    expect(isAnimatedSprite(spriteCandidates('Charizard', 'p2', '2d')[0])).toBe(false);
    expect(isAnimatedSprite(spriteCandidates('Charizard', 'p2', '3d')[0])).toBe(true);
  });
});

describe('matching sprites on your side', () => {
  it('knows which Pokémon have no back sprite (the Digimon are shown from the front, flipped)', () => {
    expect(hasBackSprite('Garchomp', '2d')).toBe(true);
    expect(hasBackSprite('Garchomp', '3d')).toBe(true);
    expect(hasBackSprite('Agumon', '2d')).toBe(false);
    expect(hasBackSprite('WarGreymon', '3d')).toBe(false);
  });

  it('shows your side\'s Pokémon as their front sprites, flipped, when asked', () => {
    const [front] = spriteCandidates('Garchomp', 'p1', '2d', { flipFront: true });
    expect(front.url).toBe('https://play.pokemonshowdown.com/sprites/gen5/garchomp.png');
    expect(front.mirrored).toBe(true);
    expect(spriteCandidates('Garchomp', 'p1', '3d', { flipFront: true })[0].url).toBe('https://play.pokemonshowdown.com/sprites/ani/garchomp.gif');
    // Already front-only: still flipped once (it faces the opponent).
    expect(spriteCandidates('Agumon', 'p1', '2d', { flipFront: true })[0]).toMatchObject({ url: '/pokemon/agumon.png', mirrored: true });
    // The opponent's side is never affected.
    expect(spriteCandidates('Garchomp', 'p2', '2d', { flipFront: true })[0].mirrored).toBeFalsy();
  });
});
