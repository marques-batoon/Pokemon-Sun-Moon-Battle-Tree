import type { Battle, Pokemon } from '@pkmn/client';
import { gen7 } from '../../team/dex';
import { BOOST_LABELS, STATUS_LABELS } from '../types';
import { HpBar } from './HpBar';
import { PartyPips } from './PartyPips';
import { TypeBadge } from './TypeBadge';

/** Volatiles worth showing; the rest are internal bookkeeping. */
const SHOWN_VOLATILES: Record<string, string> = {
  confusion: 'Confused', substitute: 'Substitute', leechseed: 'Leech Seed', taunt: 'Taunt', encore: 'Encore',
  torment: 'Torment', disable: 'Disable', attract: 'Infatuated', yawn: 'Drowsy', perishsong: 'Perish',
  focusenergy: 'Focus Energy', aquaring: 'Aqua Ring', ingrain: 'Ingrain', curse: 'Cursed', nightmare: 'Nightmare',
  partiallytrapped: 'Trapped', trapped: 'Can\'t escape', stockpile: 'Stockpile', magnetrise: 'Magnet Rise',
  embargo: 'Embargo', healblock: 'Heal Block', smackdown: 'Grounded', laserfocus: 'Laser Focus',
  mustrecharge: 'Recharging', destinybond: 'Destiny Bond', charge: 'Charged', flashfire: 'Flash Fire',
  typechange: 'Type changed', transform: 'Transformed', minimize: 'Minimized', defensecurl: 'Curled',
};

const hpPercent = (p: Pokemon) => (p.maxhp ? Math.max(0, Math.min(100, (p.hp / p.maxhp) * 100)) : 0);

interface Props {
  battle: Battle;
  side: 'p1' | 'p2';
  pokemon: Pokemon | null;
  /** Doubles: smaller boxes, two per side. */
  compact?: boolean;
  /** Show the party pips (Doubles shows them once per side, on the first box). */
  party?: boolean;
}

/**
 * Everything about one active Pokémon in one box on the battlefield: name,
 * level, status, types, HP, party, ability/item and stat changes.
 */
export function PokemonPanel({ battle, side, pokemon, compact = false, party = true }: Props) {
  const pips = party ? <PartyPips side={battle[side]} label={side === 'p1' ? 'Your Pokémon' : "Opponent's Pokémon"} /> : null;
  if (!pokemon) {
    return (
      <div className={`hud hud-${side} mon-panel ${compact ? 'compact' : ''}`}>
        <div className="mon-head"><span className="mon-name muted">—</span></div>
        <div className="mon-hp-row">{pips}</div>
      </div>
    );
  }
  const percent = pokemon.fainted ? 0 : hpPercent(pokemon);
  // The player sees exact HP; the opponent's HP arrives as a 48-pixel bar (like in-game), shown as ~%.
  const hpText = pokemon.fainted ? 'Fainted' : side === 'p1' ? `${pokemon.hp}/${pokemon.maxhp}` : `~${Math.round(percent)}%`;
  const boosts = Object.entries(pokemon.boosts).filter(([, v]) => v);
  const volatiles = Object.keys(pokemon.volatiles).filter(v => SHOWN_VOLATILES[v]);
  const item = pokemon.item ? gen7.items.get(pokemon.item)?.name ?? pokemon.item : null;
  const ability = pokemon.ability ? gen7.abilities.get(pokemon.ability)?.name ?? pokemon.ability : null;

  return (
    <div className={`hud hud-${side} mon-panel ${side === 'p1' ? 'player' : 'opponent'} ${compact ? 'compact' : ''}`}>
      <div className="mon-head">
        <span className="mon-name">{pokemon.speciesForme}</span>
        <span className="mon-level">Lv{pokemon.level}</span>
        {pokemon.gender !== 'N' && <span className="mon-gender">{pokemon.gender === 'M' ? '♂' : '♀'}</span>}
        {pokemon.status && <span className={`status status-${pokemon.status}`}>{STATUS_LABELS[pokemon.status]}</span>}
        <span className="mon-types">{pokemon.types.map(t => <TypeBadge key={t} type={t} />)}</span>
      </div>
      <HpBar percent={percent} />
      <div className="mon-hp-row">
        {pips}
        <span className="mon-hp">{hpText}</span>
      </div>
      {(item || ability) && (
        <div className="mon-meta">
          {ability && <span>{ability}</span>}
          {item && <span>@ {item}</span>}
        </div>
      )}
      {(boosts.length > 0 || volatiles.length > 0) && (
        <div className="mon-tags">
          {boosts.map(([stat, v]) => (
            <span key={stat} className={`tag ${v! > 0 ? 'tag-up' : 'tag-down'}`}>{v! > 0 ? '+' : ''}{v} {BOOST_LABELS[stat]}</span>
          ))}
          {volatiles.map(v => <span key={v} className="tag">{SHOWN_VOLATILES[v]}</span>)}
        </div>
      )}
    </div>
  );
}
