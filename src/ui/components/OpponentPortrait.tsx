import { useEffect, useRef, useState } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { trainerArt } from '../sprites';
import { useAppSettings } from '../useAppSettings';
import { introPlayed, playPortraitIntro, prefersReducedMotion, type IntroCaption } from './portrait-intro';
import { TrainerSprite } from './TrainerSprite';

interface Props {
  /** The trainer, or both trainers in a Multi Battle (side by side). */
  trainers: Trainer[];
  intro?: string | null;
  /** Name and greeting under each trainer during the intro. */
  captions?: IntroCaption[];
}

/**
 * The big centred trainer picture on the opponent card: official artwork for
 * special trainers and Battle Legends that have it, otherwise the Showdown
 * sprite scaled up with crisp pixels. Battles keep the small sprite.
 * `intro` (special battles): a key for the full-screen entrance, played once
 * per key, with `captions` (names and greetings) under the trainers. Remount
 * per battle (key) so state doesn't carry over.
 */
export function OpponentPortrait({ trainers, intro = null, captions }: Props) {
  const { sprites } = useAppSettings();
  // Trainers whose artwork failed to load (they fall back to the sprite).
  const [artFailed, setArtFailed] = useState<number[]>([]);
  const artOf = (t: Trainer) => (sprites && !artFailed.includes(t.id) ? trainerArt(t) : null);
  // Decided once: the card's own fade-in is skipped while the intro plays.
  const [withIntro] = useState(() => !!intro && !introPlayed(intro) && !prefersReducedMotion());
  const box = useRef<HTMLDivElement>(null);
  const captionKey = JSON.stringify(captions ?? []);
  const artKey = trainers.map(t => artOf(t)?.url ?? t.id).join('|');

  useEffect(() => {
    const imgs = [...(box.current?.querySelectorAll('img') ?? [])];
    if (!withIntro || !intro || !imgs.length || introPlayed(intro)) return;
    const color = getComputedStyle(imgs[0]).getPropertyValue('--kind').trim();
    let stopped = false;
    let cancel = () => {};
    // Waits for every picture, so they enter together.
    const start = () => {
      if (stopped || !imgs.every(img => img.complete && img.naturalWidth)) return;
      stopped = true;
      cancel = playPortraitIntro(imgs, intro, color, JSON.parse(captionKey) as IntroCaption[]);
    };
    imgs.forEach(img => img.addEventListener('load', start));
    start();
    return () => { stopped = true; imgs.forEach(img => img.removeEventListener('load', start)); cancel(); };
  }, [withIntro, intro, artKey, captionKey]);

  return (
    <div ref={box} className={`opponent-portrait ${trainers.some(artOf) ? 'has-art' : 'has-sprite'}${trainers.length > 1 ? ' pair' : ''}${withIntro ? ' with-intro' : ''}`}>
      {trainers.map(trainer => {
        const art = artOf(trainer);
        return art ? (
          <img
            key={trainer.id}
            className="opponent-art"
            src={art.url}
            width={art.width}
            height={art.height}
            alt={`${trainer.class} ${trainer.name}`}
            draggable={false}
            onError={() => setArtFailed(f => [...f, trainer.id])}
          />
        ) : (
          <TrainerSprite key={trainer.id} trainer={trainer} size={80} className="opponent-sprite" />
        );
      })}
    </div>
  );
}
