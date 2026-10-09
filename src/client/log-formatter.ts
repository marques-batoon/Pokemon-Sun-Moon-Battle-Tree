import type { Battle } from '@pkmn/client';
import type { ArgType, KWArgType, PokemonIdent } from '@pkmn/protocol';
import { LogFormatter } from '@pkmn/view';

/**
 * LogFormatter that counts the player's Multi Battle partner as their own side.
 * @pkmn/view compares a side with that same side's ally (never equal), so the
 * partner's Pokémon read as "the opposing Drampa"; here the partner's side is
 * written as the player's before formatting.
 */
export class TreeLogFormatter extends LogFormatter {
  private multi = false;

  /** Multi: "Battle started between Player & Sina and Darla & Alwyn!" (the base names only p1 and p2). */
  override formatText(args: ArgType, kwArgs?: KWArgType, noSectionBreak?: boolean): string {
    if (args[0] === 'gametype') this.multi = args[1] === 'multi';
    const text = super.formatText(args, kwArgs, noSectionBreak);
    if (args[0] !== 'start' || !this.multi) return text;
    return text.replace(`${this.p1} and ${this.p2}`, `${this.p1} & ${this.p3} and ${this.p2} & ${this.p4}`);
  }

  // @pkmn/view calls these with missing idents too (e.g. a field effect nobody started).
  private asOwn(side: string | undefined): string | null {
    const ally = LogFormatter.allyID(this.perspective);
    return ally && side?.startsWith(ally) ? this.perspective + side.slice(2) : null;
  }

  override pokemon(pokemon: PokemonIdent | ''): string {
    return super.pokemon((this.asOwn(pokemon) ?? pokemon) as PokemonIdent | '');
  }

  override team(side: string, them?: boolean): string {
    return super.team(this.asOwn(side) ?? side, them);
  }

  override party(side: string): string {
    return super.party(this.asOwn(side) ?? side);
  }
}

/**
 * Multi Battles: @pkmn/client gives each pair of allies one shared field array
 * (p1a + p3b, p2a + p4b), but replaces the array of the side its request is
 * for (p1, or p3 for an online partner) and puts that side's Pokémon at index 0,
 * which splits the allies apart. Re-links them, each at its own field position
 * (p1 and p2 in slot a, p3 and p4 in slot b), and shares side conditions (the
 * simulator shares them between allies). No-op otherwise.
 */
export function linkMultiAllies(battle: Battle): void {
  if (battle.gameType !== 'multi' || !battle.p3 || !battle.p4) return;
  for (const [side, ally] of [[battle.p1, battle.p3], [battle.p2, battle.p4]] as const) {
    if (side.active !== ally.active) {
      // The side the request just rebuilt has its own Pokémon only; the other still has the shared array.
      // (Compare Side objects: a Side's `id` is its player's user id, not "p3".)
      const requested = battle.request?.side ? battle.getSide(battle.request.side.id) : null;
      const rebuilt = requested === ally ? ally : side;
      const other = rebuilt === side ? ally : side;
      const at = rebuilt === side ? 0 : 1;
      const field = [other.active[0] ?? null, other.active[1] ?? null];
      field[at] = rebuilt.active.find(p => p?.side === rebuilt) ?? null;
      if (field[at]) field[at]!.slot = at;
      side.active = field;
      ally.active = field;
    }
    if (ally.sideConditions !== side.sideConditions) {
      side.sideConditions = { ...ally.sideConditions, ...side.sideConditions };
      ally.sideConditions = side.sideConditions;
    }
  }
}
