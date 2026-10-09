import type { Battle, Pokemon, Side } from '@pkmn/client';
import { TRAINERS } from '../../data/battle-tree';
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

/** Protosynthesis / Quark Drive's boost: @pkmn/client keeps the boosted stat on the volatile. */
function paradoxBoostOf(pokemon: Pokemon): { ability: 'protosynthesis' | 'quarkdrive'; stat: string } | null {
  for (const ability of ['protosynthesis', 'quarkdrive'] as const) {
    const stat = (pokemon.volatiles[ability] as { stat?: string } | undefined)?.stat;
    if (stat) return { ability, stat };
  }
  return null;
}

const hpPercent = (p: Pokemon) => (p.maxhp ? Math.max(0, Math.min(100, (p.hp / p.maxhp) * 100)) : 0);

interface Props {
  battle: Battle;
  side: 'p1' | 'p2';
  pokemon: Pokemon | null;
  /** Doubles: smaller boxes, two per side. */
  compact?: boolean;
  /** Whose party pips to show, if any (Doubles: once per side, on the first box; Multi: each trainer's own). */
  party?: Side | null;
  /** Whose view the battle is from (p3: the partner's client in an online Multi Battle). */
  me?: 'p1' | 'p3';
}

/** Battle Tree trainers by their battle name ("Pokémon Trainer Sina" -> "Sina"). */
const SHORT_NAMES = new Map(TRAINERS.map(t => [`${t.class} ${t.name}`, t.name]));
/** Multi Battles: whose Pokémon a box shows (your trainer name, "Sina", "Red", or the other player's name). */
const ownerLabel = (side: Side) => SHORT_NAMES.get(side.name) ?? side.name;

/**
 * Everything about one active Pokémon in one box on the battlefield: name,
 * level, status, types, HP, party, ability/item and stat changes.
 */
export function PokemonPanel({ battle, side, pokemon, compact = false, party = battle[side], me = 'p1' }: Props) {
  const multi = battle.gameType === 'multi';
  const mine = battle[me] ?? battle.p1;
  const pips = party ? <PartyPips side={party} label={party === mine ? 'Your Pokémon' : multi ? `${party.name}'s Pokémon` : "Opponent's Pokémon"} /> : null;
  const owner = multi && party ? <span className="mon-owner">{ownerLabel(party)}</span> : null;
  if (!pokemon) {
    return (
      <div className={`hud hud-${side} mon-panel ${compact ? 'compact' : ''}`}>
        <div className="mon-head">{owner}<span className="mon-name muted">—</span></div>
        <div className="mon-hp-row">{pips}</div>
      </div>
    );
  }
  const percent = pokemon.fainted ? 0 : hpPercent(pokemon);
  // The player sees exact HP for their own Pokémon; others' HP (opponents, a Multi partner) arrives as a
  // 48-pixel bar (like in-game), shown as ~%.
  const hpText = pokemon.fainted ? 'Fainted' : pokemon.side === mine ? `${pokemon.hp}/${pokemon.maxhp}` : `~${Math.round(percent)}%`;
  const boosts = Object.entries(pokemon.boosts).filter(([, v]) => v);
  const volatiles = Object.keys(pokemon.volatiles).filter(v => SHOWN_VOLATILES[v]);
  const paradoxBoost = paradoxBoostOf(pokemon);
  const item = pokemon.item ? gen7.items.get(pokemon.item)?.name ?? pokemon.item : null;
  const ability = pokemon.ability ? gen7.abilities.get(pokemon.ability)?.name ?? pokemon.ability : null;

  return (
    <div className={`hud hud-${side} mon-panel ${side === 'p1' ? 'player' : 'opponent'}${multi && side === 'p1' && party !== mine ? ' partner' : ''} ${compact ? 'compact' : ''}`}>
      <div className="mon-head">
        {owner}
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
      {(boosts.length > 0 || volatiles.length > 0 || paradoxBoost) && (
        <div className="mon-tags">
          {paradoxBoost && (
            <span
              className={`tag tag-paradox ${paradoxBoost.ability === 'protosynthesis' ? 'ancient' : 'future'}`}
              title={`${paradoxBoost.ability === 'protosynthesis' ? 'Protosynthesis' : 'Quark Drive'}: a flat multiplier, not a stat stage (Haze can't remove it; it ends when switched out)`}
            >
              ⬢ {BOOST_LABELS[paradoxBoost.stat]} ×{paradoxBoost.stat === 'spe' ? '1.5' : '1.3'}
            </span>
          )}
          {boosts.map(([stat, v]) => (
            <span key={stat} className={`tag ${v! > 0 ? 'tag-up' : 'tag-down'}`}>{v! > 0 ? '+' : ''}{v} {BOOST_LABELS[stat]}</span>
          ))}
          {volatiles.map(v => <span key={v} className="tag">{SHOWN_VOLATILES[v]}</span>)}
        </div>
      )}
    </div>
  );
}
