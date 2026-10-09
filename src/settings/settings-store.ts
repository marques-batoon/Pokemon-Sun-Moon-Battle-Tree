import type { KeyValueStore } from '../storage/kv';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type AnimationSpeed = 'off' | 'fast' | 'normal' | 'slow';

/** Multiplier on animation durations for each speed setting (0 = no animations). */
export const ANIMATION_SPEED_FACTOR: Record<AnimationSpeed, number> = { off: 0, fast: 0.5, normal: 1, slow: 1.6 };

export interface AppSettings {
  theme: ThemeSetting;
  /** Label moves "Super effective" / "Not very effective" / "No effect", as Sun & Moon do. */
  effectivenessHints: boolean;
  /** Keys 1-4 pick moves during battle. */
  keyboardShortcuts: boolean;
  /** Seeds, input logs, "start at battle N" and other testing aids. */
  showDebugTools: boolean;
  /** Pokémon sprites and trainer portraits (loaded from Pokémon Showdown's sprite server). */
  sprites: boolean;
  /** Battle playback: each event animates and the log advances when it finishes. */
  animationSpeed: AnimationSpeed;
  /** Your trainer name in battle and in online Multi Battles ('' = not set: "Player"). See checkTrainerName. */
  trainerName: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  effectivenessHints: true,
  keyboardShortcuts: true,
  showDebugTools: false,
  sprites: true,
  animationSpeed: 'normal',
  trainerName: '',
};

export const SETTINGS_KEY = 'settings.v1';

/** App preferences (versioned JSON behind KeyValueStore). */
export class SettingsStore {
  private settings: AppSettings;
  private readonly listeners = new Set<() => void>();
  private readonly kv: KeyValueStore;

  constructor(kv: KeyValueStore) {
    this.kv = kv;
    this.settings = this.load();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSettings = (): AppSettings => this.settings;

  update(patch: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.kv.set(SETTINGS_KEY, JSON.stringify({ version: 1, ...this.settings }));
    this.listeners.forEach(l => l());
  }

  private load(): AppSettings {
    const raw = this.kv.get(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings> & { version?: number };
      const { version: _v, ...rest } = parsed;
      return { ...DEFAULT_APP_SETTINGS, ...rest };
    } catch {
      return { ...DEFAULT_APP_SETTINGS };
    }
  }
}
