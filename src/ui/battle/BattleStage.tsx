import { useState, type CSSProperties } from 'react';
import type { Battle, Pokemon } from '@pkmn/client';
import { ROOMS, SHIELD_CONDITIONS, type BattleAnimation } from '../../client/playback';

import { useElementSize } from '../useElementSize';
import { posKey, type Point } from './fx/geometry';
import { MoveEffects } from './fx/MoveEffects';
import { actsAt, effectAnchors, effectSpec, shakeProps } from './fx/stage-fx';
import { useSpritePoints } from './fx/useSpritePoints';
import { FieldLayers } from './FieldLayers';
import { SHIELDS } from './fx/catalog';
import { PokemonPanel } from './PokemonPanel';
import { ShieldWalls } from './ShieldWalls';
import { StageSpot } from './StageSpot';

type Side = 'p1' | 'p2';

const WEATHER_CLASS: Record<string, string> = {
  Sun: 'weather-sun', 'Harsh Sunshine': 'weather-sun', Rain: 'weather-rain', 'Heavy Rain': 'weather-rain',
  Sand: 'weather-sand', Hail: 'weather-hail', Snow: 'weather-hail',
};

/** Which shield is up this turn: the simulator reports every variant as Protect, so use the last move. */
function protectVariant(pokemon: Pokemon): string | null {
  if (!('protect' in pokemon.volatiles)) return null;
  return pokemon.lastMove in SHIELDS ? pokemon.lastMove : 'protect';
}

interface SpotProps {
  side: Side;
  slot: number;
  pokemon: Pokemon | null;
  anim: BattleAnimation | null;
  playing: boolean;
  /** Pokémon whose faint animation has started (they disappear once it's over). */
  faintSeen: Set<string>;
}

function Spot({ side, slot, pokemon, anim, playing, faintSeen }: SpotProps) {
  const fainting = anim?.kind === 'faint' && actsAt(anim, side, slot);
  if (fainting && pokemon) faintSeen.add(pokemon.originalIdent);
  // The client marks a Pokémon fainted as soon as its HP hits 0 (the KO hit), but it should stay
  // on screen until its own faint animation plays. Without animations it disappears at once.
  const visible = pokemon && (!pokemon.fainted || fainting || (playing && !faintSeen.has(pokemon.originalIdent)));
  return (
    <StageSpot
      side={side}
      slot={slot}
      pokemon={visible ? { species: pokemon.speciesForme, gender: pokemon.gender, shiny: pokemon.shiny } : null}
      anim={anim}
      substitute={!!visible && 'substitute' in pokemon.volatiles}
      seeded={!!visible && 'leechseed' in pokemon.volatiles}
      status={visible ? pokemon.status : undefined}
      confused={!!visible && 'confusion' in pokemon.volatiles}
      infatuated={!!visible && 'attract' in pokemon.volatiles}
      protect={visible ? protectVariant(pokemon) : null}
    />
  );
}

/** Small text pops: HP change, stat change, miss. Placed over the measured sprite when known. */
function Pops({ anim, at }: { anim: BattleAnimation; at?: Point }) {
  const { side } = anim;
  if (!side) return null;
  const style: CSSProperties | undefined = at ? { left: at.x, top: at.y } : undefined;
  switch (anim.kind) {
    case 'hit':
    case 'residual':
    case 'heal':
    case 'leech':
    case 'absorb':
      if (anim.hpDelta === undefined || Math.abs(anim.hpDelta) < 0.5) return null;
      // Absorbed HP shows once the energy has arrived.
      return <div className={`fx-pop at-${side} ${anim.hpDelta > 0 ? 'good' : 'bad'} ${anim.kind === 'absorb' ? 'late' : ''}`} style={style}>{anim.hpDelta > 0 ? '+' : '−'}{Math.round(Math.abs(anim.hpDelta))}%</div>;
    case 'boost':
    case 'unboost':
      return <div className={`fx-pop at-${side} ${anim.kind === 'boost' ? 'up' : 'down'}`} style={style}>{anim.kind === 'boost' ? '▲▲' : '▼▼'}</div>;
    case 'miss':
      return <div className={`fx-pop at-${side} muted-pop`} style={style}>miss</div>;
    default:
      return null;
  }
}

interface StageProps {
  battle: Battle;
  animation: BattleAnimation | null;
  playing: boolean;
  /** Animation speed factor (1 = normal, 0.5 = fast); scales CSS effect timings to match playback. */
  speed?: number;
}

/** The battlefield: the active Pokémon (one per side, two in Doubles) as sprites, HP boxes, and the current event's animation. */
export function BattleStage({ battle, animation, playing, speed = 1 }: StageProps) {
  const doubles = battle.gameType === 'doubles';
  const slots = doubles ? [0, 1] : [0];
  // Stable per battle (the stage is keyed by battle id); only ever grows.
  const [faintSeen] = useState(() => new Set<string>());
  const [stageRef, size] = useElementSize<HTMLDivElement>();
  const spec = animation && playing ? effectSpec(animation) : null;
  const shake = shakeProps(spec, animation);
  const points = useSpritePoints(stageRef, `${animation?.id}:${size.w}x${size.h}`);
  const anchors = spec && animation ? effectAnchors(animation) : null;
  const shields = (s: Side) => SHIELD_CONDITIONS.filter(id => id in battle[s].sideConditions);
  const stageStyle = { '--spd': speed > 0 ? speed : 1 } as CSSProperties;
  return (
    <div
      ref={stageRef}
      className={`stage ${doubles ? 'doubles' : ''} ${WEATHER_CLASS[battle.field.weather ?? ''] ?? ''} ${battle.field.terrain ? `terrain-${battle.field.terrain.toLowerCase()}` : ''}`}
      style={stageStyle}
    >
      <div className={`stage-field ${shake.className}`} style={shake.style}>
        <FieldLayers
          terrain={battle.field.terrain ? `${battle.field.terrain.toLowerCase()}terrain` : null}
          rooms={ROOMS.filter(id => id in battle.field.pseudoWeather)}
          anim={animation}
        />
        {(['p2', 'p1'] as const).flatMap(side => slots.map(slot => (
          <Spot key={posKey(side, slot)} side={side} slot={slot} pokemon={battle[side].active[slot] ?? null} anim={animation} playing={playing} faintSeen={faintSeen} />
        )))}
        <ShieldWalls side="p2" conditions={shields('p2')} anim={animation} size={size} points={points} doubles={doubles} />
        <ShieldWalls side="p1" conditions={shields('p1')} anim={animation} size={size} points={points} doubles={doubles} />
        {spec && anchors && (
          <MoveEffects key={animation!.id} spec={spec} user={anchors.user} targets={anchors.targets} size={size} points={points} doubles={doubles} seed={animation!.id} />
        )}
      </div>
      {(['p2', 'p1'] as const).map(side => (
        <div key={side} className={`hud-stack hud-stack-${side}`}>
          {slots.map(slot => <PokemonPanel key={slot} side={side} pokemon={battle[side].active[slot] ?? null} battle={battle} compact={doubles} party={slot === 0} />)}
        </div>
      ))}
      {animation && <Pops key={animation.id} anim={animation} at={animation.side ? points[posKey(animation.side, animation.slot)] : undefined} />}
    </div>
  );
}
