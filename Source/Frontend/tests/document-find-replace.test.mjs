import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const nativeRequire = createRequire(import.meta.url);
function load(file, require = nativeRequire) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; new Function("require", "exports", "module", js)(require, module.exports, module); return module.exports;
}
const find = load("../lib/document-find-replace.ts");
const rich = load("../lib/rich-document-find.ts", name => name === "./document-find-replace" ? find : nativeRequire(name));
const { Schema } = nativeRequire("@tiptap/pm/model");
const { EditorState } = nativeRequire("@tiptap/pm/state");
const { history, undo, redo, closeHistory } = nativeRequire("@tiptap/pm/history");
test("literal find handles Vietnamese, case sensitivity, regex symbols and deletion", () => {
  const text = "Đặng [A+B] / đặng [A+B]";
  assert.equal(find.findTextMatches(text, "ĐẶNG").length, 2);
  assert.equal(find.findTextMatches(text, "Đặng", true).length, 1);
  const matches = find.findTextMatches(text, "[A+B]");
  assert.equal(find.replaceTextMatches(text, matches, "$&"), "Đặng $& / đặng $&");
  assert.equal(find.replaceTextMatches("a a", find.findTextMatches("a a", "a"), ""), " ");
  assert.deepEqual(find.findTextMatches(text, ""), []);
});
test("rich find crosses formatting runs but never crosses linked fields or paragraphs; replace-all is one undo", () => {
  const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, paragraph: { content: "inline*", group: "block" }, text: { group: "inline" }, smartField: { inline: true, group: "inline", atom: true } }, marks: { bold: {} } });
  const p = (...nodes) => schema.node("paragraph", null, nodes);
  const doc = schema.node("doc", null, [p(schema.text("Khách ", [schema.mark("bold")]), schema.text("hàng A"), schema.node("smartField"), schema.text("Khách hàng B")), p(schema.text("Khách hàng C"))]);
  let state = EditorState.create({ doc, plugins: [history()] });
  const matches = rich.richDocumentMatches(doc, "Khách hàng", false);
  assert.equal(matches.length, 3);
  assert.equal(rich.richDocumentMatches(doc, "A" + "Khách", false).length, 0);
  const before = state.doc.toJSON();
  state = state.apply(rich.replaceRichDocumentMatches(state, matches, "Đối tác"));
  state = state.apply(closeHistory(state.tr));
  assert.equal(rich.richDocumentMatches(state.doc, "Đối tác", false).length, 3);
  assert.equal(state.doc.firstChild.firstChild.marks[0].type.name, "bold");
  assert.ok(undo(state, tr => { state = state.apply(tr); }));
  assert.deepEqual(state.doc.toJSON(), before);
  assert.ok(redo(state, tr => { state = state.apply(tr); }));
  assert.equal(rich.richDocumentMatches(state.doc, "Đối tác", false).length, 3);
});
