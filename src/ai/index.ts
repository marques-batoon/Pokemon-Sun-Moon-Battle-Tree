import type { AIKind } from '../engine/protocol';
import { HeuristicAI } from './heuristic/heuristic-ai';
import { RandomAI } from './random-ai';
import type { BattleAI } from './types';

export type { AIContext, BattleAI } from './types';
export { HeuristicAI } from './heuristic/heuristic-ai';
export { DEFAULT_CONFIG, type HeuristicConfig } from './heuristic/config';

export function createAI(kind: AIKind): BattleAI {
  switch (kind) {
    case 'heuristic': return new HeuristicAI();
    case 'random': return new RandomAI();
  }
}
