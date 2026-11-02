import type { JSONContent } from "@tiptap/core";
import { CONTRACT_SNIPPETS } from "@/lib/contract-editor-snippets";

const labels = Object.fromEntries(CONTRACT_SNIPPETS.flatMap(s => s.fields.map(f => [f.key, f.label])));
const aliases: Record<string, string> = { COMPANY: "Tên công ty", CONTACT_NAME: "Người liên hệ", CONTACT_TITLE: "Chức vụ", CONTACT_PHONE: "Điện thoại", TAX_CODE: "Mã số thuế", BANK_NAME: "Ngân hàng", BANK_ACCOUNT_NUMBER: "Số tài khoản", ADDRESS: "Địa chỉ", PHONE: "Điện thoại", EMAIL: "Email", CODE: "Mã", FULL_NAME: "Họ và tên", EFFECTIVE_DATE: "Ngày hiệu lực", EXPIRE_DATE: "Ngày hết hạn", CONTRACT_DATE: "Ngày lập hợp đồng", CONTRACT_CURRENCY: "Đồng tiền", CONTRACT_TOTAL_AMOUNT: "Tổng giá trị hợp đồng" };
export function editorFieldLabel(key: string): string {
  const prefix = key.startsWith("CUSTOMER_") ? "Khách hàng" : key.startsWith("PROVIDER_") ? "Nhà cung cấp" : key.startsWith("EMPLOYEE_") ? "Nhân viên" : "";
  const tail = prefix ? key.slice(key.indexOf("_") + 1) : key;
  const label = labels[key] || aliases[tail] || aliases[key];
  return label ? `${label}${prefix ? ` · ${prefix}` : ""}` : `Thông tin ${key.toLocaleLowerCase().replaceAll("_", " ")}`;
}

/** Presentation-only atoms. Persistence/export still use the original token keys. */
export function tokenizeEditorFields(doc: JSONContent): JSONContent {
  if (doc.type !== "paragraph") return { ...doc, ...(doc.content ? { content: doc.content.map(tokenizeEditorFields) } : {}) };
  const nodes = doc.content || [];
  const text = nodes.map(n => n.type === "text" ? n.text || "" : "\n").join("");
  const matches = [...text.matchAll(/\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}/g)];
  if (!matches.length) return doc;
  const result: JSONContent[] = [];
  const slice = (start: number, end: number) => {
    let offset = 0;
    for (const node of nodes) {
      const length = node.type === "text" ? (node.text || "").length : 1;
      const from = Math.max(start, offset), to = Math.min(end, offset + length);
      if (from < to) result.push(node.type === "text" ? { ...node, text: node.text!.slice(from - offset, to - offset) } : node);
      offset += length;
    }
  };
  let cursor = 0;
  for (const match of matches) {
    slice(cursor, match.index!);
    let offset = 0;
    const source = nodes.find(n => { offset += n.type === "text" ? (n.text || "").length : 1; return offset > match.index!; });
    result.push({ type: "smartField", attrs: { fieldKey: match[1] }, marks: source?.marks });
    cursor = match.index! + match[0].length;
  }
  slice(cursor, text.length);
  return { ...doc, content: result };
}
