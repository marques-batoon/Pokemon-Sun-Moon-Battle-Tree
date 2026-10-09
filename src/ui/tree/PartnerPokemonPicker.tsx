import { SETS } from '../../data/battle-tree';
import { PARTNER_BRING } from '../../run/types';
import { PartnerMonPicture } from './PartnerCard';

interface Props {
  name: string;
  /** Set ids to choose from (the partner's offer). */
  offer: readonly number[];
  /** Chosen set ids, in order (first leads). */
  picked: readonly number[];
  onChange: (picked: number[]) => void;
}

/** Choose two of a partner's (up to) six Pokémon, by picture only. Pick order is battle order. */
export function PartnerPokemonPicker({ name, offer, picked, onChange }: Props) {
  const toggle = (id: number) =>
    onChange(picked.includes(id) ? picked.filter(x => x !== id) : picked.length < PARTNER_BRING ? [...picked, id] : [...picked]);
  return (
    <div className="partner-offer">
      <p className="muted small">Choose {PARTNER_BRING} of {name}'s Pokémon to bring ({picked.length}/{PARTNER_BRING}). The first one leads.</p>
      <div className="offer-grid">
        {offer.map(id => {
          const order = picked.indexOf(id);
          return (
            <button
              key={id}
              type="button"
              className={`offer-pick${order >= 0 ? ' picked' : ''}`}
              aria-pressed={order >= 0}
              disabled={order < 0 && picked.length >= PARTNER_BRING}
              onClick={() => toggle(id)}
            >
              {order >= 0 && <span className="pick-order">{order + 1}</span>}
              <PartnerMonPicture species={SETS[id].species} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
