import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file, require = () => { throw new Error("Unexpected import"); }) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const isolated = { exports: {} }; new Function("require", "exports", "module", js)(require, isolated.exports, isolated); return isolated.exports;
}
const rich = load("../lib/contract-rich-text.ts");
test("Word preservation metadata and protected image/table blocks survive normalization and serialization", () => {
  const preservation = { sourceId: "11111111-1111-4111-8111-111111111111", sha256: "A".repeat(64), fieldKeys: ["CONTRACT_CODE"] };
  const doc = { preservation, blocks: [
    { type: "paragraph", sourceKey: "b0", runs: [{ text: "Tiếng Việt" }] },
    { type: "paragraph", sourceKey: "b1", locked: true, label: "Ảnh gốc", previewImage: "data:image/png;base64,AAAA", runs: [{ text: "Không chỉnh nội dung trong khối" }] },
    { type: "table", sourceKey: "b2", columnWidthsBps: [10000], rows: [{ cells: [{ paragraphs: [{ sourceKey: "p5", runs: [{ text: "Ô bảng" }] }] }] }] }
  ] };
  const result = rich.parseContractRichText(rich.serializeContractRichText(doc));
  assert.deepEqual(result.preservation, preservation);
  assert.equal(result.blocks[1].locked, true); assert.equal(result.blocks[1].previewImage, doc.blocks[1].previewImage);
  assert.equal(result.blocks[2].sourceKey, "b2"); assert.equal(result.blocks[2].rows[0].cells[0].paragraphs[0].sourceKey, "p5");
  assert.throws(() => rich.serializeContractRichText({ blocks: [doc.blocks[1]] }));
  assert.deepEqual(rich.parseContractRichText(rich.serializeContractRichText({ preservation, blocks: [] })).preservation, preservation);
});
const snippets = load("../lib/contract-editor-snippets.ts", name => { assert.equal(name, "@/lib/contract-rich-text"); return rich; });
const smart = load("../lib/editor-smart-fields.ts", name => { assert.equal(name, "@/lib/contract-editor-snippets"); return snippets; });

test("linked snippets keep field identity instead of baking customer data into text", () => {
  for (const snippet of snippets.CONTRACT_SNIPPETS) {
    const content = snippets.linkedSnippetContent(snippet.id);
    for (const field of snippet.fields) assert.ok(content.includes(`{{${field.key}}}`), `${snippet.id}: ${field.key}`);
  }
});
test("provider block uses linked legal profile fields and omits unavailable optional details", () => {
  const content = snippets.linkedSnippetContent("provider", { PROVIDER_NAME: "DTC test", PROVIDER_BANK_NAME: "Test bank" });
  assert.ok(content.includes("{{PROVIDER_NAME}}"));
  assert.ok(content.includes("{{PROVIDER_BANK_NAME}}"));
  assert.ok(!content.includes("{{PROVIDER_FAX}}"));
  assert.ok(!content.includes("{{PROVIDER_BANK_ACCOUNT_NUMBER}}"));
  assert.ok(!content.includes("DTC test"));
});
test("missing-field session stays stable when a value is filled or an active value stops matching search", () => {
  const keys = ["CUSTOMER_NAME", "CONTRACT_CODE", "PROVIDER_NAME"];
  const snapshot = ["CUSTOMER_NAME", "CONTRACT_CODE"];
  const bindings = { CUSTOMER_NAME: "Đã điền", CONTRACT_CODE: "", PROVIDER_NAME: "DTC" };
  assert.deepEqual(smart.filterEditorFieldKeys(keys, snapshot, "", "CUSTOMER_NAME", bindings), snapshot);
  assert.deepEqual(smart.filterEditorFieldKeys(keys, snapshot, "không khớp", "CUSTOMER_NAME", bindings), ["CUSTOMER_NAME"]);
  const refreshed = keys.filter(key => !bindings[key]?.trim());
  assert.deepEqual(smart.filterEditorFieldKeys(keys, refreshed, "", "", bindings), ["CONTRACT_CODE"]);
  assert.deepEqual(snapshot, ["CUSTOMER_NAME", "CONTRACT_CODE"]);
});
test("smart fields recognize tokens split across formatted runs without altering surrounding text", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Tên: {{CUS", marks: [{ type: "bold" }] },
    { type: "text", text: "TOMER_NAME}} / {{CUSTOMER_NAME}}" }, { type: "hardBreak" }, { type: "text", text: "Kết thúc" },
  ] }] };
  const result = smart.tokenizeEditorFields(doc).content[0].content;
  assert.equal(result.filter(n => n.type === "smartField").length, 2);
  assert.deepEqual(result[1].attrs, { fieldKey: "CUSTOMER_NAME" });
  assert.deepEqual(result[1].marks, [{ type: "bold" }]);
  assert.equal(result.map(n => n.type === "smartField" ? `{{${n.attrs.fieldKey}}}` : n.type === "hardBreak" ? "\n" : n.text).join(""), "Tên: {{CUSTOMER_NAME}} / {{CUSTOMER_NAME}}\nKết thúc");
  assert.equal(smart.editorFieldLabel("CUSTOMER_NAME"), "Tên đơn vị · Khách hàng");
  assert.ok(!smart.editorFieldLabel("CUSTOMER_TAX_CODE").includes("_"));
  assert.equal(doc.content[0].content[0].text, "Tên: {{CUS");
});
test("all snippet recipes generate valid editable documents with filled values or placeholders", () => {
  assert.equal(snippets.CONTRACT_SNIPPETS.length, 7);
  for (const item of snippets.CONTRACT_SNIPPETS) {
    const data = Object.fromEntries(item.fields.map(field => [field.key, "Giá trị & kiểm thử"]));
    assert.ok(rich.parseContractRichText(snippets.snippetContent(item.id, data)).blocks.length);
    const empty = snippets.snippetContent(item.id, {});
    assert.ok(empty.includes("{{"));
  }
  assert.throws(() => snippets.snippetContent("unknown", {}));
});
test("font, strike and justify survive normalization without merging differently styled runs", () => {
  const encoded = rich.serializeContractRichText({ blocks: [{ type: "paragraph", alignment: "justify", runs: [{ text: "A", fontFamily: "Arial", strike: true, fontSize: 13 }, { text: "B", fontFamily: "Calibri" }] }] });
  const block = rich.parseContractRichText(encoded).blocks[0];
  assert.equal(block.alignment, "justify"); assert.equal(block.runs.length, 2);
  assert.equal(block.runs[0].fontFamily, "Arial"); assert.equal(block.runs[0].strike, true);
  assert.equal(block.runs[1].fontFamily, "Calibri");
});
