import type { Node } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { findTextMatches, type TextMatch } from "./document-find-replace";

export function richDocumentMatches(doc: Node, query: string, matchCase: boolean): TextMatch[] {
  const result: TextMatch[] = [];
  if (!query) return result;
  doc.descendants((node, position) => {
    if (!node.isTextblock) return;
    let text = "", start = position + 1;
    const flush = () => { result.push(...findTextMatches(text, query, matchCase).map(match => ({ from: start + match.from, to: start + match.to }))); text = ""; };
    node.forEach((child, offset) => {
      if (child.isText) { if (!text) start = position + 1 + offset; text += child.text; }
      else flush();
    });
    flush(); return false;
  });
  return result;
}

/** A single transaction/undo step, applied backwards so earlier offsets stay valid. */
export function replaceRichDocumentMatches(state: EditorState, matches: TextMatch[], replacement: string) {
  let transaction = closeHistory(state.tr);
  for (const match of [...matches].sort((a, b) => b.from - a.from)) transaction = replacement ? transaction.insertText(replacement, match.from, match.to) : transaction.delete(match.from, match.to);
  return transaction;
}
