import setsJson from './sets.json';
import trainersJson from './trainers.json';
import bracketsJson from './brackets.json';
import bossesJson from './bosses.json';
import rulesJson from './rules.json';
import type { Boss, BracketsFile, RulesFile, Trainer, TreeSet } from './types';

export * from './types';

export const SETS = setsJson.sets as TreeSet[];
export const TRAINERS = trainersJson.trainers as Trainer[];
export const BRACKETS = bracketsJson as unknown as BracketsFile;
export const BOSSES = bossesJson.bosses as Record<string, Boss>;
export const RULES = rulesJson as unknown as RulesFile;
