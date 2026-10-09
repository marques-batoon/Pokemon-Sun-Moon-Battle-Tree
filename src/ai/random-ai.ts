import type { AIContext, BattleAI } from './types';
import { doublesTargets } from '../engine/choices';
import { isFainted, isForceSwitch, isMoveRequest, isTeamPreview, type SimRequestActive, type SimRequestSide } from '../engine/sim-types';
import type { PRNG } from '@pkmn/sim';

/** Legal but random choices (practice opponent; also drives the player's side in headless tests). Singles, Doubles and Multi. */
export class RandomAI implements BattleAI {
  readonly name = 'random';

  private readonly switchChance: number;
  private readonly zMoveChance: number;

  /** switchChance: chance to switch on a normal turn when a switch is legal. */
  constructor(switchChance = 0.1, zMoveChance = 0.25) {
    this.switchChance = switchChance;
    this.zMoveChance = zMoveChance;
  }

  choose({ request, prng, battle, side }: AIContext): string {
    if (isTeamPreview(request)) {
      const order = request.side.pokemon.map((_, i) => i + 1);
      prng.shuffle(order);
      return `team ${order.slice(0, request.maxChosenTeamSize ?? order.length).join('')}`;
    }

    if (isForceSwitch(request)) {
      // One answer per active slot; each replacement can only be sent in once.
      const options = benchSlots(request.side);
      return request.forceSwitch.map(needed => {
        if (!needed || !options.length) return 'pass';
        const pick = prng.sample(options);
        options.splice(options.indexOf(pick), 1);
        return `switch ${pick}`;
      }).join(', ');
    }

    if (isMoveRequest(request)) {
      // Doubles and Multi both need targets; in Multi this side controls one Pokémon, at its own field position.
      // Without the simulator's battle (headless player in tests), the request tells Singles from Doubles.
      const doubles = battle ? battle.gameType !== 'singles' : request.active.length > 1;
      const position = (slot: number) => battle?.getSide(side).active[slot]?.position ?? slot;
      const bench = benchSlots(request.side);
      let megaUsed = false;
      let zUsed = false;
      return request.active.map((active, slot) => {
        const mon = request.side.pokemon[slot];
        if (!mon || isFainted(mon)) return 'pass';
        const canSwitch = !(active.trapped || active.maybeTrapped) && bench.length;
        if (canSwitch && prng.random() < this.switchChance) {
          const pick = prng.sample(bench);
          bench.splice(bench.indexOf(pick), 1);
          return `switch ${pick}`;
        }
        const choice = this.pickMove(active, position(slot), doubles, prng, { mega: !megaUsed, z: !zUsed });
        if (choice.endsWith(' mega')) megaUsed = true;
        if (choice.endsWith(' zmove')) zUsed = true;
        return choice;
      }).join(', ');
    }

    return 'default';
  }

  private pickMove(active: SimRequestActive, slot: number, doubles: boolean, prng: PRNG, allow: { mega: boolean; z: boolean }): string {
    const usable = active.moves
      .map((m, i) => ({ m, moveSlot: i + 1 }))
      .filter(({ m }) => !m.disabled && (m.pp === undefined || m.pp > 0));
    if (!usable.length) return 'move 1'; // the sim turns this into Struggle
    const { m, moveSlot } = prng.sample(usable);
    const useZ = allow.z && !!active.canZMove?.[moveSlot - 1] && prng.random() < this.zMoveChance;
    // Targets: aim at a foe when the move needs one (a Z-Move keeps the base move's target type).
    const targetType = useZ ? active.canZMove![moveSlot - 1]!.target : m.target;
    const targets = doubles ? doublesTargets(targetType, slot) : null;
    const foes = targets?.filter(t => t > 0);
    const target = targets ? prng.sample(foes?.length ? foes : targets) : null;
    const parts = ['move', String(moveSlot)];
    if (target !== null) parts.push(String(target));
    if (allow.mega && active.canMegaEvo) parts.push('mega');
    else if (useZ) parts.push('zmove');
    return parts.join(' ');
  }
}

/** 1-based request positions of healthy Pokémon that aren't active. */
function benchSlots(side: SimRequestSide): number[] {
  return side.pokemon.flatMap((p, i) => (!p.active && !isFainted(p) ? [i + 1] : []));
}
