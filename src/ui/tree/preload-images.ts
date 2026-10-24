// The pictures each Battle Tree screen shows (lists for image-preload), so they can be loaded before it opens:
// a challenge's next opponents and partner, the battle after the one being fought, and a tournament's bracket.
import { SETS, TRAINERS, type Trainer } from '../../data/battle-tree';
import { partnerTeam, partnerTrainer } from '../../run/partners';
import { courseSchedule, planOpponent } from '../../run/selection';
import { duoSpriteKey, nextOpponent, type TournamentState } from '../../run/tournament';
import type { PlannedOpponent, PlannedTrainer, RunPartner, RunState } from '../../run/types';
import type { AppSettings, SpriteStyle } from '../../settings/settings-store';
import { plannedBattleSpriteUrls } from '../sprite-preload';
import { opponentSpriteIds, playerSpriteUrl, spriteCandidates, trainerImageUrls } from '../sprites';

type SpriteSettings = Pick<AppSettings, 'sprites' | 'spriteStyle' | 'matchSideSprites'>;

const foesOf = (next: PlannedOpponent): PlannedTrainer[] => [next, ...(next.second ? [next.second] : [])];

/** A partner card (PartnerCard): their portrait (artwork or sprite) and pictures of the Pokémon they bring. */
export function partnerImages(name: string, setIds: readonly number[], style: SpriteStyle): string[][] {
  return [...trainerImageUrls([partnerTrainer(name)]), ...setIds.map(id => spriteCandidates(SETS[id].species, 'p2', style).map(c => c.url))];
}

/** The partners you own and the Pokémon each offers (choosing a partner and their two Pokémon). */
export function ownedPartnerImages(owned: Record<string, { offer: readonly number[] }>, style: SpriteStyle): string[][] {
  return Object.entries(owned).flatMap(([name, { offer }]) => partnerImages(name, offer, style));
}

/** The run screen's pictures: the next opponents' card (as the battle's seed shows them) and your partner's card. */
export function runScreenImages(run: RunState, style: SpriteStyle, next: PlannedOpponent = run.next): string[][] {
  const trainers = foesOf(next).map(f => TRAINERS[f.trainerId]);
  return [
    ...trainerImageUrls(trainers, opponentSpriteIds(trainers, next.seedText)),
    ...(run.partner ? partnerImages(run.partner.name, run.partner.setIds, style) : []),
  ];
}

/** Your side of a battle: your whole team (Team Preview can bring any of them) and, in Multi, your partner's Pokémon. */
const yourSide = (team: RunState['team'], partner: RunPartner | undefined) => [...team.sets, ...(partner ? partnerTeam(partner) : [])];

/** The Pokémon a run's next battle (or `next`) can show. */
export const runBattleImages = (run: RunState, settings: SpriteSettings, next: PlannedOpponent = run.next): string[][] =>
  plannedBattleSpriteUrls(yourSide(run.team, run.partner), foesOf(next), settings);

/** The battle after the run's current one (decided by the run's seed), or null after the course's last battle. */
export function followingOpponent(run: RunState): PlannedOpponent | null {
  const length = courseSchedule(run.format, run.course).length;
  if (length && run.battle >= length) return null;
  return planOpponent(run.seedText, run.format, run.course, run.battle + 1, run.partner?.trainerId);
}

/**
 * The tournament screen's pictures: every trainer on the bracket (sprites only, as it shows them all tournament), you,
 * your partner's card, and your next opponents' card (with their artwork, if it shows it).
 */
export function tournamentImages(t: TournamentState, playerSprite: string, style: SpriteStyle): string[][] {
  const key = duoSpriteKey(t);
  const duo = (trainers: Trainer[], art: boolean) => trainerImageUrls(trainers, opponentSpriteIds(trainers, key), { art });
  const foes = nextOpponent(t);
  return [
    [playerSpriteUrl(playerSprite)],
    ...partnerImages(t.partner.name, t.partner.setIds, style),
    ...t.entrants.flatMap(e => (e.kind === 'duo' ? duo(e.trainers.map(p => TRAINERS[p.trainerId]), false) : [])),
    ...(foes ? duo(foes.trainers.map(p => TRAINERS[p.trainerId]), true) : []),
  ];
}

/** The Pokémon your next tournament match can show (your two, your partner's two, your opponents'). */
export function tournamentBattleImages(t: TournamentState, settings: SpriteSettings): string[][] {
  const foes = nextOpponent(t);
  if (!foes) return [];
  return plannedBattleSpriteUrls([...t.team.bring.map(i => t.team.sets[i]), ...partnerTeam(t.partner)], foes.trainers, settings);
}
