import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function setup() {
  const requests = [];
  const get = (url, options) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    options.signal.addEventListener("abort", abort, { once: true });
    requests.push({ url, resolve: () => { options.signal.removeEventListener("abort", abort); resolve(new TextEncoder().encode("%PDF-test").buffer); } });
  });
  const source = fs.readFileSync(new URL("../lib/document-pdf.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "exports", "module", js)(name => { assert.equal(name, "@/lib/axios-interceptor"); return { default: { get } }; }, module.exports, module);
  return { ...module.exports, requests };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test("PDF requests deduplicate; cancelling a thumbnail does not cancel the visible preview", async () => {
  const { documentPdf, requests } = setup();
  const a = new AbortController(), b = new AbortController();
  const first = documentPdf("editor", "a", 1, "tenant:actor", a.signal, "thumbnail");
  const second = documentPdf("editor", "a", 1, "tenant:actor", b.signal);
  assert.equal(requests.length, 1);
  a.abort(); await assert.rejects(first, { name: "AbortError" });
  requests[0].resolve(); const data = await second;
  new Uint8Array(data)[0] = 0;
  const cached = await documentPdf("editor", "a", 1, "tenant:actor", b.signal);
  assert.equal(new Uint8Array(cached)[0], 37);
  assert.equal(requests.length, 1);
  const next = documentPdf("editor", "a", 2, "tenant:actor", b.signal); await flush(); requests[1].resolve(); await next;
  const other = documentPdf("editor", "a", 2, "tenant:other", b.signal); await flush(); requests[2].resolve(); await other;
  assert.equal(requests.length, 3);
});
test("visible preview takes the next free slot ahead of queued thumbnails", async () => {
  const { documentPdf, requests } = setup(); const signal = new AbortController().signal;
  const first = documentPdf("editor", "one", 1, "owner", signal, "thumbnail");
  const second = documentPdf("editor", "two", 1, "owner", signal, "thumbnail");
  const third = documentPdf("editor", "three", 1, "owner", signal, "thumbnail");
  const preview = documentPdf("editor", "main", 1, "owner", signal);
  assert.equal(requests.length, 2);
  requests[0].resolve(); await first; await flush();
  assert.ok(requests[2].url.includes("/main/"));
  requests[1].resolve(); await second; await flush();
  assert.ok(requests[3].url.includes("/three/"));
  requests[2].resolve(); requests[3].resolve(); await Promise.all([third, preview]);
});
