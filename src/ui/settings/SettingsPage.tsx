import { useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { SETS, TRAINERS } from '../../data/battle-tree';
import type { RunSettings, TreeProfile } from '../../run/types';
import { BATTLE_BACKGROUNDS, type AnimationSpeed, type SpriteStyle, type ThemeSetting } from '../../settings/settings-store';
import { StageBackdrop } from '../battle/StageBackdrop';
import { horizonVar } from '../battle/fx/geometry';
import { checkBackup, createBackup, restoreBackup, type Backup } from '../../storage/backup';
import { useTeams } from '../builder/hooks';
import { getKeyValueStore, getRunController, getSettingsStore, getTeamStore } from '../services';
import { keyLabel, useRunState } from '../tree/hooks';
import { RUN_KEYS } from '../../run/types';
import { checkDebugPassword } from '../../settings/debug-unlock';
import { TrainerNameField } from '../components/TrainerNameField';
import { TRAINER_NAME_MAX } from '../../online/trainer-name';
import { PLAYER_SPRITES } from '../sprites';
import { PlayerSprite } from '../components/PlayerSprite';

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
        <h2>Trainer</h2>
        <TrainerNameField />
        <p className="muted small">
          Shown in battle, and to your partner in online Multi Battles. Up to {TRAINER_NAME_MAX} letters, numbers, spaces and . ' _ -.
          Not your real name, please: other players can see it.
        </p>
        <fieldset className="choice-row player-sprites">
          <legend>Trainer sprite</legend>
          <p className="muted small">Stands for you in the All Star Duo Tournament. The protagonists' sprites load from Pokémon Showdown's sprite server.</p>
          <div className="player-sprite-grid">
            {PLAYER_SPRITES.map(p => (
              <label key={p.id} className={`player-sprite-choice${settings.trainerSprite === p.id ? ' selected' : ''}`} title={`${p.name} (${p.game})`}>
                <input type="radio" name="trainer-sprite" checked={settings.trainerSprite === p.id} onChange={() => store.update({ trainerSprite: p.id })} />
                <PlayerSprite id={p.id} size={64} label={p.name} />
                <span className="small">{p.name}</span>
                <span className="muted tiny">{p.game}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

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
        <fieldset className="choice-row" disabled={!settings.sprites}>
          <legend>Pokémon sprites</legend>
          {(['2d', '3d'] as SpriteStyle[]).map(st => (
            <label key={st}>
              <input type="radio" name="sprite-style" checked={settings.spriteStyle === st} onChange={() => store.update({ spriteStyle: st })} />
              {' '}{st === '2d' ? '2D pixel sprites' : '3D animated sprites'}
            </label>
          ))}
        </fieldset>
        <p className="muted small">2D: Black and White-style pixel sprites (artwork, then 3D, where a Pokémon has none). 3D: X and Y / Sun and Moon-style animated sprites.</p>
        <Toggle checked={settings.matchSideSprites} onChange={v => store.update({ matchSideSprites: v })}
          label="Matching sprites on your side"
          hint="Some Pokémon have no back sprite (some newer Megas, such as Mega Garchomp Z), so they're shown from the front, flipped. With this on, if any Pokémon on your side (yours, or your partner's in Multi) has none, all of them are shown that way, so they match." />
        <fieldset className="choice-row">
          <legend>Battle background</legend>
          {BATTLE_BACKGROUNDS.map(b => (
            <label key={b.id} className={`bg-choice${settings.battleBackground === b.id ? ' selected' : ''}`}>
              <span className="stage-mini" style={horizonVar as CSSProperties}><StageBackdrop kind={b.id} /></span>
              <span>
                <input type="radio" name="battle-bg" checked={settings.battleBackground === b.id} onChange={() => store.update({ battleBackground: b.id })} />
                {' '}{b.label}
              </span>
            </label>
          ))}
        </fieldset>
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
        <Toggle checked={settings.showBattleLog} onChange={v => store.update({ showBattleLog: v })}
          label="Battle log" hint="The text box with everything that happened in the battle (beside the battle, below it on phones). It can also be hidden or shown from the battle screen; what's happening now always shows under the battle." />
      </section>

      <section className="panel">
        <h2>New challenge defaults</h2>
        <p className="muted small">Pre-filled when you start a challenge. Each challenge keeps the settings it started with.</p>
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
        <DebugToggle on={settings.showDebugTools} onChange={v => store.update({ showDebugTools: v })} />
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

/** The debug tools switch: turning it on asks for the password (turning it off doesn't). */
function DebugToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const close = () => { setAsking(false); setPassword(''); setError(null); };
  const unlock = async () => {
    setChecking(true);
    try {
      if (await checkDebugPassword(password)) { onChange(true); close(); }
      else setError('Wrong password.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };
  return (
    <>
      <Toggle
        checked={on || asking}
        onChange={v => { if (!v) { onChange(false); close(); } else setAsking(true); }}
        label="Show debug tools"
        hint='Battle seeds and input logs, "start at battle N", "unlock Super" and choosing special trainer opponents. Debug challenges never count toward records. Needs the developer password.'
      />
      {asking && !on && (
        <form className="debug-unlock" onSubmit={e => { e.preventDefault(); void unlock(); }}>
          <label className="fld">
            <span>Developer password</span>
            <input type="password" value={password} autoFocus autoComplete="off" onChange={e => { setPassword(e.target.value); setError(null); }} />
          </label>
          <button type="submit" className="primary" disabled={!password || checking}>Unlock</button>
          <button type="button" onClick={close}>Cancel</button>
          {error && <p className="problems" role="alert">{error}</p>}
        </form>
      )}
    </>
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
