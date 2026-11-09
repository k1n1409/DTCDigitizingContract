import { parseContractRichText, serializeContractRichText, type ContractRichTextBlock } from "./contract-rich-text";

export type WordTerm = { key: number; code: string; title: string; content: string; preview: string; needsReview: boolean };
const heading = /^(?:điều|article)\s+(\d{1,6}[a-z]?)(?:(?:\s*[:.\-–—]\s*)(?!\d)(.*))?$/iu;
const boldHeading = /^(?:điều|article)\s+(\d{1,6}[a-z]?)\s+(.+)$/iu;
const boundary = /^(?:phụ lục|appendix|annex)(?:\s+(?:[\dIVXLCDM]+|[A-Z])\b|\s*[:–—-]|$)|^(?:đại diện\s+(?:bên|khách hàng|nhà cung cấp)|chữ ký(?:\s|$)|signatures?(?:\s|$)|for and on behalf of)/iu;
const resolve = (text: string, bindings: Record<string, string>) =>
  text.replace(/\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}/g, (token, key: string) =>
    Object.hasOwn(bindings, key) ? bindings[key] || token : token);
const plain = (block: ContractRichTextBlock): string => block.type === "paragraph"
  ? block.runs.map(run => run.text).join("")
  : block.rows.map(row => row.cells.map(cell => cell.paragraphs.map(p => p.runs.map(run => run.text).join("")).join(" ")).join(" | ")).join("\n");

export function termPreviewText(content?: string | null): string {
  if (!content) return "";
  try { return parseContractRichText(content).blocks.map(plain).join("\n").trim(); }
  catch { return content.startsWith("contract-rich-text:") ? "" : content.trim(); }
}

export function readWordTerms(content: string, bindings: Record<string, string>): WordTerm[] {
  let blocks: ContractRichTextBlock[];
  try { blocks = parseContractRichText(content).blocks; } catch { return []; }
  const result: WordTerm[] = [];
  let ended = false;
  let current: { key: number; code: string; title: string; blocks: ContractRichTextBlock[]; omitted: boolean } | undefined;
  const flush = () => {
    if (!current) return;
    const { key, code, title, blocks, omitted } = current;
    const preview = blocks.map(plain).join("\n").trim();
    result.push({ key, code, title, content: serializeContractRichText({ blocks }), preview,
      needsReview: omitted || !preview || /\{\{/.test(title + preview) });
    current = undefined;
  };
  blocks.forEach((block, index) => {
    if (ended) return;
    const rawText = plain(block);
    const lines = resolve(rawText, bindings).split(/\r?\n/);
    const first = lines[0].trim();
    if (block.type === "paragraph" && boundary.test(first)) {
      if (current || result.length) { flush(); ended = true; }
      return;
    }
    if (block.type === "paragraph" && !block.locked) {
      const match = heading.exec(first) ?? (block.runs.every(run => !run.text.trim() || run.bold) ? boldHeading.exec(first) : null);
      if (match) {
        flush();
        current = { key: index, code: `WORD_${match[1].toUpperCase()}`, title: first, blocks: [], omitted: false };
        const body = lines.slice(1).join("\n");
        if (body.trim()) current.blocks.push({ type: "paragraph", runs: [{ text: body }] });
        return;
      }
    }
    if (!current) return;
    if (block.type === "paragraph") {
      if (block.locked) { current.omitted = true; return; }
      current.blocks.push({ type: "paragraph", alignment: block.alignment, runs: resolveRuns(block.runs, bindings) });
    } else {
      current.blocks.push({ type: "table", columnWidthsBps: block.columnWidthsBps, rows: block.rows.map(row => ({ cells: row.cells.map(cell => ({
        ...cell, paragraphs: cell.paragraphs.map(p => ({ alignment: p.alignment, runs: resolveRuns(p.runs, bindings) })),
      })) })) });
    }
  });
  flush();
  return result;
}

function resolveRuns(runs: Extract<ContractRichTextBlock, { type: "paragraph" }>["runs"], bindings: Record<string, string>) {
  const source = runs.map(run => run.text).join("");
  const resolved = resolve(source, bindings);
  if (source === resolved) return runs;
  // A linked field may span several Word runs. Preserve formatting for
  // ordinary text and for fields fully contained in a run.
  const perRun = runs.map(run => ({ ...run, text: resolve(run.text, bindings) }));
  return perRun.map(run => run.text).join("") === resolved ? perRun : [{ text: resolved }];
}
