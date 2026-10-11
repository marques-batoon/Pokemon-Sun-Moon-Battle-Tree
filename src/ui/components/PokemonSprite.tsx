import { useState } from 'react';
import { gen7 } from '../../team/dex';
import { animatedSprite, iconStyle, isAnimatedSprite, localSpriteUrl, staticSprite, type SpriteSide } from '../sprites';
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
  className?: string;
}

/**
 * Battle sprite: animated (Showdown "ani"), falling back to the static Gen 5
 * sprite and then to a type-colored placeholder if images fail or are turned off.
 * Remount (key) on species change to retry the animated sprite for a new forme.
 */
export function PokemonSprite({ species, side, gender, shiny, scale: baseScale = 1, animatedScale = 1, className = '' }: Props) {
  const { sprites } = useAppSettings();
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  if (!sprites || level === 2) return <SpritePlaceholder species={species} className={className} />;
  const info = level === 0 ? animatedSprite(species, side, { shiny, gender }) : staticSprite(species, side);
  const scale = baseScale * (isAnimatedSprite(info) ? animatedScale : 1);
  return (
    <img
      className={`poke-sprite ${className}`}
      src={info.url}
      alt={species}
      width={Math.round(info.w * scale)}
      height={Math.round(info.h * scale)}
      style={info.pixelated || info.mirrored ? { imageRendering: info.pixelated ? 'pixelated' : undefined, transform: info.mirrored ? 'scaleX(-1)' : undefined } : undefined}
      draggable={false}
      onError={() => setLevel(l => (l === 0 ? 1 : 2))}
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

/** Small menu icon; renders nothing when images are turned off. The Digimon use their sprite, shrunk. */
export function PokemonIcon({ species, className = '' }: { species: string; className?: string }) {
  const { sprites } = useAppSettings();
  if (!sprites) return null;
  const local = localSpriteUrl(species);
  if (local) return <img className={`poke-icon poke-icon-img ${className}`} src={local} alt="" width={40} height={30} draggable={false} aria-hidden="true" />;
  return <span className={`poke-icon ${className}`} style={iconStyle(species)} aria-hidden="true" />;
}
