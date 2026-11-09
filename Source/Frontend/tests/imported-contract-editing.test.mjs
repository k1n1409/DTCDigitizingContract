import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/imported-contract-editing.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", js)(module.exports, module);
const { deleteReviewedFieldValue, reviewedBlockText, replaceReviewedBlock } = module.exports;

test("delete a field value keeps its immutable anchor and other edits; the original is untouched", () => {
  const text = "Tên: An | MST: 123";
  const first = { id: "name", blockId: "p-0", start: 5, length: 2, original: "An", value: "Anh", label: "Tên", party: "Khách hàng", status: "proposed" };
  const second = { ...first, id: "tax", start: text.indexOf("123"), length: 3, original: "123", value: "999", label: "MST", status: "confirmed" };
  const before = [first, second]; const after = deleteReviewedFieldValue(before, "name");
  assert.equal(reviewedBlockText(text, "p-0", after), "Tên:  | MST: 999");
  assert.equal(after[0].original, "An"); assert.equal(after[0].start, 5); assert.equal(after[0].status, "confirmed");
  assert.equal(after[1], second); assert.equal(first.value, "Anh");
  assert.equal(reviewedBlockText(text, "p-0", before), text.replace("123", "999"));
});

test("delete rejects missing or overlapping anchors instead of discarding another confirmed edit", () => {
  const f = { id: "a", blockId: "p-0", start: 0, length: 3, original: "abc", value: "new", label: "Nội dung", party: "", status: "confirmed" };
  assert.throws(() => deleteReviewedFieldValue([f], "missing"));
  assert.throws(() => deleteReviewedFieldValue([f, { ...f, id: "b", start: 1, length: 1, original: "b" }], "a"));
});

test("clear a paragraph consolidates its edits but keeps other paragraphs and supports restoring previous state", () => {
  const other = { id: "other", blockId: "p-1", start: 0, length: 1, original: "A", value: "B", label: "Khác", party: "", status: "confirmed" };
  const before = [other]; const original = "Độc Lập - Tự Do - Hạnh Phúc";
  const next = replaceReviewedBlock(original, "p-0", "", before, "delete");
  assert.equal(reviewedBlockText(original, "p-0", next), "");
  assert.equal(reviewedBlockText("A", "p-1", next), "B");
  assert.equal(reviewedBlockText(original, "p-0", before), original);
});
