import { useAppSettings } from '../useAppSettings';
import { semiInvulnerableOf } from '../../client/semi-invulnerable';
import { useState, type CSSProperties } from 'react';
import type { Battle, Pokemon } from '@pkmn/client';
import { ROOMS, SHIELD_CONDITIONS, type BattleAnimation } from '../../client/playback';

import { useElementSize } from '../useElementSize';
import { needsFrontSprites } from '../sprites';
import { horizonVar, posKey, type Point } from './fx/geometry';
import { MoveEffects } from './fx/MoveEffects';
import { actsAt, effectAnchors, effectSpec, shakeProps } from './fx/stage-fx';
import { useSpritePoints } from './fx/useSpritePoints';
import { FieldLayers } from './FieldLayers';
import { StageBackdrop } from './StageBackdrop';
import { SHIELDS } from './fx/catalog';
import { PokemonPanel } from './PokemonPanel';
import { ShieldWalls } from './ShieldWalls';
import { StageSpot } from './StageSpot';
import { TailwindCue } from './TailwindCue';

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
  flipFront?: boolean;
}

/**
 * Whether a Pokémon shows on its spot. The client marks a Pokémon fainted as soon as its HP hits 0 (the KO hit),
 * but it should stay on screen until its own faint animation plays. Without animations it disappears at once.
 */
function isShown(pokemon: Pokemon | null, side: Side, slot: number, anim: BattleAnimation | null, playing: boolean, faintSeen: Set<string>): pokemon is Pokemon {
  const fainting = anim?.kind === 'faint' && actsAt(anim, side, slot);
  return !!pokemon && (!pokemon.fainted || fainting || (playing && !faintSeen.has(pokemon.originalIdent)));
}

/**
 * Whether your side shows front sprites, flipped (Settings: matching sprites on your side): while any Pokémon on
 * the field on your side (yours, and your partner's in Multi) has no back sprite, so the two side by side match.
 * Once it has left the field, the others show their back sprites again. The opponents' sprites don't matter.
 */
function useFlipFront(shown: (Pokemon | null)[]): boolean {
  const { sprites, spriteStyle, matchSideSprites } = useAppSettings();
  if (!sprites || !matchSideSprites) return false;
  return needsFrontSprites(shown.map(p => p?.speciesForme ?? null), spriteStyle);
}

function Spot({ side, slot, pokemon, anim, playing, faintSeen, flipFront = false }: SpotProps) {
  const fainting = anim?.kind === 'faint' && actsAt(anim, side, slot);
  if (fainting && pokemon) faintSeen.add(pokemon.originalIdent);
  const visible = isShown(pokemon, side, slot, anim, playing, faintSeen);
  return (
    <StageSpot
      side={side}
      slot={slot}
      pokemon={visible ? { species: pokemon.speciesForme, gender: pokemon.gender, shiny: pokemon.shiny } : null}
      anim={anim}
      substitute={!!visible && 'substitute' in pokemon.volatiles}
      seeded={!!visible && 'leechseed' in pokemon.volatiles}
      charged={!!visible && 'charge' in pokemon.volatiles}
      status={visible ? pokemon.status : undefined}
      confused={!!visible && 'confusion' in pokemon.volatiles}
      infatuated={!!visible && 'attract' in pokemon.volatiles}
      protect={visible ? protectVariant(pokemon) : null}
      hidden={visible ? semiInvulnerableOf(pokemon) : null}
      flipFront={side === 'p1' && flipFront}
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
    case 'immune':
      return <div className={`fx-pop at-${side} muted-pop late`} style={style}>no effect</div>;
    case 'ability':
      // The HP an Ability gave for the move it took in (stat rises show on their own line).
      if (anim.hpDelta !== undefined && anim.hpDelta >= 0.5) return <div className={`fx-pop at-${side} good late`} style={style}>+{Math.round(anim.hpDelta)}%</div>;
      return null;
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
  /** Whose view the battle is from (p3: the partner's client in an online Multi Battle). */
  me?: 'p1' | 'p3';
}

/**
 * The battlefield: the active Pokémon (one per side, two in Doubles and Multi) as sprites,
 * HP boxes, and the current event's animation. Multi: the partner (p3) shares the player's
 * half and the second opponent (p4) the opponent's, each with their own party pips.
 */
export function BattleStage({ battle, animation, playing, speed = 1, me = 'p1' }: StageProps) {
  const doubles = battle.gameType !== 'singles';
  const multi = battle.gameType === 'multi';
  // Whose party each box shows: Doubles once per side (first box); Multi each trainer's own.
  const partyOf = (side: Side, slot: number) => (multi ? (slot === 0 ? battle[side] : side === 'p1' ? battle.p3 : battle.p4) : slot === 0 ? battle[side] : null);
  const slots = doubles ? [0, 1] : [0];
  // Stable per battle (the stage is keyed by battle id); only ever grows.
  const [faintSeen] = useState(() => new Set<string>());
  const [stageRef, size] = useElementSize<HTMLDivElement>();
  const spec = animation && playing ? effectSpec(animation) : null;
  const shake = shakeProps(spec, animation);
  const points = useSpritePoints(stageRef, `${animation?.id}:${size.w}x${size.h}`);
  const anchors = spec && animation ? effectAnchors(animation) : null;
  const shields = (s: Side) => SHIELD_CONDITIONS.filter(id => id in battle[s].sideConditions);
  const stageStyle = { '--spd': speed > 0 ? speed : 1, ...horizonVar } as CSSProperties;
  const { sprites, spriteStyle } = useAppSettings();
  // Your side's Pokémon on the field (Multi: battle.p1.active holds your partner's too, linkMultiAllies).
  const flipFront = useFlipFront(slots.map(slot => {
    const p = battle.p1.active[slot] ?? null;
    return isShown(p, 'p1', slot, animation, playing, faintSeen) ? p : null;
  }));
  // 2D pixel sprites are drawn big and stand lower on the stage.
  const big = sprites && spriteStyle === '2d' ? 'pixel-sprites' : '';
  return (
    <div
      ref={stageRef}
      className={`stage ${big} ${doubles ? 'doubles' : ''} ${multi ? 'multi' : ''} ${WEATHER_CLASS[battle.field.weather ?? ''] ?? ''} ${battle.field.terrain ? `terrain-${battle.field.terrain.toLowerCase()}` : ''}`}
      style={stageStyle}
    >
      <StageBackdrop />
      <div className={`stage-field ${shake.className}`} style={shake.style}>
        <FieldLayers
          terrain={battle.field.terrain ? `${battle.field.terrain.toLowerCase()}terrain` : null}
          rooms={ROOMS.filter(id => id in battle.field.pseudoWeather)}
          anim={animation}
        />
        {(['p2', 'p1'] as const).filter(side => 'tailwind' in battle[side].sideConditions).map(side => <TailwindCue key={side} side={side} />)}
        {(['p2', 'p1'] as const).flatMap(side => slots.map(slot => (
          <Spot key={posKey(side, slot)} side={side} slot={slot} pokemon={battle[side].active[slot] ?? null} anim={animation} playing={playing} faintSeen={faintSeen} flipFront={flipFront} />
        )))}
        <ShieldWalls side="p2" conditions={shields('p2')} anim={animation} size={size} points={points} doubles={doubles} />
        <ShieldWalls side="p1" conditions={shields('p1')} anim={animation} size={size} points={points} doubles={doubles} />
        {spec && anchors && (
          <MoveEffects key={animation!.id} spec={spec} user={anchors.user} targets={anchors.targets} size={size} points={points} doubles={doubles} seed={animation!.id} />
        )}
      </div>
      {(['p2', 'p1'] as const).map(side => (
        <div key={side} className={`hud-stack hud-stack-${side}`}>
          {slots.map(slot => <PokemonPanel key={slot} side={side} pokemon={battle[side].active[slot] ?? null} battle={battle} compact={doubles} party={partyOf(side, slot)} me={me} />)}
        </div>
      ))}
      {animation && <Pops key={animation.id} anim={animation} at={animation.side ? points[posKey(animation.side, animation.slot)] : undefined} />}
    </div>
  );
}
