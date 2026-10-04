import { useState } from 'react';
import { BRACKETS, TRAINERS } from '../../data/battle-tree';
import type { RunController, RunTeam } from '../../run/controller';
import { bpForWin } from '../../run/selection';
import { BRING, runKey, type RunState } from '../../run/types';
import type { SavedTeam } from '../../team/types';
import { useAppSettings } from '../useAppSettings';
import { courseLabel } from './hooks';
import { UnrankedTag } from './UnrankedTag';
import { TeamSetup } from './TeamSetup';
import { TrainerSprite } from '../components/TrainerSprite';
import { PokemonIcon } from '../components/PokemonSprite';

interface Props {
  controller: RunController;
  run: RunState;
  teams: readonly SavedTeam[];
  bpTotal: number;
  error: string | null;
  onBattle: () => void;
  onLeave: () => void;
}

const KIND_LABEL = { regular: null, special: 'Special trainer', legend: 'Battle Legend battle' } as const;

/** Between battles: streak, BP, next opponent, team, save & quit. */
export function RunScreen({ controller, run, teams, bpTotal, error, onBattle, onLeave }: Props) {
  const [changing, setChanging] = useState(false);
  const [newTeam, setNewTeam] = useState<RunTeam | null>(null);
  const length = BRACKETS[run.format][run.course].length;
  const key = runKey(run.format, run.course);
  const brought = run.team.bring.map(i => run.team.sets[i]);
  const preview = run.settings.teamPreviewEachBattle;
  const { showDebugTools } = useAppSettings();

  return (
    <section className="panel run-screen">
      <header className="run-head">
        <h2>{courseLabel(run.format, run.course)}{run.debug && <UnrankedTag run={run} />}</h2>
        <dl className="run-stats">
          <div><dt>Streak</dt><dd>{run.wins}</dd></div>
          <div><dt>Next battle</dt><dd>{run.battle}{length ? ` / ${length}` : ''}</dd></div>
          <div><dt>BP this run</dt><dd>{run.bp}</dd></div>
          <div><dt>BP total</dt><dd>{bpTotal}</dd></div>
        </dl>
      </header>

      <div className={`opponent-card kind-${run.next.kind}`}>
        <TrainerSprite trainer={TRAINERS[run.next.trainerId]} size={104} />
        <div className="opponent-info">
          <span className="muted small">Battle {run.battle} · win for {bpForWin(run.course, run.battle)} BP</span>
          <strong className="opponent-name">{run.next.displayName}</strong>
          {KIND_LABEL[run.next.kind] && <span className="tag">{KIND_LABEL[run.next.kind]}</span>}
        </div>
      </div>

      {!changing ? (
        <div className="brought">
          <span className="muted small">
            {preview ? `Team: ${run.team.name} — you pick ${BRING[run.format]} at Team Preview each battle.` : `Bringing from ${run.team.name}, in this order${run.format === 'doubles' ? ' (first two lead)' : ''}:`}
          </span>
          {!preview && <ol className="brought-list">{brought.map((s, i) => <li key={i}><PokemonIcon species={s.species} />{s.name !== s.species ? `${s.name} (${s.species})` : s.species}{s.item ? ` @ ${s.item}` : ''}</li>)}</ol>}
          <label className="small">
            <input type="checkbox" checked={preview} onChange={e => controller.updateSettings(key, { teamPreviewEachBattle: e.target.checked })} />
            {' '}Team Preview before every battle (not in the game)
          </label>
        </div>
      ) : (
        <div className="change-team">
          <p className="muted small">The game lets you change your team after taking a break; your streak continues.</p>
          <TeamSetup format={run.format} teams={teams} initial={run.team} onChange={setNewTeam} />
          <div className="row-actions">
            <button onClick={() => setChanging(false)}>Cancel</button>
            <button className="primary" disabled={!newTeam} onClick={() => { if (newTeam) { controller.changeTeam(key, newTeam); setChanging(false); } }}>Use this team</button>
          </div>
        </div>
      )}

      {error && <p className="problems">{error}</p>}

      <div className="row-actions">
        <button className="danger" onClick={() => { if (confirm(`Retire? Your ${run.wins}-win streak ends.`)) controller.retire(key); }}>Retire</button>
        <span className="spacer" />
        {!changing && <button onClick={() => setChanging(true)}>Change team</button>}
        <button onClick={onLeave}>Save &amp; quit</button>
        <button className="primary" disabled={changing} onClick={onBattle}>Battle!</button>
      </div>

      {run.history.length > 0 && (
        <details className="history">
          <summary>This run ({run.history.length} battles)</summary>
          <ol reversed>
            {[...run.history].reverse().map(h => (
              <li key={h.battle}>
                Battle {h.battle}: {h.opponent} — <span className={h.result === 'win' ? 'win-text' : 'error-text'}>{h.result === 'win' ? `won (+${h.bp} BP)` : 'lost'}</span>
                <span className="muted small"> · {h.turns} turns{showDebugTools && <> · seed <code>{h.seedText}</code></>}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
