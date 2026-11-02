import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { webcrypto } from "node:crypto";
function load(file) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; new Function("require", "exports", "module", js)(() => { throw new Error("Unexpected import"); }, module.exports, module); return module.exports;
}
const tools = load("../lib/imported-review-tools.ts");
const field = { id:"id",blockId:"p-0",start:0,length:3,original:"Old",value:"Private customer",label:"Tên công ty",party:"Bên A",status:"confirmed" };
test("review groups do not guess customer/provider from party A or B", () => {
  assert.equal(tools.reviewGroup(field), "Chưa phân loại");
  assert.equal(tools.reviewGroup({...field,party:"Khách hàng"}), "Khách hàng");
  assert.equal(tools.reviewGroup({...field,label:"Số tài khoản"}), "Thanh toán");
  assert.equal(tools.reviewGroup({...field,label:"Mã hợp đồng"}), "Hợp đồng");
  assert.equal(tools.reviewTemplateKey({...field,party:"Khách hàng"}, 0), "CUSTOMER_NAME_1");
});
test("diff keeps Unicode intact and supports insertion and deletion", () => {
  assert.deepEqual(tools.textDifference("A😀B", "A😊B"), {prefix:"A",removed:"😀",added:"😊",suffix:"B"});
  assert.equal(tools.textDifference("abc", "ac").removed, "b");
  assert.equal(tools.textDifference("ac", "abc").added, "b");
});
test("recovery is encrypted, scoped, tamper checked, expires and is purged on logout", async () => {
  const values = new Map();
  globalThis.sessionStorage = { get length(){return values.size;},key:i=>[...values.keys()][i] || null,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k) };
  if (!globalThis.crypto) globalThis.crypto = webcrypto;
  const recovery = load("../lib/review-recovery.ts");
  const value = {revision:1,sha:"hash",fields:[field],savedAt:Date.now()};
  await recovery.writeReviewRecovery("tenant:actor", "doc", value);
  const key = recovery.recoveryKey("tenant:actor", "doc");
  assert.ok(!values.get(key).includes("Private customer"));
  assert.deepEqual(await recovery.readReviewRecovery("tenant:actor", "doc"), value);
  assert.equal(await recovery.readReviewRecovery("tenant:other", "doc"), null);
  values.set(recovery.recoveryKey("tenant:actor", "copy"), values.get(key));
  assert.equal(await recovery.readReviewRecovery("tenant:actor", "copy"), null);
  values.set(key, '{"iv":"bad","bytes":"bad"}');
  assert.equal(await recovery.readReviewRecovery("tenant:actor", "doc"), null);
  await recovery.writeReviewRecovery("tenant:actor", "doc", {...value,savedAt:Date.now()-25*60*60*1000});
  assert.equal(await recovery.readReviewRecovery("tenant:actor", "doc"), null);
  await recovery.writeReviewRecovery("tenant:actor", "doc", value);
  recovery.purgeReviewRecovery(); assert.equal(values.size, 0);
});
