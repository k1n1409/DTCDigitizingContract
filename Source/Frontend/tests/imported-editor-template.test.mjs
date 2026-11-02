import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(client) {
  const source = fs.readFileSync(new URL("../services/imported-editor-template-api.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "exports", "module", js)(name => { assert.equal(name, "@/lib/axios-interceptor"); return { default: client }; }, module.exports, module);
  return module.exports;
}
test("Word review becomes a separate editor template from the exact saved revision", async () => {
  const calls = [];
  const api = load({
    get: async (url, options) => { calls.push({ url, options }); return new Blob(["reviewed DOCX"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); },
    post: async (url, body) => { calls.push({ url, body }); return url.endsWith("/import") ? { content: "structured content", warning: "Review layout" } : { id: "new-template", revision: 1 }; },
  });
  const prepared = await api.prepareImportedTemplate("original", 3);
  const result = await api.savePreparedTemplate("  Mẫu mới  ", prepared.content, "stable-client-id");
  assert.equal(calls[0].url, "/api/imported-contracts/original/export/docx");
  assert.equal(calls[0].options.params.revision, 3);
  assert.equal(calls[1].body.get("file").name, "reviewed-v3.docx");
  assert.deepEqual(calls[2].body, { title: "Mẫu mới", content: "structured content", bindings: {}, isTemplate: true, expectedRevision: 0, clientDocumentId: "stable-client-id" });
  assert.equal(result.id, "new-template");
  assert.ok(calls.every(c => !c.url.endsWith("/export/original")));
});
test("a failed source export does not create an empty template", async () => {
  let posts = 0;
  const api = load({ get: async () => { throw new Error("Forbidden"); }, post: async () => { posts++; } });
  await assert.rejects(api.prepareImportedTemplate("other-account", 1), /Forbidden/);
  assert.equal(posts, 0);
});
