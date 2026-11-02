import type { ReviewField } from "@/lib/imported-contract-editing";
export const REVIEW_GROUPS = ["Khách hàng", "Nhà cung cấp", "Hợp đồng", "Thanh toán", "Chưa phân loại"] as const;
export function reviewGroup(field: ReviewField): string {
  if ((REVIEW_GROUPS as readonly string[]).includes(field.party)) return field.party;
  if (/khách hàng/i.test(field.party)) return "Khách hàng";
  if (/nhà cung cấp/i.test(field.party)) return "Nhà cung cấp";
  if (/thanh toán|tài khoản|ngân hàng|giá trị|số tiền/i.test(field.label)) return "Thanh toán";
  if (/hợp đồng|ngày ký|hiệu lực|hết hạn/i.test(field.label)) return "Hợp đồng";
  return "Chưa phân loại"; // Bên A/B is not evidence of customer/provider identity.
}
export function reviewTemplateKey(field: ReviewField, index: number): string {
  const group = reviewGroup(field);
  const prefix = group === "Khách hàng" ? "CUSTOMER" : group === "Nhà cung cấp" ? "PROVIDER" : "CONTRACT";
  const labels: [RegExp, string][] = [[/mã số thuế|^mst$/i, "TAX_CODE"], [/tên.*(khách hàng|công ty|doanh nghiệp)/i, "NAME"], [/địa chỉ/i, "ADDRESS"], [/điện thoại/i, "PHONE"], [/email/i, "EMAIL"], [/đại diện/i, "REPRESENTATIVE"], [/chức vụ|chức danh/i, "TITLE"], [/ngân hàng/i, "BANK_NAME"], [/tài khoản/i, "BANK_ACCOUNT_NUMBER"]];
  const tail = labels.find(([pattern]) => pattern.test(field.label))?.[1];
  return tail ? `${prefix}_${tail}_${index + 1}` : `REVIEW_FIELD_${index + 1}`;
}
export function textDifference(before: string, after: string) {
  const a = Array.from(before), b = Array.from(after); let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  return { prefix: a.slice(0, start).join(""), removed: a.slice(start, endA).join(""), added: b.slice(start, endB).join(""), suffix: a.slice(endA).join("") };
}
