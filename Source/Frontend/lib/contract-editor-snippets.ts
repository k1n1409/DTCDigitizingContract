import { serializeContractRichText, type ContractRichTextBlock } from "@/lib/contract-rich-text";
export const CONTRACT_SNIPPET_MIME = "application/x-econtract-snippet";
type Field = { key: string; label: string };
type Snippet = { id: string; title: string; description: string; fields: Field[]; build: (values: Record<string, string>) => ContractRichTextBlock[] };
const p = (text: string, bold = false, alignment?: "center" | "right"): ContractRichTextBlock => ({ type: "paragraph", runs: [{ text, ...(bold ? { bold } : {}) }], ...(alignment ? { alignment } : {}) });
const value = (data: Record<string, string>, key: string) => data[key]?.trim() || `{{${key}}}`;
const party = (data: Record<string, string>, prefix: string, heading: string): ContractRichTextBlock[] => [
  p(`${heading}: ${value(data, `${prefix}_NAME`)}`, true),
  ...[["Đại diện", "REPRESENTATIVE"], ["Chức vụ", "TITLE"], ["Địa chỉ", "ADDRESS"], ["Mã số thuế", "TAX_CODE"], ["Điện thoại", "PHONE"], ["Email", "EMAIL"]].map(([label, key]) => p(`${label}: ${value(data, `${prefix}_${key}`)}`)),
];
const partyFields = (prefix: string): Field[] => [["NAME", "Tên đơn vị"], ["REPRESENTATIVE", "Người đại diện"], ["TITLE", "Chức vụ"], ["ADDRESS", "Địa chỉ"], ["TAX_CODE", "Mã số thuế"], ["PHONE", "Điện thoại"], ["EMAIL", "Email"]].map(([key, label]) => ({ key: `${prefix}_${key}`, label }));
export const CONTRACT_SNIPPETS: Snippet[] = [
  { id: "heading", title: "Quốc hiệu & tên hợp đồng", description: "Khung đầu trang và số hợp đồng", fields: [{ key: "CONTRACT_NAME", label: "Tên hợp đồng" }, { key: "CONTRACT_CODE", label: "Số hợp đồng" }], build: d => [p("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", true, "center"), p("Độc lập - Tự do - Hạnh phúc", true, "center"), p(""), p(value(d, "CONTRACT_NAME"), true, "center"), p(`Số: ${value(d, "CONTRACT_CODE")}`, false, "center")] },
  { id: "customer", title: "Thông tin Bên A", description: "Có thể lấy giá trị khách hàng đã liên kết", fields: partyFields("CUSTOMER"), build: d => party(d, "CUSTOMER", "BÊN A") },
  { id: "provider", title: "Thông tin Bên B", description: "Đơn vị cung cấp và người đại diện", fields: partyFields("PROVIDER"), build: d => party(d, "PROVIDER", "BÊN B") },
  { id: "scope", title: "Phạm vi công việc", description: "Sản phẩm/dịch vụ, kết quả và thời hạn", fields: [{ key: "SCOPE_TITLE", label: "Tiêu đề điều khoản" }, { key: "SCOPE_CONTENT", label: "Nội dung công việc" }, { key: "DELIVERY_DATE", label: "Thời hạn bàn giao" }], build: d => [p(d.SCOPE_TITLE || "Điều 1. Phạm vi công việc", true), p(value(d, "SCOPE_CONTENT")), p(`Thời hạn bàn giao: ${value(d, "DELIVERY_DATE")}`)] },
  { id: "payment", title: "Giá trị & thanh toán", description: "Giá trị, thời hạn và tài khoản nhận tiền", fields: [{ key: "CONTRACT_AMOUNT", label: "Giá trị thanh toán" }, { key: "PAYMENT_SCHEDULE", label: "Tiến độ thanh toán" }, { key: "PAYMENT_ACCOUNT", label: "Tài khoản thụ hưởng" }], build: d => [p("Điều 2. Giá trị và thanh toán", true), p(`Giá trị: ${value(d, "CONTRACT_AMOUNT")}`), p(`Tiến độ thanh toán: ${value(d, "PAYMENT_SCHEDULE")}`), p(`Tài khoản thụ hưởng: ${value(d, "PAYMENT_ACCOUNT")}`)] },
  { id: "terms", title: "Điều khoản tùy chỉnh", description: "Bảo hành, bảo mật hoặc điều khoản khác", fields: [{ key: "TERM_TITLE", label: "Tiêu đề" }, { key: "TERM_CONTENT", label: "Nội dung" }], build: d => [p(value(d, "TERM_TITLE"), true), p(value(d, "TERM_CONTENT"))] },
  { id: "signature", title: "Khung chữ ký hai bên", description: "Bảng hai cột, không thay việc ký hợp đồng", fields: [{ key: "CUSTOMER_REPRESENTATIVE", label: "Đại diện Bên A" }, { key: "PROVIDER_REPRESENTATIVE", label: "Đại diện Bên B" }], build: d => [{ type: "table", columnWidthsBps: [5000, 5000], rows: [{ cells: ["ĐẠI DIỆN BÊN A", "ĐẠI DIỆN BÊN B"].map(text => ({ paragraphs: [{ runs: [{ text, bold: true }], alignment: "center" }] })) }, { cells: ["CUSTOMER_REPRESENTATIVE", "PROVIDER_REPRESENTATIVE"].map(key => ({ paragraphs: [{ runs: [{ text: "(Ký, ghi rõ họ tên)" }], alignment: "center" }, { runs: [{ text: "\n\n" }] }, { runs: [{ text: value(d, key), bold: true }], alignment: "center" }] })) }] }] },
];
export function snippetContent(id: string, data: Record<string, string>) {
  const snippet = CONTRACT_SNIPPETS.find(item => item.id === id);
  if (!snippet) throw new Error("Cụm nội dung không hợp lệ.");
  return serializeContractRichText({ blocks: snippet.build(data) });
}
export function linkedSnippetContent(id: string) {
  const snippet = CONTRACT_SNIPPETS.find(item => item.id === id);
  if (!snippet) throw new Error("Cụm nội dung không hợp lệ.");
  return snippetContent(id, Object.fromEntries(snippet.fields.map(field => [field.key, `{{${field.key}}}`])));
}
