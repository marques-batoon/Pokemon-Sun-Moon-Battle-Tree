// Loads every picture a battle can show as soon as it is started ("Battle!"), so the sprites are in the
// browser's cache by the time the Pokémon come out.
import type { PokemonSet } from '@pkmn/data';
import type { StartOptions } from '../client/battle-client';
import type { TeamInput } from '../engine/protocol';
import type { AppSettings } from '../settings/settings-store';
import { gen7 } from '../team/dex';
import { statForms } from '../team/sets';
import { ITEM_USE_IDS } from './battle/fx/catalog';
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
 * Substitute doll if anyone knows Substitute, and the item icons if anyone holds a Berry or an item used up
 * with its own animation (a herb, Red Card...: the animations show it). The sim picks a gender when a set has none, so both are loaded (the same picture for most species).
 * With "matching sprites on your side", your Pokémon's front pictures too when one of them has no back sprite.
 */
export function battleSpriteUrls(opts: StartOptions, settings: SpriteSettings): string[][] {
  if (!settings.sprites) return [];
  const sides: [SpriteSide, PokemonSet[]][] = [
    ['p1', [...setsOf(opts.player.team), ...(opts.partner?.team ?? [])]],
    ['p2', [opts.opponent, opts.opponent2].flatMap(o => (o?.kind === 'team' ? o.team : []))],
  ];
  const style = settings.spriteStyle;
  // Your side shows front sprites (flipped) while one of your Pokémon on the field has no back sprite (BattleStage
  // useFlipFront): then both pictures of your Pokémon may show during the battle.
  const mayFlip = settings.matchSideSprites && sides[0][1].flatMap(formsOf).some(name => !hasBackSprite(name, style));
  const lists = new Map<string, string[]>();
  const add = (urls: string[]) => { if (urls.length) lists.set(urls[0], urls); };
  for (const [side, sets] of sides) {
    for (const set of sets) {
      const genders: ('M' | 'F' | 'N')[] = set.gender === 'M' || set.gender === 'F' || set.gender === 'N' ? [set.gender] : ['M', 'F'];
      for (const name of formsOf(set)) {
        for (const gender of genders) {
          for (const flipFront of side === 'p1' && mayFlip ? [false, true] : [false]) {
            add(spriteCandidates(name, side, style, { shiny: !!set.shiny, gender, flipFront }).map(c => c.url));
          }
        }
      }
    }
    if (sets.some(s => s.moves.some(m => gen7.moves.get(m)?.id === 'substitute'))) add([substituteSprite(side).url]);
  }
  // Item icons: someone holds a Berry or an item used up with its own animation, or has Frisk (it shows what it finds).
  const frisk = sides.some(([, sets]) => sets.some(s => gen7.abilities.get(s.ability)?.id === 'frisk'));
  if (frisk || sides.some(([, sets]) => sets.some(s => { const item = gen7.items.get(s.item); return !!item && (item.isBerry || ITEM_USE_IDS.includes(item.id)); }))) add([itemSheetUrl()]);
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
