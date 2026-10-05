// Sprite URLs. Images are loaded at runtime from Pokémon Showdown's sprite
// server (via @pkmn/img), never bundled; © Nintendo / Creatures / GAME FREAK.
import type { CSSProperties } from 'react';
import { Icons, Sprites } from '@pkmn/img';
import { CHAMPIONS_SPRITES } from '../data/champions';
import { SPRITE_ALIASES } from '../data/custom';
import { PARADOX_SPRITES } from '../data/custom/paradox';
import spriteData from '../data/battle-tree/trainer-sprites.json';
import artData from '../data/battle-tree/trainer-art.json';
import type { Trainer } from '../data/battle-tree';

export type SpriteSide = 'p1' | 'p2';

export interface SpriteInfo {
  url: string;
  w: number;
  h: number;
  pixelated: boolean;
  /** No back sprite exists: show the front sprite flipped horizontally. */
  mirrored?: boolean;
}

const SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites';

/**
 * Sprites for the Pokémon Champions formes and the Paradox forms, from the probed
 * availability tables (@pkmn/img predates them). Animated first, then static; with no back sprite,
 * the front one is mirrored. `preferStatic` picks the static image first.
 */
function championsSprite(species: string, side: SpriteSide, preferStatic: boolean): SpriteInfo | null {
  const a = CHAMPIONS_SPRITES[species] ?? PARADOX_SPRITES[species];
  if (!a) return null;
  const ani = (size: [number, number], back: boolean): SpriteInfo => ({ url: `${SPRITE_BASE}/${back ? 'ani-back' : 'ani'}/${a.id}.gif`, w: size[0], h: size[1], pixelated: false });
  const gen5 = (size: [number, number], back: boolean): SpriteInfo => ({ url: `${SPRITE_BASE}/${back ? 'gen5-back' : 'gen5'}/${a.id}.png`, w: size[0], h: size[1], pixelated: true });
  const front = [a.ani && ani(a.ani, false), a.gen5 && gen5(a.gen5, false)].filter((x): x is SpriteInfo => !!x);
  const back = [a.aniBack && ani(a.aniBack, true), a.gen5Back && gen5(a.gen5Back, true)].filter((x): x is SpriteInfo => !!x);
  const order = (list: SpriteInfo[]) => (preferStatic ? [...list].reverse() : list);
  if (side === 'p2') return order(front)[0] ?? null;
  const pick = order(back)[0];
  if (pick) return pick;
  const mirrored = order(front)[0];
  return mirrored ? { ...mirrored, mirrored: true } : null;
}

/** Animated 3D sprite (XY/SM style); `p1` = back sprite, `p2` = front sprite. */
export function animatedSprite(name: string, side: SpriteSide, opts: { shiny?: boolean; gender?: 'M' | 'F' | 'N' } = {}): SpriteInfo {
  const species = SPRITE_ALIASES[name] ?? name; // custom Megas use their base Pokémon's sprites
  const champions = championsSprite(species, side, false);
  if (champions) return champions;
  const s = Sprites.getPokemon(species, { gen: 'ani', side, shiny: opts.shiny, gender: opts.gender });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** Static Gen 5 sprite, used if the animated one fails to load. */
export function staticSprite(name: string, side: SpriteSide): SpriteInfo {
  const species = SPRITE_ALIASES[name] ?? name;
  const champions = championsSprite(species, side, true);
  if (champions) return champions;
  const s = Sprites.getPokemon(species, { gen: 'gen5', side });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** The Substitute doll (Gen 5 pixel art; `p1` = back view). */
export function substituteSprite(side: SpriteSide): SpriteInfo {
  const s = Sprites.getSubstitute({ gen: 'gen5', side });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** Small menu icon (sprite sheet) as inline styles. */
export function iconStyle(species: string): CSSProperties {
  const css = Icons.getPokemon(SPRITE_ALIASES[species] ?? species).css;
  // @pkmn/img returns CSS property names in kebab case.
  return Object.fromEntries(Object.entries(css).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v])) as CSSProperties;
}

const classes = spriteData.classes as Record<string, string>;
const named = spriteData.named as Record<string, string>;

/** Showdown trainer sprite id for a Battle Tree trainer (see trainer-sprites.json). */
export function trainerSpriteId(trainer: Trainer): string | null {
  if (trainer.kind !== 'regular') return named[trainer.name] ?? null;
  return classes[`${trainer.class}|${trainer.classGender}`] ?? classes[trainer.class] ?? null;
}

export function trainerSpriteUrl(trainer: Trainer): string | null {
  const id = trainerSpriteId(trainer);
  return id ? Sprites.getAvatar(id) : null;
}

export interface TrainerArt { url: string; width: number; height: number }
const art = artData.named as Record<string, TrainerArt>;

/**
 * Official artwork for the opponent card (special trainers and Battle Legends
 * only; see trainer-art.json). Loaded from PidgiWiki's image CDN.
 */
export function trainerArt(trainer: Trainer): TrainerArt | null {
  return trainer.kind === 'regular' ? null : art[trainer.name] ?? null;
}
