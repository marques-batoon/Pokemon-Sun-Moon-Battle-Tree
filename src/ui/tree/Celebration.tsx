import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { PlayerSprite } from '../components/PlayerSprite';
import { TrainerSprite } from '../components/TrainerSprite';
import { Trophy } from '../components/Trophy';

const CONFETTI_COLORS = ['#f6c73c', '#ff5a7a', '#4ac0ff', '#7ad85a', '#b07aff', '#ffffff', '#ff9a3a'];
/** Deterministic pseudo-random in [0, 1). */
const rand = (i: number, salt: number) => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return s - Math.floor(s); };
/** How big the champions stand on the podium (CSS scales them down on narrow screens). */
const SPRITE = 200;

/** Who won: you and your partner, or a duo of special trainers (each with their victory line, if they have one). */
export type Champions =
  | { kind: 'player'; you: string; partner: Trainer }
  | { kind: 'duo'; trainers: [Trainer, Trainer]; quotes: [string | null, string | null] };

/**
 * The tournament's champions celebrate: light rays, confetti, the trophy rising, and the winning pair jumping for joy
 * on the podium (you and your partner, with the BP you earned; or the duo who won, saying their victory lines).
 * Closes with Continue (or Escape).
 */
export function Celebration({ champions, bp = 0, onClose }: { champions: Champions; bp?: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const you = champions.kind === 'player';
  const names = you ? `${champions.you} & ${champions.partner.name}` : champions.trainers.map(t => t.name).join(' & ');
  const podium: ReactNode[] = you
    ? [<PlayerSprite key="you" size={SPRITE} label={champions.you} />, <TrainerSprite key="partner" trainer={champions.partner} size={SPRITE} />]
    : champions.trainers.map(t => <TrainerSprite key={t.id} trainer={t} size={SPRITE} />);
  return (
    <div className={`celebration${you ? '' : ' others'}`} role="dialog" aria-modal="true" aria-label={`${names}: tournament champions`}>
      <div className="celebration-rays" aria-hidden />
      <div className="celebration-confetti" aria-hidden>
        {Array.from({ length: 70 }, (_, i) => (
          <span key={i} style={{
            '--x': `${rand(i, 1) * 100}%`, '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length], '--d': `${rand(i, 2) * 2.4}s`,
            '--t': `${2.6 + rand(i, 3) * 2.2}s`, '--r': `${rand(i, 4) * 720 - 360}deg`, '--drift': `${rand(i, 5) * 160 - 80}px`, '--w': `${6 + rand(i, 6) * 6}px`,
          } as CSSProperties} />
        ))}
      </div>
      <div className="celebration-body">
        <Trophy size={110} className="celebration-trophy" />
        <h2 className="celebration-title">Tournament Champions!</h2>
        <div className="celebration-podium">
          {podium.map((sprite, i) => (
            <div key={i} className={`celebration-champion${i ? ' late' : ''}`}>
              {/* A speech bubble (its tail is drawn with ::after, so the quote marks are written out). */}
              {!you && champions.quotes[i] && <p className="celebration-quote">“{champions.quotes[i]}”</p>}
              <span className="celebration-hop">{sprite}</span>
            </div>
          ))}
        </div>
        <p className="celebration-names">{you ? `${names} won the All Star Duo Tournament` : `${names} won the All Star Duo Tournament!`}</p>
        {you && bp > 0 && <p className="celebration-bp">+{bp} BP this tournament</p>}
        <button className="primary" onClick={onClose} autoFocus>Continue</button>
      </div>
    </div>
  );
}
