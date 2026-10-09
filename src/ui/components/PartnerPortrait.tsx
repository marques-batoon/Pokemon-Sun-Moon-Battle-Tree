import { useState, type CSSProperties } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { trainerArt } from '../sprites';
import { useAppSettings } from '../useAppSettings';
import { TrainerSprite } from './TrainerSprite';

/**
 * Square trainer picture for choosing a Multi partner: official artwork cropped
 * to its top square (head and shoulders), or the Showdown sprite (already
 * square) scaled up with crisp pixels.
 */
export function PartnerPortrait({ trainer, size = 96 }: { trainer: Trainer; size?: number }) {
  const { sprites } = useAppSettings();
  const [artFailed, setArtFailed] = useState(false);
  const art = sprites && !artFailed ? trainerArt(trainer) : null;
  return (
    <div className={`partner-portrait ${art ? 'has-art' : 'has-sprite'}`} style={{ '--size': `${size}px` } as CSSProperties}>
      {art ? (
        <img src={art.url} alt={`${trainer.class} ${trainer.name}`} draggable={false} onError={() => setArtFailed(true)} />
      ) : (
        <TrainerSprite trainer={trainer} size={size} />
      )}
    </div>
  );
}
