import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(name, resolve = () => { throw Error("Unexpected import"); }) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("exports", "require", outputText)(exports, resolve);
  return exports;
}
const rich = load("contract-rich-text");
const { readWordTerms, termPreviewText } = load("word-term-import", () => rich);
const p = (text, bold = false) => ({ type: "paragraph", runs: [{ text, bold }] });
const document = (...blocks) => rich.serializeContractRichText({ blocks });

test("imports numbered headings and keeps body formatting and linked values", () => {
  const body = { type: "paragraph", alignment: "center", runs: [{ text: "Cho {{CUSTOMER", bold: true }, { text: "_NAME}}" }] };
  const terms = readWordTerms(document(p("HỢP ĐỒNG"), p("Điều 1. Phạm vi"), body, p("Điều 2 – Thanh toán"), p("Thanh toán theo Điều 1.", true)), { CUSTOMER_NAME: "Công ty A" });
  assert.deepEqual(terms.map(term => [term.code, term.title, term.preview]), [
    ["WORD_1", "Điều 1. Phạm vi", "Cho Công ty A"], ["WORD_2", "Điều 2 – Thanh toán", "Thanh toán theo Điều 1."],
  ]);
  assert.equal(rich.parseContractRichText(terms[0].content).blocks[0].alignment, "center");
  assert.equal(rich.parseContractRichText(terms[1].content).blocks[0].runs[0].bold, true);
});

test("stops at appendices or signatures and does not split numbered subclauses", () => {
  const terms = readWordTerms(document(p("Điều 1: Giao hàng"), p("Điều 1.1 Cách giao"), p("PHỤ LỤC I"), p("Điều 3: Mục trong phụ lục"), p("Không nhập")), {});
  assert.equal(terms.length, 1);
  assert.equal(terms[0].preview, "Điều 1.1 Cách giao");
  assert.deepEqual(readWordTerms("invalid", {}), []);
});

test("flags empty clauses and unresolved linked fields", () => {
  const terms = readWordTerms(document(p("Article 1"), p("Điều 2 Thanh toán", true), p("Giá: {{AMOUNT}}")), {});
  assert.deepEqual(terms.map(term => term.needsReview), [true, true]);
});

test("step preview shows current term text rather than serialized markup", () => {
  assert.equal(termPreviewText(document(p("Nội dung đã sửa"), p("Đoạn thứ hai"))), "Nội dung đã sửa\nĐoạn thứ hai");
  assert.equal(termPreviewText("Nội dung văn bản cũ"), "Nội dung văn bản cũ");
  assert.equal(termPreviewText("contract-rich-text:v4:invalid"), "");
});
