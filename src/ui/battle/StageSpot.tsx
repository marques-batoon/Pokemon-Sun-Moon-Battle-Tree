import { useState, type CSSProperties } from 'react';
import { isWarpForm } from '../../data/custom/digimon';
import type { BattleAnimation } from '../../client/playback';
import { PokemonSprite } from '../components/PokemonSprite';
import { substituteSprite } from '../sprites';
import { useAppSettings } from '../useAppSettings';
import { SHIELDS } from './fx/catalog';
import { posKey } from './fx/geometry';
import { actsAt, spriteClass } from './fx/stage-fx';

type Side = 'p1' | 'p2';

/** Size of a Mega Evolved (or Warp Digivolved) Pokémon's sprite relative to the usual one (keep in sync with .is-mega in index.css). */
const MEGA_SCALE = 1.2;

/** Drawn doll for when sprites are off or the image fails to load. */
function DollSvg({ side }: { side: Side }) {
  return (
    <svg className="sub-doll-svg" viewBox="0 0 64 72" width={side === 'p1' ? 96 : 80} height={side === 'p1' ? 108 : 90} aria-hidden>
      <path d="M14 30 L10 8 L24 22 Z M50 30 L54 8 L40 22 Z" fill="#d9c08f" stroke="#7a6440" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="32" cy="34" rx="20" ry="16" fill="#e8d3a6" stroke="#7a6440" strokeWidth="2" />
      <path d="M16 50 Q14 70 24 70 L40 70 Q50 70 48 50 Q40 44 32 44 Q24 44 16 50 Z" fill="#e8d3a6" stroke="#7a6440" strokeWidth="2" />
      {side === 'p2' && (
        <>
          <circle cx="25" cy="33" r="2.6" fill="#3a2e1c" />
          <circle cx="39" cy="33" r="2.6" fill="#3a2e1c" />
          <path d="M28 40 Q32 43 36 40" fill="none" stroke="#3a2e1c" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      <path d="M32 46 L32 68" stroke="#b39a6a" strokeWidth="1.4" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

function SubDoll({ side, className }: { side: Side; className: string }) {
  const { sprites } = useAppSettings();
  const [failed, setFailed] = useState(false);
  const info = substituteSprite(side);
  const scale = side === 'p1' ? 2.3 : 1.9;
  return (
    <div className={`sub-doll sub-doll-${side}`}>
      <div className={`sub-doll-inner ${className}`}>
        {sprites && !failed ? (
          <img
            className="sub-doll-img"
            src={info.url}
            alt="Substitute"
            width={Math.round(info.w * scale)}
            height={Math.round(info.h * scale)}
            style={info.pixelated ? { imageRendering: 'pixelated' } : undefined}
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <DollSvg side={side} />
        )}
      </div>
    </div>
  );
}

/**
 * Lasting status shown on the Pokémon: flames (burn), bubbles (poison), sparks (paralysis), drifting
 * Z's (sleep), an ice block (freeze), circling stars (confusion) and hearts (infatuation).
 */
// Small shapes for the lasting marks (class names are mark-*, since status-* colours the HUD badges).
const BOLT = <svg viewBox="0 0 16 18"><polygon points="9.3,0 2.9,10.1 7.4,10.1 5.1,18 13.4,6.8 9,6.8 11.8,0" /></svg>;
const STAR = <svg viewBox="0 0 20 20"><polygon points="10,0 12.2,7 19.6,7 13.6,11.4 15.8,18.2 10,14 4.2,18.2 6.4,11.4 0.4,7 7.8,7" /></svg>;
const HEART = <svg viewBox="0 0 20 18"><path d="M10 18 L1.6 9.6 A4.6 4.6 0 0 1 10 3.4 A4.6 4.6 0 0 1 18.4 9.6 Z" /></svg>;

function StatusMarks({ status, confused, infatuated }: { status?: string; confused: boolean; infatuated: boolean }) {
  return (
    <>
      {status && (
        <span className={`cond-marks mark-${status}`} aria-hidden>
          {status === 'slp'
            ? ['z', 'z', 'Z'].map((z, i) => <span key={i} className="mark">{z}</span>)
            : status === 'frz'
              ? <span className="ice-block" />
              : [0, 1, 2, 3].map(i => <span key={i} className="mark">{status === 'par' ? BOLT : null}</span>)}
        </span>
      )}
      {confused && (
        <span className="cond-marks mark-confusion" aria-hidden>
          <span className="orbit">{[0, 1, 2].map(i => <span key={i} className="mark">{STAR}</span>)}</span>
        </span>
      )}
      {infatuated && (
        <span className="cond-marks mark-attract" aria-hidden>
          {[0, 1, 2].map(i => <span key={i} className="mark">{HEART}</span>)}
        </span>
      )}
    </>
  );
}

/** Protect (or a variant) is up for the rest of the turn. */
function ProtectBubble({ variant }: { variant: string }) {
  const s = SHIELDS[variant] ?? SHIELDS.protect;
  return <span className={`protect-bubble ${s.spiky ? 'spiky' : ''}`} style={{ '--c': s.color } as CSSProperties} aria-hidden />;
}

/** Leech Seed: seeds with sprouts stuck to the Pokémon. */
function SeedMarks() {
  return (
    <span className="seed-marks" aria-hidden>
      <span className="seed" /><span className="seed" /><span className="seed" />
    </span>
  );
}

export interface StageSpotProps {
  side: Side;
  /** Active slot (Doubles: 0 = a, 1 = b). */
  slot?: number;
  /** Pokémon on this spot; null leaves only the platform. */
  pokemon: { species: string; gender?: 'M' | 'F' | 'N'; shiny?: boolean } | null;
  anim: BattleAnimation | null;
  /** Behind a Substitute (the doll stands in for it). */
  substitute?: boolean;
  /** Seeded by Leech Seed. */
  seeded?: boolean;
  /** Major status: brn, par, psn, tox, slp, frz. */
  status?: string;
  confused?: boolean;
  infatuated?: boolean;
  /** Protect (or detect, kingsshield, spikyshield, banefulbunker) is up this turn. */
  protect?: string | null;
}

/** One side of the field: platform, Pokémon sprite, Substitute doll and status marks. */
export function StageSpot({ side, slot = 0, pokemon, anim, substitute = false, seeded = false, status, confused = false, infatuated = false, protect = null }: StageSpotProps) {
  const mine = actsAt(anim, side, slot) ? anim : null;
  const pos = posKey(side, slot);
  const v = anim && anim.id % 2 ? 'a' : 'b';
  // While its Substitute is up the Pokémon is hidden, except when it steps out to use a move.
  const peeking = substitute && mine?.kind === 'move' && !mine.still;
  const subClass = mine?.kind === 'sub-start' ? 'subbed fx-sub-hide'
    : mine?.kind === 'sub-end' ? 'fx-sub-show'
    : substitute && !peeking ? 'subbed' : '';
  const showDoll = substitute || mine?.kind === 'sub-end';
  // Mega Evolved Pokémon are drawn 20% larger.
  const mega = !!pokemon && (/-Mega(-[XYZ])?$/.test(pokemon.species) || isWarpForm(pokemon.species));
  const dollClass = mine?.kind === 'sub-start' ? 'fx-doll-drop'
    : mine?.kind === 'sub-hit' ? `fx-doll-hit-${v}`
    : mine?.kind === 'sub-end' ? 'fx-doll-break'
    : peeking ? 'aside' : '';
  return (
    <div className={`spot spot-${side} spot-${pos}`} data-pos={pos}>
      <div className="platform" />
      {pokemon && (
        <div className={`sprite-sub ${subClass}`}>
          <div className={`sprite-wrap ${spriteClass(side, slot, anim)} ${seeded ? 'seeded' : ''} ${mega ? 'is-mega' : ''}`}>
            <PokemonSprite
              key={pokemon.species}
              species={pokemon.species}
              side={side}
              gender={pokemon.gender}
              shiny={pokemon.shiny}
              scale={(side === 'p1' ? 1.4 : 1.3) * (mega ? MEGA_SCALE : 1)}
            />
            {seeded && <SeedMarks />}
            <StatusMarks status={status} confused={confused} infatuated={infatuated} />
          </div>
        </div>
      )}
      {pokemon && showDoll && <SubDoll side={side} className={dollClass} />}
      {pokemon && protect && <ProtectBubble variant={protect} />}
    </div>
  );
}
