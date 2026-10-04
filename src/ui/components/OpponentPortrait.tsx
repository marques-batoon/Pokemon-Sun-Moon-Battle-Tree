import { useEffect, useRef, useState } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { trainerArt } from '../sprites';
import { useAppSettings } from '../useAppSettings';
import { introPlayed, playPortraitIntro, prefersReducedMotion, type IntroCaption } from './portrait-intro';
import { TrainerSprite } from './TrainerSprite';

/**
 * The big centred trainer picture on the opponent card: official artwork for
 * special trainers and Battle Legends that have it, otherwise the Showdown
 * sprite scaled up with crisp pixels. Battles keep the small sprite.
 * `intro` (special battles): a key for the full-screen entrance, played once
 * per key, with `caption` (name and greeting) under the trainer. Remount per
 * battle (key) so state doesn't carry over.
 */
export function OpponentPortrait({ trainer, intro = null, caption }: { trainer: Trainer; intro?: string | null; caption?: IntroCaption }) {
  const { sprites } = useAppSettings();
  const [artFailed, setArtFailed] = useState(false);
  const art = sprites && !artFailed ? trainerArt(trainer) : null;
  // Decided once: the card's own fade-in is skipped while the intro plays.
  const [withIntro] = useState(() => !!intro && !introPlayed(intro) && !prefersReducedMotion());
  const box = useRef<HTMLDivElement>(null);
  const captionName = caption?.name;
  const captionQuote = caption?.quote ?? null;

  useEffect(() => {
    const img = box.current?.querySelector('img');
    if (!withIntro || !intro || !img || introPlayed(intro)) return;
    const color = getComputedStyle(img).getPropertyValue('--kind').trim();
    let stopped = false;
    let cancel = () => {};
    const text = captionName !== undefined ? { name: captionName, quote: captionQuote } : undefined;
    const start = () => { if (!stopped) cancel = playPortraitIntro(img, intro, color, text); };
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener('load', start, { once: true });
    return () => { stopped = true; img.removeEventListener('load', start); cancel(); };
  }, [withIntro, intro, art?.url, captionName, captionQuote]);

  return (
    <div ref={box} className={`opponent-portrait ${art ? 'has-art' : 'has-sprite'}${withIntro ? ' with-intro' : ''}`}>
      {art ? (
        <img
          className="opponent-art"
          src={art.url}
          width={art.width}
          height={art.height}
          alt={`${trainer.class} ${trainer.name}`}
          draggable={false}
          onError={() => setArtFailed(true)}
        />
      ) : (
        <TrainerSprite trainer={trainer} size={80} className="opponent-sprite" />
      )}
    </div>
  );
}
