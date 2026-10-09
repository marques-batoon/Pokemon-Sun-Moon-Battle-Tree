import { useSyncExternalStore } from 'react';
import type { RunController } from '../../run/controller';
import type { Course, Format, RunKey, RunState } from '../../run/types';

export function useRunState(controller: RunController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}

const FORMAT_LABEL: Record<Format, string> = { singles: 'Singles', doubles: 'Doubles', multi: 'Multi' };
/** "Normal Singles", "Super Doubles", "Super Multi". */
export const courseLabel = (format: Format, course: Course) => `${course === 'normal' ? 'Normal' : 'Super'} ${FORMAT_LABEL[format]}`;
export const keyLabel = (key: RunKey) => courseLabel(...splitKey(key));
export const splitKey = (key: RunKey) => key.split('-') as [Format, Course];
/** The Battle Legend of each format (Multi: both, together). */
export const LEGEND: Record<Format, string> = { singles: 'Red', doubles: 'Blue', multi: 'Red & Blue' };
/** Section titles on the Battle Tree page. */
export const BATTLE_TITLE: Record<Format, string> = { singles: 'Single Battles', doubles: 'Double Battles', multi: 'Multi Battles' };

/** Why a run doesn't count toward records. */
export function unrankedReason(run: RunState): string | null {
  if (!run.debug) return null;
  if ((run.settings.ai ?? 'heuristic') !== 'heuristic') return 'Practice against the random AI';
  return 'Debug run (started past battle 1)';
}
