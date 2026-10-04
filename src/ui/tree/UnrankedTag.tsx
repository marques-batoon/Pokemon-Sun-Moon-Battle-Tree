import type { RunState } from '../../run/types';
import { unrankedReason } from './hooks';

/** Marks a run that never counts toward records (practice or debug). */
export function UnrankedTag({ run }: { run: RunState }) {
  const reason = unrankedReason(run);
  return reason ? <span className="tag" title={`${reason}. Doesn't count toward records or unlocks.`}>unranked</span> : null;
}
