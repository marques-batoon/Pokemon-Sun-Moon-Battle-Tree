import type { Nature } from '@pkmn/data';
import { gen7 } from '../../team/dex';
import { battleLevel, battleSpecies, calcStats, evTotal, withEv, withIv } from '../../team/sets';
import { MAX_EV_STAT, MAX_EV_TOTAL, MAX_IV, STAT_IDS, STAT_LABELS, type PokemonSet } from '../../team/types';

interface Props {
  set: PokemonSet;
  onChange: (set: PokemonSet) => void;
}

/** EV / IV inputs with live final stats at the battle level. */
export function StatTable({ set, onChange }: Props) {
  const species = gen7.species.get(battleSpecies(set));
  const nature = gen7.natures.get(set.nature) as Nature | undefined;
  const stats = calcStats(set);
  const remaining = MAX_EV_TOTAL - evTotal(set);
  const maxBase = 180;

  return (
    <table className="stat-table">
      <caption className="muted small">Stats at Lv. {battleLevel(set)}{set.level > 50 ? ' (battle level; registered Lv. ' + set.level + ')' : ''}</caption>
      <thead>
        <tr><th scope="col">Stat</th><th scope="col">Base</th><th scope="col">EVs</th><th scope="col">IVs</th><th scope="col">Total</th></tr>
      </thead>
      <tbody>
        {STAT_IDS.map(stat => {
          const base = species?.baseStats[stat] ?? 0;
          const mod = nature?.plus === stat ? 'plus' : nature?.minus === stat ? 'minus' : '';
          return (
            <tr key={stat}>
              <th scope="row" className={`stat-${mod}`}>{STAT_LABELS[stat]}{mod === 'plus' ? ' +' : mod === 'minus' ? ' −' : ''}</th>
              <td className="stat-base">
                <span className="base-num">{base}</span>
                <span className="base-track" aria-hidden="true">
                  <span className="base-bar" style={{ width: `${Math.min(100, (base / maxBase) * 100)}%` }} />
                </span>
              </td>
              <td className="ev-cell">
                <input
                  type="range" min={0} max={MAX_EV_STAT} step={4} value={set.evs[stat]}
                  aria-label={`${STAT_LABELS[stat]} EVs slider`}
                  onChange={e => onChange(withEv(set, stat, Number(e.target.value)))}
                />
                <input
                  type="number" min={0} max={MAX_EV_STAT} value={set.evs[stat]} className="num"
                  aria-label={`${STAT_LABELS[stat]} EVs`}
                  onChange={e => onChange(withEv(set, stat, Number(e.target.value)))}
                />
              </td>
              <td>
                <input
                  type="number" min={0} max={MAX_IV} value={set.ivs[stat]} className="num"
                  aria-label={`${STAT_LABELS[stat]} IVs`}
                  onChange={e => onChange(withIv(set, stat, Number(e.target.value)))}
                />
              </td>
              <td className={`stat-total stat-${mod}`}>{stats[stat]}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5} className={remaining < 0 ? 'error-text' : 'muted small'}>
            EVs: {MAX_EV_TOTAL - remaining} / {MAX_EV_TOTAL} ({remaining} left, max {MAX_EV_STAT} per stat)
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
