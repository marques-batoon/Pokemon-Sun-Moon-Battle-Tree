import { useMemo, useState } from 'react';
import { TRAINERS, type Trainer } from '../../data/battle-tree';
import { canField } from '../../run/opponent';
import { multiDuo, teamSizeFor } from '../../run/selection';
import type { Format } from '../../run/types';

/** How a trainer is listed: Battle Legends say which of their teams (Normal or Super) it is. */
function optionLabel(t: Trainer): string {
  if (t.kind === 'legend' && !t.custom) return `${t.class} ${t.name} (${t.course === 'super' ? 'Super' : 'Normal'} team)`;
  return `${t.class} ${t.name}`;
}

/** The trainers debug mode can pick, grouped, leaving out any that can't field a team in this format. */
function groupsFor(format: Format) {
  const eligible = (t: Trainer) => canField(t, teamSizeFor(t, format));
  return [
    { label: 'Battle Legends', trainers: TRAINERS.filter(t => t.kind === 'legend' && eligible(t)) },
    { label: 'Battle Tree special trainers', trainers: TRAINERS.filter(t => t.kind === 'special' && !t.custom && eligible(t)) },
    { label: 'Gym Leaders', trainers: TRAINERS.filter(t => t.kind === 'special' && t.custom && eligible(t)).sort((a, b) => a.name.localeCompare(b.name)) },
  ].filter(g => g.trainers.length);
}

function TrainerSelect({ value, onChange, exclude, label, groups, disabled = false }: {
  value: number | null; onChange: (id: number) => void; exclude: number[]; label: string; groups: ReturnType<typeof groupsFor>; disabled?: boolean;
}) {
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value ?? ''} disabled={disabled} onChange={e => onChange(Number(e.target.value))}>
        <option value="" disabled>Choose…</option>
        {groups.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.trainers.filter(t => !exclude.includes(t.id) || t.id === value).map(t => (
              <option key={t.id} value={t.id}>{optionLabel(t)}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/**
 * Debug: pick the trainer(s) for the next battle (two in a Multi Battle): special trainers or
 * Battle Legends. Pairs stay together in Multi (Tate and Liza; Marques and Thomas, Marques
 * first): picking one fills in the other.
 */
export function DebugOpponentPicker({ format, exclude = [], onApply }: { format: Format; exclude?: number[]; onApply: (ids: number[]) => void }) {
  const multi = format === 'multi';
  const groups = useMemo(() => groupsFor(format), [format]);
  const [first, setFirst] = useState<number | null>(null);
  const [second, setSecond] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const duo = multi && first !== null ? multiDuo(first) : null;
  const shownSecond = duo ? (duo[0] === first ? duo[1] : duo[0]) : second;
  // Trainers who only battle as a pair can't be the second pick on their own.
  const pairedIds = useMemo(() => TRAINERS.filter(t => multiDuo(t.id)).map(t => t.id), []);
  const ready = first !== null && (!multi || (shownSecond !== null && shownSecond !== first));
  const apply = () => {
    if (!ready) return;
    try {
      onApply(multi ? [first!, shownSecond!] : [first!]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <details className="debug debug-opponents">
      <summary>Debug: choose the next opponent{multi ? 's' : ''}</summary>
      <div className="debug-opponent-row">
        <TrainerSelect label={multi ? 'Opponent 1' : 'Opponent'} value={first} exclude={exclude} groups={groups} onChange={id => { setFirst(id); if (id === second) setSecond(null); }} />
        {multi && (
          <TrainerSelect
            label="Opponent 2"
            value={shownSecond}
            disabled={!!duo}
            exclude={[...exclude, ...(first === null ? [] : [first]), ...pairedIds]}
            groups={groups}
            onChange={setSecond}
          />
        )}
        <button type="button" disabled={!ready} onClick={apply}>Use for the next battle</button>
      </div>
      {duo && <p className="muted small">{TRAINERS[duo[0]].name} and {TRAINERS[duo[1]].name} always battle together in Multi Battles{TRAINERS[duo[0]].custom && TRAINERS[duo[0]].kind === 'legend' ? `, ${TRAINERS[duo[0]].name} first` : ''}.</p>}
      <p className="muted small">Their teams are drawn as usual. Choosing opponents makes the challenge unranked.</p>
      {error && <p className="problems">{error}</p>}
    </details>
  );
}
