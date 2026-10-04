import { useRef, useState, useSyncExternalStore } from 'react';
import { SETS, TRAINERS } from '../../data/battle-tree';
import type { RunSettings, TreeProfile } from '../../run/types';
import type { AnimationSpeed, ThemeSetting } from '../../settings/settings-store';
import { checkBackup, createBackup, restoreBackup, type Backup } from '../../storage/backup';
import { useTeams } from '../builder/hooks';
import { getKeyValueStore, getRunController, getSettingsStore, getTeamStore } from '../services';
import { keyLabel, useRunState } from '../tree/hooks';
import { RUN_KEYS } from '../../run/types';

export function SettingsPage() {
  const store = getSettingsStore();
  const settings = useSyncExternalStore(store.subscribe, store.getSettings);
  const controller = getRunController();
  const tree = useRunState(controller);
  const teamStore = getTeamStore();
  const teams = useTeams(teamStore);
  const defaults = tree.profile.settings;
  const setDefault = (patch: Partial<RunSettings>) => controller.updateDefaults(patch);

  return (
    <div className="settings">
      <section className="panel">
        <h2>Appearance</h2>
        <fieldset className="choice-row">
          <legend>Theme</legend>
          {(['system', 'light', 'dark'] as ThemeSetting[]).map(t => (
            <label key={t}>
              <input type="radio" name="theme" checked={settings.theme === t} onChange={() => store.update({ theme: t })} />
              {' '}{t === 'system' ? 'Match system' : t === 'light' ? 'Light' : 'Dark'}
            </label>
          ))}
        </fieldset>
        <Toggle checked={settings.sprites} onChange={v => store.update({ sprites: v })}
          label="Pokémon sprites and trainer portraits" hint="Loaded from Pokémon Showdown's sprite server (needs an internet connection; © Nintendo / Creatures / GAME FREAK). Off: type-colored placeholders." />
      </section>

      <section className="panel">
        <h2>Battle</h2>
        <fieldset className="choice-row">
          <legend>Animation speed</legend>
          {(['off', 'fast', 'normal', 'slow'] as AnimationSpeed[]).map(sp => (
            <label key={sp}>
              <input type="radio" name="anim" checked={settings.animationSpeed === sp} onChange={() => store.update({ animationSpeed: sp })} />
              {' '}{sp === 'off' ? 'Off (instant)' : sp[0].toUpperCase() + sp.slice(1)}
            </label>
          ))}
        </fieldset>
        <p className="muted small">Moves, damage, switches and faints play one at a time and the battle log advances as each finishes. "Skip" during a battle jumps to the end of the turn.</p>
        <Toggle checked={settings.effectivenessHints} onChange={v => store.update({ effectivenessHints: v })}
          label="Move effectiveness hints" hint='Label moves "Super effective", "Not very effective" or "No effect" against the opposing Pokémon, as Sun & Moon do. Abilities are not taken into account.' />
        <Toggle checked={settings.keyboardShortcuts} onChange={v => store.update({ keyboardShortcuts: v })}
          label="Keyboard shortcuts" hint="Keys 1-4 use moves; M toggles Mega Evolution and Z toggles the Z-Move." />
      </section>

      <section className="panel">
        <h2>New challenge defaults</h2>
        <p className="muted small">Pre-filled when you start a challenge. Each challenge keeps the settings it started with.</p>
        <Toggle checked={defaults.anabelUnlocked} onChange={v => setDefault({ anabelUnlocked: v })}
          label="Anabel can appear" hint="In the game she appears only after you reach Guzzlord's chapter of the Looker episode." />
        <Toggle checked={defaults.teamPreviewEachBattle} onChange={v => setDefault({ teamPreviewEachBattle: v })}
          label="Team Preview before every battle" hint="Showdown-style. In the game you bring the same 3 until you take a break, and never see the opponent's team in advance." />
        <label className="inline-field">
          Opponent AI{' '}
          <select value={defaults.ai} onChange={e => setDefault({ ai: e.target.value as RunSettings['ai'] })}>
            <option value="heuristic">Battle Tree AI</option>
            <option value="random">Random (practice; doesn't count toward records)</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>Developer</h2>
        <Toggle checked={settings.showDebugTools} onChange={v => store.update({ showDebugTools: v })}
          label="Show debug tools" hint='Battle seeds and input logs, "start at battle N" and "unlock Super" when starting a challenge. Debug challenges never count toward records.' />
      </section>

      <DataSection
        teamCount={teams.length}
        records={tree.profile.records}
        onResetProgress={() => controller.resetProgress()}
        onDeleteTeams={() => teamStore.clear()}
      />

      <section className="panel">
        <h2>About</h2>
        <p className="small">
          Battle Tree data: Pokémon Sun &amp; Moon (v1.1), {SETS.length} Pokémon sets and {TRAINERS.length} trainers, datamined
          and cross-checked against Bulbapedia and community spreadsheets. Battles run on Pokémon Showdown's simulator (<code>@pkmn/sim</code>);
          the opponent AI approximates the in-game AI using <code>@smogon/calc</code>.
        </p>
        <p className="muted small">Sources, approximations and known deviations are documented in DATA_NOTES.md and AI_NOTES.md in the project.</p>
      </section>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint && <span className="muted small">{hint}</span>}
      </span>
    </label>
  );
}

function DataSection({ teamCount, records, onResetProgress, onDeleteTeams }: {
  teamCount: number;
  records: TreeProfile['records'];
  onResetProgress: () => void;
  onDeleteTeams: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const exportBackup = () => {
    const backup = createBackup(getKeyValueStore());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battle-tree-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: 'ok', text: 'Backup downloaded.' });
  };

  const importBackup = async (file: File) => {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { setMessage({ kind: 'error', text: 'That file is not valid JSON.' }); return; }
    const problem = checkBackup(parsed);
    if (problem) { setMessage({ kind: 'error', text: problem }); return; }
    if (!confirm('Restoring replaces all your teams, Battle Tree progress and settings with the backup. Continue?')) return;
    restoreBackup(getKeyValueStore(), parsed as Backup);
    window.location.reload();
  };

  return (
    <section className="panel">
      <h2>Data</h2>
      <p className="muted small">
        Saved in this browser only: {teamCount} team{teamCount === 1 ? '' : 's'}; best streaks {RUN_KEYS.map(k => `${keyLabel(k)} ${records[k].best}`).join(', ')}.
        Back up to move to another browser or device.
      </p>
      <div className="row-actions">
        <button onClick={exportBackup}>Download backup</button>
        <button onClick={() => fileRef.current?.click()}>Restore from backup…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importBackup(f); }} />
      </div>
      <div className="row-actions">
        <button className="danger" onClick={() => {
          if (confirm('Reset Battle Tree progress? Records, BP, the Super Singles unlock and saved challenges are erased. Teams are kept.')) {
            onResetProgress(); setMessage({ kind: 'ok', text: 'Battle Tree progress reset.' });
          }
        }}>Reset Battle Tree progress</button>
        <button className="danger" disabled={!teamCount} onClick={() => {
          if (confirm(`Delete all ${teamCount} teams? This can't be undone (download a backup first if unsure).`)) {
            onDeleteTeams(); setMessage({ kind: 'ok', text: 'All teams deleted.' });
          }
        }}>Delete all teams</button>
      </div>
      {message && <p className={message.kind === 'error' ? 'error-text small' : 'muted small'} role="status">{message.text}</p>}
    </section>
  );
}
