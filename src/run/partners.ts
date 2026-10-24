import { SETS, TRAINERS, trainerKey, type LegendTrainer, type SpecialTrainer, type TreeSet } from '../data/battle-tree';
import { isDigimon } from '../data/custom/digimon';
import { isOpponentOnly } from '../data/galar';
import type { PokemonSet } from '../team/types';
import { dexNum, pickUpTo, treeSetToPokemonSet } from './opponent';
import { Rng } from './rng';
import { DEFAULT_PARTNERS, PARTNER_BRING, PARTNER_OFFER_SIZE, priceOf, type PartnerBook, type RunPartner } from './types';

/** Who can be a Multi partner: special trainers and (since 2026-10-11) Battle Legends. */
export type PartnerTrainer = SpecialTrainer | LegendTrainer;

/**
 * A special trainer or Battle Legend by name (trainerKey): partners are stored by it. Red and Blue each have a
 * Normal and a Super version (the same Pokémon): their Super one.
 */
export function partnerTrainer(name: string): PartnerTrainer {
  const matches = TRAINERS.filter((t): t is PartnerTrainer => (t.kind === 'special' || t.kind === 'legend') && trainerKey(t) === name);
  const trainer = matches.find(t => t.kind === 'special') ?? matches.find(t => t.kind === 'legend' && t.course !== 'normal') ?? matches[0];
  if (!trainer) throw new Error(`${name} isn't a special trainer or Battle Legend.`);
  return trainer;
}

/** Whether beating this trainer puts them in the partner shop (special trainers and Battle Legends). */
export const isPartnerKind = (kind: string) => kind === 'special' || kind === 'legend';

/** A trainer's Digimon (Tai's Agumon, Izzy's Tentomon, Henry's Terriermon...), if they have one. */
function digimonSet(trainer: PartnerTrainer): TreeSet | undefined {
  return trainer.roster.map(id => SETS[id]).find(s => isDigimon(s.species));
}

/**
 * The Pokémon you can choose a partner's two from: up to six of their Battle Tree
 * sets, all different species and items, so any two of them obey the partner's
 * Species and Item Clause. Rolled once, when you get the partner. A trainer with a
 * Digimon always offers it (on request, 2026-10-18), first.
 */
export function rollOffer(name: string, rng: Rng): number[] {
  const trainer = partnerTrainer(name);
  // Opponents-only Pokémon (Gloria's Galar Pokémon) aren't offered.
  const offerable = { ...trainer, roster: trainer.roster.filter(id => !isOpponentOnly(SETS[id].species)) };
  return pickUpTo(offerable, PARTNER_OFFER_SIZE, rng, digimonSet(trainer)).map(s => s.id);
}

/**
 * An offer rolled before the Digimon were always in it: the trainer's Digimon comes in first, and the others stay
 * if they still go with it (different species and item), up to six. Any other offer is returned as it is.
 */
export function withDigimon(name: string, offer: readonly number[]): number[] {
  const digimon = digimonSet(partnerTrainer(name));
  if (!digimon || offer.includes(digimon.id)) return [...offer];
  const others = offer.map(id => SETS[id]).filter(s => dexNum(s) !== dexNum(digimon) && s.item !== digimon.item);
  return [digimon.id, ...others.map(s => s.id)].slice(0, PARTNER_OFFER_SIZE);
}

/**
 * The partners everyone starts with (Sina and Dexio, an app choice: the game starts
 * you with Pokémon Breeder Rada), with offers fixed per name.
 */
export function defaultPartnerBook(): PartnerBook {
  const owned = Object.fromEntries(DEFAULT_PARTNERS.map(name => [name, { offer: rollOffer(name, new Rng(`default-partner|${name}`)) }]));
  return { owned, beaten: {} };
}

/** Special trainers and Battle Legends you can buy now (beaten, not owned yet), with their price. */
export function partnersForSale(book: PartnerBook): { name: string; timesBeaten: number; price: number }[] {
  return Object.entries(book.beaten)
    .filter(([name, times]) => times > 0 && !book.owned[name])
    .map(([name, times]) => ({ name, timesBeaten: times, price: priceOf(book, name)! }));
}

/** The partner for a challenge: an owned partner and two different Pokémon from their offer, lead first. */

export function runPartner(name: string, setIds: readonly number[], book: PartnerBook): RunPartner {
  const entry = book.owned[name];
  if (!entry) throw new Error(`You don't have ${name} as a partner yet.`);
  if (setIds.length !== PARTNER_BRING || new Set(setIds).size !== PARTNER_BRING || setIds.some(id => !entry.offer.includes(id))) {
    throw new Error(`Choose ${PARTNER_BRING} of ${name}'s Pokémon.`);
  }
  return { name, trainerId: partnerTrainer(name).id, setIds: [...setIds] };
}

/**
 * The partner's two Pokémon. Abilities and genders are rolled once per partner team
 * (not per battle), so a partner keeps the same Pokémon all challenge.
 */
export function partnerTeam(partner: RunPartner): PokemonSet[] {
  const trainer = TRAINERS[partner.trainerId];
  const rng = new Rng(`partner|${partner.name}|${partner.setIds.join(',')}`);
  return partner.setIds.map(id => treeSetToPokemonSet(SETS[id], trainer.iv, rng));
}
