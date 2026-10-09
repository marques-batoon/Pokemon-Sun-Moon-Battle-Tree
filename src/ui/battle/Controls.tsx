import { useEffect, useRef, useState } from 'react';
import type { Battle } from '@pkmn/client';
import { gen7 } from '../../team/dex';
import { effectivenessLabel } from '../../team/effectiveness';
import { doublesTargets, needsReplacement } from '../../engine/choices';
import {
  isFainted, isForceSwitch, isMoveRequest, type SimRequest, type SimRequestActive, type SimRequestPokemon,
} from '../../engine/sim-types';
import { typeColor } from '../types';
import { zMoveInfo } from './z-move-info';
import { PokemonIcon } from '../components/PokemonSprite';
import { HpBar } from './HpBar';

const speciesOf = (p: SimRequestPokemon) => p.details.split(', ')[0];

function conditionPercent(condition: string): number {
  const [hp] = condition.split(' ');
  const [cur, max] = hp.split('/').map(Number);
  return max ? (cur / max) * 100 : 0;
}

interface Props {
  request: SimRequest;
  awaiting: boolean;
  onChoose: (choice: string) => void;
  /** Current types of the opposing active Pokémon (Singles effectiveness hints). */
  foeTypes?: readonly string[];
  /** Live battle state (Doubles: targets' names, types and whether they're still standing). */
  battle?: Battle | null;
  showHints: boolean;
  shortcuts: boolean;
}

const HINT_CLASS = { 'Super effective': 'hint-super', 'Not very effective': 'hint-weak', 'No effect': 'hint-none' } as const;

/** The four move buttons plus the Mega / Z toggles for one active Pokémon. */
function MoveGrid({ active, mega, setMega, megaAllowed, zMove, setZMove, zAllowed, hintTypes, showHints, shortcuts, onPick }: {
  active: SimRequestActive;
  mega: boolean; setMega: (v: boolean) => void; megaAllowed: boolean;
  zMove: boolean; setZMove: (v: boolean) => void; zAllowed: boolean;
  hintTypes?: readonly string[]; showHints: boolean; shortcuts: boolean;
  onPick: (moveIndex: number, z: boolean) => void;
}) {
  const moves = active.moves.map((m, i) => {
    const data = gen7.moves.get(m.id);
    const z = zMove ? active.canZMove?.[i] : null;
    const disabled = !!m.disabled || m.pp === 0 || (zMove && !z);
    return { m, i, data, z, disabled };
  });
  const canMega = megaAllowed && !!active.canMegaEvo;
  const canZ = zAllowed && !!active.canZMove?.some(Boolean);
  return (
    <>
      <div className="move-grid">
        {moves.map(({ m, i, data, z, disabled }) => {
          // With Z-Move on, show what the move becomes: Z name, type, power (or Z-Power effect).
          const zInfo = z && data ? zMoveInfo(data, z.move) : null;
          const type = zInfo?.type ?? data?.type ?? '???';
          const category = zInfo?.category ?? data?.category ?? '';
          const { bg, fg } = typeColor(type);
          const damaging = !!data && data.category !== 'Status';
          const power = zInfo ? zInfo.power : !damaging ? '—' : data.basePower ? String(data.basePower) : 'var.';
          const hint = showHints && damaging && hintTypes ? effectivenessLabel(type, hintTypes) : null;
          // Z-Moves never miss.
          const accuracy = zInfo ? '—' : data ? (data.accuracy === true ? '—' : `${data.accuracy}%`) : '';
          const title = !data ? m.move
            : zInfo ? `${zInfo.name} (Z-Move from ${data.name}) · ${type} ${category} · ${zInfo.effect ? `Z-Power: ${zInfo.effect}` : `Power ${power}`} · Accuracy ${accuracy}`
            : `${data.name} · ${type} ${category} · Power ${power} · Accuracy ${accuracy}\n${data.shortDesc ?? ''}`;
          return (
            <button
              key={m.id + i}
              className={`move-btn${zInfo ? ' z-on' : ''}`}
              style={{ background: bg, color: fg }}
              disabled={disabled}
              title={title}
              onClick={() => onPick(i, !!z)}
            >
              <span className="move-name">{shortcuts && <kbd>{i + 1}</kbd>}{zInfo ? zInfo.name : m.move}</span>
              <span className="move-meta">
                {type} · {category} · {zInfo?.effect ? <span className="z-power">{zInfo.effect}</span> : zInfo ? <span className="z-power">{power}</span> : power}
                {m.maxpp !== undefined && <> · PP {m.pp}/{m.maxpp}</>}
              </span>
              {hint && <span className={`move-hint ${HINT_CLASS[hint]}`}>{hint}</span>}
            </button>
          );
        })}
      </div>
      {(canMega || canZ) && (
        <div className="gimmicks">
          {canMega && (
            <label className={mega ? 'on' : ''}><input type="checkbox" checked={mega} onChange={e => setMega(e.target.checked)} /> Mega Evolve{shortcuts && <kbd>M</kbd>}</label>
          )}
          {canZ && (
            <label className={zMove ? 'on' : ''}><input type="checkbox" checked={zMove} onChange={e => setZMove(e.target.checked)} /> Z-Move{shortcuts && <kbd>Z</kbd>}</label>
          )}
        </div>
      )}
    </>
  );
}

/** Bench Pokémon to switch in (request positions are 1-based). */
function SwitchList({ request, forced, trapped, exclude = [], onPick, heading }: {
  request: SimRequest; forced: boolean; trapped: boolean; exclude?: number[]; onPick: (slot: number) => void; heading: string;
}) {
  const bench = request.side.pokemon.map((p, i) => ({ p, slot: i + 1 })).filter(({ p }) => !p.active);
  return (
    <>
      <div className="switch-head">{heading}</div>
      <div className="switch-list">
        {bench.map(({ p, slot }) => {
          const fainted = isFainted(p);
          const taken = exclude.includes(slot);
          return (
            <button key={p.ident} className="switch-btn" disabled={fainted || taken || (!forced && trapped)} onClick={() => onPick(slot)}>
              <span className="switch-name"><PokemonIcon species={speciesOf(p)} />{speciesOf(p)}</span>
              <HpBar percent={fainted ? 0 : conditionPercent(p.condition)} />
              <span className="switch-cond">{fainted ? 'Fainted' : taken ? 'Chosen' : p.condition}</span>
            </button>
          );
        })}
        {!bench.length && <span className="muted small">No other Pokémon.</span>}
      </div>
    </>
  );
}

export function Controls(props: Props) {
  // Multi Battles use the Doubles controls for one Pokémon: its moves can target either foe or the partner.
  const doubles = props.battle?.gameType === 'multi'
    || (isMoveRequest(props.request) ? props.request.active.length > 1 : isForceSwitch(props.request) && props.request.forceSwitch.length > 1);
  if (props.awaiting) return <div className="controls waiting" role="status">Waiting for the opponent…</div>;
  // Key by request so a new turn starts from the first Pokémon again.
  return doubles ? <DoublesControls key={props.request.rqid ?? JSON.stringify(props.request.side.pokemon.map(p => p.condition))} {...props} /> : <SinglesControls {...props} />;
}

function SinglesControls({ request, awaiting, onChoose, foeTypes, showHints, shortcuts }: Props) {
  const [mega, setMega] = useState(false);
  const [zMove, setZMove] = useState(false);
  const choose = (choice: string) => { setMega(false); setZMove(false); onChoose(choice); };

  const forced = isForceSwitch(request);
  const active = isMoveRequest(request) ? request.active[0] : null;
  const trapped = !!(active?.trapped || active?.maybeTrapped);
  const pickMove = (i: number, z: boolean) => choose(`move ${i + 1}${mega ? ' mega' : ''}${z ? ' zmove' : ''}`);

  // Keyboard: 1-4 moves, M Mega Evolution, Z Z-Move. Ignored while typing in a field.
  const latest = useRef({ active, pickMove, zMove });
  useEffect(() => { latest.current = { active, pickMove, zMove }; });
  useEffect(() => {
    if (!shortcuts || awaiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      const { active: act, pickMove: pick, zMove: zm } = latest.current;
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && act) {
        const m = act.moves[n - 1];
        const z = zm ? act.canZMove?.[n - 1] : null;
        if (m && !m.disabled && m.pp !== 0 && (!zm || z)) pick(n - 1, !!z);
      } else if ((e.key === 'm' || e.key === 'M') && act?.canMegaEvo) setMega(v => !v);
      else if ((e.key === 'z' || e.key === 'Z') && act?.canZMove?.some(Boolean)) setZMove(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts, awaiting]);

  return (
    <div className="controls">
      {active && (
        <MoveGrid
          active={active} mega={mega} setMega={setMega} megaAllowed zMove={zMove} setZMove={setZMove} zAllowed
          hintTypes={foeTypes} showHints={showHints} shortcuts={shortcuts} onPick={pickMove}
        />
      )}
      <SwitchList
        request={request} forced={forced} trapped={trapped} onPick={slot => choose(`switch ${slot}`)}
        heading={forced ? 'Choose a Pokémon to send out' : trapped ? 'You can\'t switch out' : 'Switch'}
      />
    </div>
  );
}

interface Pending { moveIndex: number; z: boolean; mega: boolean; targetType: string | undefined }

/**
 * Double Battles: choose for each active Pokémon in turn (moves needing a
 * target ask which one), then send both choices together. Only one Mega
 * Evolution and one Z-Move per turn; a Pokémon picked to switch in can't be
 * picked again.
 */
function DoublesControls({ request, onChoose, battle, showHints, shortcuts }: Props) {
  const forced = isForceSwitch(request);
  const count = isMoveRequest(request) ? request.active.length : isForceSwitch(request) ? request.forceSwitch.length : 0;
  // Which slots need an answer from the player, given the choices for earlier
  // slots (fainted / not-forced slots, and forced slots with nobody left to
  // send out, pass automatically).
  const needs = (slot: number, earlier: string[]) => {
    if (isForceSwitch(request)) return needsReplacement(request, slot, earlier);
    const mon = request.side.pokemon[slot];
    return !!mon && !isFainted(mon) && !!(request as Extract<SimRequest, { active: unknown }>).active[slot];
  };
  const [choices, setChoices] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mega, setMega] = useState(false);
  const [zMove, setZMove] = useState(false);

  // Advance past slots that pass automatically.
  let slot = choices.length;
  const auto: string[] = [...choices];
  while (slot < count && !needs(slot, auto)) { auto.push('pass'); slot++; }
  const done = slot >= count;
  const submitted = useRef(false);
  useEffect(() => {
    if (done && !submitted.current) {
      submitted.current = true;
      onChoose(auto.join(', '));
    }
  });
  if (done) return <div className="controls waiting" role="status">Sending your choices…</div>;

  const record = (choice: string) => {
    setPending(null); setMega(false); setZMove(false);
    setChoices([...auto, choice]);
  };
  const back = () => {
    setPending(null); setMega(false); setZMove(false);
    // Drop the last real choice (and any automatic passes after it).
    const prev = [...choices];
    while (prev.length && prev[prev.length - 1] === 'pass' && !needs(prev.length - 1, prev.slice(0, -1))) prev.pop();
    prev.pop();
    setChoices(prev);
  };
  const megaUsed = auto.some(c => c.endsWith(' mega'));
  const zUsed = auto.some(c => c.endsWith(' zmove'));
  const switchedIn = auto.flatMap(c => (c.startsWith('switch ') ? [Number(c.slice(7))] : []));
  const me = request.side.pokemon[slot];
  const name = me ? speciesOf(me) : 'your Pokémon';
  const active = isMoveRequest(request) ? request.active[slot] : null;
  // Where this Pokémon stands on the field (targets are relative to it). In Multi each trainer has one:
  // the player (p1) and the first opponent in slot a, the partner (p3) and the second opponent in slot b.
  const position = battle?.gameType === 'multi' ? (request.side.id === 'p3' || request.side.id === 'p4' ? 1 : 0) : slot;
  const trapped = !!(active?.trapped || active?.maybeTrapped);

  const finishMove = (p: Pending, target: number | null) =>
    record(`move ${p.moveIndex + 1}${target !== null ? ` ${target}` : ''}${p.mega ? ' mega' : ''}${p.z ? ' zmove' : ''}`);
  const pickMove = (moveIndex: number, z: boolean) => {
    if (!active) return;
    const targetType = z ? active.canZMove?.[moveIndex]?.target : active.moves[moveIndex].target;
    const p: Pending = { moveIndex, z, mega, targetType };
    const targets = doublesTargets(targetType, position);
    if (!targets) finishMove(p, null);
    else if (targets.length === 1) finishMove(p, targets[0]);
    else setPending(p);
  };

  // Target buttons, laid out like the field: the foe's b and a on top, the player's a and b below.
  const targetButton = (loc: number) => {
    const side = loc > 0 ? battle?.p2 : battle?.p1;
    const idx = Math.abs(loc) - 1;
    const mon = side?.active[idx] ?? null;
    const allowed = pending ? doublesTargets(pending.targetType, position)?.includes(loc) : false;
    const gone = !mon || mon.fainted;
    const moveData = pending && active ? gen7.moves.get(active.moves[pending.moveIndex].id) : null;
    const hint = showHints && loc > 0 && mon && moveData && moveData.category !== 'Status' ? effectivenessLabel(moveData.type, mon.types) : null;
    return (
      <button key={loc} type="button" className={`target-btn ${loc > 0 ? 'foe' : 'ally'}`} disabled={!allowed || gone} onClick={() => pending && finishMove(pending, loc)}>
        {mon ? <><PokemonIcon species={mon.speciesForme} />{mon.speciesForme}</> : <span className="muted">Empty</span>}
        <span className="muted small">{loc > 0 ? 'Opponent' : loc === -(position + 1) ? 'Itself' : 'Partner'}</span>
        {hint && <span className={`move-hint ${HINT_CLASS[hint]}`}>{hint}</span>}
      </button>
    );
  };

  return (
    <div className="controls doubles-controls">
      <div className="slot-head">
        <strong>{forced ? `Send out a Pokémon in ${name}'s place` : `What will ${name} do?`}</strong>
        <span className="muted small">{forced || count < 2 ? '' : `Pokémon ${slot + 1} of ${count}`}</span>
        <span className="spacer" />
        {choices.length > 0 && <button type="button" onClick={back}>Back</button>}
      </div>
      {pending ? (
        <div className="target-pick">
          <span className="muted small">Choose a target for {active && (pending.z ? active.canZMove?.[pending.moveIndex]?.move : active.moves[pending.moveIndex].move)}:</span>
          <div className="target-grid">
            {[2, 1].map(targetButton)}
            {[-1, -2].map(targetButton)}
          </div>
          <div className="row-actions"><button type="button" onClick={() => setPending(null)}>Cancel</button></div>
        </div>
      ) : (
        <>
          {active && (
            <MoveGrid
              active={active} mega={mega} setMega={setMega} megaAllowed={!megaUsed} zMove={zMove} setZMove={setZMove} zAllowed={!zUsed}
              showHints={false} shortcuts={shortcuts} onPick={pickMove}
            />
          )}
          <SwitchList
            request={request} forced={forced} trapped={trapped} exclude={switchedIn} onPick={s => record(`switch ${s}`)}
            heading={forced ? 'Choose a Pokémon to send out' : trapped ? 'You can\'t switch out' : 'Switch'}
          />
        </>
      )}
    </div>
  );
}
