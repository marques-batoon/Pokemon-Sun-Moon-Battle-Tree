import { useEffect, useState, type CSSProperties } from 'react';
import { TRAINERS, trainerQuotes, type Trainer } from '../../data/battle-tree';
import { battleName } from '../../online/trainer-name';
import {
  champion, matchKey, nextOpponent, roundName, roundPhrase, roundsOf, tournamentBp, tournamentDecided, type TournamentState,
} from '../../run/tournament';
import type { TournamentController } from '../../run/tournament-controller';
import { bpBalance } from '../../run/types';
import { ANIMATION_SPEED_FACTOR } from '../../settings/settings-store';
import { OpponentCard } from '../components/OpponentCard';
import { PokemonIcon } from '../components/PokemonSprite';
import { Trophy } from '../components/Trophy';
import { useAppSettings } from '../useAppSettings';
import { Bracket } from './Bracket';
import { revealDuration } from './bracket-timing';
import { Celebration } from './Celebration';
import { PartnerCard } from './PartnerCard';
import { useTournament } from './hooks';

interface Props {
  controller: TournamentController;
  onBattle: () => void;
  onLeave: () => void;
  onNew: () => void;
  /** Watch the replay of a decided match. */
  onReplay: (round: number, match: number) => void;
}

const complete = (t: TournamentState, round: number) => t.results[round].every(r => r !== null);

/**
 * The tournament between matches: the whole bracket, your next opponents, Battle! / Retire / Save & quit. After each
 * of your matches the rest of the round is fought (by the engine) and revealed on the bracket; knocked out, the
 * remaining rounds play out one after another until the champions are crowned. Win it, and you celebrate.
 */
export function TournamentScreen({ controller, onBattle, onLeave, onNew, onReplay }: Props) {
  const snap = useTournament(controller);
  const t = snap.tournament;
  const { animationSpeed, trainerName, showDebugTools } = useAppSettings();
  const speed = ANIMATION_SPEED_FACTOR[animationSpeed] ?? 1;
  const you = trainerName ? battleName(trainerName) : 'You';
  const [celebrated, setCelebrated] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const out = t?.status === 'lost' || t?.status === 'retired';
  const rounds = t ? roundsOf(t) : 0;
  // The first round still missing results that the bracket needs now: before your current round while you're in;
  // knocked out, the next round to play out.
  const limit = !t ? -1 : out ? Math.max(t.round, t.shown) : t.status === 'won' ? rounds - 1 : t.round - 1;
  let needRound: number | null = null;
  if (t) for (let r = 0; r <= Math.min(limit, rounds - 1); r++) if (!complete(t, r)) { needRound = r; break; }
  const simulating = needRound !== null && snap.simulating.includes(needRound);
  const failed = !!snap.error;
  const playingOut = out && needRound !== null && needRound > (t?.round ?? 0);

  useEffect(() => {
    if (needRound === null || simulating || failed) return;
    // Playing out after you're knocked out: a short pause between rounds.
    const timer = setTimeout(() => void controller.resolveRound(needRound), playingOut ? 700 * speed : 0);
    return () => clearTimeout(timer);
  }, [controller, needRound, simulating, failed, playingOut, speed]);

  // A round whose results are all in but not shown yet is revealed on the bracket (animated), then marked shown.
  const revealing = t && t.shown < rounds && complete(t, t.shown) ? t.shown : null;
  useEffect(() => {
    if (revealing === null) return;
    const timer = setTimeout(() => controller.markShown(revealing + 1), revealDuration(revealing, rounds) * speed);
    return () => clearTimeout(timer);
  }, [controller, revealing, rounds, speed]);

  if (!t) return <section className="panel"><p>No tournament in progress.</p><button onClick={onLeave}>Back</button></section>;

  const partner = TRAINERS[t.partner.trainerId];
  const foes = nextOpponent(t);
  const finished = tournamentDecided(t) && t.shown >= rounds;
  const winnerIndex = champion(t);
  const winner = winnerIndex === null ? null : t.entrants[winnerIndex];
  const interrupted = controller.isInterrupted();
  const canBattle = t.status === 'ready' && t.shown >= t.round && !!foes && !snap.inBattle;
  const brought = t.team.bring.map(i => t.team.sets[i]);

  const skipToEnd = async () => {
    setSkipping(true);
    try {
      for (let r = controller.tournament?.shown ?? 0; r < rounds; r++) await controller.resolveRound(r);
      controller.markShown(rounds);
    } finally {
      setSkipping(false);
    }
  };

  return (
    <section className="panel run-screen tournament" style={{ '--spd': speed } as CSSProperties}>
      <header className="run-head">
        <h2>All Star Duo Tournament <span className="tag">unrated</span>{t.debug && <span className="tag">practice</span>}</h2>
        <dl className="run-stats">
          <div><dt>{t.status === 'won' ? 'Result' : out ? 'Out in' : 'Next'}</dt><dd>{t.status === 'won' ? 'Champions' : roundName(t.round, rounds)}</dd></div>
          <div><dt>BP this tournament</dt><dd>{t.bp}</dd></div>
          <div><dt>BP to spend</dt><dd>{bpBalance(snap.profile)}</dd></div>
        </dl>
      </header>

      <Bracket t={t} you={you} animating={speed > 0 ? revealing : null} onReplay={onReplay} />
      {t.logs && t.shown > 0 && <p className="muted small bracket-hint">Click a finished match to watch its replay.</p>}

      <div className="tournament-status" role="status">
        {simulating && <p className="muted small">{playingOut ? `Playing out ${roundPhrase(needRound!, rounds)}…` : 'Deciding the other matches…'}</p>}
        {revealing !== null && speed > 0 && (
          <p className="muted small">
            {roundName(revealing, rounds)} results… <button className="link-button small" onClick={() => controller.markShown(revealing + 1)}>Skip</button>
          </p>
        )}
        {snap.error && (
          <p className="problems">{snap.error} <button className="link-button" onClick={() => { if (needRound !== null) void controller.resolveRound(needRound); }}>Try again</button></p>
        )}
        {out && !finished && (
          <p className="small">
            {t.status === 'retired' ? `You retired in ${roundPhrase(t.round, rounds)}` : `You went out in ${roundPhrase(t.round, rounds)}`}: watch the rest of the tournament play out.{' '}
            <button className="link-button small" disabled={skipping} onClick={() => void skipToEnd()}>Skip to the winner</button>
          </p>
        )}
        {finished && winner && winner.kind === 'duo' && (
          <div className="tournament-winner">
            <Trophy size={40} />
            <p><strong>{winner.trainers.map(p => TRAINERS[p.trainerId].name).join(' & ')}</strong> won the All Star Duo Tournament!</p>
          </div>
        )}
        {finished && t.status === 'won' && (
          <div className="tournament-winner you-won">
            <Trophy size={40} />
            <p><strong>You and {partner.name} won the All Star Duo Tournament!</strong>{t.bp > 0 ? ` +${t.bp} BP.` : ''}</p>
          </div>
        )}
      </div>

      {interrupted ? (
        <div className="panel inset">
          <h3>Match interrupted</h3>
          <p className="small">Your match in {roundPhrase(t.round, rounds)} didn't finish (the app was closed or reloaded). Count it as a loss, as the Battle Tree does, or play it again from the start.</p>
          <div className="row-actions">
            <button className="danger" onClick={() => controller.forfeitInterrupted()}>Count as a loss</button>
            <button className="primary" onClick={() => controller.restartInterrupted()}>Replay the match</button>
          </div>
        </div>
      ) : t.status === 'ready' && (
        <>
          {foes && t.shown >= t.round && (
            <OpponentCard
              trainers={foes.trainers.map(p => TRAINERS[p.trainerId])}
              greetings={foes.trainers.map(p => trainerQuotes(TRAINERS[p.trainerId], matchKey(t), foes.trainers.map(o => TRAINERS[o.trainerId]))?.greeting ?? null)}
              detail={`${roundName(t.round, rounds)} · win for ${t.debug ? 0 : tournamentBp(t.round, rounds)} BP${t.debug ? ' (practice)' : ''}`}
              battleKey={`${t.id}:${t.round}`}
            />
          )}
          <div className="row-actions">
            <button className="danger" disabled={!foes} onClick={() => { if (confirm('Retire from the tournament? The duo you were to face goes through.')) controller.retire(); }}>Retire</button>
            <span className="spacer" />
            <button onClick={onLeave}>Save &amp; quit</button>
            <button className="primary" disabled={!canBattle} onClick={onBattle}>Battle!</button>
          </div>
          <div className="run-partner">
            <span className="muted small">Your partner</span>
            <PartnerCard name={t.partner.name} team={t.partner.setIds} />
          </div>
          <div className="brought">
            <span className="muted small">Bringing from {t.team.name}:</span>
            <ol className="brought-list">{brought.map((s, i) => <li key={i}><PokemonIcon species={s.species} />{s.name !== s.species ? `${s.name} (${s.species})` : s.species}{s.item ? ` @ ${s.item}` : ''}</li>)}</ol>
          </div>
        </>
      )}

      {(t.status === 'won' || out) && (
        <div className="row-actions">
          <button onClick={() => { controller.dismiss(); onLeave(); }}>Back to the Battle Tree</button>
          <button className="primary" onClick={() => { controller.dismiss(); onNew(); }}>New tournament</button>
        </div>
      )}

      {t.history.length > 0 && (
        <details className="history">
          <summary>Your matches ({t.history.length})</summary>
          <ol>
            {t.history.map(h => (
              <li key={h.battle}>
                {roundName(h.battle - 1, rounds)}: {h.opponent} — <span className={h.result === 'win' ? 'win-text' : 'error-text'}>{h.result === 'win' ? `won (+${h.bp} BP)` : 'lost'}</span>
                <span className="muted small"> · {h.turns} turns{showDebugTools && <> · seed <code>{h.seedText}</code></>}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {finished && !celebrated && winner && (
        <Celebration
          champions={winner.kind === 'player' ? { kind: 'player', you, partner } : {
            kind: 'duo',
            trainers: winner.trainers.map(p => TRAINERS[p.trainerId]) as [Trainer, Trainer],
            // Their lines for winning together (pair lines), as at the end of a battle.
            quotes: winner.trainers.map(p => trainerQuotes(TRAINERS[p.trainerId], `${t.seedText}|champions`, winner.trainers.map(o => TRAINERS[o.trainerId]))?.trainerWins ?? null) as [string | null, string | null],
          }}
          bp={t.bp}
          onClose={() => setCelebrated(true)}
        />
      )}
    </section>
  );
}
