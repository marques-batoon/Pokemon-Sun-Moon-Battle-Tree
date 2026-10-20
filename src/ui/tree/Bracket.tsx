import type { CSSProperties, ReactNode } from 'react';
import { TRAINERS } from '../../data/battle-tree';
import { REVEAL_STAGGER_MS } from './bracket-timing';
import { playerMatch, ROUND_NAMES, TOURNAMENT_ROUNDS, TOURNAMENT_SIZE, type TournamentEntrant, type TournamentState } from '../../run/tournament';
import { PlayerSprite } from '../components/PlayerSprite';
import { TrainerSprite } from '../components/TrainerSprite';
import { Trophy } from '../components/Trophy';


interface Props {
  t: TournamentState;
  /** Your name as shown on the bracket ("You", or your trainer name). */
  you: string;
  /** The round whose results are being revealed now (they appear with the animation), if any. */
  animating: number | null;
}

/**
 * The whole bracket, left to right: 16 pairs, the quarterfinals, semifinals, final and the champion. Results show
 * for the rounds already revealed (t.shown) and, animated, for the round being revealed: each match in turn, the
 * winners glow and move on to the next column while the losers fade.
 */
export function Bracket({ t, you, animating }: Props) {
  const visible = (round: number) => round < t.shown || round === animating;
  const nextMatch = t.status === 'ready' && t.shown >= t.round ? playerMatch(t, t.round) : null;
  const entrantAt = (column: number, slot: number): number | null =>
    column === 0 ? slot : visible(column - 1) ? t.results[column - 1][slot] : null;

  const columns: ReactNode[] = [];
  for (let c = 0; c <= TOURNAMENT_ROUNDS; c++) {
    const champion = c === TOURNAMENT_ROUNDS;
    const slots = TOURNAMENT_SIZE >> c;
    const matches: ReactNode[] = [];
    for (let m = 0; m < (champion ? 1 : slots / 2); m++) {
      const cards = (champion ? [0] : [2 * m, 2 * m + 1]).map(slot => {
        const index = entrantAt(c, slot);
        // Arriving from the round being revealed: it slides in when its match is decided.
        const arriving = c > 0 && animating === c - 1;
        const winner = !champion && visible(c) ? t.results[c][m] : null;
        const revealing = !champion && animating === c;
        const state = index === null ? 'empty'
          : winner === null ? '' : winner === index ? (revealing ? 'reveal-win' : 'won') : (revealing ? 'reveal-lose' : 'out');
        const order = arriving ? slot : m;
        return (
          <Entrant
            key={slot}
            entrant={index === null ? null : t.entrants[index]}
            t={t}
            you={you}
            className={`${state}${arriving && index !== null ? ' reveal-in' : ''}${!champion && nextMatch === m && c === t.round ? ' next' : ''}${champion && index !== null ? ' champion' : ''}`}
            order={order}
          />
        );
      });
      matches.push(<div key={m} className={`b-match${champion ? ' b-final-slot' : ''}`}>{cards}</div>);
    }
    columns.push(
      <div key={c} className={`b-column${champion ? ' b-champion' : ''}`}>
        <h4 className="b-title">{champion ? 'Champions' : ROUND_NAMES[c]}</h4>
        <div className="b-matches">{matches}</div>
      </div>,
    );
  }
  return (
    <div className="bracket-scroll">
      <div className="bracket" style={{ '--stagger': `${REVEAL_STAGGER_MS}ms` } as CSSProperties}>{columns}</div>
    </div>
  );
}

function Entrant({ entrant, t, you, className, order }: { entrant: TournamentEntrant | null; t: TournamentState; you: string; className: string; order: number }) {
  if (!entrant) return <div className={`b-entrant ${className}`}><span className="b-names muted">—</span></div>;
  const partner = TRAINERS[t.partner.trainerId];
  const names = entrant.kind === 'player' ? `${you} & ${partner.name}` : entrant.trainers.map(p => TRAINERS[p.trainerId].name).join(' & ');
  return (
    <div className={`b-entrant${entrant.kind === 'player' ? ' you' : ''} ${className}`} style={{ '--m': order } as CSSProperties} title={names}>
      <span className="b-sprites">
        {entrant.kind === 'player'
          ? <><PlayerSprite size={30} label={you} /><TrainerSprite trainer={partner} size={30} /></>
          : entrant.trainers.map(p => <TrainerSprite key={p.trainerId} trainer={TRAINERS[p.trainerId]} size={30} />)}
      </span>
      <span className="b-names">{names}</span>
      {className.includes('champion') && <Trophy size={22} className="b-trophy" />}
    </div>
  );
}
