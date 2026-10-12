import type { Nature } from '@pkmn/data';
import { gen7 } from '../../team/dex';
import { battleLevel, battleSpecies, calcStats, evTotal, withEv, withIv } from '../../team/sets';
import { MAX_EV_STAT, MAX_EV_TOTAL, MAX_IV, STAT_IDS, STAT_LABELS, type PokemonSet } from '../../team/types';
import { getSettingsStore } from '../services';
import { useAppSettings } from '../useAppSettings';

interface Props {
  set: PokemonSet;
  onChange: (set: PokemonSet) => void;
}

/** EV / IV inputs with live final stats at the battle level (and, if chosen, at Lv. 100 for comparison). */
export function StatTable({ set, onChange }: Props) {
  const species = gen7.species.get(battleSpecies(set));
  const nature = gen7.natures.get(set.nature) as Nature | undefined;
  const stats = calcStats(set);
  const { showLevel100Stats: show100 } = useAppSettings();
  const stats100 = show100 ? calcStats(set, 100) : null;
  const remaining = MAX_EV_TOTAL - evTotal(set);
  const maxBase = 180;

  return (
    <table className="stat-table">
      <caption className="muted small">
        <div className="stat-caption">
          <span>Stats at Lv. {battleLevel(set)}{set.level > 50 ? ' (battle level; registered Lv. ' + set.level + ')' : ''}</span>
          <label className="lv100-toggle">
            <input type="checkbox" checked={show100} onChange={e => getSettingsStore().update({ showLevel100Stats: e.target.checked })} />
            {' '}Show Lv. 100 stats
          </label>
        </div>
      </caption>
      <thead>
        <tr>
          <th scope="col">Stat</th><th scope="col">Base</th><th scope="col">EVs</th><th scope="col">IVs</th><th scope="col">Total</th>
          {stats100 && <th scope="col" className="stat-lv100" title="What this Pokémon's stats would be at Lv. 100 (battles here are at Lv. 50)">Lv. 100</th>}
        </tr>
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
              {stats100 && <td className={`stat-lv100 stat-${mod}`}>{stats100[stat]}</td>}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={stats100 ? 6 : 5} className={remaining < 0 ? 'error-text' : 'muted small'}>
            EVs: {MAX_EV_TOTAL - remaining} / {MAX_EV_TOTAL} ({remaining} left, max {MAX_EV_STAT} per stat)
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
