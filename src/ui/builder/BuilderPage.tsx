import { useState } from 'react';
import type { TeamStore } from '../../storage/team-store';
import { exportShowdownBackup } from '../../team/showdown-text';
import { ExportDialog, ImportDialog } from './ImportExport';
import { TeamEditor } from './TeamEditor';
import { useTeams } from './hooks';

export function BuilderPage({ store }: { store: TeamStore }) {
  const teams = useTeams(store);
  const [selectedId, setSelectedId] = useState<string | null>(teams[0]?.id ?? null);
  const [dialog, setDialog] = useState<'import' | 'export-all' | null>(null);
  const selected = teams.find(t => t.id === selectedId) ?? teams[0] ?? null;

  return (
    <div className="builder">
      <aside className="team-list" aria-label="Saved teams">
        <div className="team-list-actions">
          <button className="primary" onClick={() => setSelectedId(store.create(`Team ${teams.length + 1}`).id)}>New team</button>
          <button onClick={() => setDialog('import')}>Import</button>
          <button onClick={() => setDialog('export-all')} disabled={!teams.some(t => t.sets.length)}>Export all</button>
        </div>
        {teams.length === 0 && <p className="muted small">No teams yet. Create one or import from Showdown text.</p>}
        <ul>
          {teams.map(t => (
            <li key={t.id}>
              <button className={`team-item ${selected?.id === t.id ? 'selected' : ''}`} onClick={() => setSelectedId(t.id)}>
                <strong>{t.name || 'Untitled team'}</strong>
                <small>{t.sets.length ? t.sets.map(s => s.species).join(' · ') : 'Empty'}</small>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <div className="team-list-actions">
            <button onClick={() => { const c = store.duplicate(selected.id); if (c) setSelectedId(c.id); }}>Duplicate</button>
            <button className="danger" onClick={() => { if (confirm(`Delete “${selected.name}”? This can't be undone.`)) store.remove(selected.id); }}>Delete</button>
          </div>
        )}
      </aside>

      {selected ? (
        <TeamEditor key={selected.id} team={selected} store={store} onSelectTeam={setSelectedId} />
      ) : (
        <section className="team-editor empty-state">
          <p>Create a team to start building.</p>
        </section>
      )}

      {dialog === 'import' && (
        <ImportDialog
          existingTeamCount={teams.length}
          onClose={() => setDialog(null)}
          onCreate={imported => {
            const created = imported.map(t => store.create(t.name ?? 'Imported team', t.sets));
            if (created[0]) setSelectedId(created[0].id);
          }}
          onReplaceAll={imported => {
            const created = store.replaceAll(imported.map(t => ({ name: t.name ?? 'Imported team', sets: t.sets })));
            setSelectedId(created[0]?.id ?? null);
          }}
        />
      )}
      {dialog === 'export-all' && (
        <ExportDialog
          title={`Export all teams (${teams.filter(t => t.sets.length).length})`}
          text={exportShowdownBackup(teams)}
          filename={() => `battle-tree-teams-${new Date().toISOString().slice(0, 10)}.txt`}
          note={'Showdown backup format: one "=== [format] Name ===" block per team. Import it here with "Import", or in Showdown\'s teambuilder via "Backup all teams" / import. Empty teams are left out.'}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
