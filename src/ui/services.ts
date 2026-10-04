// App-wide singletons. Module scope (not component state) so React StrictMode's
// mount/unmount cycle can't tear down the worker or reload storage mid-use.
import { BattleClient } from '../client/battle-client';
import { createWorkerTransport, type EngineTransport } from '../client/transport';
import { ValidationClient } from '../client/validation-client';
import { localStore, type KeyValueStore } from '../storage/kv';
import { ANIMATION_SPEED_FACTOR, SettingsStore } from '../settings/settings-store';
import { TeamStore } from '../storage/team-store';
import { RunController } from '../run/controller';
import { RunStore } from '../run/run-store';

let transport: EngineTransport | null = null;
let battleClient: BattleClient | null = null;
let validationClient: ValidationClient | null = null;
let teamStore: TeamStore | null = null;
let runController: RunController | null = null;
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

/** A battle client that plays at the animation speed from Settings and follows changes to it. */
function newBattleClient(): BattleClient {
  const settings = getSettingsStore();
  const speed = () => ANIMATION_SPEED_FACTOR[settings.getSettings().animationSpeed] ?? 1;
  const client = new BattleClient(engine(), { speed: speed() });
  settings.subscribe(() => client.setSpeed(speed()));
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

/** Battle Tree runs get their own battle client so a test battle can't cut off a run's battle. */
export function getRunController(): RunController {
  runController ??= new RunController(new RunStore(getKeyValueStore()), newBattleClient());
  return runController;
}

export function getSettingsStore(): SettingsStore {
  settingsStore ??= new SettingsStore(getKeyValueStore());
  return settingsStore;
}

// Hot updates would re-run this module and duplicate the singletons (a second worker, stores and
// battle clients the rest of the app doesn't use), so changes here or below reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
