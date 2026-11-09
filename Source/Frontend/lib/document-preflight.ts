import { parseContractRichText } from "./contract-rich-text";

export type DocumentCheck = { id: string; title: string; description: string; blocking?: boolean; fieldKey?: string; blockIndex?: number };
export function checkEditorDocument(content: string, bindings: Record<string, string>): DocumentCheck[] {
  const doc = parseContractRichText(content);
  const texts = doc.blocks.map(b => b.type === "paragraph" ? b.runs.map(r => r.text).join("") : b.rows.flatMap(r => r.cells.flatMap(c => c.paragraphs.map(p => p.runs.map(r => r.text).join("")))).join("\n"));
  const keys = [...new Set([...(doc.preservation?.fieldKeys || []), ...texts.flatMap(t => [...t.matchAll(/\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}/g)].map(m => m[1]))])];
  const issues: DocumentCheck[] = keys.filter(k => !bindings[k]?.trim()).map(k => ({ id: `missing-${k}`, title: "Thông tin chưa điền", description: k, blocking: true, fieldKey: k }));
  if (!texts.some(t => t.trim())) issues.push({ id: "empty", title: "Tài liệu chưa có nội dung", description: "Bắt đầu soạn hoặc chọn mẫu trước khi xuất/tạo hợp đồng.", blocking: true, blockIndex: 0 });
  texts.forEach((text, blockIndex) => {
    const plain = text.replace(/\{\{[^{}]+\}\}/g, "");
    if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+84|0)\d[\d .()-]{7,}\d|(?:tài khoản|mã số thuế)\s*[:：]?\s*\d{6,}/i.test(plain)) issues.push({ id: `private-${blockIndex}`, title: "Kiểm tra dữ liệu gõ trực tiếp", description: "Đoạn có email, số điện thoại hoặc thông tin tài khoản/thuế. Hãy xác nhận đây là dữ liệu đúng của hợp đồng, không phải khách hàng cũ.", blockIndex });
    if (doc.blocks[blockIndex].type === "paragraph" && doc.blocks[blockIndex].locked) issues.push({ id: `locked-${blockIndex}`, title: "Khối Word chỉ được giữ nguyên", description: "Không chỉnh trực tiếp nội dung bên trong. Kiểm tra ảnh, chữ và bố cục bằng bản PDF thực tế.", blockIndex });
  });
  if (doc.preservation) issues.push({ id: "original-stories", title: "Rà soát header/footer và nội dung ẩn", description: "Kiểm tra tên khách hàng, email, tài khoản và chữ ký trong ảnh/header/footer. Bộ kiểm tra không tự phát hiện được mọi dữ liệu riêng." });
  return issues;
}
