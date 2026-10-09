import type { ReactNode } from 'react';
import { SETS } from '../../data/battle-tree';
import { specialTrainer } from '../../run/partners';
import { PartnerPortrait } from '../components/PartnerPortrait';
import { PokemonSprite } from '../components/PokemonSprite';

interface Props {
  /** Special trainer's name ("Sina"). */
  name: string;
  /** The Pokémon they bring this challenge (Battle Tree set ids), shown as pictures. */
  team?: readonly number[];
  /** Makes the card a toggle button (choosing a partner). */
  onSelect?: () => void;
  selected?: boolean;
  /** Extra content (e.g. a Buy button; only for non-button cards). */
  children?: ReactNode;
}

/** A Multi partner: square portrait and name (and, during a challenge, pictures of their two Pokémon). */
export function PartnerCard({ name, team, onSelect, selected = false, children }: Props) {
  const trainer = specialTrainer(name);
  const body = (
    <>
      <PartnerPortrait trainer={trainer} size={88} />
      <span className="partner-name">
        <strong>{trainer.name}</strong>
        <span className="muted small">{trainer.class}</span>
      </span>
      {team && (
        <span className="partner-mons">
          {team.map(id => <PartnerMonPicture key={id} species={SETS[id].species} />)}
        </span>
      )}
      {children}
    </>
  );
  return onSelect ? (
    <button type="button" className={`partner-card${selected ? ' picked' : ''}`} aria-pressed={selected} onClick={onSelect}>{body}</button>
  ) : (
    <div className="partner-card">{body}</div>
  );
}

/** Just the Pokémon's picture: no name, item, stats or moves (the name is for screen readers). */
export function PartnerMonPicture({ species }: { species: string }) {
  return (
    <span className="partner-mon" role="img" aria-label={species}>
      <PokemonSprite species={species} side="p2" />
    </span>
  );
}
