import { useEffect, useState, useSyncExternalStore } from 'react';
import { TRAINERS } from '../../data/battle-tree';
import { ReplayPlayer } from '../../client/replay-player';
import { matchEntrants, roundName, roundsOf, type TournamentEntrant, type TournamentState } from '../../run/tournament';
import { ANIMATION_SPEED_FACTOR } from '../../settings/settings-store';
import { BattleLog } from '../battle/BattleLog';
import { BattleStage } from '../battle/BattleStage';
import { FieldStatus } from '../battle/FieldStatus';
import { NowPlaying } from '../battle/NowPlaying';
import { useBattleFocusWhile } from '../battleFocus';
import { getSettingsStore, getSimulationClient } from '../services';
import { useAppSettings } from '../useAppSettings';
import { useBattleSnapshot } from '../useBattleClient';

interface Props {
  t: TournamentState;
  round: number;
  match: number;
  /** Your name ("You", or your trainer name). */
  you: string;
  onBack: () => void;
}

const speedSetting = () => ANIMATION_SPEED_FACTOR[getSettingsStore().getSettings().animationSpeed] ?? 1;

/**
 * The replay of a finished tournament match: the engine plays it again from its input log, and it plays back on the
 * battle stage turn by turn. Previous turn, next turn and back to the bracket are always there (also ←, → and Esc;
 * space pauses).
 */
export function ReplayScreen({ t, round, match, you, onBack }: Props) {
  const log = t.logs?.[round]?.[match] ?? null;
  const [player, setPlayer] = useState<ReplayPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!log) return;
    let live = true;
    let made: ReplayPlayer | null = null;
    getSimulationClient().replay(log).then(
      replay => {
        if (!live) return;
        made = new ReplayPlayer(replay.chunks, replay.team, speedSetting);
        setPlayer(made);
      },
      err => { if (live) setError(err instanceof Error ? err.message : String(err)); },
    );
    return () => { live = false; made?.dispose(); };
  }, [log]);

  const rounds = roundsOf(t);
  const pair = matchEntrants(t, round, match);
  // The side seen from below: yours in your matches, otherwise the first duo of the match (as the engine fought it).
  const [bottom, top] = !pair ? [null, null] : t.entrants[pair[1]].kind === 'player' ? [pair[1], pair[0]] : [pair[0], pair[1]];
  const name = (i: number | null) => (i === null ? '?' : entrantName(t.entrants[i], t, you));
  const winner = t.results[round][match];
  const title = `${roundName(round, rounds)}: ${name(bottom)} vs ${name(top)}`;

  if (!log) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        <p>There's no replay of this match{t.logs ? ' (it wasn\'t played)' : ' (this tournament was played before replays were kept)'}.</p>
        <button onClick={onBack}>Back to the bracket</button>
      </section>
    );
  }
  if (error || !player) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        {error ? <p className="problems">Couldn't load the replay: {error}</p> : <p className="muted" role="status">Loading the replay…</p>}
        <button onClick={onBack}>Back to the bracket</button>
      </section>
    );
  }
  return <ReplayView player={player} title={title} winner={winner === null ? null : name(winner)} onBack={onBack} />;
}

function ReplayView({ player, title, winner, onBack }: { player: ReplayPlayer; title: string; winner: string | null; onBack: () => void }) {
  const state = useSyncExternalStore(player.subscribe, player.getState);
  const s = useBattleSnapshot(state.client);
  const settings = useAppSettings();
  useBattleFocusWhile(true);
  const over = state.at >= state.total && !s.playing;
  // While a turn plays, that's the turn shown; between turns, the one about to start.
  const turn = s.playing ? state.at - 1 : state.at;
  const turnLabel = over ? 'Battle over' : turn <= 0 ? 'Start' : `Turn ${turn} of ${player.turns}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
      if (e.key === 'ArrowLeft') player.previous();
      else if (e.key === 'ArrowRight') player.next();
      else if (e.key === 'Escape') onBack();
      else if (e.key === ' ') { e.preventDefault(); player.togglePause(); }
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, onBack]);

  return (
    <section className="replay">
      <div className="replay-bar" role="toolbar" aria-label="Replay controls">
        <button onClick={onBack}>← Back to bracket</button>
        <span className="replay-title">{title}</span>
        <span className="spacer" />
        <button onClick={() => player.previous()} disabled={state.at === 0 && !s.playing}>◀ Previous turn</button>
        <button onClick={() => player.togglePause()} disabled={over} aria-pressed={state.paused}>{state.paused ? '▶ Play' : '❚❚ Pause'}</button>
        <button onClick={() => player.next()} disabled={over}>Next turn ▶</button>
        <span className="replay-turn" aria-live="polite">{turnLabel}</span>
      </div>
      {s.battle && (
        <div className={`battle-layout${settings.showBattleLog ? '' : ' no-log'}`}>
          <div className="battle-main">
            <FieldStatus battle={s.battle} timers={s.fieldTimers} />
            <BattleStage key={s.battleId} battle={s.battle} animation={s.animation} playing={s.playing} speed={ANIMATION_SPEED_FACTOR[settings.animationSpeed]} me={s.perspective} />
            {over ? (
              <div className="notice result replay-over">
                <strong>{winner ? `${winner} won.` : 'Battle over.'}</strong>
                <span className="spacer" />
                <button onClick={() => player.previous()}>◀ Previous turn</button>
                <button className="primary" onClick={onBack} autoFocus>Back to bracket</button>
              </div>
            ) : (
              <div className="controls waiting playing" role="status" aria-live="polite">
                <NowPlaying move={s.currentMove} caption={s.caption} />
              </div>
            )}
          </div>
          {settings.showBattleLog && <BattleLog entries={s.log} onHide={() => getSettingsStore().update({ showBattleLog: false })} />}
        </div>
      )}
    </section>
  );
}

function entrantName(e: TournamentEntrant, t: TournamentState, you: string): string {
  return e.kind === 'player' ? `${you} & ${TRAINERS[t.partner.trainerId].name}` : e.trainers.map(p => TRAINERS[p.trainerId].name).join(' & ');
}
