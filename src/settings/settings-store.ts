import type { KeyValueStore } from '../storage/kv';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type AnimationSpeed = 'off' | 'fast' | 'normal' | 'slow';
/** Pokémon pictures: 2D pixel sprites (Black and White style) or 3D animated ones (X and Y / Sun and Moon style). */
export type SpriteStyle = '2d' | '3d';
/** Scenery behind the battle (all share the same horizon line). */
export type BattleBackground = 'battletree' | 'grass' | 'stadium' | 'mountain' | 'ocean' | 'forest';
export const BATTLE_BACKGROUNDS: { id: BattleBackground; label: string }[] = [
  { id: 'battletree', label: 'Battle Tree' },
  { id: 'grass', label: 'Grass field' },
  { id: 'stadium', label: 'Pokémon Stadium' },
  { id: 'mountain', label: 'Mountain' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
];

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
  /** Which Pokémon sprites: 2D pixel (default) or 3D animated. Each falls back to the other kinds if missing. */
  spriteStyle: SpriteStyle;
  /** Scenery behind the battle. */
  battleBackground: BattleBackground;
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
  spriteStyle: '2d',
  battleBackground: 'battletree',
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
