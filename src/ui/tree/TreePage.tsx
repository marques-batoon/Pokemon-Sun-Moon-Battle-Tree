import { useState, type ReactNode } from 'react';
import { isFinished, type RunController } from '../../run/controller';
import {
  bpBalance, COURSES, FORMATS, isSuperUnlocked, needsSuper, opponentLabel, PARTNER_OFFER_SIZE, PARTNER_PRICE, runKey, type Course, type Format, type RunKey, type RunState, type TreeProfile,
} from '../../run/types';
import type { TeamStore } from '../../storage/team-store';
import { BattleScreen } from '../battle/BattleScreen';
import { useTeams } from '../builder/hooks';
import { BATTLE_TITLE, courseLabel, keyLabel, LEGEND, useRunState, useTournament } from './hooks';
import { NewRunForm } from './NewRunForm';
import { PartnerCard } from './PartnerCard';
import { partnersForSale } from '../../run/partners';
import { RunScreen } from './RunScreen';
import { UnrankedTag } from './UnrankedTag';
import { TrainerSprite } from '../components/TrainerSprite';
import { opponentSpriteIds } from '../sprites';
import { duoTitle, TRAINERS } from '../../data/battle-tree';
import { useScrollToTopOn } from '../useScrollToTop';
import type { TournamentController } from '../../run/tournament-controller';
import { TournamentScreen } from './TournamentScreen';
import { TournamentForm } from './TournamentForm';
import { duoSpriteKey, matchKey, nextOpponent, roundName, roundPhrase, roundsOf } from '../../run/tournament';
import { ReplayScreen } from './ReplayScreen';
import { battleName } from '../../online/trainer-name';
import { useAppSettings } from '../useAppSettings';
import { PreloadNextBattle, RunImagesGate, TournamentImagesGate } from './preload';

type View =
  | { kind: 'home' }
  | { kind: 'new'; key: RunKey }
  | { kind: 'run'; key: RunKey }
  /** trainerIds: the opposing trainer, or both in a Multi Battle. */
  | { kind: 'battle'; key: RunKey; battle: number; opponent: string; trainerIds: number[]; seedText: string }
  /** The All Star Duo Tournament: starting one, its bracket between matches, and one of your matches. */
  | { kind: 'tournament-new' }
  | { kind: 'tournament' }
  | { kind: 'tournament-battle'; round: number; trainerIds: number[]; battleKey: string }
  /** The replay of a finished tournament match. */
  | { kind: 'tournament-replay'; round: number; match: number };

const battleView = (run: RunState): View => ({
  kind: 'battle',
  key: runKey(run.format, run.course),
  battle: run.battle,
  opponent: opponentLabel(run.next),
  trainerIds: [run.next.trainerId, ...(run.next.second ? [run.next.second.trainerId] : [])],
  seedText: run.next.seedText,
});

export function TreePage({ controller, tournaments, teamStore }: { controller: RunController; tournaments: TournamentController; teamStore: TeamStore }) {
  const state = useRunState(controller);
  const tournament = useTournament(tournaments);
  const { trainerName } = useAppSettings();
  const teams = useTeams(teamStore);
  const [view, setView] = useState<View>(() => {
    const run = state.active && state.runs[state.active.key];
    return run ? battleView(run) : { kind: 'home' };
  });
  const { profile } = state;
  // Each screen (choosing a challenge, the next opponents, a battle, the results) opens at the top of the page.
  useScrollToTopOn(view.kind === 'battle' ? `battle:${view.key}:${view.battle}` : view.kind === 'tournament-battle' ? `${view.kind}:${view.round}`
    : view.kind === 'tournament-replay' ? `${view.kind}:${view.round}:${view.match}` : 'key' in view ? `${view.kind}:${view.key}` : view.kind);

  if (view.kind === 'tournament-replay') {
    const t = tournament.tournament;
    if (!t) return <TreeHomeFallback onHome={() => setView({ kind: 'home' })} />;
    return (
      <ReplayScreen
        key={`${view.round}:${view.match}`}
        t={t} round={view.round} match={view.match}
        you={trainerName ? battleName(trainerName) : 'You'}
        onBack={() => setView({ kind: 'tournament' })}
      />
    );
  }

  if (view.kind === 'tournament-new') {
    return <TournamentForm controller={tournaments} teams={teams} onStarted={() => setView({ kind: 'tournament' })} onCancel={() => setView({ kind: 'home' })} />;
  }

  if (view.kind === 'tournament') {
    return (
      <TournamentImagesGate t={tournament.tournament}>
        <TournamentScreen
          controller={tournaments}
          onBattle={() => {
            const t = tournaments.tournament;
            const foes = t && nextOpponent(t);
            if (!t || !foes) return;
            // The duo's lines (greeting, closing remark) are the round's: fixed now, before the result moves the round on.
            const battleKey = matchKey(t);
            tournaments.startBattle();
            setView({ kind: 'tournament-battle', round: t.round, trainerIds: foes.trainers.map(p => p.trainerId), battleKey });
          }}
          onLeave={() => setView({ kind: 'home' })}
          onNew={() => setView({ kind: 'tournament-new' })}
          onReplay={(round, match) => setView({ kind: 'tournament-replay', round, match })}
        />
      </TournamentImagesGate>
    );
  }

  if (view.kind === 'tournament-battle') {
    const foes = view.trainerIds.map(id => TRAINERS[id]);
    // The duo looks the same all tournament (a Pokémon Masters sprite or not), as on the bracket.
    const spriteIds = opponentSpriteIds(foes, tournament.tournament ? duoSpriteKey(tournament.tournament) : null);
    return (
      <>
        <div className="battle-banner">
          {foes.map((t, i) => <TrainerSprite key={t.id} trainer={t} size={44} spriteId={spriteIds[i]} />)}
          <span>All Star Duo Tournament · {roundName(view.round, tournament.tournament ? roundsOf(tournament.tournament) : undefined)} · vs {duoTitle(foes[0], foes[1])} ({foes.map(t => t.name).join(' & ')})</span>
        </div>
        <BattleScreen
          client={tournaments.battleClient}
          opponent={{ trainers: foes, battleKey: view.battleKey, spriteIds }}
          onContinue={tournament.inBattle ? undefined : () => setView({ kind: 'tournament' })}
          continueLabel="Back to the bracket"
        />
      </>
    );
  }

  if (view.kind === 'battle') {
    const foes = view.trainerIds.map(id => TRAINERS[id]);
    const spriteIds = opponentSpriteIds(foes, view.seedText);
    const run = state.runs[view.key];
    return (
      <>
        {run && <PreloadNextBattle run={run} />}
        <div className="battle-banner">
          {foes.map((t, i) => <TrainerSprite key={t.id} trainer={t} size={44} spriteId={spriteIds[i]} />)}
          <span>{keyLabel(view.key)} · Battle {view.battle} · vs {view.opponent}</span>
        </div>
        <BattleScreen
          client={controller.battleClient}
          opponent={{ trainers: foes, battleKey: view.seedText, spriteIds }}
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
      <RunImagesGate run={run}>
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
      </RunImagesGate>
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
              <TournamentCard snapshot={tournament} unlocked={isSuperUnlocked(profile, 'multi')} onOpen={setView} />
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

const ALL_STAR_TEXT = 'Unrated (no records), but it earns BP. Special trainers in every battle, and the Battle Legends draw every 10th battle. Anyone beaten here for the first time comes into the partner shop at 10000 BP.';
const COURSE_TEXT: Record<Format, Partial<Record<Course, string>>> = {
  singles: {
    normal: '20 battles, bringing 3. Battle Legend Red waits at battle 20; beating him unlocks Super Singles.',
    super: 'Endless. Special trainers every 10 battles, Battle Legends every 50 (50, 100, ...), the toughest trainers from battle 51.',
    allstar: ALL_STAR_TEXT,
  },
  doubles: {
    normal: '20 Double Battles, bringing 4. Battle Legend Blue waits at battle 20; beating him unlocks Super Doubles.',
    super: 'Endless Double Battles. Special trainers every 10 battles, Battle Legends every 50 (50, 100, ...), the toughest trainers from battle 51.',
    allstar: ALL_STAR_TEXT,
  },
  multi: {
    super: 'Endless Multi Battles: you and a partner bring 2 each against two trainers. Special trainers in pairs every 10 battles, Battle Legends every 50.',
    allstar: `Multi Battles with a partner. ${ALL_STAR_TEXT}`,
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
          const locked = needsSuper(course) && !isSuperUnlocked(profile, format);
          const unrated = course === 'allstar';
          return (
            <article key={course} className="panel course-card">
              <h3>{courseLabel(format, course)}</h3>
              <p className="muted small">{COURSE_TEXT[format][course]}</p>
              {unrated ? (
                <p className="small"><span className="tag">All Star Mode</span> <span className="tag">unrated</span></p>
              ) : (
                <dl className="run-stats">
                  <div><dt>Best streak</dt><dd>{record.best}</dd></div>
                  <div><dt>Last streak</dt><dd>{record.last}</dd></div>
                </dl>
              )}
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

/** The All Star Duo Tournament on the Battle Tree page: what it is, your tournaments, and the one in progress. */
function TournamentCard({ snapshot, unlocked, onOpen }: { snapshot: ReturnType<typeof useTournament>; unlocked: boolean; onOpen: (v: View) => void }) {
  const t = snapshot.tournament;
  const { entered, won } = snapshot.profile.tournaments;
  const finished = t && (t.status === 'won' || t.status === 'lost' || t.status === 'retired');
  return (
    <article className="panel course-card tournament-card">
      <h3>All Star Duo Tournament</h3>
      <p className="muted small">
        A 32-pair bracket, single elimination: you and a partner against 31 duos of special trainers who team up together.
        Every round before the final pays 2 BP a win; winning the final pays 50 BP. Lose, and you watch the rest play out. Every match can be watched again.
      </p>
      <p className="small"><span className="tag">All Star Mode</span> <span className="tag">unrated</span></p>
      <dl className="run-stats">
        <div><dt>Tournaments</dt><dd>{entered}</dd></div>
        <div><dt>Won</dt><dd>{won}</dd></div>
      </dl>
      {t && (
        <p className="saved-run">
          {t.status === 'in-battle' && !snapshot.inBattle ? 'Match interrupted'
            : t.status === 'won' ? 'Finished: you won!' : finished ? `Finished: out in ${roundPhrase(t.round, roundsOf(t))}` : `Saved tournament: ${roundName(t.round, roundsOf(t))} next`}
        </p>
      )}
      <div className="row-actions">
        {t && <button className="primary" onClick={() => onOpen({ kind: 'tournament' })}>{finished ? 'See results' : 'Continue'}</button>}
        <button disabled={!unlocked} className={t ? '' : 'primary'} onClick={() => onOpen({ kind: 'tournament-new' })}>{unlocked ? 'New tournament' : 'Locked'}</button>
      </div>
      {!unlocked && <p className="muted small">Opens with Super Multi, once Super Singles and Super Doubles are both unlocked.</p>}
    </article>
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
        Beat a special trainer or Battle Legend in any challenge and you can buy them as a Multi partner for {PARTNER_PRICE.first} BP
        ({PARTNER_PRICE.allStarFirst} BP if you first beat them in All Star Mode). Each time you beat them again, their price drops
        by {PARTNER_PRICE.dropPerWin} BP ({PARTNER_PRICE.allStarDropPerWin} BP in All Star Mode), down to {PARTNER_PRICE.lowest} BP;
        a win outside All Star Mode brings a price above {PARTNER_PRICE.first} BP down to {PARTNER_PRICE.first} BP.
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
        <p className="muted small">Nobody to buy yet. Special trainers appear every 10th battle of a Super challenge (every battle in All Star Mode), and Battle Legends every 50th (every 10th in All Star Mode).</p>
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
      {run.debug ? <p className="muted small">Unranked run: not counted toward records or unlocks, and no BP or partner progress.</p>
        : run.course === 'allstar' && <p className="muted small">All Star Mode is unrated: no records, but the BP and partner progress count.</p>}
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
