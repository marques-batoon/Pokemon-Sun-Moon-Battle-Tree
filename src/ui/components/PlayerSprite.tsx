import { useState, type CSSProperties } from 'react';
import { playerSpriteUrl } from '../sprites';
import { useAppSettings } from '../useAppSettings';

/** The sprite that stands for you (Settings: trainer sprite; or `id`), with an initial placeholder if missing or turned off. */
export function PlayerSprite({ id, size = 96, className = '', label = 'You' }: { id?: string; size?: number; className?: string; label?: string }) {
  const { sprites, trainerSprite } = useAppSettings();
  const url = playerSpriteUrl(id ?? trainerSprite);
  const [failed, setFailed] = useState<string | null>(null);
  if (!sprites || failed === url) {
    return <div className={`trainer-sprite placeholder ${className}`} style={{ '--size': `${size}px` } as CSSProperties} aria-label={label}>{label.slice(0, 2)}</div>;
  }
  return <img className={`trainer-sprite ${className}`} src={url} alt={label} width={size} height={size} draggable={false} onError={() => setFailed(url)} />;
}
