import { useState } from 'react';
import type { Battle } from '@pkmn/client';
import { gen7 } from '../../team/dex';
import type { SimRequestPokemon } from '../../engine/sim-types';
import { PokemonIcon } from '../components/PokemonSprite';
import { TypeBadge } from './TypeBadge';

interface Props {
  battle: Battle;
  pokemon: SimRequestPokemon[];
  bring: number;
  onConfirm: (choice: string) => void;
}

/** Bring-N selection. Pick order = battle order; the first pick leads. */
export function TeamPreview({ battle, pokemon, bring, onConfirm }: Props) {
  const [picks, setPicks] = useState<number[]>([]);
  const toggle = (slot: number) =>
    setPicks(p => (p.includes(slot) ? p.filter(s => s !== slot) : p.length < bring ? [...p, slot] : p));

  return (
    <div className="team-preview">
      <section>
        <h3>Opponent: {battle.p2.name}</h3>
        <div className="preview-row">
          {/* Team Preview Pokémon have no ident yet, so key by position. */}
          {battle.p2.team.map((p, i) => (
            <div key={`${i}-${p.speciesForme}`} className="preview-card foe">
              <strong><PokemonIcon species={p.speciesForme} />{p.speciesForme}</strong>
              <div>{p.types.map(t => <TypeBadge key={t} type={t} />)}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Choose {bring} (in battle order)</h3>
        <div className="preview-row">
          {pokemon.map((p, i) => {
            const slot = i + 1;
            const species = gen7.species.get(p.details.split(', ')[0]);
            const order = picks.indexOf(slot);
            const item = gen7.items.get(p.item)?.name;
            return (
              <button key={p.ident} className={`preview-card ${order >= 0 ? 'picked' : ''}`} onClick={() => toggle(slot)}>
                {order >= 0 && <span className="pick-order">{order + 1}</span>}
                <strong>{species && <PokemonIcon species={species.name} />}{species?.name}</strong>
                <div>{species?.types.map(t => <TypeBadge key={t} type={t} />)}</div>
                {item && <small>@ {item}</small>}
              </button>
            );
          })}
        </div>
        <button className="primary" disabled={picks.length !== bring} onClick={() => onConfirm(`team ${picks.join('')}`)}>
          Start battle
        </button>
      </section>
    </div>
  );
}
