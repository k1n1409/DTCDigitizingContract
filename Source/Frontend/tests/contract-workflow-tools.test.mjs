import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const ContractStatus = { Draft: 0, Negotiating: 1, PendingApproval: 2, PendingSignature: 3, Signed: 4, Completed: 5, Cancelled: 6, Rejected: 7, PendingAdministrativeReview: 8 };
const ContractOutcome = { InProgress: 0, Succeeded: 1, Failed: 2, StoppedRenewal: 3 };
function load(name) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  new Function("exports", "require", outputText)(exports, () => ({ ContractStatus, ContractOutcome }));
  return exports;
}
const { contractNextSteps } = load("contract-next-steps");
const { pickWorkFilters, validateWorkFilters } = load("contract-work-filters");
const { rememberContractList, readContractList, contractListHref, recordContractListSuccess, clearContractList, lastAvailablePage } = load("contract-list-return");

test("return snapshot is scoped to the account, list URL and opened contract", () => {
  const scope = "1:2";
  const href = "/contracts?status=4";
  const snapshot = { scope, href, contractId: 8, pagination: { pageIndex: 3, pageSize: 10 }, scrollTop: 260, workFilters: { paymentState: 0 } };
  rememberContractList(snapshot);
  assert.equal(readContractList("2:2", href), undefined);
  assert.equal(readContractList(scope, "/contracts"), undefined);
  assert.equal(contractListHref(scope, 9), "/contracts");
  assert.equal(contractListHref(scope, 8), href);
  recordContractListSuccess(scope, 9, "Wrong contract");
  assert.equal(snapshot.success, undefined);
  recordContractListSuccess(scope, 8, "Đã ghi nhận khoản thanh toán.");
  assert.equal(readContractList(scope, href).success, "Đã ghi nhận khoản thanh toán.");
  assert.equal(readContractList(scope, href).pagination.pageIndex, 3);
  clearContractList();
  assert.equal(readContractList(scope, href), undefined);
});

test("return falls back to the last available page when results shrink", () => {
  assert.equal(lastAvailablePage(21, 10), 2);
  assert.equal(lastAvailablePage(20, 10), 1);
  assert.equal(lastAvailablePage(0, 10), 0);
});

test("administrative review opens approval; signed blockers point to closing sections", () => {
  assert.equal(contractNextSteps({ status: ContractStatus.PendingAdministrativeReview })[0].tab, "approval");
  const contract = { status: ContractStatus.Signed };
  assert.deepEqual(contractNextSteps(contract), []);
  const steps = contractNextSteps(contract, { signed: true, acceptanceCompleted: false, paymentCompleted: false, remainingAmount: 100, blockers: [] });
  assert.deepEqual(steps.map(step => step.anchor), ["contract-next-acceptance", "contract-next-payments"]);
  assert.equal(contractNextSteps({ ...contract, outcome: ContractOutcome.Failed })[0].tab, "activity");
});

test("open comments are shown once and link to terms", () => {
  const steps = contractNextSteps({ status: ContractStatus.Negotiating, approvalReadiness: {
    openCommentCount: 2, blockers: [{ code: "UnresolvedComments", message: "Unresolved comments" }]
  } });
  assert.deepEqual(steps.map(step => [step.code, step.tab]), [["comments", "terms"]]);
});

test("saved filters preserve unpaid and decimal strings, and reject incompatible ranges", () => {
  assert.deepEqual(pickWorkFilters({ status: 4, paymentState: 0, maxAmount: "99999999999999.9999", onlyMine: false }), {
    maxAmount: "99999999999999.9999", paymentState: 0
  });
  assert.equal(validateWorkFilters({ minAmount: "0", maxAmount: "99999999999999.9999" }), null);
  assert.ok(validateWorkFilters({ minAmount: "11", maxAmount: "10" }));
  assert.ok(validateWorkFilters({ expireFrom: "2026-11-06", expiringInDays: 30 }));
});
