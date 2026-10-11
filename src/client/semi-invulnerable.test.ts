import { describe, expect, it } from 'vitest';
import { Battle as ClientBattle } from '@pkmn/client';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { Protocol } from '@pkmn/protocol';
import { Battle, Teams, type ID } from '@pkmn/sim';
import { semiInvulnerableOf, trackSemiInvulnerable } from './semi-invulnerable';

/** Plays a scripted battle into a client, as the battle screen does, reporting p1's hidden state after each turn. */
function hiddenAfterEachTurn(p1Team: string, p2Team: string, turns: [string, string][]): (string | null)[] {
  const sim = new Battle({ formatid: 'gen7customgame' as ID, seed: '1,2,3,4' });
  sim.setPlayer('p1', { name: 'A', team: Teams.pack(Teams.import(p1Team)) });
  sim.setPlayer('p2', { name: 'B', team: Teams.pack(Teams.import(p2Team)) });
  sim.makeChoices('team 1', 'team 1');
  for (const [a, b] of turns) sim.makeChoices(a, b);
  const client = new ClientBattle(new Generations(Dex));
  const out: (string | null)[] = [];
  for (let i = 0; i < sim.log.length; i++) {
    if (sim.log[i].startsWith('|split|')) { i++; continue; }
    const { args, kwArgs } = Protocol.parseBattleLine(sim.log[i]);
    client.add(args, kwArgs);
    trackSemiInvulnerable(client, args as readonly string[]);
    if (args[0] === 'turn' && Number(args[1]) > 1) out.push(semiInvulnerableOf(client.p1.active[0]!));
  }
  return out;
}

const FOE = `Snorlax\nAbility: Thick Fat\nLevel: 50\nEVs: 252 HP / 252 Def\n- Rest\n- Splash`;
const user = (move: string, item = 'Leftovers') => `Garchomp @ ${item}\nAbility: Rough Skin\nLevel: 50\n- ${move}\n- Protect`;

describe('semi-invulnerable turns', () => {
  it('shows where Dig, Fly, Dive and Phantom Force take the user, until the attack lands', () => {
    // Turn 1 charges (hidden at the start of turn 2), turn 2 attacks (back at the start of turn 3).
    expect(hiddenAfterEachTurn(user('Dig'), FOE, [['move 1', 'move 2'], ['move 1', 'move 2']])).toEqual(['underground', null]);
    expect(hiddenAfterEachTurn(user('Fly'), FOE, [['move 1', 'move 2'], ['move 1', 'move 2']])).toEqual(['sky', null]);
    expect(hiddenAfterEachTurn(user('Dive'), FOE, [['move 1', 'move 2'], ['move 1', 'move 2']])).toEqual(['underwater', null]);
    expect(hiddenAfterEachTurn(user('Phantom Force').replace('Garchomp', 'Gengar').replace('Rough Skin', 'Cursed Body'), FOE,
      [['move 1', 'move 2'], ['move 1', 'move 2']])).toEqual(['phantom', null]);
  });

  it('never hides the user when a Power Herb skips the charge', () => {
    expect(hiddenAfterEachTurn(user('Dig', 'Power Herb'), FOE, [['move 1', 'move 2']])).toEqual([null]);
  });
});
