import { useState, type ReactNode } from 'react';
import { isFinished, type RunController } from '../../run/controller';
import {
  bpBalance, COURSES, FORMATS, isSuperUnlocked, opponentLabel, PARTNER_OFFER_SIZE, PARTNER_PRICE, runKey, type Course, type Format, type RunKey, type RunState, type TreeProfile,
} from '../../run/types';
import type { TeamStore } from '../../storage/team-store';
import { BattleScreen } from '../battle/BattleScreen';
import { useTeams } from '../builder/hooks';
import { BATTLE_TITLE, courseLabel, keyLabel, LEGEND, useRunState } from './hooks';
import { NewRunForm } from './NewRunForm';
import { PartnerCard } from './PartnerCard';
import { partnersForSale } from '../../run/partners';
import { RunScreen } from './RunScreen';
import { UnrankedTag } from './UnrankedTag';
import { TrainerSprite } from '../components/TrainerSprite';
import { TRAINERS } from '../../data/battle-tree';

type View =
  | { kind: 'home' }
  | { kind: 'new'; key: RunKey }
  | { kind: 'run'; key: RunKey }
  /** trainerIds: the opposing trainer, or both in a Multi Battle. */
  | { kind: 'battle'; key: RunKey; battle: number; opponent: string; trainerIds: number[]; seedText: string };

const battleView = (run: RunState): View => ({
  kind: 'battle',
  key: runKey(run.format, run.course),
  battle: run.battle,
  opponent: opponentLabel(run.next),
  trainerIds: [run.next.trainerId, ...(run.next.second ? [run.next.second.trainerId] : [])],
  seedText: run.next.seedText,
});

export function TreePage({ controller, teamStore }: { controller: RunController; teamStore: TeamStore }) {
  const state = useRunState(controller);
  const teams = useTeams(teamStore);
  const [view, setView] = useState<View>(() => {
    const run = state.active && state.runs[state.active.key];
    return run ? battleView(run) : { kind: 'home' };
  });
  const { profile } = state;

  if (view.kind === 'battle') {
    return (
      <>
        <div className="battle-banner">
          {view.trainerIds.map(id => <TrainerSprite key={id} trainer={TRAINERS[id]} size={44} />)}
          <span>{keyLabel(view.key)} · Battle {view.battle} · vs {view.opponent}</span>
        </div>
        <BattleScreen
          client={controller.battleClient}
          opponent={{ trainers: view.trainerIds.map(id => TRAINERS[id]), battleKey: view.seedText }}
          onContinue={state.active ? undefined : () => setView({ kind: 'run', key: view.key })}
        />
      </>
    );
  }

  if (view.kind === 'new') {
    return (
      <NewRunForm
        controller={controller}
        teams={teams}
        profile={profile}
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
    if (isFinished(run)) {
      const retry = run.status === 'lost' ? state.retries[key] : undefined;
      return (
        <RunResult
          run={run} best={profile.records[key].best} superUnlocked={isSuperUnlocked(profile, run.format)}
          retryFrom={retry?.battle ?? null}
          onRetry={() => { controller.retryFromOffer(key); setView({ kind: 'run', key }); }}
          onDone={() => { controller.dismiss(key); setView({ kind: 'home' }); }}
        />
      );
    }
    if (controller.isInterrupted(key)) return <Interrupted controller={controller} run={run} onBack={() => setView({ kind: 'home' })} />;
    return (
      <RunScreen
        controller={controller}
        run={run}
        teams={teams}
        bp={bpBalance(profile)}
        error={state.error}
        onBattle={() => {
          controller.startBattle(key);
          setView(battleView(run));
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
            <li>Build a team in the <a href="#/builder">Team Builder</a> (or import one from Showdown): 3–6 Pokémon for Singles, 4–6 for Doubles, 2–6 for Multi.</li>
            <li>Start <strong>Normal Singles</strong> (Battle Legend Red at battle 20) or <strong>Normal Doubles</strong> (Battle Legend Blue).</li>
            <li>Beat the Battle Legend to unlock that format's <strong>Super</strong> course, the endless challenge.</li>
            <li>With both Super courses unlocked, team up with a partner in <strong>Super Multi</strong>.</li>
          </ol>
        </div>
      )}
      {FORMATS.map(format => (
        <FormatSection key={format} format={format} state={state} onOpen={setView}>
          {format === 'multi' && (
            <>
              <p className="small online-link"><a href="#/online">Team up with a friend online →</a></p>
              <PartnerShop controller={controller} profile={profile} />
            </>
          )}
        </FormatSection>
      ))}
      <p className="muted small">BP: {bpBalance(profile)} to spend ({profile.bpTotal} earned{profile.bpSpent ? `, ${profile.bpSpent} spent on partners` : ''}).</p>
    </section>
  );
}

const COURSE_TEXT: Record<Format, Partial<Record<Course, string>>> = {
  singles: {
    normal: '20 battles, bringing 3. Battle Legend Red waits at battle 20; beating him unlocks Super Singles.',
    super: 'Endless. Special trainers every 10 battles, Red at 50, the toughest trainers from battle 51.',
  },
  doubles: {
    normal: '20 Double Battles, bringing 4. Battle Legend Blue waits at battle 20; beating him unlocks Super Doubles.',
    super: 'Endless Double Battles. Special trainers every 10 battles, Blue at 50, the toughest trainers from battle 51.',
  },
  multi: {
    super: 'Endless Multi Battles: you and a partner bring 2 each against two trainers. Special trainers in pairs every 10 battles, Red and Blue together at 50.',
  },
};

const LOCKED_TEXT: Record<Format, string> = {
  singles: `Super Singles unlocks when you beat Battle Legend Red at the end of Normal Singles.`,
  doubles: `Super Doubles unlocks when you beat Battle Legend Blue at the end of Normal Doubles.`,
  multi: 'Super Multi unlocks once Super Singles and Super Doubles are both unlocked.',
};

/** The course cards for one format (Normal and Super; Multi has only Super). */
function FormatSection({ format, state, onOpen, children }: { format: Format; state: ReturnType<typeof useRunState>; onOpen: (v: View) => void; children?: ReactNode }) {
  const { profile } = state;
  return (
    <section className="format-section">
      <h2 className="format-title">{BATTLE_TITLE[format]}</h2>
      <div className="course-grid">
        {COURSES[format].map(course => {
          const key = runKey(format, course);
          const run = state.runs[key];
          const record = profile.records[key];
          const locked = course === 'super' && !isSuperUnlocked(profile, format);
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
      {!isSuperUnlocked(profile, format) && <p className="muted small">{LOCKED_TEXT[format]}</p>}
      {children}
    </section>
  );
}

/** Multi partners: the ones you have, and special trainers you've beaten who can be bought with BP. */
function PartnerShop({ controller, profile }: { controller: RunController; profile: TreeProfile }) {
  const [error, setError] = useState<string | null>(null);
  const balance = bpBalance(profile);
  const owned = Object.keys(profile.partners.owned);
  const forSale = partnersForSale(profile.partners);
  const buy = (name: string, price: number) => {
    if (!confirm(`Buy ${name} as a Multi partner for ${price} BP?`)) return;
    try {
      controller.buyPartner(name);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="panel partner-shop">
      <div className="partner-shop-head">
        <h3>Partners</h3>
        <span className="bp-balance">{balance} BP</span>
      </div>
      <p className="muted small">
        Beat a special trainer in any challenge and you can buy them as a Multi partner for {PARTNER_PRICE.first} BP.
        Each time you beat them again, their price drops by {PARTNER_PRICE.dropPerWin} BP (down to {PARTNER_PRICE.lowest} BP).
        Each partner offers {PARTNER_OFFER_SIZE} of their Pokémon; you choose two when you start a Super Multi challenge.
      </p>
      <h4>Your partners</h4>
      <div className="partner-grid">
        {owned.map(name => <PartnerCard key={name} name={name} />)}
      </div>
      <h4>Buy a partner</h4>
      {forSale.length ? (
        <div className="partner-grid">
          {forSale.map(({ name, timesBeaten, price }) => (
            <PartnerCard key={name} name={name}>
              <span className="muted small">Beaten {timesBeaten === 1 ? 'once' : `${timesBeaten} times`}</span>
              <button className="primary" disabled={balance < price} onClick={() => buy(name, price)}>Buy · {price} BP</button>
            </PartnerCard>
          ))}
        </div>
      ) : (
        <p className="muted small">Nobody to buy yet. Special trainers appear every 10th battle of a Super challenge.</p>
      )}
      {error && <p className="problems">{error}</p>}
    </div>
  );
}

function TreeHomeFallback({ onHome }: { onHome: () => void }) {
  return <section className="panel"><p>No saved challenge.</p><button onClick={onHome}>Back</button></section>;
}

function Interrupted({ controller, run, onBack }: { controller: RunController; run: RunState; onBack: () => void }) {
  return (
    <section className="panel">
      <h2>Battle interrupted</h2>
      <p>Battle {run.battle} against {opponentLabel(run.next)} didn't finish (the app was closed or reloaded).</p>
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

function RunResult({ run, best, superUnlocked, retryFrom, onRetry, onDone }: {
  run: RunState; best: number; superUnlocked: boolean;
  /** Just lost at battle 10 or later: start again from this battle (last multiple of 10). */
  retryFrom: number | null; onRetry: () => void; onDone: () => void;
}) {
  const last = run.history.at(-1);
  const [error, setError] = useState<string | null>(null);
  const retry = () => {
    try { onRetry(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
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
      {retryFrom !== null && (
        <p className="muted small">
          Start a new challenge from battle {retryFrom} with the same team{run.partner ? ` and partner (${run.partner.name})` : ''}: your streak starts at {retryFrom - 1}. Only offered right after a loss (this session).
        </p>
      )}
      {error && <p className="problems">{error}</p>}
      <div className="row-actions">
        <button className={retryFrom === null ? 'primary' : ''} onClick={onDone}>Back to the Battle Tree</button>
        {retryFrom !== null && <button className="primary" onClick={retry}>Start again from battle {retryFrom}</button>}
      </div>
    </section>
  );
}
