import { SETS, TRAINERS, type SpecialTrainer } from '../data/battle-tree';
import type { PokemonSet } from '../team/types';
import { pickUpTo, treeSetToPokemonSet } from './opponent';
import { Rng } from './rng';
import { DEFAULT_PARTNERS, PARTNER_BRING, PARTNER_OFFER_SIZE, type PartnerBook, type RunPartner } from './types';

/** Special trainers (the only Multi partners), by name: partners are stored by name. */
export function specialTrainer(name: string): SpecialTrainer {
  const trainer = TRAINERS.find((t): t is SpecialTrainer => t.kind === 'special' && t.name === name);
  if (!trainer) throw new Error(`${name} isn't a special trainer.`);
  return trainer;
}

/**
 * The Pokémon you can choose a partner's two from: up to six of their Battle Tree
 * sets, all different species and items, so any two of them obey the partner's
 * Species and Item Clause. Rolled once, when you get the partner.
 */
export function rollOffer(name: string, rng: Rng): number[] {
  return pickUpTo(specialTrainer(name), PARTNER_OFFER_SIZE, rng).map(s => s.id);
}

/**
 * The partners everyone starts with (Sina and Dexio, an app choice: the game starts
 * you with Pokémon Breeder Rada), with offers fixed per name.
 */
export function defaultPartnerBook(): PartnerBook {
  const owned = Object.fromEntries(DEFAULT_PARTNERS.map(name => [name, { offer: rollOffer(name, new Rng(`default-partner|${name}`)) }]));
  return { owned, available: [] };
}

/** The partner for a challenge: an owned partner and two different Pokémon from their offer, lead first. */
export function runPartner(name: string, setIds: readonly number[], book: PartnerBook): RunPartner {
  const entry = book.owned[name];
  if (!entry) throw new Error(`You don't have ${name} as a partner yet.`);
  if (setIds.length !== PARTNER_BRING || new Set(setIds).size !== PARTNER_BRING || setIds.some(id => !entry.offer.includes(id))) {
    throw new Error(`Choose ${PARTNER_BRING} of ${name}'s Pokémon.`);
  }
  return { name, trainerId: specialTrainer(name).id, setIds: [...setIds] };
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
