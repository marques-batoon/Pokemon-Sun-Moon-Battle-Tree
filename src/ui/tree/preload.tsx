// Battle Tree screens that open with their pictures in place (preload-images lists what each shows).
import { useMemo, type ReactNode } from 'react';
import type { TournamentState } from '../../run/tournament';
import type { RunState } from '../../run/types';
import { ImageGate } from '../components/ImageGate';
import { useAppSettings } from '../useAppSettings';
import { usePreloadImages } from '../useImagesReady';
import { followingOpponent, runBattleImages, runScreenImages, tournamentBattleImages, tournamentImages } from './preload-images';

/** The run screen, once the next opponents' and partner's pictures are in (at most IMAGE_WAIT_MS). Starts loading the battle's Pokémon too. */
export function RunImagesGate({ run, children }: { run: RunState; children: ReactNode }) {
  const settings = useAppSettings();
  usePreloadImages(runBattleImages(run, settings));
  return <ImageGate lists={runScreenImages(run, settings.spriteStyle)}>{children}</ImageGate>;
}

/**
 * During a battle: loads the next battle's pictures (its opponents and their Pokémon; the run's seed decides them, so
 * they're known already), so the run screen after a win opens complete. Renders nothing.
 */
export function PreloadNextBattle({ run }: { run: RunState }) {
  const settings = useAppSettings();
  const next = useMemo(() => followingOpponent(run), [run]);
  usePreloadImages(next ? [...runScreenImages(run, settings.spriteStyle, next), ...runBattleImages(run, settings, next)] : []);
  return null;
}

/** The tournament screen, once the bracket's pictures are in (at most IMAGE_WAIT_MS). Starts loading your next match's Pokémon. */
export function TournamentImagesGate({ t, children }: { t: TournamentState | null; children: ReactNode }) {
  const settings = useAppSettings();
  usePreloadImages(t ? tournamentBattleImages(t, settings) : []);
  return <ImageGate lists={t ? tournamentImages(t, settings.trainerSprite, settings.spriteStyle) : []}>{children}</ImageGate>;
}
