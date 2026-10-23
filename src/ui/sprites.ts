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
import type { SpriteStyle } from '../settings/settings-store';
import spriteData from '../data/battle-tree/trainer-sprites.json';
import artData from '../data/battle-tree/trainer-art.json';
import { QUOTE_PICKS, quotePick, trainerKey, type Trainer } from '../data/battle-tree';

export type SpriteSide = 'p1' | 'p2';

export interface SpriteInfo {
  url: string;
  w: number;
  h: number;
  pixelated: boolean;
  /** No back sprite exists: show the front sprite flipped horizontally. */
  mirrored?: boolean;
  /** Pixel art in a high-resolution file (the Digimon): sized like a pixel sprite, but scaled smoothly. */
  smooth?: boolean;
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

/**
 * A sprite shipped with the app (the Digimon): pixel art in a 96-px box like Pokémon's 2D sprites, so it is
 * sized and placed like one (in either sprite style). Your side uses its back sprite; without one, the front
 * one (facing left) flipped.
 */
function localSprite(species: string, side: SpriteSide): SpriteInfo | null {
  const s = DIGIMON_SPRITES[species];
  if (!s) return null;
  const base = { w: s.w, h: s.h, pixelated: true, smooth: true };
  if (side === 'p1' && s.back) return { ...base, url: `${import.meta.env.BASE_URL}${s.back}` };
  return { ...base, url: localSpriteUrl(species)!, ...(side === 'p1' ? { mirrored: true } : {}) };
}

/** URL of a sprite shipped with the app, or null if the species has none. */
export function localSpriteUrl(species: string): string | null {
  const s = DIGIMON_SPRITES[species];
  return s ? `${import.meta.env.BASE_URL}${s.file}` : null;
}

/** URL of a menu icon shipped with the app (the Digimon, cropped from their sprites), or null. */
export function localIconUrl(species: string): string | null {
  const s = DIGIMON_SPRITES[species];
  return s ? `${import.meta.env.BASE_URL}${s.icon}` : null;
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

/** Static 2D sprite (Black and White style, pixel art; newer Pokémon have fan-made ones in that style). */
export function staticSprite(name: string, side: SpriteSide, opts: { shiny?: boolean; gender?: 'M' | 'F' | 'N' } = {}): SpriteInfo {
  const species = SPRITE_ALIASES[name] ?? name;
  const local = localSprite(species, side);
  if (local) return local;
  const champions = championsSprite(species, side, true);
  if (champions) return champions;
  const s = Sprites.getPokemon(species, { gen: 'gen5', side, shiny: opts.shiny, gender: opts.gender });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** Official-style artwork (Showdown's Pokédex pictures): front only, so the back view is it flipped. */
export function artworkSprite(name: string, side: SpriteSide): SpriteInfo {
  const species = SPRITE_ALIASES[name] ?? name;
  const local = localSprite(species, side);
  if (local) return local;
  const a = CHAMPIONS_SPRITES[species] ?? PARADOX_SPRITES[species];
  const info: SpriteInfo = a
    ? { url: `${SPRITE_BASE}/dex/${a.id}.png`, w: 120, h: 120, pixelated: false }
    : (({ url, w, h }) => ({ url, w, h, pixelated: false }))(Sprites.getDexPokemon(species, { gen: 'dex' }));
  return side === 'p1' ? { ...info, mirrored: true } : info;
}

/**
 * The pictures to try for a Pokémon, in order, until one loads. 2D (the default): the pixel sprite,
 * then the artwork, then the 3D sprite. 3D: the animated sprite, then the pixel one. Every image URL
 * the app shows is built in this file (an offline version would only need to change these).
 */
export function spriteCandidates(name: string, side: SpriteSide, style: SpriteStyle, opts: { shiny?: boolean; gender?: 'M' | 'F' | 'N'; flipFront?: boolean } = {}): SpriteInfo[] {
  // Your side shown with front sprites, flipped (Settings: matching sprites on your side).
  if (side === 'p1' && opts.flipFront) return spriteCandidates(name, 'p2', style, { ...opts, flipFront: false }).map(c => ({ ...c, mirrored: !c.mirrored }));
  return style === '3d'
    ? [animatedSprite(name, side, opts), staticSprite(name, side, opts)]
    : [staticSprite(name, side, opts), artworkSprite(name, side), animatedSprite(name, side, opts)];
}

/** Whether the Pokémon has a real back sprite in this style (else its front sprite is shown flipped). */
export const hasBackSprite = (name: string, style: SpriteStyle) => !spriteCandidates(name, 'p1', style)[0]?.mirrored;
/**
 * "Matching sprites on your side": whether any of these Pokémon (on the field on your side; null: an empty spot)
 * has no back sprite in this style, so all of them show their front sprites, flipped.
 */
export const needsFrontSprites = (species: (string | null)[], style: SpriteStyle) => species.some(name => !!name && !hasBackSprite(name, style));

/** Whether the image is one of Showdown's animated 3D sprites (front or back, shiny or not). */
export const isAnimatedSprite = (info: SpriteInfo) => /\/sprites\/ani(-back)?(-shiny)?\//.test(info.url);

/** Extra size on the battle stage for some animated 3D sprites (they look small otherwise), picked by name on request. */
const BOOSTED: Record<string, number> = {
  // Tall or bulky sprites drawn too small.
  'Exeggutor-Alola': 1.5, 'Raging Bolt': 1.5,
};
/** Small size tweaks on request, on top of everything else (Megas: over the usual Mega size). */
const SIZE_TWEAKS: Record<string, number> = {
  'Latios-Mega': 1.05, 'Latias-Mega': 1.05, 'Charizard-Mega-X': 1.05, 'Charizard-Mega-Y': 1.05,
  'Metagross-Mega': 1.1, Noivern: 1.1,
};
/** The Sky Battle Pokémon below are enlarged a little less (35%, on request). */
const WING_FLAP_BOOST = 1.35;
/**
 * Sky Battle Pokémon whose animated sprites flap their wings through a wide sweep, so the image is
 * much bigger than the Pokémon in any one frame and it looks small on the stage. Picked from the
 * Showdown GIFs (2026-10-10): each frame's outline averaged 65% or less of the whole animation's
 * box, and the frames were checked by eye to be wing flaps (not floating, gas puffs or swaying tails).
 * Archeops and the bats (Zubat, Golbat, Crobat, Woobat, Swoobat, Noibat, Noivern) were then put back
 * to their usual size on request.
 */
export const WING_FLAPPERS = [
  'Aerodactyl', 'Aerodactyl-Mega', 'Articuno', 'Braviary', 'Charizard', 'Charizard-Mega-Y', 'Fearow', 'Fletchinder', 'Flygon',
  'Ho-Oh', 'Honchkrow', 'Lugia', 'Mandibuzz', 'Moltres', 'Mothim', 'Noctowl', 'Pelipper', 'Pidgeotto', 'Pidgeot', 'Staravia',
  'Staraptor', 'Swanna', 'Talonflame', 'Tornadus-Therian', 'Tranquill', 'Unfezant', 'Yveltal', 'Zapdos',
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
  const boost = BOOSTED[name] ?? (wingFlappers.has(name) && hasSkyBattleAnimation(name) ? WING_FLAP_BOOST : 1);
  return boost * (SIZE_TWEAKS[name] ?? 1);
}

/** The Substitute doll (Gen 5 pixel art; `p1` = back view). */
export function substituteSprite(side: SpriteSide): SpriteInfo {
  const s = Sprites.getSubstitute({ gen: 'gen5', side });
  return { url: s.url, w: s.w, h: s.h, pixelated: s.pixelated };
}

/** Showdown's item icon sheet: 24-px icons, 16 to a row. */
const ITEM_ICON = 24;
const ITEM_SHEET_WIDTH = 16 * ITEM_ICON;

/** URL of the item icon sheet (one image for every item icon). */
export const itemSheetUrl = (): string => Icons.getItem('Sitrus Berry').url;

/** A held item's icon drawn `size` px wide (pixel art, scaled from the sheet), as inline styles; null if it has none. */
export function itemIconStyle(item: string, size = ITEM_ICON): CSSProperties | null {
  const icon = Icons.getItem(item);
  if (!icon.left && !icon.top) return null;
  const k = size / ITEM_ICON;
  return {
    display: 'block', width: size, height: size, imageRendering: 'pixelated',
    background: `transparent url(${icon.url}) no-repeat ${icon.left * k}px ${icon.top * k}px / ${ITEM_SHEET_WIDTH * k}px auto`,
  };
}

/** Small menu icon (sprite sheet) as inline styles. */
export function iconStyle(species: string): CSSProperties {
  const css = Icons.getPokemon(SPRITE_ALIASES[species] ?? species).css;
  // @pkmn/img returns CSS property names in kebab case.
  return Object.fromEntries(Object.entries(css).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v])) as CSSProperties;
}

const classes = spriteData.classes as Record<string, string>;
const named = spriteData.named as Record<string, string>;

/** Showdown trainer sprite id for a Battle Tree trainer (see trainer-sprites.json; a custom trainer may name its own). */
export function trainerSpriteId(trainer: Trainer): string | null {
  if (trainer.spriteId) return trainer.spriteId;
  if (trainer.kind !== 'regular') return named[trainerKey(trainer)] ?? null;
  return classes[`${trainer.class}|${trainer.classGender}`] ?? classes[trainer.class] ?? null;
}

/** A trainer's usual sprite, or (`spriteId`) another Showdown trainer sprite of theirs: a Pokémon Masters one. */
export function trainerSpriteUrl(trainer: Trainer, spriteId?: string | null): string | null {
  if (spriteId) return Sprites.getAvatar(spriteId);
  // Custom trainers bring their own sprite, served from public/ with the app.
  if (trainer.sprite) return `${import.meta.env.BASE_URL}${trainer.sprite.replace(/^\//, '')}`;
  const id = trainerSpriteId(trainer);
  return id ? Sprites.getAvatar(id) : null;
}

const masters = spriteData.masters as Record<string, string[]>;
/** How often a special trainer who has Pokémon Masters sprites shows one in a battle (on request, 2026-10-22). */
export const MASTERS_CHANCE = 0.3;
/** A special trainer's Pokémon Masters sprites on Showdown (kyledove's; some have several outfits), if any. */
export const mastersSpriteIds = (trainer: Trainer): readonly string[] => (trainer.kind === 'special' ? masters[trainerKey(trainer)] ?? [] : []);

/**
 * The sprite each opposing trainer shows in a battle: for a special trainer with Pokémon Masters sprites, one of those
 * 30% of the time (each outfit equally likely), else null (their usual sprite and artwork). In a Multi Battle, if one
 * of them shows theirs, both do (if both have one). Decided by `key` (the battle's seed text or quote pick; a
 * tournament's own key for its duos), so a battle always looks the same; null: no Masters sprites.
 */
export function opponentSpriteIds(trainers: readonly Trainer[], key: string | number | null): (string | null)[] {
  if (key === null) return trainers.map(() => null);
  const roll = (t: Trainer, what: string) => quotePick(`${key}|masters|${what}|${trainerKey(t)}`);
  const shown = trainers.some(t => mastersSpriteIds(t).length && roll(t, 'chance') < MASTERS_CHANCE * QUOTE_PICKS);
  return trainers.map(t => {
    const ids = mastersSpriteIds(t);
    return shown && ids.length ? ids[roll(t, 'outfit') % ids.length] : null;
  });
}

/**
 * Sprites you can pick to stand for you (Settings; shown in the Duo Tournament): Battle Legends Marques (default) and
 * Thomas (the user's own sprites, served with the app), and the main-story protagonists from HeartGold and SoulSilver
 * on, from Pokémon Showdown's trainer sprites (on request, 2026-10-19). Brilliant Diamond and Shining Pearl's Lucas
 * and Dawn use their Diamond and Pearl sprites (the remakes have none); Let's Go is left out.
 */
export const PLAYER_SPRITES: readonly { id: string; name: string; game: string; file?: string }[] = [
  { id: 'marques', name: 'Battle Legend Marques', game: 'Battle Tree Simulator', file: 'trainers/marques.png' },
  { id: 'thomas', name: 'Battle Legend Thomas', game: 'Battle Tree Simulator', file: 'trainers/thomas.png' },
  { id: 'ethan', name: 'Ethan', game: 'HeartGold & SoulSilver' },
  { id: 'lyra', name: 'Lyra', game: 'HeartGold & SoulSilver' },
  { id: 'hilbert', name: 'Hilbert', game: 'Black & White' },
  { id: 'hilda', name: 'Hilda', game: 'Black & White' },
  { id: 'nate', name: 'Nate', game: 'Black 2 & White 2' },
  { id: 'rosa', name: 'Rosa', game: 'Black 2 & White 2' },
  { id: 'calem', name: 'Calem', game: 'X & Y' },
  { id: 'serena', name: 'Serena', game: 'X & Y' },
  { id: 'brendan', name: 'Brendan', game: 'Omega Ruby & Alpha Sapphire' },
  { id: 'may', name: 'May', game: 'Omega Ruby & Alpha Sapphire' },
  { id: 'elio', name: 'Elio', game: 'Sun & Moon' },
  { id: 'selene', name: 'Selene', game: 'Sun & Moon' },
  { id: 'elio-usum', name: 'Elio', game: 'Ultra Sun & Ultra Moon' },
  { id: 'selene-usum', name: 'Selene', game: 'Ultra Sun & Ultra Moon' },
  { id: 'victor', name: 'Victor', game: 'Sword & Shield' },
  { id: 'gloria', name: 'Gloria', game: 'Sword & Shield' },
  { id: 'lucas', name: 'Lucas', game: 'Brilliant Diamond & Shining Pearl' },
  { id: 'dawn', name: 'Dawn', game: 'Brilliant Diamond & Shining Pearl' },
  { id: 'rei', name: 'Rei', game: 'Legends: Arceus' },
  { id: 'akari', name: 'Akari', game: 'Legends: Arceus' },
  { id: 'florian-s', name: 'Florian', game: 'Scarlet & Violet' },
  { id: 'juliana-s', name: 'Juliana', game: 'Scarlet & Violet' },
  { id: 'urbain', name: 'Urbain', game: 'Legends: Z-A' },
  { id: 'taunie', name: 'Taunie', game: 'Legends: Z-A' },
];
export const DEFAULT_PLAYER_SPRITE = 'marques';

/** The picture for a player sprite id (an unknown id: the default). */
export function playerSpriteUrl(id: string): string {
  const entry = PLAYER_SPRITES.find(p => p.id === id) ?? PLAYER_SPRITES.find(p => p.id === DEFAULT_PLAYER_SPRITE)!;
  return entry.file ? `${import.meta.env.BASE_URL}${entry.file}` : Sprites.getAvatar(entry.id);
}

export interface TrainerArt { url: string; width: number; height: number }
const art = artData.named as Record<string, TrainerArt>;

/**
 * Official artwork for the opponent card (special trainers and Battle Legends
 * only; see trainer-art.json). Loaded from PidgiWiki's image CDN.
 */
export function trainerArt(trainer: Trainer): TrainerArt | null {
  return trainer.kind === 'regular' ? null : art[trainerKey(trainer)] ?? null;
}
