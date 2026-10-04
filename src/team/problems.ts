/**
 * Showdown's validator splits some problems over two lines, the second in
 * parentheses ("You are limited to 1 of each item by Item Clause." +
 * "(You have more than 1 Eviolite)"). Joins those so one issue reads as one.
 */
export function groupProblems(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith('(') && out.length) out[out.length - 1] += ` ${line}`;
    else out.push(line);
  }
  return out;
}
