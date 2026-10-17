import { describe, expect, it } from 'vitest';
import type { PokemonSet } from '@pkmn/data';
import type { StartOptions } from '../client/battle-client';
import { battleSpriteUrls } from './sprite-preload';
import { itemIconStyle, itemSheetUrl, needsFrontSprites, spriteCandidates } from './sprites';

const mon = (species: string, item: string, moves: string[] = ['Protect'], extra: Partial<PokemonSet> = {}): PokemonSet => ({
  name: species, species, item, ability: '', moves, nature: 'Hardy', gender: '', evs: {} as PokemonSet['evs'], ivs: {} as PokemonSet['ivs'], level: 50, ...extra,
});
const start = (player: PokemonSet[], opponent: PokemonSet[]): StartOptions => ({
  format: 'singles', seedText: 'x', player: { name: 'P', team: player }, opponent: { kind: 'team', name: 'O', team: opponent }, ai: 'heuristic',
});
const SETTINGS: { sprites: boolean; spriteStyle: '2d' | '3d'; matchSideSprites: boolean } = { sprites: true, spriteStyle: '2d', matchSideSprites: false };
const firstUrls = (opts: StartOptions, settings = SETTINGS) => battleSpriteUrls(opts, settings).map(l => l[0]);

describe('sprite preloading when a battle starts', () => {
  it('loads both sides in every form their items give them, as the stage shows them', () => {
    const urls = firstUrls(start(
      [mon('Charizard', 'Charizardite X', ['Flamethrower'], { gender: 'M' }), mon('Agumon', 'Wargreyite', ['Pepper Breath'], { gender: 'M' })],
      [mon('Garchomp', 'Garchompite', ['Substitute'], { gender: 'F', shiny: true })],
    ));
    for (const [name, side] of [['Charizard', 'p1'], ['Charizard-Mega-X', 'p1'], ['Agumon', 'p1'], ['WarGreymon', 'p1']] as const) {
      expect(urls).toContain(spriteCandidates(name, side, '2d', { gender: 'M', shiny: false })[0].url);
    }
    expect(urls).toContain(spriteCandidates('Garchomp', 'p2', '2d', { gender: 'F', shiny: true })[0].url);
    expect(urls).toContain(spriteCandidates('Garchomp-Mega', 'p2', '2d', { gender: 'F', shiny: true })[0].url);
    // Substitute: the doll on the side that uses it; no Berry, no item icons.
    expect(urls.some(u => /substitute/.test(u))).toBe(true);
    expect(urls).not.toContain(itemSheetUrl());
  });

  it('keeps the fallbacks to try in order, and the item icons when someone holds a Berry', () => {
    const lists = battleSpriteUrls(start([mon('Snorlax', 'Sitrus Berry', ['Rest'], { gender: 'M' })], [mon('Garchomp', '')]), SETTINGS);
    expect(lists[0]).toEqual(spriteCandidates('Snorlax', 'p1', '2d', { gender: 'M', shiny: false }).map(c => c.url));
    expect(lists.flat()).toContain(itemSheetUrl());
  });

  it('follows the settings: 3D sprites, matching sprites on your side, or none at all', () => {
    const opts = start([mon('Agumon', 'Blackwargreyite', ['Pepper Breath'], { gender: 'M' })], [mon('Garchomp', '', ['Protect'], { gender: 'M' })]);
    expect(firstUrls(opts, { ...SETTINGS, spriteStyle: '3d' })).toContain(spriteCandidates('Garchomp', 'p2', '3d', { gender: 'M', shiny: false })[0].url);
    expect(battleSpriteUrls(opts, { ...SETTINGS, sprites: false })).toEqual([]);
  });
});

describe('item icons', () => {
  it('scales the icon from the sheet; none for an unknown item', () => {
    expect(itemIconStyle('Sitrus Berry', 48)).toMatchObject({ width: 48, height: 48 });
    expect(String(itemIconStyle('Sitrus Berry', 48)!.background)).toContain('/ 768px auto');
    expect(itemIconStyle('Not An Item')).toBeNull();
  });
});

describe('matching sprites on your side', () => {
  it('flips your side only while a Pokémon on the field there has no back sprite', () => {
    expect(needsFrontSprites(['Garchomp', 'Lucario-Mega-Z'], '2d')).toBe(true);
    expect(needsFrontSprites(['Garchomp', null], '2d')).toBe(false);
    expect(needsFrontSprites(['Garchomp', 'Snorlax'], '3d')).toBe(false);
  });

  it('preloads both pictures of your Pokémon when one of them may need its front sprite', () => {
    const urls = battleSpriteUrls(start(
      [mon('Garchomp', '', ['Protect'], { gender: 'M' }), mon('Lucario', 'Lucarionite Z', ['Protect'], { gender: 'M' })],
      [mon('Snorlax', '', ['Protect'], { gender: 'M' })],
    ), { ...SETTINGS, matchSideSprites: true }).map(l => l[0]);
    expect(urls).toContain(spriteCandidates('Garchomp', 'p1', '2d', { gender: 'M', shiny: false })[0].url);
    expect(urls).toContain(spriteCandidates('Garchomp', 'p1', '2d', { gender: 'M', shiny: false, flipFront: true })[0].url);
  });
});
