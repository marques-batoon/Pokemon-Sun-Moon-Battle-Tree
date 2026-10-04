import { useState } from 'react';
import { BRACKETS } from '../../data/battle-tree';
import type { RunController, RunTeam } from '../../run/controller';
import { DEFAULT_SETTINGS, runKey, type Course, type Format, type RunKey, type RunSettings, type TreeProfile } from '../../run/types';
import type { SavedTeam } from '../../team/types';
import { useAppSettings } from '../useAppSettings';
import { courseLabel, LEGEND, splitKey } from './hooks';
import { TeamSetup } from './TeamSetup';

interface Props {
  controller: RunController;
  teams: readonly SavedTeam[];
  superUnlocked: TreeProfile['superUnlocked'];
  defaults: RunSettings;
  /** Format and course to start with (the format is fixed; the course can be changed). */
  initialKey: RunKey;
  onStarted: (key: RunKey) => void;
  onCancel: () => void;
}

export function NewRunForm({ controller, teams, superUnlocked: unlocked, defaults, initialKey, onStarted, onCancel }: Props) {
  const [format, initialCourse] = splitKey(initialKey) as [Format, Course];
  const superUnlocked = unlocked[format];
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
  const length = BRACKETS[format][course].length;

  const start = () => {
    if (!team) return;
    if (existing && (existing.status === 'ready' || existing.status === 'in-battle')
      && !confirm(`Starting a new ${label(course)} challenge ends your saved ${existing.wins}-win streak. Continue?`)) return;
    try {
      controller.startRun({ format, course, team, settings, seedText: seedText.trim() || undefined, startBattle: startBattle > 1 ? startBattle : undefined });
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
        {(['normal', 'super'] as const).map(c => (
          <label key={c} className={c === 'super' && !superUnlocked && startBattle <= 1 ? 'muted' : ''}>
            <input type="radio" name="course" checked={course === c} disabled={c === 'super' && !superUnlocked && startBattle <= 1} onChange={() => setCourse(c)} />
            {' '}{label(c)}
            <small className="muted">
              {c === 'normal' ? ` · 20 battles, Battle Legend ${legend} at 20` : superUnlocked ? ` · endless, ${legend} at 50, special trainers every 10` : ` · locked: beat ${legend} in ${label('normal')}`}
            </small>
          </label>
        ))}
      </fieldset>

      <TeamSetup key={format} format={format} teams={teams} onChange={setTeam} />

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
        <label>
          <input type="checkbox" checked={settings.teamPreviewEachBattle} onChange={e => setSettings(s => ({ ...s, teamPreviewEachBattle: e.target.checked }))} />
          {' '}Team Preview before every battle <small className="muted">(Showdown-style; in the game you bring the same {format === 'doubles' ? 4 : 3} until you take a break, and never see the opponent's team)</small>
        </label>
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
        <button className="primary" disabled={!team} onClick={start}>Start {label(course)}</button>
      </div>
    </section>
  );
}
