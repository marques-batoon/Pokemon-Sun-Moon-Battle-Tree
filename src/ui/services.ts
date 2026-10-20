// App-wide singletons. Module scope (not component state) so React StrictMode's
// mount/unmount cycle can't tear down the worker or reload storage mid-use.
import { BattleClient } from '../client/battle-client';
import { createWorkerTransport, type EngineTransport } from '../client/transport';
import { SimulationClient } from '../client/simulation-client';
import { ValidationClient } from '../client/validation-client';
import { localStore, type KeyValueStore } from '../storage/kv';
import { ANIMATION_SPEED_FACTOR, SettingsStore } from '../settings/settings-store';
import { TeamStore } from '../storage/team-store';
import { RunController } from '../run/controller';
import { RunStore } from '../run/run-store';
import { TournamentController } from '../run/tournament-controller';
import { battleName } from '../online/trainer-name';
import { preloadBattleSprites } from './sprite-preload';

let transport: EngineTransport | null = null;
let battleClient: BattleClient | null = null;
let validationClient: ValidationClient | null = null;
let teamStore: TeamStore | null = null;
let runController: RunController | null = null;
let runStore: RunStore | null = null;
let simulationClient: SimulationClient | null = null;
let tournamentController: TournamentController | null = null;
let settingsStore: SettingsStore | null = null;
let kv: KeyValueStore | null = null;

/** One persistence backend for every store (localStorage today; swappable). */
export function getKeyValueStore(): KeyValueStore {
  kv ??= localStore();
  return kv;
}

/** One worker serves both battles and team validation. */
export function engine(): EngineTransport {
  transport ??= createWorkerTransport();
  return transport;
}

/**
 * A battle client that plays at the animation speed from Settings and follows changes to it.
 * Online Multi Battles pass their own transport (the guest's is the room) and perspective.
 * Starting a battle ("Battle!") also starts loading every sprite it can show (sprite-preload).
 */
export function newBattleClient(transport: EngineTransport = engine(), perspective: 'p1' | 'p3' = 'p1'): BattleClient {
  const settings = getSettingsStore();
  const speed = () => ANIMATION_SPEED_FACTOR[settings.getSettings().animationSpeed] ?? 1;
  const client = new BattleClient(transport, { speed: speed(), perspective });
  const unsubscribe = settings.subscribe(() => client.setSpeed(speed()));
  const start = client.start.bind(client);
  client.start = opts => {
    preloadBattleSprites(opts, settings.getSettings());
    return start(opts);
  };
  const dispose = client.dispose.bind(client);
  client.dispose = () => { unsubscribe(); dispose(); };
  return client;
}

export function getBattleClient(): BattleClient {
  battleClient ??= newBattleClient();
  return battleClient;
}

export function getValidationClient(): ValidationClient {
  validationClient ??= new ValidationClient(engine());
  return validationClient;
}

export function getTeamStore(): TeamStore {
  teamStore ??= new TeamStore(getKeyValueStore());
  return teamStore;
}

/** Battle Tree progress: runs, the tournament, BP and partners (one store for both controllers). */
function getRunStore(): RunStore {
  runStore ??= new RunStore(getKeyValueStore());
  return runStore;
}

const playerName = () => battleName(getSettingsStore().getSettings().trainerName);

/** Battle Tree runs get their own battle client so a test battle can't cut off a run's battle. */
export function getRunController(): RunController {
  runController ??= new RunController(getRunStore(), newBattleClient(), { playerName });
  return runController;
}

/** The engine fights tournament matches you're not in (same worker as battles). */
export function getSimulationClient(): SimulationClient {
  simulationClient ??= new SimulationClient(engine());
  return simulationClient;
}

/** The All Star Duo Tournament shares the Battle Tree's battle client (one Battle Tree battle at a time). */
export function getTournamentController(): TournamentController {
  const sims = getSimulationClient();
  tournamentController ??= new TournamentController(getRunStore(), getRunController().battleClient, (matches, ai) => sims.simulate(matches, ai), { playerName });
  return tournamentController;
}

export function getSettingsStore(): SettingsStore {
  settingsStore ??= new SettingsStore(getKeyValueStore());
  return settingsStore;
}

// Hot updates would re-run this module and duplicate the singletons (a second worker, stores and
// battle clients the rest of the app doesn't use), so changes here or below reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
