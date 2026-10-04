import { useState } from 'react';
import type { Specie } from '@pkmn/data';
import type { TeamStore } from '../../storage/team-store';
import { slotConflicts } from '../../team/checks';
import { eligibleSpecies, gen7 } from '../../team/dex';
import { groupProblems } from '../../team/problems';
import { newSet } from '../../team/sets';
import { MAX_TEAM_SIZE, type PokemonSet, type SavedTeam } from '../../team/types';
import { SearchSelect } from '../components/SearchSelect';
import { useTeamValidation } from './hooks';
import { ExportDialog, ImportDialog, PokemonImportDialog } from './ImportExport';
import { exportShowdownText, fileNameFor } from '../../team/showdown-text';
import { SetEditor, SpeciesOption } from './SetEditor';
import { PokemonIcon } from '../components/PokemonSprite';

interface Props {
  team: SavedTeam;
  store: TeamStore;
  onSelectTeam: (id: string) => void;
}

export function TeamEditor({ team, store, onSelectTeam }: Props) {
  const [slot, setSlot] = useState(0);
  const [dialog, setDialog] = useState<'import' | 'export' | 'paste-add' | 'paste-replace' | 'export-one' | null>(null);
  // Bumped when a slot is replaced by pasting, so its editor starts fresh.
  const [editorVersion, setEditorVersion] = useState(0);
  const { pending, result } = useTeamValidation(team.sets);
  const conflicts = slotConflicts(team.sets);
  const adding = slot >= team.sets.length;
  const setSets = (sets: PokemonSet[]) => store.update(team.id, { sets });

  const teamProblems = groupProblems(result?.team ?? []);
  const problemsFor = (i: number) => groupProblems(result?.sets[i] ?? []);
  const problemCount = teamProblems.length + team.sets.reduce((n, _, i) => n + problemsFor(i).length, 0);

  const move = (from: number, to: number) => {
    const sets = [...team.sets];
    const [s] = sets.splice(from, 1);
    sets.splice(to, 0, s);
    setSets(sets);
    setSlot(to);
  };

  return (
    <section className="team-editor" aria-label={`Editing ${team.name}`}>
      <div className="editor-head">
        <input className="team-name" value={team.name} aria-label="Team name" onChange={e => store.update(team.id, { name: e.target.value })} />
        <span className={`status-chip ${pending ? 'checking' : problemCount ? 'bad' : 'good'}`} role="status">
          {pending ? 'Checking…' : problemCount ? `${problemCount} problem${problemCount > 1 ? 's' : ''}` : team.sets.length ? 'Legal for the Battle Tree' : 'Empty'}
        </span>
        <span className="spacer" />
        <button onClick={() => setDialog('import')}>Import</button>
        <button onClick={() => setDialog('export')} disabled={!team.sets.length}>Export</button>
      </div>

      <div className="slot-strip" role="tablist" aria-label="Team members">
        {team.sets.map((s, i) => {
          const bad = problemsFor(i).length > 0 || conflicts.any.has(i);
          return (
            <button key={i} role="tab" aria-selected={slot === i} className={`slot-card ${slot === i ? 'selected' : ''} ${bad ? 'bad' : ''}`} onClick={() => setSlot(i)}>
              <strong className="slot-name"><PokemonIcon species={s.species} />{s.name !== s.species ? `${s.name} (${s.species})` : s.species}</strong>
              <small>{s.item || 'No item'}</small>
              {bad && <span className="dot" aria-label="has problems" />}
            </button>
          );
        })}
        {team.sets.length < MAX_TEAM_SIZE && (
          <button role="tab" aria-selected={adding} className={`slot-card add ${adding ? 'selected' : ''}`} onClick={() => setSlot(team.sets.length)}>
            + Add Pokémon
          </button>
        )}
      </div>

      {teamProblems.length > 0 && (
        <ul className="problems team-problems" aria-label="Team problems">
          {teamProblems.map(p => <li key={p}>{p}</li>)}
        </ul>
      )}

      {adding ? (
        <div className="add-panel">
          <label className="fld fld-wide">
            <span>Choose a Pokémon</span>
            <SearchSelect<Specie>
              ariaLabel="Choose a Pokémon"
              value=""
              placeholder="Type to search…"
              options={eligibleSpecies()}
              getKey={s => s.id}
              getLabel={s => s.name}
              renderOption={s => <SpeciesOption s={s} />}
              onSelect={s => { if (s) { setSets([...team.sets, newSet(s.name)]); setSlot(team.sets.length); } }}
            />
          </label>
          <div className="row-actions">
            <span className="muted small">or</span>
            <button onClick={() => setDialog('paste-add')}>Paste from Showdown…</button>
          </div>
          <p className="muted small">
            {eligibleSpecies().length} Pokémon available. Sun/Moon Battle Tree rules: restricted legendaries and mythicals are banned; Pokémon above Lv. 50 battle at 50.
          </p>
        </div>
      ) : (
        <>
          <div className="slot-actions">
            <button disabled={slot === 0} onClick={() => move(slot, slot - 1)} aria-label="Move left">←</button>
            <button disabled={slot === team.sets.length - 1} onClick={() => move(slot, slot + 1)} aria-label="Move right">→</button>
            <span className="spacer" />
            <button onClick={() => setDialog('export-one')}>Export {gen7.species.get(team.sets[slot].species)?.name}</button>
            <button onClick={() => setDialog('paste-replace')}>Paste over…</button>
            <button className="danger" onClick={() => { setSets(team.sets.filter((_, i) => i !== slot)); setSlot(Math.max(0, slot - 1)); }}>
              Remove {gen7.species.get(team.sets[slot].species)?.name}
            </button>
          </div>
          <SetEditor
            key={`${slot}:${editorVersion}`}
            set={team.sets[slot]}
            problems={problemsFor(slot)}
            speciesConflict={conflicts.species.has(slot)}
            itemConflict={conflicts.items.has(slot)}
            onChange={s => setSets(team.sets.map((x, i) => (i === slot ? s : x)))}
          />
        </>
      )}

      {dialog === 'export' && (
        <ExportDialog title={`Export: ${team.name}`} text={exportShowdownText(team.sets)} filename={fileNameFor(team.name)} onClose={() => setDialog(null)} />
      )}
      {dialog === 'export-one' && !adding && (
        <ExportDialog
          title={`Export: ${team.sets[slot].name}`}
          text={exportShowdownText([team.sets[slot]])}
          filename={fileNameFor(team.sets[slot].name)}
          note={'Showdown format. Paste into Showdown\'s teambuilder or into "Paste from Showdown…" in this app.'}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'paste-add' && (
        <PokemonImportDialog
          mode="add"
          room={MAX_TEAM_SIZE - team.sets.length}
          onImport={sets => { setSets([...team.sets, ...sets]); setSlot(team.sets.length); }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'paste-replace' && !adding && (
        <PokemonImportDialog
          mode="replace"
          room={1}
          replacing={team.sets[slot].name}
          onImport={([set]) => { setSets(team.sets.map((x, i) => (i === slot ? set : x))); setEditorVersion(v => v + 1); }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'import' && (
        <ImportDialog
          currentTeamName={team.name}
          onClose={() => setDialog(null)}
          onReplace={sets => { setSets(sets); setSlot(0); }}
          onCreate={teams => {
            const created = teams.map(t => store.create(t.name ?? 'Imported team', t.sets));
            if (created[0]) onSelectTeam(created[0].id);
          }}
        />
      )}
    </section>
  );
}
