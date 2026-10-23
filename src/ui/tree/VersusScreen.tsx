import { useEffect, type ReactNode } from 'react';
import { duoTitle, playerDuoTitle, TRAINERS } from '../../data/battle-tree';
import { duoSpriteKey, type TournamentEntrant, type TournamentState } from '../../run/tournament';
import { PlayerSprite } from '../components/PlayerSprite';
import { TrainerSprite } from '../components/TrainerSprite';
import { opponentSpriteIds } from '../sprites';

const SPRITE = 160;

interface Side { title: string; names: string; sprites: ReactNode }

/** One team as it stands on the versus screen: its title, its two names and its two sprites (a duo's for the tournament). */
function side(e: TournamentEntrant, t: TournamentState, you: string): Side {
  if (e.kind === 'player') {
    const partner = TRAINERS[t.partner.trainerId];
    return {
      title: playerDuoTitle(you, partner), names: `${you} & ${partner.name}`,
      sprites: <><PlayerSprite size={SPRITE} label={you} className="versus-sprite" /><TrainerSprite trainer={partner} size={SPRITE} className="versus-sprite" /></>,
    };
  }
  const trainers = e.trainers.map(p => TRAINERS[p.trainerId]);
  const spriteIds = opponentSpriteIds(trainers, duoSpriteKey(t));
  return {
    title: duoTitle(trainers[0], trainers[1]), names: trainers.map(x => x.name).join(' & '),
    sprites: trainers.map((x, i) => <TrainerSprite key={x.id} trainer={x} size={SPRITE} spriteId={spriteIds[i]} className="versus-sprite" />),
  };
}

interface Props {
  t: TournamentState;
  /** The two entrants of the match (indices); your team, if it's one of them, stands on the left. */
  pair: [number, number];
  you: string;
  /** Above the teams: the round. */
  detail: string;
  /** What a click does: "Battle!" or "Watch the replay". */
  action: string;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * The two teams face off before a tournament match (on request, 2026-10-23): yours (or the first duo) slides in from
 * the left and the other from the right, each with its title and sprites, and "VS" crashes down between them. A click,
 * tap, Enter or Space goes on to the battle (or its replay); Escape or Back returns to the bracket.
 */
export function VersusScreen({ t, pair, you, detail, action, onContinue, onBack }: Props) {
  const [a, b] = pair.map(i => t.entrants[i]);
  const [left, right] = (b.kind === 'player' ? [b, a] : [a, b]).map(e => side(e, t, you));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      else if (e.key === 'Enter' || e.key === ' ') onContinue();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onContinue, onBack]);

  return (
    <div className="versus" role="dialog" aria-modal="true" aria-label={`${detail}: ${left.title} versus ${right.title}. ${action}`} onClick={onContinue}>
      <div className="versus-backdrop" aria-hidden />
      <p className="versus-detail">{detail}</p>
      <div className="versus-teams">
        {[left, right].map((s, i) => (
          <div key={i} className={`versus-side ${i ? 'right' : 'left'}`}>
            <div className="versus-sprites">{s.sprites}</div>
            <strong className="versus-title">{s.title}</strong>
            <span className="versus-names">{s.names}</span>
          </div>
        ))}
        <span className="versus-vs" aria-hidden>VS</span>
      </div>
      <div className="versus-actions">
        <button className="primary" autoFocus onClick={e => { e.stopPropagation(); onContinue(); }}>{action}</button>
        <button onClick={e => { e.stopPropagation(); onBack(); }}>Back to the bracket</button>
      </div>
    </div>
  );
}
