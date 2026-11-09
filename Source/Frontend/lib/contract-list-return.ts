import type { ContractWorkFilter } from "./contract-work-filters";

type ListReturn = {
  scope: string;
  href: string;
  contractId: number;
  keyword: string;
  direction: string;
  type: string;
  workFilters: ContractWorkFilter;
  filtersOpen: boolean;
  pagination: { pageIndex: number; pageSize: number };
  scrollTop: number;
  tableScrollLeft: number;
  tableScrollTop: number;
  success?: string;
};

// Keep this per tab, in memory only. Never persist filters or account data to disk.
let pending: ListReturn | undefined;

export function rememberContractList(value: ListReturn) { pending = value; }
export function readContractList(scope: string, href: string) {
  return pending?.scope === scope && pending.href === href ? pending : undefined;
}
export function clearContractList() { pending = undefined; }
export function contractListHref(scope: string, contractId: number) {
  return pending?.scope === scope && pending.contractId === contractId ? pending.href : "/contracts";
}
export function recordContractListSuccess(scope: string, contractId: number, message: string) {
  if (pending?.scope === scope && pending.contractId === contractId) pending.success = message;
}

export function lastAvailablePage(total: number, pageSize: number) {
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}
