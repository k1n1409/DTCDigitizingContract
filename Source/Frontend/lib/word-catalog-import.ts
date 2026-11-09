import { parseContractRichText } from "./contract-rich-text";

export type WordItemRow = { line: number; code: string; name: string; alternateNames?: string[]; unit: string; quantity: string; price: string; total: string };
export type WordItemTable = { index: number; rows: WordItemRow[]; currencyHint?: string };
export const normalizeWordLabel = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").trim();
const header = (text: string) => normalizeWordLabel(text).replace(/[^a-z0-9]+/g, " ").trim();
const aliases = {
  code: ["ma", "ma sp", "ma dv", "ma san pham", "ma dich vu", "ma hang", "sku", "code", "item code"],
  name: ["ten", "ten hang", "ten san pham", "ten dich vu", "ten san pham dich vu", "san pham dich vu", "hang hoa dich vu", "hang hoa", "hang muc", "ten hang muc", "noi dung", "mo ta", "item", "item name", "product", "product name", "description", "service", "service name"],
  unit: ["don vi", "don vi tinh", "dvt", "unit", "uom"],
  quantity: ["so luong", "sl", "quantity", "qty"],
  price: ["don gia", "don gia vnd", "don gia usd", "don gia chua vat", "unit price", "unit price vnd", "unit price usd"],
  total: ["thanh tien", "thanh tien vnd", "thanh tien usd", "tong tien", "amount", "line total", "total"],
} satisfies Record<string, string[]>;
const summaryLabels = ["tong", "tong cong", "tong tien", "cong", "tam tinh", "vat", "thue vat", "tong thanh toan", "subtotal", "grand total", "total", "tax"];
const textLines = (value: string) => value.split(/\r?\n/).map(text => text.trim()).filter(Boolean);
function hasLabel(value: string, labels: string[]) {
  const joined = header(value);
  return labels.includes(joined) || textLines(value).some(line => labels.includes(header(line)))
    || labels.some(first => labels.some(second => joined === `${first} ${second}`));
}

export function readWordItemTables(content: string, bindings: Record<string, string>): WordItemTable[] {
  const result: WordItemTable[] = [];
  let blocks;
  try { blocks = parseContractRichText(content).blocks; }
  catch { return result; }
  let index = 0;
  for (const block of blocks) {
    if (block.type !== "table") continue;
    index++;
    // Row-spanning cells shift the physical column positions of later rows.
    if (block.rows.some(row => row.cells.some(cell => (cell.rowspan ?? 1) > 1))) continue;
    const values = block.rows.map(row => row.cells.map(cell => cell.paragraphs
      .map(p => p.runs.map(r => r.text).join("")).join("\n")
      .replace(/\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}/g, (token, key: string) => Object.hasOwn(bindings, key) ? bindings[key] : token).trim()));
    for (let i = 0; i < Math.min(5, values.length); i++) {
      if (block.rows[i].cells.some(cell => (cell.colspan ?? 1) !== 1)) continue;
      const headers = values[i];
      const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => {
        const indices = headers.flatMap((value, j) => hasLabel(value, names) ? [j] : []);
        return [key, indices.length === 1 ? indices[0] : -1];
      }));
      if (columns.name < 0 || columns.quantity < 0 || columns.price < 0) continue;
      const rows: WordItemRow[] = [];
      let unsupported = false;
      for (let j = i + 1; j < values.length; j++) {
        const cells = values[j];
        if (!cells.some(Boolean)) continue;
        const merged = block.rows[j].cells.some(cell => (cell.colspan ?? 1) !== 1);
        const get = (key: keyof typeof aliases) => textLines(cells[columns[key]] ?? "").join(" ");
        const nameCell = cells[columns.name] ?? "";
        const code = get("code");
        if (merged ? hasLabel(cells.find(Boolean) ?? "", summaryLabels)
          : !code && !get("quantity") && !get("price") && hasLabel(nameCell || cells.find(Boolean) || "", summaryLabels)) continue;
        if (merged || cells.length !== headers.length) { unsupported = true; break; }
        const names = [...new Map(textLines(nameCell).map(name => [normalizeWordLabel(name), name])).values()];
        rows.push({ line: j + 1, code, name: names[0] ?? "",
          ...(names.length > 1 ? { alternateNames: names.slice(1) } : {}),
          unit: get("unit"), quantity: get("quantity"), price: get("price"), total: get("total") });
      }
      const currencyHint = header(headers[columns.price]).match(/\b(vnd|usd)\b/)?.[1].toUpperCase();
      if (!unsupported && rows.length > 0 && rows.length <= 100) result.push({ index, rows, currencyHint });
      break;
    }
  }
  return result;
}

// Ambiguous single separators (1,234 / 1.234) must be confirmed manually.
export function parseWordNumber(raw: string, currency?: string): number | null {
  let value = raw.trim();
  if (currency) {
    const suffix = currency === "VND" ? /\s*(?:VND|VNĐ|₫|đ)$/i : new RegExp(`\\s*${currency.replace(/[^A-Z]/g, "")}$`, "i");
    value = value.replace(suffix, "").trim();
  }
  if (/^\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d{1,4})?$/.test(value)) value = value.replace(/\s/g, "");
  else if (/\s/.test(value)) return null;
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,4}$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,4}$/.test(value)) value = value.replace(/,/g, "");
  else if (/^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})+$/.test(value)) value = value.replace(/[.,]/g, "");
  else if (/^\d{1,3}[.,]\d{3}$/.test(value) && !/^0[.,]/.test(value)) {
    if (currency !== "VND") return null;
    value = value.replace(/[.,]/g, "");
  } else value = value.replace(",", ".");
  return /^\d{1,14}(?:\.\d{1,4})?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}
