import { useState } from 'react';
import { pairedTrainer, TRAINERS, type SpecialTrainer } from '../../data/battle-tree';
import type { Format } from '../../run/types';

const SPECIALS = TRAINERS.filter((t): t is SpecialTrainer => t.kind === 'special');
const GROUPS = [
  { label: 'Battle Tree special trainers', trainers: SPECIALS.filter(t => !t.custom) },
  { label: 'Gym Leaders', trainers: SPECIALS.filter(t => t.custom).sort((a, b) => a.name.localeCompare(b.name)) },
];

function TrainerSelect({ value, onChange, exclude, label, disabled = false }: {
  value: number | null; onChange: (id: number) => void; exclude: number[]; label: string; disabled?: boolean;
}) {
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value ?? ''} disabled={disabled} onChange={e => onChange(Number(e.target.value))}>
        <option value="" disabled>Choose…</option>
        {GROUPS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.trainers.filter(t => !exclude.includes(t.id) || t.id === value).map(t => (
              <option key={t.id} value={t.id}>{t.class} {t.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/**
 * Debug: pick the special trainer(s) for the next battle (two in a Multi Battle). Tate and Liza
 * come as a pair in Multi: picking one fills in the other.
 */
export function DebugOpponentPicker({ format, exclude = [], onApply }: { format: Format; exclude?: number[]; onApply: (ids: number[]) => void }) {
  const multi = format === 'multi';
  const [first, setFirst] = useState<number | null>(null);
  const [second, setSecond] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstPair = multi && first !== null ? pairedTrainer(first) : null;
  const shownSecond = firstPair ? firstPair.partnerId : second;
  // Paired trainers can't be the second pick on their own (they bring their twin).
  const pairedIds = SPECIALS.filter(t => pairedTrainer(t.id)).map(t => t.id);
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
        <TrainerSelect label={multi ? 'Opponent 1' : 'Special trainer'} value={first} exclude={exclude} onChange={id => { setFirst(id); if (id === second) setSecond(null); }} />
        {multi && (
          <TrainerSelect
            label="Opponent 2"
            value={shownSecond}
            disabled={!!firstPair}
            exclude={[...exclude, ...(first === null ? [] : [first]), ...pairedIds]}
            onChange={setSecond}
          />
        )}
        <button type="button" disabled={!ready} onClick={apply}>Use for the next battle</button>
      </div>
      {firstPair && <p className="muted small">{TRAINERS[first!].name} and {TRAINERS[firstPair.partnerId].name} always battle together in Multi Battles.</p>}
      <p className="muted small">Their teams are drawn as usual. Choosing opponents makes the challenge unranked.</p>
      {error && <p className="problems">{error}</p>}
    </details>
  );
}
