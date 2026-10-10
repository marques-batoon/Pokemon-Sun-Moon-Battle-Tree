import { useState } from 'react';
import type { RunController, RunTeam } from '../../run/controller';
import { courseSchedule } from '../../run/selection';
import {
  BRING, checkpointsFor, CHECKPOINTS, COURSES, DEFAULT_SETTINGS, isSuperUnlocked, PARTNER_BRING, runKey, type Course, type Format, type RunKey, type RunSettings, type TreeProfile,
} from '../../run/types';
import type { SavedTeam } from '../../team/types';
import { useAppSettings } from '../useAppSettings';
import { courseLabel, LEGEND, splitKey, useRunState } from './hooks';
import { PartnerCard } from './PartnerCard';
import { PartnerPokemonPicker } from './PartnerPokemonPicker';
import { TeamSetup } from './TeamSetup';

interface Props {
  controller: RunController;
  teams: readonly SavedTeam[];
  profile: TreeProfile;
  defaults: RunSettings;
  /** Format and course to start with (the format is fixed; the course can be changed). */
  initialKey: RunKey;
  onStarted: (key: RunKey) => void;
  onCancel: () => void;
}

export function NewRunForm({ controller, teams, profile, defaults, initialKey, onStarted, onCancel }: Props) {
  const [format, initialCourse] = splitKey(initialKey) as [Format, Course];
  const multi = format === 'multi';
  const superUnlocked = isSuperUnlocked(profile, format);
  const partners = Object.entries(profile.partners.owned);
  const [partner, setPartner] = useState<string | null>(null);
  const [partnerPicks, setPartnerPicks] = useState<number[]>([]);
  // Multi: choose the partner, then their two Pokémon, then yours.
  const partnerReady = !multi || (!!partner && partnerPicks.length === PARTNER_BRING);
  const legend = LEGEND[format];
  const label = (c: Course) => courseLabel(format, c);
  const [course, setCourse] = useState<Course>(initialCourse);
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_SETTINGS, ...defaults });
  const [team, setTeam] = useState<RunTeam | null>(null);
  const [seedText, setSeedText] = useState('');
  const [startBattle, setStartBattle] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { showDebugTools } = useAppSettings();
  const key = runKey(format, course);
  const existing = controller.run(key);
  const length = courseSchedule(format, course).length;
  // Later starting battles unlocked by this course's best streak (battle 30 after winning 50, 50 after 100).
  const checkpoints = checkpointsFor(profile.records[key]);
  // Just lost this course at battle 10 or later (this session): it can start again from the last multiple of 10.
  const retry = useRunState(controller).retries[key] ?? null;
  const starts = [...new Set([1, ...checkpoints, ...(retry ? [retry.battle] : [])])].sort((a, b) => a - b);
  const [checkpointChoice, setCheckpoint] = useState(1);
  const checkpoint = starts.includes(checkpointChoice) ? checkpointChoice : 1;
  const useRetry = !!retry && checkpoint === retry.battle && !checkpoints.includes(checkpoint);

  const start = () => {
    if (!team || !partnerReady) return;
    if (existing && (existing.status === 'ready' || existing.status === 'in-battle')
      && !confirm(`Starting a new ${label(course)} challenge ends your saved ${existing.wins}-win streak. Continue?`)) return;
    try {
      controller.startRun({
        format, course, team, seedText: seedText.trim() || undefined, startBattle: startBattle > 1 ? startBattle : undefined,
        // Multi Battles have no Team Preview.
        settings: multi ? { ...settings, teamPreviewEachBattle: false } : settings,
        partner: multi && partner ? { name: partner, setIds: partnerPicks } : undefined,
        checkpoint: checkpoint > 1 && !useRetry ? checkpoint : undefined,
        retry: useRetry ? checkpoint : undefined,
      });
      onStarted(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="panel new-run">
      <h2>New challenge</h2>
      <fieldset className="course-pick">
        <legend>Course</legend>
        {COURSES[format].map(c => (
          <label key={c} className={c === 'super' && !superUnlocked && startBattle <= 1 ? 'muted' : ''}>
            <input type="radio" name="course" checked={course === c} disabled={c === 'super' && !superUnlocked && startBattle <= 1} onChange={() => setCourse(c)} />
            {' '}{label(c)}
            <small className="muted">
              {c === 'normal' ? ` · 20 battles, Battle Legend ${legend} at 20`
                : multi ? (superUnlocked ? ` · endless, ${legend} together at 50, special trainers in pairs every 10` : ' · locked: unlock Super Singles and Super Doubles first')
                : superUnlocked ? ` · endless, ${legend} at 50, special trainers every 10` : ` · locked: beat ${legend} in ${label('normal')}`}
            </small>
          </label>
        ))}
      </fieldset>

      {starts.length > 1 && (
        <fieldset className="start-at">
          <legend>Start at</legend>
          {starts.map(n => (
            <label key={n}>
              <input type="radio" name="start-at" checked={checkpoint === n} onChange={() => setCheckpoint(n)} />
              {' '}Battle {n}
              <small className="muted">
                {n === 1 ? ' · from the beginning'
                  : checkpoints.includes(n) ? ` · unlocked by winning battle ${CHECKPOINTS.find(c => c.start === n)!.unlockedBy}; your streak starts at ${n - 1}`
                  : ` · you just lost at battle ${retry!.lostAt}: start again from here (this session only); your streak starts at ${n - 1}`}
              </small>
            </label>
          ))}
        </fieldset>
      )}

      {multi && (
        <fieldset className="partner-pick">
          <legend>Partner</legend>
          <p className="muted small">Your partner brings {PARTNER_BRING} Pokémon and you bring {BRING.multi}. Buy more partners on the Battle Tree page with BP.</p>
          <div className="partner-grid">
            {partners.map(([name]) => (
              <PartnerCard key={name} name={name} selected={partner === name} onSelect={() => { if (partner !== name) { setPartner(name); setPartnerPicks([]); } }} />
            ))}
          </div>
          {partner && (
            <PartnerPokemonPicker name={partner} offer={profile.partners.owned[partner].offer} picked={partnerPicks} onChange={setPartnerPicks} />
          )}
        </fieldset>
      )}

      {partnerReady ? (
        <TeamSetup key={format} format={format} teams={teams} onChange={setTeam} />
      ) : (
        <p className="muted small">{partner ? `Choose ${partner}'s ${PARTNER_BRING} Pokémon first, then yours.` : 'Choose your partner first, then their Pokémon, then yours.'}</p>
      )}

      <fieldset className="settings">
        <legend>Settings</legend>
        <label>
          <input type="checkbox" checked={settings.anabelUnlocked} onChange={e => setSettings(s => ({ ...s, anabelUnlocked: e.target.checked }))} />
          {' '}Anabel can appear (reached Guzzlord's chapter of the Looker episode)
        </label>
        <label>
          Opponent AI{' '}
          <select value={settings.ai} onChange={e => setSettings(s => ({ ...s, ai: e.target.value as RunSettings['ai'] }))}>
            <option value="heuristic">Battle Tree AI</option>
            <option value="random">Random (practice; doesn't count toward records)</option>
          </select>
        </label>
        {!multi && (
          <label>
            <input type="checkbox" checked={settings.teamPreviewEachBattle} onChange={e => setSettings(s => ({ ...s, teamPreviewEachBattle: e.target.checked }))} />
            {' '}Team Preview before every battle <small className="muted">(Showdown-style; in the game you bring the same {BRING[format]} until you take a break, and never see the opponent's team)</small>
          </label>
        )}
      </fieldset>

      {showDebugTools && <details className="debug">
        <summary>Debug options</summary>
        <label>Run seed <input value={seedText} placeholder="random" onChange={e => setSeedText(e.target.value)} spellCheck={false} /></label>
        <label>
          Start at battle{' '}
          <input type="number" min={1} max={length ?? 9999} value={startBattle} className="num"
            onChange={e => setStartBattle(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
          <small className="muted"> (debug runs never count toward records or unlocks)</small>
        </label>
        {!superUnlocked && <button type="button" onClick={() => controller.debugUnlockSuper(format)}>Unlock {label('super')}</button>}
      </details>}

      {error && <p className="problems">{error}</p>}
      <div className="row-actions">
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!team || !partnerReady} onClick={start}>Start {label(course)}</button>
      </div>
    </section>
  );
}
