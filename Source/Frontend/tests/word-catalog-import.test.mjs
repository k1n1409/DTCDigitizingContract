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
const { readWordItemTables, parseWordNumber } = load("word-catalog-import", () => rich);
const table = (rows) => ({
  type: "table",
  columnWidthsBps: rich.normalizeColumnWidthsBps([], rows[0].reduce((sum, cell) => sum + (cell.colspan ?? 1), 0)),
  rows: rows.map(row => ({ cells: row.map(value => ({
    paragraphs: [{ runs: [{ text: typeof value === "string" ? value : value.text }] }],
    ...(typeof value === "string" ? {} : { colspan: value.colspan }),
  })) })),
});

test("finds multiple simple item tables and resolves linked values", () => {
  const content = rich.serializeContractRichText({ blocks: [
    table([["Người đại diện", "Điện thoại"], ["Khách hàng", "0900"]]),
    table([["STT", "Mã SP", "Tên sản phẩm", "ĐVT", "SL", "Đơn giá (VND)", "Thành tiền"],
      ["1", "SP-1", "{{ITEM_NAME}}", "Gói", "2", "1.000.000 ₫", "2.000.000"],
      ["", "", "Tổng cộng", "", "", "", "2.000.000"]]),
    table([["Quantity", "Unit price", "Service name"], ["1", "12.50", "Support"]]),
  ] });
  const found = readWordItemTables(content, { ITEM_NAME: "Phần mềm" });
  assert.deepEqual(found.map(x => x.index), [2, 3]);
  assert.equal(found[0].currencyHint, "VND");
  assert.deepEqual(found[0].rows, [{ line: 2, code: "SP-1", name: "Phần mềm", unit: "Gói", quantity: "2", price: "1.000.000 ₫", total: "2.000.000" }]);
  assert.equal(found[1].rows[0].name, "Support");
});

test("ignores merged tables and invalid source; keeps incomplete rows for review", () => {
  const content = rich.serializeContractRichText({ blocks: [
    table([[{ text: "Tên sản phẩm", colspan: 2 }, "SL", "Đơn giá"], ["A", "", "1", "100"]]),
    table([["Tên sản phẩm", "SL", "Đơn giá"], ["B", "", "100"]]),
  ] });
  assert.deepEqual(readWordItemTables(content, {}).map(x => x.rows[0].quantity), [""]);
  assert.deepEqual(readWordItemTables("not-rich-text", {}), []);
});

test("reads the bilingual exported price table and skips its merged total row", () => {
  const content = rich.serializeContractRichText({ blocks: [
    table([
      ["No.\n\nSTT", "Type\n\nLoại", "Description\n\nSản phẩm, dịch vụ", "Qty SL", "Unit price\n\nĐơn giá", "Disc.\n\nCK", "VAT", "Total\n\nThành tiền"],
      ["1", "Product\n\nSản phẩm", "Enterprise Firewall Appliance\n\nEnterprise Firewall Appliance", "1", "95.000.000\nVND", "0 VND", "10%", "104.500.000 VND"],
      [{ text: "TOTAL\n\nTỔNG CỘNG", colspan: 7 }, "104.500.000 VND"],
    ]),
  ] });
  const [found] = readWordItemTables(content, {});
  assert.deepEqual(found.rows, [{ line: 2, code: "", name: "Enterprise Firewall Appliance", unit: "", quantity: "1", price: "95.000.000 VND", total: "104.500.000 VND" }]);
  assert.equal(parseWordNumber(found.rows[0].price, "VND"), 95000000);
});

test("recognizes currency values without guessing ambiguous separators or invalid input", () => {
  assert.equal(parseWordNumber("1.250.000 ₫", "VND"), 1250000);
  assert.equal(parseWordNumber("12.500 VND", "VND"), 12500);
  assert.equal(parseWordNumber("1,234.50 USD", "USD"), 1234.5);
  assert.equal(parseWordNumber("1 234,50", "USD"), 1234.5);
  assert.equal(parseWordNumber("1,234", "USD"), null);
  assert.equal(parseWordNumber("1.234"), null);
  assert.equal(parseWordNumber("10 USD", "VND"), null);
  assert.equal(parseWordNumber(""), null);
  assert.equal(parseWordNumber("-10"), null);
});
