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
const snippets = load("../lib/contract-editor-snippets.ts", name => { assert.equal(name, "@/lib/contract-rich-text"); return rich; });
const smart = load("../lib/editor-smart-fields.ts", name => { assert.equal(name, "@/lib/contract-editor-snippets"); return snippets; });

test("linked snippets keep field identity instead of baking customer data into text", () => {
  for (const snippet of snippets.CONTRACT_SNIPPETS) {
    const content = snippets.linkedSnippetContent(snippet.id);
    for (const field of snippet.fields) assert.ok(content.includes(`{{${field.key}}}`), `${snippet.id}: ${field.key}`);
  }
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
