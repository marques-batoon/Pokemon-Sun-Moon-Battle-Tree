import type { Item, Move, Specie } from '@pkmn/data';
import { allItems, eligibleSpecies, gen7, speciesAbilities } from '../../team/dex';
import { canHoldItem, PARADOX_LABELS, paradoxFormForSet, paradoxKindOfItem } from '../../data/custom/paradox';
import { isWarpForm } from '../../data/custom/digimon';
import { changeSpecies, hiddenPowerType, megaFormForSet } from '../../team/sets';
import { STAT_IDS, STAT_LABELS, type PokemonSet } from '../../team/types';
import { SearchSelect } from '../components/SearchSelect';
import { TypeBadge } from '../battle/TypeBadge';
import { useLearnset } from './hooks';
import { StatTable } from './StatTable';
import { PokemonSprite } from '../components/PokemonSprite';
import { AbilityDetails, InfoButton, MoveDetails } from './InfoPopover';

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
const bst = (s: Specie) => Object.values(s.baseStats).reduce((a, b) => a + b, 0);

/**
 * What the Pokémon becomes when it Mega Evolves (or Warp Digivolves) with its held item: the new
 * form's look, types, Ability and base stats (with the change from the base form).
 */
function MegaFormSection({ base, form }: { base: Specie; form: Specie }) {
  const warp = isWarpForm(form.name);
  const ability = form.abilities[0];
  return (
    <section className={`mega-form${warp ? ' warp' : ''}`} aria-label={`${base.name} after ${warp ? 'Warp Digivolution' : 'Mega Evolution'}`}>
      <div className="mega-form-sprite"><PokemonSprite key={form.name} species={form.name} side="p2" /></div>
      <div className="mega-form-body">
        <div className="mega-form-head">
          <span className="mega-form-kicker">{warp ? 'Warp Digivolves into' : 'Mega Evolves into'}</span>
          <strong>{form.name}</strong>
          {form.types.map(t => <TypeBadge key={t} type={t} />)}
        </div>
        <div className="mega-form-ability">
          <span className="fld-head">
            <span className="muted small">Ability after {warp ? 'Warp Digivolving' : 'Mega Evolving'}:</span>
            <strong>{ability}</strong>
            {ability && <InfoButton label={`the Ability ${ability}`}><AbilityDetails name={ability} /></InfoButton>}
          </span>
          {ability && gen7.abilities.get(ability)?.shortDesc && <span className="muted small">{gen7.abilities.get(ability)!.shortDesc}</span>}
        </div>
        <dl className="mega-form-stats">
          {STAT_IDS.map(stat => {
            const diff = form.baseStats[stat] - base.baseStats[stat];
            return (
              <div key={stat}>
                <dt>{STAT_LABELS[stat]}</dt>
                <dd>{form.baseStats[stat]}{diff !== 0 && <span className={diff > 0 ? 'up' : 'down'}>{diff > 0 ? `+${diff}` : diff}</span>}</dd>
              </div>
            );
          })}
          <div className="total"><dt>BST</dt><dd>{bst(form)}<span className="up">{bst(form) - bst(base) > 0 ? `+${bst(form) - bst(base)}` : ''}</span></dd></div>
        </dl>
      </div>
    </section>
  );
}

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
  // Holding a matching Paradoxorb, it battles as its Paradox form: show that form's look, stats, Ability and moves.
  const paradox = paradoxFormForSet(set.species, set.item);
  const paradoxKind = paradox ? paradoxKindOfItem(set.item) : null;
  const shown = paradox ? gen7.species.get(paradox) : species;
  // Holding its Mega Stone (or a Digimon its warp item), its BST is the new form's, and a section shows that form.
  const megaForm = paradox ? null : megaFormForSet(set);
  const megaSpecies = megaForm ? gen7.species.get(megaForm) : undefined;
  const learnset = useLearnset(set.species, set.item);
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
        <div className="set-hero-sprite"><PokemonSprite key={shown?.name ?? set.species} species={shown?.name ?? set.species} side="p2" /></div>
        <div className="set-hero-types">
          {paradox && paradoxKind && (
            <span className={`paradox-badge paradox-${paradoxKind}`} title={`Paradox Evolves into ${paradox} when first sent out`}>
              {PARADOX_LABELS[paradoxKind]} Paradox Form: {paradox}
            </span>
          )}
          {shown?.types.map(t => <TypeBadge key={t} type={t} />)}
          {megaSpecies && shown ? (
            <span className="muted small" title={`Base stat total after ${isWarpForm(megaSpecies.name) ? 'Warp Digivolving' : 'Mega Evolving'} (${shown.name}: ${bst(shown)})`}>
              BST {bst(megaSpecies)} <span className="bst-form">as {megaSpecies.name}</span>
            </span>
          ) : (
            <span className="muted small">BST {shown ? bst(shown) : '—'}</span>
          )}
        </div>
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
        {species && !species.gender && !paradox && (
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
          <span className="fld-head">
            Ability{paradox ? ' (Paradox form)' : ''}
            {(paradox ? shown?.abilities[0] : set.ability) && (
              <InfoButton label={`the Ability ${paradox ? shown?.abilities[0] : set.ability}`}>
                <AbilityDetails name={(paradox ? shown?.abilities[0] : set.ability) as string} />
              </InfoButton>
            )}
          </span>
          {paradox ? (
            // The Paradox form's Ability replaces the original's before it ever activates.
            <select value="paradox" disabled title={shown?.abilities[0] ? gen7.abilities.get(shown.abilities[0])?.shortDesc : undefined}>
              <option value="paradox">{shown?.abilities[0] ?? '—'}</option>
            </select>
          ) : (
            <select value={set.ability} onChange={e => update({ ability: e.target.value })}>
              {!abilities.includes(set.ability) && <option value={set.ability}>{set.ability || '—'}</option>}
              {abilities.map(a => (
                <option key={a} value={a} title={gen7.abilities.get(a)?.shortDesc}>{a}{a === species?.abilities.H ? ' (Hidden)' : ''}</option>
              ))}
            </select>
          )}
        </label>
        <label className="fld">
          <span>Item</span>
          <SearchSelect<Item>
            ariaLabel="Item"
            value={set.item}
            invalid={itemConflict}
            placeholder="(none)"
            options={allItems().filter(i => canHoldItem(set.species, i.name))}
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

      {megaSpecies && species && <MegaFormSection base={species} form={megaSpecies} />}

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
                describe={m => <MoveDetails move={m} brief />}
                onSelect={m => setMove(i, m)}
              />
              {current && gen7.moves.get(current) && (
                <InfoButton label={`the move ${current}`}><MoveDetails move={gen7.moves.get(current)!} /></InfoButton>
              )}
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
