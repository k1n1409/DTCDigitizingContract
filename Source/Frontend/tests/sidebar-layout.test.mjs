import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("document density stays inside the workspace instead of resizing the app shell", () => {
  const css = read("../app/globals.css");
  assert.ok(!css.includes("[data-document-shell]"), "shell spacing would also resize the sidebar on editor routes");
  assert.match(css, /\.document-workspace-ui\s*\{\s*--spacing:\s*0\.225rem/);
});

test("sidebar geometry is route-independent and only its menu scrolls", () => {
  const source = read("../components/sidebar.tsx");
  assert.match(source, /isExpanded \? "w-\[16rem\]" : "w-\[5rem\]"/);
  assert.ok(source.includes("[--spacing:0.25rem]"));
  assert.ok(source.includes("h-[4rem] shrink-0"));
  assert.ok(source.includes("min-h-0 flex-1"));
  assert.ok(source.includes("overflow-x-hidden overflow-y-auto overscroll-contain"));
});

test("Word workspace headers align with the stable four-rem logo header", () => {
  for (const path of ["../app/(protected)/contract-import/page.tsx", "../app/(protected)/contract-editor/page.tsx"]) {
    assert.ok(read(path).includes("min-h-[4rem] shrink-0"), path);
  }
});
