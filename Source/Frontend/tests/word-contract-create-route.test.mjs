import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import config from "../next.config.mjs";

const read = (path) => readFileSync(new URL(`../app/(protected)/${path}`, import.meta.url), "utf8");

test("old Word links redirect, but the normal create route does not", async () => {
  const redirects = (await config.redirects()).filter(route => route.source === "/contracts/create");
  assert.deepEqual(redirects, [{
    source: "/contracts/create",
    has: [{ type: "query", key: "editorDocument" }],
    destination: "/contracts/create-from-word",
    permanent: false,
  }]);
});

test("editor opens the Word wizard; each wizard calls its own create API", () => {
  assert.match(read("contract-editor/page.tsx"), /\/contracts\/create-from-word\?editorDocument=/);
  const standard = read("contracts/create/page.tsx");
  assert.match(standard, /contractApi\.create\(payload\)/);
  assert.doesNotMatch(standard, /editorDocument|createFromEditor/);
  const word = read("contracts/create-from-word/page.tsx");
  assert.match(word, /contractApi\.createFromEditor\(editorSource\.id, editorSource\.revision, payload\)/);
  assert.doesNotMatch(word, /contractApi\.create\(payload\)/);
});
