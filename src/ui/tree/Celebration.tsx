import { useEffect, type CSSProperties } from 'react';
import type { Trainer } from '../../data/battle-tree';
import { PlayerSprite } from '../components/PlayerSprite';
import { TrainerSprite } from '../components/TrainerSprite';
import { Trophy } from '../components/Trophy';

const CONFETTI_COLORS = ['#f6c73c', '#ff5a7a', '#4ac0ff', '#7ad85a', '#b07aff', '#ffffff', '#ff9a3a'];
/** Deterministic pseudo-random in [0, 1). */
const rand = (i: number, salt: number) => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return s - Math.floor(s); };

/**
 * You won the All Star Duo Tournament: light rays, confetti, the trophy rising, and you and your partner jumping for
 * joy on the winners' podium. Closes with Continue (or Escape).
 */
export function Celebration({ you, partner, bp, onClose }: { you: string; partner: Trainer; bp: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="celebration" role="dialog" aria-modal="true" aria-label="Tournament champions">
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
        <Trophy size={120} className="celebration-trophy" />
        <h2 className="celebration-title">Tournament Champions!</h2>
        <div className="celebration-podium">
          <span className="celebration-hop"><PlayerSprite size={112} label={you} /></span>
          <span className="celebration-hop late"><TrainerSprite trainer={partner} size={112} /></span>
        </div>
        <p className="celebration-names">{you} &amp; {partner.name} won the All Star Duo Tournament</p>
        {bp > 0 && <p className="celebration-bp">+{bp} BP this tournament</p>}
        <button className="primary" onClick={onClose} autoFocus>Continue</button>
      </div>
    </div>
  );
}
