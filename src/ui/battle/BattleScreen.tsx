import type { BattleClient } from '../../client/battle-client';
import { trainerQuotes, type Trainer } from '../../data/battle-tree';
import { TrainerSprite } from '../components/TrainerSprite';
import { isTeamPreview } from '../../engine/sim-types';
import { ANIMATION_SPEED_FACTOR } from '../../settings/settings-store';
import { useAppSettings } from '../useAppSettings';
import { useBattleFocusWhile } from '../battleFocus';
import { useBattleSnapshot } from '../useBattleClient';
import { BattleLog } from './BattleLog';
import { Controls } from './Controls';
import { FieldStatus } from './FieldStatus';
import { NowPlaying } from './NowPlaying';
import { BattleStage } from './BattleStage';
import { TeamPreview } from './TeamPreview';

interface Props {
  client: BattleClient;
  /** Shown on the end-of-battle banner (e.g. "Continue" back to the run). */
  onContinue?: () => void;
  continueLabel?: string;
  /** The trainer being fought and this battle's key (seed text): they say a closing remark when it ends. */
  opponent?: { trainer: Trainer; battleKey: string };
}

export function BattleScreen({ client, onContinue, continueLabel = 'Continue', opponent }: Props) {
  const s = useBattleSnapshot(client);
  const settings = useAppSettings();
  // Battle focus mode (the site header hides) while a battle is on screen.
  useBattleFocusWhile(s.phase === 'starting' || s.phase === 'active' || s.phase === 'ended');

  if (s.phase === 'idle') return null;
  if (s.phase === 'starting') return <p className="muted" role="status">Starting battle…</p>;
  if (s.phase === 'invalid-team') {
    return (
      <div className="notice error">
        <strong>Team is not legal for the Battle Tree:</strong>
        <ul>{s.problems.map(p => <li key={p}>{p}</li>)}</ul>
      </div>
    );
  }
  if (s.phase === 'error') return <div className="notice error">Engine error: {s.error}</div>;
  const { battle, request } = s;
  if (!battle) return null;

  const inPreview = request && isTeamPreview(request) && !s.awaiting;
  const foe = battle.p2.active[0];

  return (
    <div className="battle-layout">
      <div className="battle-main">
        {inPreview ? (
          <TeamPreview
            battle={battle}
            pokemon={request.side.pokemon}
            bring={request.maxChosenTeamSize ?? 3}
            onConfirm={c => client.choose(c)}
          />
        ) : (
          <>
            <FieldStatus battle={battle} timers={s.fieldTimers} />
            <BattleStage key={s.battleId} battle={battle} animation={s.animation} playing={s.playing} speed={ANIMATION_SPEED_FACTOR[settings.animationSpeed]} />
            {s.playing ? (
              <div className="controls waiting playing" role="status" aria-live="polite">
                <NowPlaying move={s.currentMove} caption={s.caption} />
                <span className="spacer" />
                <button onClick={() => client.skipAnimations()}>Skip</button>
              </div>
            ) : s.phase === 'ended' && s.result ? (
              <div className={`notice result ${s.result.winner === 'p1' ? 'win' : 'loss'}`}>
                {opponent && <ClosingRemark trainer={opponent.trainer} battleKey={opponent.battleKey} winner={s.result.winner} />}
                <strong>{s.result.winner === 'p1' ? 'You won!' : s.result.winner === 'p2' ? 'You lost.' : 'Tie.'}</strong>
                <span className="muted small">{s.result.turns} turns</span>
                {settings.showDebugTools && (
                  <>
                    <span className="muted small">seed <code>{s.seedText}</code></span>
                    <button onClick={() => void navigator.clipboard?.writeText(s.result!.inputLog.join('\n'))}>Copy input log</button>
                  </>
                )}
                <span className="spacer" />
                {onContinue && <button className="primary" onClick={onContinue} autoFocus>{continueLabel}</button>}
              </div>
            ) : request ? (
              <Controls
                request={request}
                awaiting={s.awaiting}
                onChoose={c => client.choose(c)}
                foeTypes={foe && !foe.fainted ? foe.types : undefined}
                battle={battle}
                showHints={settings.effectivenessHints}
                shortcuts={settings.keyboardShortcuts}
              />
            ) : (
              <div className="controls waiting" role="status">…</div>
            )}
          </>
        )}
      </div>
      <BattleLog entries={s.log} />
    </div>
  );
}

/** The opponent's last word: the closing remark (win or loss) that goes with this battle's greeting; none on a tie. */
function ClosingRemark({ trainer, battleKey, winner }: { trainer: Trainer; battleKey: string; winner: string | null | undefined }) {
  const quotes = trainerQuotes(trainer, battleKey);
  const line = winner === 'p2' ? quotes?.trainerWins : winner === 'p1' ? quotes?.trainerLoses : null;
  if (!line) return null;
  return (
    <div className="closing-remark">
      <TrainerSprite trainer={trainer} size={48} />
      <div className="closing-remark-text">
        <span className="muted small">{trainer.class} {trainer.name}</span>
        <q>{line}</q>
      </div>
    </div>
  );
}
