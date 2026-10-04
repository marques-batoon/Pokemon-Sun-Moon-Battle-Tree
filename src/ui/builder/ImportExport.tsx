import { useMemo, useRef, useState } from 'react';
import { importShowdownText, type ImportedTeam } from '../../team/showdown-text';
import type { PokemonSet } from '../../team/types';
import { Modal } from '../components/Modal';

interface ExportProps {
  title: string;
  /** Showdown text to show, copy and download. */
  text: string;
  /** Download file name (".txt"); a function is evaluated when the download starts. */
  filename: string | (() => string);
  note?: string;
  onClose: () => void;
}

export function ExportDialog({ title, text, filename, note, onClose }: ExportProps) {
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = typeof filename === 'function' ? filename() : filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={download}>Download .txt</button>
          <button className="primary" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
        </>
      }
    >
      <p className="muted small">{note ?? 'Showdown format. Paste into Showdown\'s teambuilder ("Import from text") or back into this app.'}</p>
      <textarea className="code-area" readOnly value={text} rows={18} onFocus={e => e.target.select()} aria-label="Export text" />
    </Modal>
  );
}

interface ImportProps {
  /** When set, offers "Replace this team" for single-team imports. */
  currentTeamName?: string;
  /** Number of saved teams; when > 0 a full backup can replace them all. */
  existingTeamCount?: number;
  onCreate: (teams: ImportedTeam[]) => void;
  onReplace?: (sets: PokemonSet[]) => void;
  onReplaceAll?: (teams: ImportedTeam[]) => void;
  onClose: () => void;
}

export function ImportDialog({ currentTeamName, existingTeamCount = 0, onCreate, onReplace, onReplaceAll, onClose }: ImportProps) {
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (text.trim() ? importShowdownText(text) : null), [text]);
  const teams = parsed?.teams ?? [];
  const many = teams.length > 1;

  const loadFile = async (file: File) => {
    setFileError(null);
    if (file.size > 2_000_000) { setFileError('That file is too large to be a team export.'); return; }
    setText(await file.text());
  };

  return (
    <Modal
      title="Import teams"
      onClose={onClose}
      footer={
        <>
          {onReplace && teams.length === 1 && (
            <button onClick={() => { onReplace(teams[0].sets); onClose(); }}>Replace “{currentTeamName}”</button>
          )}
          {onReplaceAll && teams.length > 0 && existingTeamCount > 0 && (
            <button
              className="danger"
              onClick={() => {
                if (!confirm(`Replace all ${existingTeamCount} saved team${existingTeamCount === 1 ? '' : 's'} with the ${teams.length} imported team${many ? 's' : ''}? This can't be undone.`)) return;
                onReplaceAll(teams);
                onClose();
              }}
            >
              Replace all my teams
            </button>
          )}
          <button className="primary" disabled={!teams.length} onClick={() => { onCreate(teams); onClose(); }}>
            {many ? `Add ${teams.length} teams` : 'Add as new team'}
          </button>
        </>
      }
    >
      <p className="muted small">
        Paste one team, or a backup of several teams (Showdown's "Backup all teams" or this app's "Export all"), or load a .txt file.
      </p>
      <div className="row-actions">
        <button onClick={() => fileRef.current?.click()}>Load from file…</button>
        <input ref={fileRef} type="file" accept=".txt,text/plain" className="visually-hidden" tabIndex={-1}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void loadFile(f); }} />
        {fileError && <span className="error-text small">{fileError}</span>}
      </div>
      <textarea
        className="code-area"
        rows={14}
        value={text}
        placeholder={'Garchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Outrage\n…\n\nor several teams:\n=== [gen7battlespotsingles] Rain ===\n…'}
        onChange={e => setText(e.target.value)}
        aria-label="Showdown team text"
      />
      {teams.length > 0 && (
        <div className="import-preview">
          <strong>{teams.length} team{many ? 's' : ''} found:</strong>
          <ul>
            {teams.map((t, i) => (
              <li key={i}><strong>{t.name ?? 'Untitled team'}</strong>: {t.sets.map(s => s.species).join(', ')}</li>
            ))}
          </ul>
        </div>
      )}
      {parsed && parsed.warnings.length > 0 && (
        <ul className="problems">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      <p className="muted small">A missing "Level:" line means Lv. 100, as in Showdown. Pokémon above Lv. 50 battle at 50.</p>
    </Modal>
  );
}

interface PokemonImportProps {
  /** "add": add the pasted Pokémon to the team (as many as there's room for); "replace": replace one Pokémon. */
  mode: 'add' | 'replace';
  /** Free team slots ("add"). */
  room: number;
  /** Name of the Pokémon being replaced ("replace"). */
  replacing?: string;
  onImport: (sets: PokemonSet[]) => void;
  onClose: () => void;
}

/** Paste individual Pokémon in Showdown format, to add to a team or replace one slot. */
export function PokemonImportDialog({ mode, room, replacing, onImport, onClose }: PokemonImportProps) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim() ? importShowdownText(text) : null), [text]);
  const found = parsed?.teams.flatMap(t => t.sets) ?? [];
  const limit = mode === 'replace' ? 1 : room;
  const sets = found.slice(0, limit);
  const leftOver = found.length - sets.length;
  const label = (s: PokemonSet) => `${s.name !== s.species ? `${s.name} (${s.species})` : s.species}${s.item ? ` @ ${s.item}` : ''}`;

  return (
    <Modal
      title={mode === 'replace' ? `Paste over ${replacing ?? 'this Pokémon'}` : 'Paste a Pokémon'}
      onClose={onClose}
      footer={
        <button className="primary" disabled={!sets.length} onClick={() => { onImport(sets); onClose(); }}>
          {mode === 'replace' ? `Replace ${replacing ?? 'Pokémon'}` : sets.length > 1 ? `Add ${sets.length} Pokémon` : 'Add to team'}
        </button>
      }
    >
      <p className="muted small">
        Paste one Pokémon in Showdown format, e.g. copied from Showdown's teambuilder, a forum post, or this app's
        {' '}Export.{mode === 'add' && room > 1 ? ` You can paste up to ${room} at once.` : ''}
      </p>
      <textarea
        className="code-area"
        rows={10}
        value={text}
        placeholder={'Garchomp @ Choice Scarf\nAbility: Rough Skin\nLevel: 50\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Outrage\n- Stone Edge\n- Fire Fang'}
        onChange={e => setText(e.target.value)}
        aria-label="Showdown Pokémon text"
        autoFocus
      />
      {sets.length > 0 && (
        <div className="import-preview">
          <strong>{mode === 'replace' ? 'Replacing with:' : `${sets.length} Pokémon found:`}</strong>
          <ul>{sets.map((s, i) => <li key={i}>{label(s)}</li>)}</ul>
        </div>
      )}
      {leftOver > 0 && (
        <p className="error-text small">
          {mode === 'replace'
            ? `Only the first Pokémon is used; ${leftOver} more ${leftOver === 1 ? 'was' : 'were'} ignored.`
            : `The team only has room for ${room}; ${leftOver} more ${leftOver === 1 ? 'was' : 'were'} ignored.`}
        </p>
      )}
      {parsed && !found.length && <p className="error-text small">No Pokémon found in that text.</p>}
      {parsed && parsed.warnings.length > 0 && (
        <ul className="problems">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      <p className="muted small">A missing "Level:" line means Lv. 100, as in Showdown. Pokémon above Lv. 50 battle at 50.</p>
    </Modal>
  );
}
