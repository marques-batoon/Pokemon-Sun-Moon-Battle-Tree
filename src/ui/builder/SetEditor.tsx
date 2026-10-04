import type { Item, Move, Specie } from '@pkmn/data';
import { allItems, eligibleSpecies, gen7, speciesAbilities } from '../../team/dex';
import { changeSpecies, hiddenPowerType } from '../../team/sets';
import { STAT_LABELS, type PokemonSet } from '../../team/types';
import { SearchSelect } from '../components/SearchSelect';
import { TypeBadge } from '../battle/TypeBadge';
import { useLearnset } from './hooks';
import { StatTable } from './StatTable';
import { PokemonSprite } from '../components/PokemonSprite';

interface Props {
  set: PokemonSet;
  problems: string[];
  /** Another slot has the same species (Species Clause). */
  speciesConflict: boolean;
  /** Another slot holds the same item (Item Clause). */
  itemConflict: boolean;
  onChange: (set: PokemonSet) => void;
}

const natureLabel = (name: string) => {
  const n = gen7.natures.get(name);
  return n?.plus && n.minus ? `${n.name} (+${STAT_LABELS[n.plus]} −${STAT_LABELS[n.minus]})` : `${name} (neutral)`;
};
const NATURES = [...gen7.natures].map(n => n.name).sort();

export function SpeciesOption({ s }: { s: Specie }) {
  return (
    <span className="opt-row">
      <span>{s.name}</span>
      <span className="opt-types">{s.types.map(t => <TypeBadge key={t} type={t} />)}</span>
    </span>
  );
}

function MoveOption({ m }: { m: Move }) {
  return (
    <span className="opt-row">
      <span>{m.name}</span>
      <span className="opt-meta"><TypeBadge type={m.type} /> {m.category} {m.basePower ? m.basePower : ''}</span>
    </span>
  );
}

export function SetEditor({ set, problems, speciesConflict, itemConflict, onChange }: Props) {
  const species = gen7.species.get(set.species);
  const learnset = useLearnset(set.species);
  const abilities = speciesAbilities(set.species);
  const learnable = new Set<string>(learnset?.map(m => m.name));
  const update = (patch: Partial<PokemonSet>) => onChange({ ...set, ...patch });

  const setMove = (i: number, move: Move | null) => {
    const moves = [...set.moves];
    if (move) moves[i] = move.name; else moves.splice(i, 1);
    update({ moves: moves.filter(Boolean).slice(0, 4) });
  };

  return (
    <div className="set-editor">
      <div className="set-hero">
        <div className="set-hero-sprite"><PokemonSprite key={set.species} species={set.species} side="p2" /></div>
        <div className="set-hero-types">{species?.types.map(t => <TypeBadge key={t} type={t} />)}<span className="muted small">BST {species ? Object.values(species.baseStats).reduce((a, b) => a + b, 0) : '—'}</span></div>
      </div>
      <div className="field-grid">
        <label className="fld fld-wide">
          <span>Pokémon</span>
          <SearchSelect<Specie>
            ariaLabel="Pokémon"
            value={set.species}
            invalid={speciesConflict}
            options={eligibleSpecies()}
            getKey={s => s.id}
            getLabel={s => s.name}
            renderOption={s => <SpeciesOption s={s} />}
            onSelect={s => s && onChange(changeSpecies(set, s.name))}
          />
        </label>
        <label className="fld">
          <span>Nickname</span>
          <input value={set.name === set.species ? '' : set.name} placeholder={set.species} maxLength={12}
            onChange={e => update({ name: e.target.value || set.species })} />
        </label>
        <label className="fld fld-narrow">
          <span>Level</span>
          <input type="number" min={1} max={100} value={set.level} className="num"
            onChange={e => update({ level: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) })} />
        </label>
        {species && !species.gender && (
          <label className="fld fld-narrow">
            <span>Gender</span>
            <select value={set.gender || ''} onChange={e => update({ gender: e.target.value })}>
              <option value="">Random</option>
              <option value="M">♂</option>
              <option value="F">♀</option>
            </select>
          </label>
        )}
      </div>

      <div className="field-grid">
        <label className="fld">
          <span>Ability</span>
          <select value={set.ability} onChange={e => update({ ability: e.target.value })}>
            {!abilities.includes(set.ability) && <option value={set.ability}>{set.ability || '—'}</option>}
            {abilities.map(a => <option key={a} value={a}>{a}{a === species?.abilities.H ? ' (Hidden)' : ''}</option>)}
          </select>
        </label>
        <label className="fld">
          <span>Item</span>
          <SearchSelect<Item>
            ariaLabel="Item"
            value={set.item}
            invalid={itemConflict}
            placeholder="(none)"
            options={allItems()}
            allowEmpty
            getKey={i => i.id}
            getLabel={i => i.name}
            onSelect={i => update({ item: i?.name ?? '' })}
          />
        </label>
        <label className="fld">
          <span>Nature</span>
          <select value={set.nature} onChange={e => update({ nature: e.target.value })}>
            {NATURES.map(n => <option key={n} value={n}>{natureLabel(n)}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="moves">
        <legend>Moves {learnset === null && <span className="muted small">(loading learnset…)</span>}</legend>
        {[0, 1, 2, 3].map(i => {
          const current = set.moves[i] ?? '';
          const options = (learnset ?? []).filter(m => m.name === current || !set.moves.includes(m.name as string));
          const illegal = !!current && learnset !== null && !learnable.has(current);
          return (
            <div key={i} className="move-row">
              <SearchSelect<Move>
                ariaLabel={`Move ${i + 1}`}
                value={current === 'Hidden Power' ? `Hidden Power [${hiddenPowerType(set)}]` : current}
                placeholder={i <= set.moves.length ? '(empty)' : ''}
                options={options}
                allowEmpty={!!current}
                disabled={learnset === null || i > set.moves.length}
                invalid={illegal}
                getKey={m => m.id}
                getLabel={m => m.name}
                renderOption={m => <MoveOption m={m} />}
                onSelect={m => setMove(i, m)}
              />
            </div>
          );
        })}
      </fieldset>

      <StatTable set={set} onChange={onChange} />

      {problems.length > 0 && (
        <ul className="problems" aria-label="Problems with this Pokémon">
          {problems.map(p => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
