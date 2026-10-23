import { useState, type CSSProperties } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { trainerSpriteUrl } from '../sprites';
import { useAppSettings } from '../useAppSettings';

/**
 * Trainer portrait (Showdown trainer sprite), with an initials placeholder if
 * missing or turned off. `size` is the default box; CSS may scale it (the
 * opponent card enlarges it with crisp pixels). `spriteId`: another sprite of
 * theirs for this battle (a Pokémon Masters one); the usual one if it fails to load.
 */
export function TrainerSprite({ trainer, size = 96, className = '', spriteId = null }: { trainer: Trainer; size?: number; className?: string; spriteId?: string | null }) {
  const { sprites } = useAppSettings();
  const [failed, setFailed] = useState<string[]>([]);
  const url = [trainerSpriteUrl(trainer, spriteId), trainerSpriteUrl(trainer)].find(u => u && !failed.includes(u)) ?? null;
  if (!sprites || !url) {
    const initials = trainer.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2);
    return <div className={`trainer-sprite placeholder ${className}`} style={{ '--size': `${size}px` } as CSSProperties} aria-label={`${trainer.class} ${trainer.name}`}>{initials}</div>;
  }
  return (
    <img
      className={`trainer-sprite ${className}`}
      src={url}
      alt={`${trainer.class} ${trainer.name}`}
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(f => [...f, url])}
    />
  );
}
