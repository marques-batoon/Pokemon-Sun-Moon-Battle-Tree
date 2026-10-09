import { useEffect, useRef, useState } from 'react';
import type { RunTeam } from '../../run/controller';
import { BRING, MIN_REGISTERED, type Format } from '../../run/types';
import { groupProblems } from '../../team/problems';
import type { SavedTeam } from '../../team/types';
import { useTeamValidation } from '../builder/hooks';
import { TypeBadge } from '../battle/TypeBadge';
import { gen7 } from '../../team/dex';

interface Props {
  /** Singles (bring 3), Doubles (bring 4) or Multi (bring 2). */
  format?: Format;
  teams: readonly SavedTeam[];
  initial?: RunTeam;
  /** Called with the chosen team, or null while it's incomplete or illegal. */
  onChange: (team: RunTeam | null) => void;
}

/** Pick a saved team and the 3 (Doubles: 4, Multi: 2) to bring, in battle order (lead first; Doubles: first two lead). Validated through the engine. */
const FORMAT_NAME: Record<Format, string> = { singles: 'Singles', doubles: 'Doubles', multi: 'Multi' };

export function TeamSetup({ format = 'singles', teams, initial, onChange }: Props) {
  const n = BRING[format];
  const min = MIN_REGISTERED[format];
  const [teamId, setTeamId] = useState(initial?.sourceTeamId ?? teams[0]?.id ?? '');
  const team = teams.find(t => t.id === teamId);
  const [bring, setBring] = useState<number[]>(initial && initial.sourceTeamId === teamId ? initial.bring : []);
  const { pending, result } = useTeamValidation(team?.sets ?? [], format);
  const problems = groupProblems([...(result?.team ?? []), ...(result?.sets.flat() ?? [])]);
  const legal = !!team && !pending && problems.length === 0 && team.sets.length >= min;
  const ready = legal && bring.length === n;

  // Latest callback in a ref: the parent's inline onChange changes identity every
  // render, and re-emitting on that would loop. Emit only when the choice changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const bringKey = bring.join(',');
  useEffect(() => {
    onChangeRef.current(ready && team ? { sourceTeamId: team.id, name: team.name, sets: team.sets, bring: bringKey.split(',').map(Number) } : null);
  }, [ready, team, bringKey]);

  const toggle = (i: number) =>
    setBring(b => (b.includes(i) ? b.filter(x => x !== i) : b.length < n ? [...b, i] : b));

  if (!teams.length) {
    return <p className="notice">No saved teams. Build one in the <a href="#/builder">Team Builder</a> first.</p>;
  }

  return (
    <div className="team-setup">
      <label className="fld">
        <span>Registered team</span>
        <select value={teamId} onChange={e => { setTeamId(e.target.value); setBring([]); }}>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.sets.length})</option>)}
        </select>
      </label>
      {team && (
        <>
          <div className="muted small">
            {pending ? 'Checking team…' : legal ? `Legal. Choose ${n} to bring, in battle order (${format === 'doubles' ? 'first two lead' : 'first = lead'}).` : null}
          </div>
          {!pending && problems.length > 0 && (
            <ul className="problems">
              {problems.map(p => <li key={p}>{p}</li>)}
              <li><a href="#/builder">Fix it in the Team Builder</a></li>
            </ul>
          )}
          {team.sets.length < min && <p className="problems">A {FORMAT_NAME[format]} team needs at least {min} Pokémon.</p>}
          <div className="preview-row">
            {team.sets.map((s, i) => {
              const order = bring.indexOf(i);
              const species = gen7.species.get(s.species);
              return (
                <button key={i} type="button" className={`preview-card ${order >= 0 ? 'picked' : ''}`} onClick={() => toggle(i)} disabled={!legal} aria-pressed={order >= 0}>
                  {order >= 0 && <span className="pick-order">{order + 1}</span>}
                  <strong>{s.name !== s.species ? s.name : s.species}</strong>
                  <div>{species?.types.map(t => <TypeBadge key={t} type={t} />)}</div>
                  <small>{s.item ? `@ ${s.item}` : 'No item'}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
