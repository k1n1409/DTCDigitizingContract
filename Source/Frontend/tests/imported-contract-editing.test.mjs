import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
// Test the exact production TypeScript helpers without requiring a browser or extra packages.
const filename = fileURLToPath(new URL("../lib/imported-contract-editing.ts", import.meta.url));
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const isolated = { exports: {} };
new Function("exports", "module", compiled.outputText)(isolated.exports, isolated);
const { reviewedBlockText, replaceReviewedBlock } = isolated.exports;
const field = (patch = {}) => ({ id: "f1", blockId: "p-0", start: 4, length: 1, original: "A", value: "B", label: "Tên", party: "Bên A", status: "confirmed", ...patch });

test("live text applies only confirmed anchored values, not every matching string", () => {
  assert.equal(reviewedBlockText("Tên A, A", "p-0", [field()]), "Tên B, A");
  assert.equal(reviewedBlockText("Tên A, A", "p-0", [field({ status: "proposed" })]), "Tên A, A");
  assert.equal(reviewedBlockText("Tên A, A", "p-0", [field({ status: "ignored" })]), "Tên A, A");
});
test("editing displayed paragraph consolidates fields without mutating the source or other blocks", () => {
  const fields = [field(), field({ id: "f2", blockId: "p-1" })];
  const before = JSON.stringify(fields);
  const next = replaceReviewedBlock("Tên A, A", "p-0", "Tên B, C", fields, "full");
  assert.equal(next.length, 2);
  assert.equal(reviewedBlockText("Tên A, A", "p-0", next), "Tên B, C");
  assert.equal(next[0].id, "f2");
  assert.equal(next[1].original, "A, A");
  assert.equal(next[1].status, "confirmed");
  assert.equal(JSON.stringify(fields), before);
  assert.equal(replaceReviewedBlock("Tên A, A", "p-0", "Khác", next, "unused")[1].id, "full");
});
test("empty edit deletes only the selected paragraph and pasted newlines normalize", () => {
  const deleted = replaceReviewedBlock("Tên A", "p-0", "", [], "full");
  assert.equal(reviewedBlockText("Tên A", "p-0", deleted), "");
  assert.equal(reviewedBlockText("Tên A", "p-1", deleted), "Tên A");
  assert.equal(reviewedBlockText("Tên A", "p-0", replaceReviewedBlock("Tên A", "p-0", "Tên\r\nB\tC", [], "full")), "Tên B C");
});
test("invalid or overlapping anchors and oversize fields are blocked", () => {
  assert.throws(() => reviewedBlockText("Tên A", "p-0", [field({ original: "X" })]));
  assert.throws(() => reviewedBlockText("Tên A", "p-0", [field(), field({ id: "other" })]));
  assert.throws(() => replaceReviewedBlock("Tên A", "p-0", "a".repeat(10001), [], "full"));
  const unrelated = Array.from({ length: 500 }, (_, i) => field({ id: String(i), blockId: "other" }));
  assert.throws(() => replaceReviewedBlock("Tên A", "p-0", "B", unrelated, "full"));
});
test("insertions and Unicode changes retain valid nonempty source anchors", () => {
  for (const [source, value] of [["ABC", "ABXC"], ["ABC", "ABCX"], ["ABC", "XABC"], ["Tên 😀", "Tên 😁"], ["😀BC", "😀XBC"]]) {
    const next = replaceReviewedBlock(source, "p-0", value, [], "full");
    assert.equal(reviewedBlockText(source, "p-0", next), value);
    assert.ok(next[0].length > 0);
    assert.equal(next[0].original, source.slice(next[0].start, next[0].start + next[0].length));
  }
  assert.deepEqual(replaceReviewedBlock("ABC", "p-0", "ABC", [], "full"), []);
});
