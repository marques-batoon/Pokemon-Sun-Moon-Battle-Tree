import { useState } from 'react';
import { gen7 } from '../../team/dex';
import { iconStyle, isAnimatedSprite, localIconUrl, spriteCandidates, type SpriteSide } from '../sprites';
import { typeColor } from '../types';
import { useAppSettings } from '../useAppSettings';

interface Props {
  species: string;
  side: SpriteSide;
  gender?: 'M' | 'F' | 'N';
  shiny?: boolean;
  /** Multiplier on the sprite's natural size. */
  scale?: number;
  /** Further multiplier, only when the animated 3D sprite is shown (not the static fallback). */
  animatedScale?: number;
  /** Further multiplier for pixel sprites (96 px images, so they match the 3D ones' size on the stage). */
  pixelScale?: number;
  /** Your side: show the front sprite, flipped, instead of the back one (so every Pokémon there matches). */
  flipFront?: boolean;
  className?: string;
}

/**
 * Battle sprite in the chosen style (Settings): 2D pixel sprites by default, falling back to
 * artwork, then the 3D sprite; or 3D animated sprites, falling back to the pixel ones. Then a
 * type-colored placeholder if images fail or are turned off. Remount (key) on species change to
 * start over for a new forme.
 */
export function PokemonSprite({ species, side, gender, shiny, scale: baseScale = 1, animatedScale = 1, pixelScale = 1, flipFront = false, className = '' }: Props) {
  const { sprites, spriteStyle } = useAppSettings();
  const [level, setLevel] = useState(0);
  const candidates = spriteCandidates(species, side, spriteStyle, { shiny, gender, flipFront });
  if (!sprites || level >= candidates.length) return <SpritePlaceholder species={species} className={className} />;
  const info = candidates[level];
  const scale = baseScale * (isAnimatedSprite(info) ? animatedScale : info.pixelated ? pixelScale : 1);
  return (
    <img
      key={info.url}
      className={`poke-sprite${info.pixelated ? ' pixel' : ''} ${className}`}
      src={info.url}
      alt={species}
      width={Math.round(info.w * scale)}
      height={Math.round(info.h * scale)}
      style={info.pixelated || info.mirrored ? { imageRendering: info.pixelated && !info.smooth ? 'pixelated' : undefined, transform: info.mirrored ? 'scaleX(-1)' : undefined } : undefined}
      draggable={false}
      onError={() => setLevel(l => l + 1)}
    />
  );
}

export function SpritePlaceholder({ species, className = '' }: { species: string; className?: string }) {
  const s = gen7.species.get(species);
  const [a, b] = s?.types ?? ['???'];
  const bg = typeColor(a);
  const bg2 = typeColor(b ?? a);
  return (
    <div className={`poke-sprite placeholder ${className}`} style={{ background: `linear-gradient(135deg, ${bg.bg}, ${bg2.bg})`, color: bg.fg }} aria-label={species}>
      {s?.name.slice(0, 2) ?? '?'}
    </div>
  );
}

/** Small menu icon; renders nothing when images are turned off. The Digimon use their own (cropped from their sprite). */
export function PokemonIcon({ species, className = '' }: { species: string; className?: string }) {
  const { sprites } = useAppSettings();
  if (!sprites) return null;
  const local = localIconUrl(species);
  if (local) return <img className={`poke-icon poke-icon-img ${className}`} src={local} alt="" width={40} height={30} draggable={false} aria-hidden="true" />;
  return <span className={`poke-icon ${className}`} style={iconStyle(species)} aria-hidden="true" />;
}
