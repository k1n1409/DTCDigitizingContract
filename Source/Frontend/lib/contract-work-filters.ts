import type { ContractFilterRequest } from "@/services/contract-api";
export const workFilterKeys = ["customerId", "employeeId", "departmentId", "onlyMine", "minAmount", "maxAmount", "currencyCode", "expireFrom", "expireTo", "expiringInDays", "paymentState"] as const;
export type ContractWorkFilter = Pick<ContractFilterRequest, typeof workFilterKeys[number]>;
export function pickWorkFilters(value: ContractFilterRequest): ContractWorkFilter {
  return Object.fromEntries(workFilterKeys.filter(key => value[key] !== undefined && value[key] !== null && value[key] !== "" && value[key] !== false).map(key => [key, value[key]]));
}
export function validateWorkFilters(value: ContractWorkFilter): string | null {
  const amount = /^(?:\d{1,14})(?:\.\d{1,4})?$/;
  if (value.minAmount !== undefined && !amount.test(String(value.minAmount)) || value.maxAmount !== undefined && !amount.test(String(value.maxAmount))) return "Giá trị cần là số không âm, tối đa 14 chữ số nguyên và 4 số thập phân.";
  if (value.minAmount !== undefined && value.maxAmount !== undefined && Number(value.minAmount) > Number(value.maxAmount)) return "Giá trị từ không được lớn hơn giá trị đến.";
  if (value.expireFrom && value.expireTo && value.expireFrom.slice(0, 10) > value.expireTo.slice(0, 10)) return "Ngày hết hạn từ không được sau ngày hết hạn đến.";
  if (value.expiringInDays && (value.expireFrom || value.expireTo)) return "Chọn khoảng ngày hoặc mốc sắp hết hạn, không dùng đồng thời.";
  return null;
}
