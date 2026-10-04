import type { BattleClient } from '../../client/battle-client';
import { isTeamPreview } from '../../engine/sim-types';
import { ANIMATION_SPEED_FACTOR } from '../../settings/settings-store';
import { useAppSettings } from '../useAppSettings';
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
}

export function BattleScreen({ client, onContinue, continueLabel = 'Continue' }: Props) {
  const s = useBattleSnapshot(client);
  const settings = useAppSettings();

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
            <FieldStatus battle={battle} />
            <BattleStage key={s.battleId} battle={battle} animation={s.animation} playing={s.playing} speed={ANIMATION_SPEED_FACTOR[settings.animationSpeed]} />
            {s.playing ? (
              <div className="controls waiting playing" role="status" aria-live="polite">
                <NowPlaying move={s.currentMove} caption={s.caption} />
                <span className="spacer" />
                <button onClick={() => client.skipAnimations()}>Skip</button>
              </div>
            ) : s.phase === 'ended' && s.result ? (
              <div className={`notice result ${s.result.winner === 'p1' ? 'win' : 'loss'}`}>
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
