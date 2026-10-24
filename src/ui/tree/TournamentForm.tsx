import { useState } from 'react';
import type { RunTeam } from '../../run/controller';
import type { TournamentController } from '../../run/tournament-controller';
import { BRING, DEFAULT_SETTINGS, PARTNER_BRING, type RunSettings } from '../../run/types';
import type { SavedTeam } from '../../team/types';
import { useAppSettings } from '../useAppSettings';
import { usePreloadImages } from '../useImagesReady';
import { ownedPartnerImages } from './preload-images';
import { useTournament } from './hooks';
import { PartnerCard } from './PartnerCard';
import { PartnerPokemonPicker } from './PartnerPokemonPicker';
import { TeamSetup } from './TeamSetup';

/** A new All Star Duo Tournament: your partner, their two Pokémon, then your two. */
export function TournamentForm({ controller, teams, onStarted, onCancel }: { controller: TournamentController; teams: readonly SavedTeam[]; onStarted: () => void; onCancel: () => void }) {
  const { profile, tournament } = useTournament(controller);
  const partners = Object.keys(profile.partners.owned);
  const [partner, setPartner] = useState<string | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [team, setTeam] = useState<RunTeam | null>(null);
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_SETTINGS, ...profile.settings });
  const [seedText, setSeedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { showDebugTools, spriteStyle } = useAppSettings();
  // Your partners' Pokémon, so choosing a partner shows them at once.
  usePreloadImages(ownedPartnerImages(profile.partners.owned, spriteStyle));
  const partnerReady = !!partner && picks.length === PARTNER_BRING;
  const unfinished = tournament && (tournament.status === 'ready' || tournament.status === 'in-battle');

  const start = () => {
    if (!team || !partner || !partnerReady) return;
    if (unfinished && !confirm('Starting a new tournament ends the one you have saved. Continue?')) return;
    try {
      controller.start({ team, partner: { name: partner, setIds: picks }, settings, seedText: seedText.trim() || undefined });
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="panel new-run">
      <h2>New All Star Duo Tournament</h2>
      <p className="muted small">
        32 pairs, single elimination: you and your partner against 31 duos of special trainers who team up together.
        Rounds 1–4 pay 2 BP a win and the final pays 50 BP. Unrated (no records); anyone you beat comes into the partner shop as in All Star Mode.
      </p>
      <fieldset className="partner-pick">
        <legend>Partner</legend>
        <p className="muted small">Your partner brings {PARTNER_BRING} Pokémon and you bring {BRING.multi}, for the whole tournament. Your partner won't be in the bracket.</p>
        <div className="partner-grid">
          {partners.map(name => (
            <PartnerCard key={name} name={name} selected={partner === name} onSelect={() => { if (partner !== name) { setPartner(name); setPicks([]); } }} />
          ))}
        </div>
        {partner && <PartnerPokemonPicker name={partner} offer={profile.partners.owned[partner].offer} picked={picks} onChange={setPicks} />}
      </fieldset>

      {partnerReady ? (
        <TeamSetup format="multi" teams={teams} onChange={setTeam} />
      ) : (
        <p className="muted small">{partner ? `Choose ${partner}'s ${PARTNER_BRING} Pokémon first, then yours.` : 'Choose your partner first, then their Pokémon, then yours.'}</p>
      )}

      <fieldset className="settings">
        <legend>Settings</legend>
        <label>
          Opponent AI{' '}
          <select value={settings.ai} onChange={e => setSettings(s => ({ ...s, ai: e.target.value as RunSettings['ai'] }))}>
            <option value="heuristic">Battle Tree AI</option>
            <option value="random">Random (practice; no BP or partner progress)</option>
          </select>
        </label>
      </fieldset>

      {showDebugTools && (
        <details className="debug">
          <summary>Debug options</summary>
          <label>Tournament seed <input value={seedText} placeholder="random" onChange={e => setSeedText(e.target.value)} spellCheck={false} /></label>
        </details>
      )}

      {error && <p className="problems">{error}</p>}
      <div className="row-actions">
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!team || !partnerReady} onClick={start}>Start All Star Duo Tournament</button>
      </div>
    </section>
  );
}
