import { useState } from 'react';
import { isFinished, type RunController } from '../../run/controller';
import { FORMATS, runKey, type Format, type RunKey, type RunState } from '../../run/types';
import type { TeamStore } from '../../storage/team-store';
import { BattleScreen } from '../battle/BattleScreen';
import { useTeams } from '../builder/hooks';
import { courseLabel, keyLabel, LEGEND, useRunState } from './hooks';
import { NewRunForm } from './NewRunForm';
import { RunScreen } from './RunScreen';
import { UnrankedTag } from './UnrankedTag';
import { TrainerSprite } from '../components/TrainerSprite';
import { TRAINERS } from '../../data/battle-tree';

type View =
  | { kind: 'home' }
  | { kind: 'new'; key: RunKey }
  | { kind: 'run'; key: RunKey }
  | { kind: 'battle'; key: RunKey; battle: number; opponent: string; trainerId: number };

export function TreePage({ controller, teamStore }: { controller: RunController; teamStore: TeamStore }) {
  const state = useRunState(controller);
  const teams = useTeams(teamStore);
  const [view, setView] = useState<View>(() => {
    const run = state.active && state.runs[state.active.key];
    return run ? { kind: 'battle', key: runKey(run.format, run.course), battle: run.battle, opponent: run.next.displayName, trainerId: run.next.trainerId } : { kind: 'home' };
  });
  const { profile } = state;

  if (view.kind === 'battle') {
    return (
      <>
        <div className="battle-banner">
          <TrainerSprite trainer={TRAINERS[view.trainerId]} size={44} />
          <span>{keyLabel(view.key)} · Battle {view.battle} · vs {view.opponent}</span>
        </div>
        <BattleScreen client={controller.battleClient} onContinue={state.active ? undefined : () => setView({ kind: 'run', key: view.key })} />
      </>
    );
  }

  if (view.kind === 'new') {
    return (
      <NewRunForm
        controller={controller}
        teams={teams}
        superUnlocked={profile.superUnlocked}
        defaults={profile.settings}
        initialKey={view.key}
        onStarted={key => setView({ kind: 'run', key })}
        onCancel={() => setView({ kind: 'home' })}
      />
    );
  }

  if (view.kind === 'run') {
    const key = view.key;
    const run = state.runs[key];
    if (!run) return <TreeHomeFallback onHome={() => setView({ kind: 'home' })} />;
    if (isFinished(run)) return <RunResult run={run} best={profile.records[key].best} superUnlocked={profile.superUnlocked[run.format]} onDone={() => { controller.dismiss(key); setView({ kind: 'home' }); }} />;
    if (controller.isInterrupted(key)) return <Interrupted controller={controller} run={run} onBack={() => setView({ kind: 'home' })} />;
    return (
      <RunScreen
        controller={controller}
        run={run}
        teams={teams}
        bpTotal={profile.bpTotal}
        error={state.error}
        onBattle={() => {
          controller.startBattle(key);
          setView({ kind: 'battle', key, battle: run.battle, opponent: run.next.displayName, trainerId: run.next.trainerId });
        }}
        onLeave={() => setView({ kind: 'home' })}
      />
    );
  }

  return (
    <section className="tree-home">
      {teams.length === 0 && (
        <div className="panel getting-started">
          <h2>Getting started</h2>
          <ol className="small">
            <li>Build a team in the <a href="#/builder">Team Builder</a> (or import one from Showdown): 3–6 Pokémon for Singles, 4–6 for Doubles.</li>
            <li>Start <strong>Normal Singles</strong> (Battle Legend Red at battle 20) or <strong>Normal Doubles</strong> (Battle Legend Blue).</li>
            <li>Beat the Battle Legend to unlock that format's <strong>Super</strong> course, the endless challenge.</li>
          </ol>
        </div>
      )}
      {FORMATS.map(format => <FormatSection key={format} format={format} state={state} onOpen={setView} />)}
      <p className="muted small">Total BP earned: {profile.bpTotal}. BP are tracked for display only.</p>
    </section>
  );
}

const COURSE_TEXT: Record<Format, { normal: string; super: string }> = {
  singles: {
    normal: '20 battles, bringing 3. Battle Legend Red waits at battle 20; beating him unlocks Super Singles.',
    super: 'Endless. Special trainers every 10 battles, Red at 50, the toughest trainers from battle 51.',
  },
  doubles: {
    normal: '20 Double Battles, bringing 4. Battle Legend Blue waits at battle 20; beating him unlocks Super Doubles.',
    super: 'Endless Double Battles. Special trainers every 10 battles, Blue at 50, the toughest trainers from battle 51.',
  },
};

/** Normal and Super cards for one format. */
function FormatSection({ format, state, onOpen }: { format: Format; state: ReturnType<typeof useRunState>; onOpen: (v: View) => void }) {
  const { profile } = state;
  return (
    <section className="format-section">
      <h2 className="format-title">{format === 'singles' ? 'Single Battles' : 'Double Battles'}</h2>
      <div className="course-grid">
        {(['normal', 'super'] as const).map(course => {
          const key = runKey(format, course);
          const run = state.runs[key];
          const record = profile.records[key];
          const locked = course === 'super' && !profile.superUnlocked[format];
          return (
            <article key={course} className="panel course-card">
              <h3>{courseLabel(format, course)}</h3>
              <p className="muted small">{COURSE_TEXT[format][course]}</p>
              <dl className="run-stats">
                <div><dt>Best streak</dt><dd>{record.best}</dd></div>
                <div><dt>Last streak</dt><dd>{record.last}</dd></div>
              </dl>
              {run && (
                <p className="saved-run">
                  {run.status === 'in-battle' && !state.active ? 'Battle interrupted' : isFinished(run) ? `Finished: ${run.status}` : `Saved challenge: ${run.wins} wins, next battle ${run.battle}`}
                  <UnrankedTag run={run} />
                </p>
              )}
              <div className="row-actions">
                {run && <button className="primary" onClick={() => onOpen({ kind: 'run', key })}>{isFinished(run) ? 'See results' : 'Continue'}</button>}
                <button disabled={locked} onClick={() => onOpen({ kind: 'new', key })} className={run ? '' : 'primary'}>
                  {locked ? 'Locked' : 'New challenge'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!profile.superUnlocked[format] && (
        <p className="muted small">{courseLabel(format, 'super')} unlocks when you beat Battle Legend {LEGEND[format]} at the end of {courseLabel(format, 'normal')}.</p>
      )}
    </section>
  );
}

function TreeHomeFallback({ onHome }: { onHome: () => void }) {
  return <section className="panel"><p>No saved challenge.</p><button onClick={onHome}>Back</button></section>;
}

function Interrupted({ controller, run, onBack }: { controller: RunController; run: RunState; onBack: () => void }) {
  return (
    <section className="panel">
      <h2>Battle interrupted</h2>
      <p>Battle {run.battle} against {run.next.displayName} didn't finish (the app was closed or reloaded).</p>
      <p className="muted small">In the game, quitting mid-battle counts as a loss. You can also replay the battle from the start: same opponent, same seed.</p>
      <div className="row-actions">
        <button onClick={onBack}>Back</button>
        <span className="spacer" />
        <button className="danger" onClick={() => controller.forfeitInterrupted(runKey(run.format, run.course))}>Count as a loss</button>
        <button className="primary" onClick={() => controller.restartInterrupted(runKey(run.format, run.course))}>Replay the battle</button>
      </div>
    </section>
  );
}

function RunResult({ run, best, superUnlocked, onDone }: { run: RunState; best: number; superUnlocked: boolean; onDone: () => void }) {
  const last = run.history.at(-1);
  return (
    <section className="panel run-result">
      {run.status === 'cleared' && (
        <>
          <h2>{courseLabel(run.format, run.course)} cleared!</h2>
          <p>You beat Battle Legend {LEGEND[run.format]}.{run.course === 'normal' && superUnlocked && !run.debug ? ` ${courseLabel(run.format, 'super')} is now unlocked.` : ''}</p>
        </>
      )}
      {run.status === 'lost' && (
        <>
          <h2>Your streak ended at {run.wins}</h2>
          {last && <p>Lost battle {last.battle} to {last.opponent}.</p>}
        </>
      )}
      {run.status === 'retired' && <h2>You retired with a {run.wins}-win streak</h2>}
      <dl className="run-stats">
        <div><dt>Streak</dt><dd>{run.wins}</dd></div>
        <div><dt>BP earned</dt><dd>{run.bp}</dd></div>
        <div><dt>Best</dt><dd>{best}</dd></div>
      </dl>
      {run.debug && <p className="muted small">Unranked run: not counted toward records or unlocks.</p>}
      <button className="primary" onClick={onDone}>Back to the Battle Tree</button>
    </section>
  );
}
