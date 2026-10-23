import type { CSSProperties, ReactNode } from 'react';
import { duoTitle, playerDuoTitle, TRAINERS, type Trainer } from '../../data/battle-tree';
import { duoSpriteKey, matchCount, playerMatch, roundName, roundsOf, type TournamentEntrant, type TournamentState } from '../../run/tournament';
import { PlayerSprite } from '../components/PlayerSprite';
import { TrainerSprite } from '../components/TrainerSprite';
import { Trophy } from '../components/Trophy';
import { opponentSpriteIds } from '../sprites';
import { revealStagger } from './bracket-timing';

interface Props {
  t: TournamentState;
  /** Your name as shown on the bracket ("You", or your trainer name). */
  you: string;
  /** The round whose results are being revealed now (they appear with the animation), if any. */
  animating: number | null;
  /** Watch the replay of a decided match (round, match). */
  onReplay?: (round: number, match: number) => void;
}

/**
 * The whole bracket on two sides meeting in the middle: the top half of the draw on the left, the bottom half on the
 * right, each narrowing round by round to its finalist, and the final and the champions in the center. Results show
 * for the rounds already revealed (t.shown) and, animated, for the round being revealed: each match in turn, the
 * winners glow and move on while the losers fade. A decided match can be clicked to watch its replay.
 */
export function Bracket({ t, you, animating, onReplay }: Props) {
  const rounds = roundsOf(t);
  const visible = (round: number) => round < t.shown || round === animating;
  // Who stands in each slot of a round: the draw in round 1, then the previous round's winners once shown.
  const slotEntrant = (round: number, slot: number): number | null => (round === 0 ? slot : visible(round - 1) ? t.results[round - 1][slot] : null);
  const nextMatch = t.status === 'ready' && t.shown >= t.round ? playerMatch(t, t.round) : null;
  const replayable = (round: number, match: number) =>
    !!onReplay && round < t.shown && round !== animating && t.results[round][match] !== null && !!t.logs?.[round]?.[match];

  const card = (round: number, slot: number, extra = '') => {
    const index = slotEntrant(round, slot);
    const match = slot >> 1;
    const winner = visible(round) ? t.results[round][match] : null;
    const revealing = animating === round;
    // Arriving from the round being revealed: it slides in when its match is decided.
    const arriving = round > 0 && animating === round - 1 && index !== null;
    const state = index === null ? 'empty'
      : winner === null ? '' : winner === index ? (revealing ? 'reveal-win' : 'won') : (revealing ? 'reveal-lose' : 'out');
    const next = nextMatch === match && round === t.round && index !== null ? ' next' : '';
    return <Entrant key={slot} entrant={index === null ? null : t.entrants[index]} t={t} you={you} className={`${state}${arriving ? ' reveal-in' : ''}${next} ${extra}`} order={arriving ? slot : match} />;
  };

  const matchBox = (round: number, match: number, children: ReactNode, className = '') => {
    const canReplay = replayable(round, match);
    return (
      <div
        key={match}
        className={`b-match ${className}${canReplay ? ' replayable' : ''}`}
        onClick={canReplay ? () => onReplay!(round, match) : undefined}
        title={canReplay ? 'Watch the replay' : undefined}
      >
        {children}
        {canReplay && (
          <button type="button" className="b-replay" aria-label={`Watch the replay: ${roundName(round, rounds)}, match ${match + 1}`}
            onClick={e => { e.stopPropagation(); onReplay!(round, match); }}>▶</button>
        )}
      </div>
    );
  };

  // One side: rounds 1 to the semifinals, matches of the top half (left) or the bottom half (right).
  const side = (which: 'left' | 'right') => {
    const columns = Array.from({ length: rounds - 1 }, (_, round) => {
      const half = matchCount(round, rounds) / 2;
      const from = which === 'left' ? 0 : half;
      return (
        <div key={`${which}-${round}`} className={`b-column b-${which}`}>
          <h4 className="b-title">{roundName(round, rounds)}</h4>
          <div className="b-matches">
            {Array.from({ length: half }, (_, k) => matchBox(round, from + k, [card(round, 2 * (from + k)), card(round, 2 * (from + k) + 1)]))}
          </div>
        </div>
      );
    });
    return which === 'left' ? columns : columns.reverse();
  };

  const final = rounds - 1;
  const championIndex = visible(final) ? t.results[final][0] : null;
  const crowning = animating === final;
  return (
    <div className="bracket-scroll">
      <div
        className="bracket"
        style={{ '--stagger': `${revealStagger(animating ?? 0, rounds)}ms`, '--side-cols': rounds - 1, '--rows': t.entrants.length / 2 } as CSSProperties}
      >
        {side('left')}
        <div className="b-column b-center">
          <h4 className="b-title">{roundName(final, rounds)}</h4>
          <div className="b-matches">
            <div className="b-champion-slot">
              <Trophy size={48} className={`b-big-trophy${championIndex !== null ? ' won' : ''}`} />
              <span className="b-title">Champions</span>
              {championIndex === null
                ? <div className="b-entrant champion-empty"><span className="b-names muted">?</span></div>
                : <Entrant entrant={t.entrants[championIndex]} t={t} you={you} className={`champion${crowning ? ' reveal-in' : ''}`} order={0} />}
            </div>
            {matchBox(final, 0, [card(final, 0, 'finalist left'), <span key="vs" className="b-vs">VS</span>, card(final, 1, 'finalist right')], 'b-final')}
          </div>
        </div>
        {side('right')}
      </div>
    </div>
  );
}

function Entrant({ entrant, t, you, className, order }: { entrant: TournamentEntrant | null; t: TournamentState; you: string; className: string; order: number }) {
  if (!entrant) return <div className={`b-entrant ${className}`}><span className="b-names muted">—</span></div>;
  const partner = TRAINERS[t.partner.trainerId];
  const names = entrant.kind === 'player' ? `${you} & ${partner.name}` : entrant.trainers.map(p => TRAINERS[p.trainerId].name).join(' & ');
  const title = entrant.kind === 'player' ? playerDuoTitle(you, partner) : duoTitle(TRAINERS[entrant.trainers[0].trainerId], TRAINERS[entrant.trainers[1].trainerId]);
  const big = className.includes('champion') || className.includes('finalist');
  const size = className.includes('champion') ? 44 : big ? 34 : 24;
  return (
    <div className={`b-entrant${entrant.kind === 'player' ? ' you' : ''} ${className}`} style={{ '--m': order } as CSSProperties} title={`${title}: ${names}`}>
      <span className="b-sprites">
        {entrant.kind === 'player'
          ? <><PlayerSprite size={size} label={you} /><TrainerSprite trainer={partner} size={size} /></>
          : duoSprites(entrant.trainers.map(p => TRAINERS[p.trainerId]), t, size)}
      </span>
      <span className="b-names">{names}</span>
    </div>
  );
}

/** A duo's sprites on the bracket: their Pokémon Masters sprites when they have them this tournament (as in their matches). */
function duoSprites(trainers: Trainer[], t: TournamentState, size: number): ReactNode {
  const spriteIds = opponentSpriteIds(trainers, duoSpriteKey(t));
  return trainers.map((trainer, i) => <TrainerSprite key={trainer.id} trainer={trainer} size={size} spriteId={spriteIds[i]} />);
}
