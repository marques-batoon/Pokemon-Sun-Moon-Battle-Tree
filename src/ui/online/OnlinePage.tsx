import { useState, useSyncExternalStore } from 'react';
import { TRAINERS } from '../../data/battle-tree';
import type { OnlineRoom } from '../../online/link-room';
import { RELAY_URL } from '../../online/relay-client';
import { newRoomCode, ROOM_CODE } from '../../online/relay-protocol';
import { checkTrainerName } from '../../online/trainer-name';
import { displayName } from '../../run/selection';
import { BRING, isSuperUnlocked } from '../../run/types';
import type { TeamStore } from '../../storage/team-store';
import { BattleScreen } from '../battle/BattleScreen';
import { useTeams } from '../builder/hooks';
import { TrainerNameField } from '../components/TrainerNameField';
import { TrainerSprite } from '../components/TrainerSprite';
import { getRunController } from '../services';
import { TeamSetup } from '../tree/TeamSetup';
import { useRunState } from '../tree/hooks';
import { useAppSettings } from '../useAppSettings';
import { useBattleSnapshot } from '../useBattleClient';
import { hashParam } from '../useHashRoute';
import { roomStore } from './room-store';
import { DebugOpponentPicker } from '../tree/DebugOpponentPicker';

/** Online Multi Battles: team up with a friend against Battle Tree trainers. */
export function OnlinePage({ teamStore }: { teamStore: TeamStore }) {
  const room = useSyncExternalStore(roomStore.subscribe, roomStore.get);
  const { trainerName } = useAppSettings();
  const name = checkTrainerName(trainerName);

  if (!RELAY_URL) {
    return (
      <section className="panel">
        <h2>Online Multi Battles</h2>
        <p>Online play isn't set up for this copy of the app.</p>
        <p className="muted small">
          It needs the relay server (the <code>relay/</code> folder) deployed and its address in <code>VITE_RELAY_URL</code> when the app is built.
          See <code>relay/README.md</code>.
        </p>
      </section>
    );
  }
  if (!name.ok) {
    return (
      <section className="panel online-name">
        <h2>Online Multi Battles</h2>
        <p>Choose a trainer name first. Your partner will see it.</p>
        <TrainerNameField />
        <p className="muted small">Don't use your real name.</p>
      </section>
    );
  }
  return room ? <RoomView room={room} teamStore={teamStore} /> : <OnlineHome name={name.name} />;
}

function OnlineHome({ name }: { name: string }) {
  const { profile } = useRunState(getRunController());
  const canHost = isSuperUnlocked(profile, 'multi');
  const [code, setCode] = useState(() => (hashParam('room') ?? '').toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const join = () => {
    const c = code.trim().toUpperCase();
    if (!ROOM_CODE.test(c)) { setError('Room codes are 8 letters and numbers.'); return; }
    roomStore.open('guest', c, name);
  };
  return (
    <section className="online-home">
      <div className="panel">
        <h2>Online Multi Battles</h2>
        <p>Team up with a friend: you each bring {BRING.multi} Pokémon against two Battle Tree trainers, and keep a streak going while you win.</p>
        <p className="muted small">You're playing as <strong>{name}</strong> (change it in <a href="#/settings">Settings</a>).</p>
      </div>
      <div className="online-choices">
        <div className="panel">
          <h3>Make a room</h3>
          <p className="muted small">You get a code to send to your friend. Your browser runs the battle.</p>
          {canHost ? (
            <button className="primary" onClick={() => roomStore.open('host', newRoomCode(), name)}>Make a room</button>
          ) : (
            <p className="muted small">Unlock Super Multi first (unlock Super Singles and Super Doubles). You can still join a friend's room.</p>
          )}
        </div>
        <form className="panel" onSubmit={e => { e.preventDefault(); join(); }}>
          <h3>Join a room</h3>
          <label className="fld">
            <span>Room code</span>
            <input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError(null); }} maxLength={8} autoCapitalize="characters" spellCheck={false} placeholder="ABCD2345" />
          </label>
          {error && <p className="problems">{error}</p>}
          <button className="primary" type="submit">Join</button>
        </form>
      </div>
      <SafetyNote />
    </section>
  );
}

function SafetyNote() {
  return (
    <p className="muted small online-safety">
      Only play with people you know. There's no chat, and nobody can find your room without its code.
      Never share personal details in your trainer name. You can leave a room at any time.
    </p>
  );
}

function RoomView({ room, teamStore }: { room: OnlineRoom; teamStore: TeamStore }) {
  const snap = useSyncExternalStore(room.subscribe, room.getSnapshot);
  const battle = useBattleSnapshot(room.client);
  const teams = useTeams(teamStore);
  const { lobby, role, partnerName } = snap;
  const host = role === 'host';
  // Debug tools are the host's alone: the guest never sees them, whatever their own settings.
  const { showDebugTools } = useAppSettings();
  const hostDebug = host && showDebugTools;
  const { battleFoes } = snap;
  const [copied, setCopied] = useState(false);
  const invite = `${location.origin}${location.pathname}#/online?room=${snap.code}`;

  if (snap.battleId && battle.phase !== 'idle') {
    const failed = battle.phase === 'invalid-team' || battle.phase === 'error';
    return (
      <>
        <div className="battle-banner">
          {battleFoes.map(id => <TrainerSprite key={id} trainer={TRAINERS[id]} size={44} />)}
          <span>Online Multi · Battle {lobby.battle} · with {partnerName ?? 'your partner'}</span>
          <span className="spacer" />
          {host && lobby.inBattle && !snap.aiPartner && partnerName && (
            <button onClick={() => { if (confirm(`Let the AI play ${partnerName}'s Pokémon for the rest of this battle?`)) room.aiTakeOver(); }}>
              AI plays for {partnerName}
            </button>
          )}
          <button className="danger" onClick={() => {
            if (battle.phase !== 'active' || confirm(host ? 'Leave the room? The battle ends for both of you.' : 'Leave the room? The AI plays your Pokémon for the rest of the battle.')) roomStore.close();
          }}>Leave room</button>
        </div>
        <BattleScreen
          client={room.client}
          opponent={{ trainers: battleFoes.map(id => TRAINERS[id]), battleKey: battle.seedText ?? snap.battleId }}
          onContinue={battle.phase === 'ended' ? () => room.leaveBattleScreen() : undefined}
          continueLabel="Back to the room"
          debugTools={hostDebug}
        />
        {snap.aiPartner && <p className="muted small">The AI is playing {host ? `${partnerName ?? 'your partner'}'s` : 'your'} Pokémon.</p>}
        {failed && <button onClick={() => room.leaveBattleScreen()}>Back to the room</button>}
      </>
    );
  }

  if (snap.status === 'closed') {
    return (
      <section className="panel">
        <h2>Room closed</h2>
        <p>{snap.error}</p>
        <button className="primary" onClick={() => roomStore.close()}>Back</button>
      </section>
    );
  }

  return (
    <section className="panel online-room">
      <header className="online-room-head">
        <div>
          <h2>Room <code className="room-code">{snap.code}</code></h2>
          <p className="muted small">{snap.status === 'connecting' ? 'Connecting…' : host ? 'Send your friend the code or the invite link.' : 'Connected.'}</p>
        </div>
        <div className="row-actions">
          {host && (
            <button onClick={() => { void navigator.clipboard?.writeText(invite).then(() => setCopied(true)); }}>{copied ? 'Link copied' : 'Copy invite link'}</button>
          )}
          <button className="danger" onClick={() => { if (!lobby.inBattle || confirm('Leave the room? The battle ends for both of you.')) roomStore.close(); }}>Leave</button>
        </div>
      </header>

      <ul className="online-members">
        <li><strong>{snap.members.find(m => m.seat === snap.seat)?.name ?? 'You'}</strong> (you){snap.ready ? ' · ready' : ''}</li>
        <li>{partnerName ? <><strong>{partnerName}</strong>{(host ? lobby.guestReady : lobby.hostReady) ? ' · ready' : ' · choosing Pokémon'}</> : <span className="muted">Waiting for your friend to join…</span>}</li>
      </ul>

      {lobby.next.length > 0 && (
        <div className="online-next">
          <span className="muted small">Streak {lobby.streak} · next: battle {lobby.battle}</span>
          <div className="online-next-foes">
            {lobby.next.map(id => (
              <span key={id} className="online-foe"><TrainerSprite trainer={TRAINERS[id]} size={56} />{displayName(TRAINERS[id])}</span>
            ))}
          </div>
        </div>
      )}

      {lobby.notice && <p className="problems">{lobby.notice}</p>}

      {hostDebug && !lobby.inBattle && (
        <DebugOpponentPicker key={lobby.battle} format="multi" onApply={ids => room.debugChooseOpponents(ids)} />
      )}

      <h3>Your Pokémon</h3>
      <TeamSetup format="multi" teams={teams} initial={room.teamChoice ?? undefined} onChange={team => room.setTeam(team ? team.bring.map(i => team.sets[i]) : null, team)} />
      <p className="muted small">Nicknames aren't shown online: your partner sees species names only.</p>

      <div className="row-actions">
        <span className="spacer" />
        {host ? (
          <button className="primary" disabled={!partnerName || !lobby.hostReady || !lobby.guestReady || lobby.inBattle} onClick={() => room.startBattle()}>
            Start battle {lobby.battle}
          </button>
        ) : (
          <span className="muted small">{lobby.inBattle ? 'Battle starting…' : 'The host starts the battle when you are both ready.'}</span>
        )}
      </div>
      <SafetyNote />
    </section>
  );
}
