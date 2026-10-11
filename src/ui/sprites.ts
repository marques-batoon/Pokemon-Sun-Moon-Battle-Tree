// Sprite URLs. Images are loaded at runtime from Pokémon Showdown's sprite
// server (via @pkmn/img), never bundled; © Nintendo / Creatures / GAME FREAK.
// The custom Digimon bring their own images (public/pokemon).
import type { CSSProperties } from 'react';
import { Icons, Sprites } from '@pkmn/img';
import { CHAMPIONS_SPRITES } from '../data/champions';
import { SPRITE_ALIASES } from '../data/custom';
import { DIGIMON_SPRITES } from '../data/custom/digimon';
import { PARADOX_SPRITES } from '../data/custom/paradox';
import { gen7 } from '../team/dex';
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

/** A sprite shipped with the app (the Digimon): the image faces left, so the back view is it flipped. */
function localSprite(species: string, side: SpriteSide): SpriteInfo | null {
  const s = DIGIMON_SPRITES[species];
  if (!s) return null;
  return { url: localSpriteUrl(species)!, w: s.w, h: s.h, pixelated: false, ...(side === 'p1' ? { mirrored: true } : {}) };
}

/** URL of a sprite shipped with the app, or null if the species has none. */
export function localSpriteUrl(species: string): string | null {
  const s = DIGIMON_SPRITES[species];
  return s ? `${import.meta.env.BASE_URL}${s.file}` : null;
}

/** Animated 3D sprite (XY/SM style); `p1` = back sprite, `p2` = front sprite. */
export function animatedSprite(name: string, side: SpriteSide, opts: { shiny?: boolean; gender?: 'M' | 'F' | 'N' } = {}): SpriteInfo {
  const species = SPRITE_ALIASES[name] ?? name; // custom Megas use their base Pokémon's sprites
  const local = localSprite(species, side);
  if (local) return local;
  const champions = championsSprite(species, side, false);
  if (champions) return champions;
  const s = Sprites.getPokemon(species, { gen: 'ani', side, shiny: opts.shiny, gender: opts.gender });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** Static Gen 5 sprite, used if the animated one fails to load. */
export function staticSprite(name: string, side: SpriteSide): SpriteInfo {
  const species = SPRITE_ALIASES[name] ?? name;
  const local = localSprite(species, side);
  if (local) return local;
  const champions = championsSprite(species, side, true);
  if (champions) return champions;
  const s = Sprites.getPokemon(species, { gen: 'gen5', side });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** Whether the image is one of Showdown's animated 3D sprites (front or back, shiny or not). */
export const isAnimatedSprite = (info: SpriteInfo) => /\/sprites\/ani(-back)?(-shiny)?\//.test(info.url);

/** Extra size on the battle stage for some animated 3D sprites (they look small otherwise). */
const ANIMATED_BOOST = 1.5;
/** Picked by name, on request: tall or bulky sprites drawn too small. */
const BOOSTED = new Set(['Exeggutor-Alola', 'Raging Bolt']);
/** The Sky Battle Pokémon below are enlarged a little less (35%, on request). */
const WING_FLAP_BOOST = 1.35;
/**
 * Sky Battle Pokémon whose animated sprites flap their wings through a wide sweep, so the image is
 * much bigger than the Pokémon in any one frame and it looks small on the stage. Picked from the
 * Showdown GIFs (2026-10-10): each frame's outline averaged 65% or less of the whole animation's
 * box, and the frames were checked by eye to be wing flaps (not floating, gas puffs or swaying tails).
 */
export const WING_FLAPPERS = [
  'Aerodactyl', 'Aerodactyl-Mega', 'Archeops', 'Articuno', 'Braviary', 'Charizard', 'Charizard-Mega-Y', 'Crobat', 'Fearow', 'Fletchinder',
  'Flygon', 'Golbat', 'Ho-Oh', 'Honchkrow', 'Lugia', 'Mandibuzz', 'Moltres', 'Mothim', 'Noctowl', 'Noibat', 'Noivern', 'Pelipper',
  'Pidgeotto', 'Pidgeot', 'Staravia', 'Staraptor', 'Swanna', 'Woobat', 'Swoobat', 'Talonflame', 'Tornadus-Therian', 'Tranquill',
  'Unfezant', 'Yveltal', 'Zapdos', 'Zubat',
];
const wingFlappers = new Set(WING_FLAPPERS);
/**
 * Flying-type or Levitate Pokémon that X & Y still kept out of Sky Battles (they don't fly in battle),
 * from the community lists (Nintendo never published one). Gengar lost Levitate in Gen 7 anyway.
 */
const SKY_BATTLE_BANNED = new Set([
  'Pidgey', 'Spearow', 'Farfetch’d', 'Doduo', 'Dodrio', 'Hoothoot', 'Natu', 'Murkrow', 'Delibird', 'Taillow', 'Starly', 'Chatot',
  'Shaymin', 'Pidove', 'Archen', 'Ducklett', 'Rufflet', 'Vullaby', 'Fletchling', 'Hawlucha', 'Gengar',
]);
/**
 * Pokémon with Sky Battle (flying) animations: the ones X & Y let into Sky Battles (Flying-type or
 * Levitate, from Gens 1-6, minus the exclusions above), and their X & Y / Omega Ruby & Alpha
 * Sapphire Mega Evolutions. Later Pokémon (Gen 7, Alolan forms, the Champions Megas) never had them.
 */
export function hasSkyBattleAnimation(name: string): boolean {
  const s = gen7.species.get(name);
  if (!s || s.gen > 6 || SKY_BATTLE_BANNED.has(s.baseSpecies)) return false;
  const flier = s.forme.startsWith('Mega') ? gen7.species.get(s.baseSpecies) : s;
  return !!flier && (flier.types.includes('Flying') || Object.values(flier.abilities).includes('Levitate'));
}
/** Size multiplier for a Pokémon's animated 3D sprite on the battle stage (1: usual size). */
export function animatedSpriteBoost(name: string): number {
  if (BOOSTED.has(name)) return ANIMATED_BOOST;
  return wingFlappers.has(name) && hasSkyBattleAnimation(name) ? WING_FLAP_BOOST : 1;
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
  // Custom trainers bring their own sprite, served from public/ with the app.
  if (trainer.sprite) return `${import.meta.env.BASE_URL}${trainer.sprite.replace(/^\//, '')}`;
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
