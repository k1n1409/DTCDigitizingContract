export type TextMatch = { from: number; to: number };
/** Literal search only: user input is never interpreted as a regular expression. */
export function findTextMatches(text: string, query: string, matchCase = false): TextMatch[] {
  if (!query) return [];
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(text.matchAll(new RegExp(pattern, matchCase ? "gu" : "giu")), match => ({ from: match.index!, to: match.index! + match[0].length }));
}
export function replaceTextMatches(text: string, matches: TextMatch[], replacement: string) {
  return [...matches].sort((a, b) => b.from - a.from).reduce((value, match) => value.slice(0, match.from) + replacement + value.slice(match.to), text);
}
