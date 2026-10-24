import { describe, expect, it } from 'vitest';
import { SETS, TRAINERS } from '../../data/battle-tree';
import { BattleClient } from '../../client/battle-client';
import { TEST_PLAYER_TEAM_TEXT } from '../../engine/fixtures-data';
import { createInProcessTransport } from '../../engine/in-process-transport';
import { RunController, type RunTeam } from '../../run/controller';
import { RunStore } from '../../run/run-store';
import { planOpponent } from '../../run/selection';
import { drawBracket, duoSpriteKey, emptyResults, nextOpponent, type TournamentState } from '../../run/tournament';
import { DEFAULT_SETTINGS, type RunState } from '../../run/types';
import { memoryStore } from '../../storage/kv';
import { importShowdownText } from '../../team/showdown-text';
import { opponentSpriteIds, playerSpriteUrl, spriteCandidates, trainerArt, trainerSpriteUrl } from '../sprites';
import { followingOpponent, ownedPartnerImages, runBattleImages, runScreenImages, tournamentImages } from './preload-images';

const TEAM: RunTeam = { sourceTeamId: null, name: 'Test team', sets: importShowdownText(TEST_PLAYER_TEAM_TEXT).teams[0].sets, bring: [0, 1, 2] };
const SETTINGS = { sprites: true, spriteStyle: '2d' as const, matchSideSprites: false };

function startRun(seedText: string, startBattle?: number): RunState {
  const controller = new RunController(new RunStore(memoryStore()), new BattleClient(createInProcessTransport()));
  return controller.startRun({ course: 'normal', team: TEAM, settings: DEFAULT_SETTINGS, seedText, startBattle });
}

const sina = TRAINERS.find(t => t.name === 'Sina' && t.kind === 'special')!;
const firsts = (lists: string[][]) => lists.map(l => l[0]);

describe('pictures loaded before the Battle Tree screens open', () => {
  it('the run screen: the next opponent as this battle shows them, and your partner with their Pokémon', () => {
    const run = startRun('preload');
    const foe = TRAINERS[run.next.trainerId];
    const [spriteId] = opponentSpriteIds([foe], run.next.seedText);
    expect(firsts(runScreenImages(run, '2d'))).toContain(trainerSpriteUrl(foe, spriteId));

    const setIds = sina.roster.slice(0, 2);
    const withPartner = { ...run, partner: { name: 'Sina', trainerId: sina.id, setIds } };
    const urls = runScreenImages(withPartner, '2d').flat();
    expect(urls).toContain(trainerArt(sina)?.url ?? trainerSpriteUrl(sina));
    for (const id of setIds) expect(urls).toContain(spriteCandidates(SETS[id].species, 'p2', '2d')[0].url);
  });

  it('the battle after the current one is the one the run will plan after a win; none after the last battle', () => {
    const run = startRun('ahead');
    expect(followingOpponent(run)).toEqual(planOpponent(run.seedText, run.format, run.course, run.battle + 1, undefined));
    expect(followingOpponent(startRun('last', 20))).toBeNull();
    // Its Pokémon: the opponents' from the front.
    const next = followingOpponent(run)!;
    expect(runBattleImages(run, SETTINGS, next).flat()).toContain(spriteCandidates(next.team[0].species, 'p2', '2d', { gender: next.team[0].gender as 'M', shiny: !!next.team[0].shiny })[0].url);
  });

  it('the tournament: every trainer on the bracket, you, and your partner', () => {
    const partnerSets = sina.roster.slice(0, 2);
    const t = {
      seedText: 'cup', entrants: drawBracket('cup', sina.id), results: emptyResults(), round: 0,
      partner: { name: 'Sina', trainerId: sina.id, setIds: partnerSets }, team: TEAM,
    } as unknown as TournamentState;
    const urls = tournamentImages(t, 'elio', '2d');
    expect(firsts(urls)).toContain(playerSpriteUrl('elio'));
    for (const e of t.entrants) {
      if (e.kind !== 'duo') continue;
      const trainers = e.trainers.map(p => TRAINERS[p.trainerId]);
      opponentSpriteIds(trainers, duoSpriteKey(t)).forEach((id, i) => expect(firsts(urls)).toContain(trainerSpriteUrl(trainers[i], id)));
    }
    expect(nextOpponent(t)).not.toBeNull();
  });

  it('choosing a partner: the Pokémon each partner you own offers', () => {
    const offer = sina.roster.slice(0, 6);
    const urls = ownedPartnerImages({ Sina: { offer } }, '2d').flat();
    for (const id of offer) expect(urls).toContain(spriteCandidates(SETS[id].species, 'p2', '2d')[0].url);
  });
});
