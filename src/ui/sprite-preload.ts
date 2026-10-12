// Loads every picture a battle can show as soon as it is started ("Battle!"), so the sprites are in the
// browser's cache by the time the Pokémon come out.
import type { PokemonSet } from '@pkmn/data';
import type { StartOptions } from '../client/battle-client';
import type { TeamInput } from '../engine/protocol';
import type { AppSettings } from '../settings/settings-store';
import { gen7 } from '../team/dex';
import { statForms } from '../team/sets';
import { hasBackSprite, itemSheetUrl, spriteCandidates, substituteSprite, type SpriteSide } from './sprites';

type SpriteSettings = Pick<AppSettings, 'sprites' | 'spriteStyle' | 'matchSideSprites'>;

const setsOf = (team: TeamInput | undefined): PokemonSet[] => (Array.isArray(team) ? team : []);

/** The species a set can show: its own, and the form its held item turns it into (Mega, warp or Paradox form). */
const formsOf = (set: PokemonSet): string[] => {
  const { base, evolved } = statForms(set);
  return evolved ? [base, evolved] : [base];
};

/**
 * The pictures a battle can show, each as the URLs the stage tries in order (as PokemonSprite does): every
 * Pokémon on both sides in each of its forms (your side from behind, the opponents' from the front, with
 * the same choices as the stage: sprite style, shiny, gender and "matching sprites on your side"), the
 * Substitute doll if anyone knows Substitute, and the item icons if anyone holds a Berry (its animation
 * shows it). The sim picks a gender when a set has none, so both are loaded (the same picture for most species).
 */
export function battleSpriteUrls(opts: StartOptions, settings: SpriteSettings): string[][] {
  if (!settings.sprites) return [];
  const sides: [SpriteSide, PokemonSet[]][] = [
    ['p1', [...setsOf(opts.player.team), ...(opts.partner?.team ?? [])]],
    ['p2', [opts.opponent, opts.opponent2].flatMap(o => (o?.kind === 'team' ? o.team : []))],
  ];
  const style = settings.spriteStyle;
  // Your side shows front sprites (flipped) if any of your Pokémon has no back sprite (BattleStage useFlipFront).
  const flipFront = settings.matchSideSprites && sides[0][1].flatMap(formsOf).some(name => !hasBackSprite(name, style));
  const lists = new Map<string, string[]>();
  const add = (urls: string[]) => { if (urls.length) lists.set(urls[0], urls); };
  for (const [side, sets] of sides) {
    for (const set of sets) {
      const genders: ('M' | 'F' | 'N')[] = set.gender === 'M' || set.gender === 'F' || set.gender === 'N' ? [set.gender] : ['M', 'F'];
      for (const name of formsOf(set)) {
        for (const gender of genders) {
          add(spriteCandidates(name, side, style, { shiny: !!set.shiny, gender, flipFront: side === 'p1' && flipFront }).map(c => c.url));
        }
      }
    }
    if (sets.some(s => s.moves.some(m => gen7.moves.get(m)?.id === 'substitute'))) add([substituteSprite(side).url]);
  }
  if (sides.some(([, sets]) => sets.some(s => gen7.items.get(s.item)?.isBerry))) add([itemSheetUrl()]);
  return [...lists.values()];
}

/** Images loading, kept referenced until they finish. */
const loading = new Set<HTMLImageElement>();

/** Loads the first URL of each list that works (moving on to the next one when an image fails, like the stage). */
export function preloadBattleSprites(opts: StartOptions, settings: SpriteSettings): void {
  if (typeof Image === 'undefined') return;
  const load = (urls: string[], i: number) => {
    if (i >= urls.length) return;
    const img = new Image();
    loading.add(img);
    img.onload = () => { loading.delete(img); };
    img.onerror = () => { loading.delete(img); load(urls, i + 1); };
    img.src = urls[i];
  };
  for (const urls of battleSpriteUrls(opts, settings)) load(urls, 0);
}
