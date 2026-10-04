import { useState } from 'react';
import type { BattleClient } from '../../client/battle-client';
import type { AIKind } from '../../engine/protocol';
import { TEST_OPPONENT_SET_LABELS, TEST_PLAYER_TEAM_TEXT } from '../../engine/fixtures-data';
import { randomSeedText } from '../../engine/seed';
import type { BattleTreeFormat } from '../../engine/format-constants';
import { planOpponent } from '../../run/selection';
import { DEFAULT_SETTINGS, MIN_REGISTERED } from '../../run/types';
import type { TeamStore } from '../../storage/team-store';
import { useTeams } from '../builder/hooks';
import { useAppSettings } from '../useAppSettings';
import { AnimationPreview } from './AnimationPreview';
import { BattleScreen } from './BattleScreen';

const BUILT_IN = '__builtin';

/** Free battle with a saved team: Singles against Super Red's fixed sets, Doubles against Battle Legend Blue (Super). Useful for trying teams and the AI. */
export function TestBattlePage({ client, store }: { client: BattleClient; store: TeamStore }) {
  const teams = useTeams(store);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? BUILT_IN);
  const [seedText, setSeedText] = useState(randomSeedText);
  const [ai, setAi] = useState<AIKind>('heuristic');
  const [format, setFormat] = useState<BattleTreeFormat>('singles');
  const { showDebugTools } = useAppSettings();
  const team = teams.find(t => t.id === teamId);

  const start = () => {
    // Without debug tools the seed isn't shown, so every battle gets a fresh one.
    const seed = showDebugTools ? seedText : randomSeedText();
    // Doubles: Battle Legend Blue's Super team (4 of his sets, rolled from the seed).
    const blue = format === 'doubles' ? planOpponent(seed, 'doubles', 'super', 50, DEFAULT_SETTINGS) : null;
    client.start({
      format,
      seedText: seed,
      player: { name: 'Player', team: team ? team.sets : TEST_PLAYER_TEAM_TEXT },
      opponent: blue ? { kind: 'team', name: blue.displayName, team: blue.team } : { kind: 'test-fixture' },
      ai,
    });
  };

  return (
    <>
      <section className="setup">
        <label>
          Team{' '}
          <select value={team ? teamId : BUILT_IN} onChange={e => setTeamId(e.target.value)}>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.sets.length})</option>)}
            <option value={BUILT_IN}>Built-in test team</option>
          </select>
        </label>
        <label>
          Format{' '}
          <select value={format} onChange={e => setFormat(e.target.value as BattleTreeFormat)}>
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
        </label>
        <label>
          Opponent AI{' '}
          <select value={ai} onChange={e => setAi(e.target.value as AIKind)}>
            <option value="heuristic">Battle Tree AI (heuristic)</option>
            <option value="random">Random</option>
          </select>
        </label>
        {showDebugTools && (
          <>
            <label>
              Seed <input value={seedText} onChange={e => setSeedText(e.target.value)} spellCheck={false} />
            </label>
            <button onClick={() => setSeedText(randomSeedText())}>New seed</button>
          </>
        )}
        <button className="primary" onClick={start}>Start battle</button>
        <p className="muted small">
          {format === 'singles'
            ? <>Practice against Super Red's {TEST_OPPONENT_SET_LABELS.join(', ')} (IV 31) with Team Preview.</>
            : <>Double Battle against Battle Legend Blue (Super: 4 of his sets, IV 31) with Team Preview. Your team needs at least {MIN_REGISTERED.doubles} Pokémon.</>}
          {' '}The team is checked against Battle Tree rules first. Nothing here counts toward Battle Tree records.
        </p>
      </section>
      {showDebugTools && <AnimationPreview />}
      <BattleScreen client={client} />
    </>
  );
}
