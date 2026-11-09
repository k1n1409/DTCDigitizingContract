import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as dates from "date-fns";
import ts from "typescript";

const source = readFileSync(new URL("../components/ui/custom/date-picker-calendar.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const Calendar = Symbol("Calendar");
const jsx = (type, props) => ({ type, props });
const modules = {
  "react/jsx-runtime": { jsx, jsxs: jsx },
  react: { useId: () => "test", useRef: value => ({ current: value }), useEffect: () => {}, useState: value => [typeof value === "function" ? value() : value, () => {}] },
  "date-fns": dates,
  "@/components/ui/calendar": { Calendar },
  "@/components/ui/input": { Input: Symbol("Input") },
  "@/components/ui/label": { Label: Symbol("Label") },
};
const exports = {};
new Function("exports", "require", outputText)(exports, name => modules[name]);
const { DatePickerCalendar } = exports;
const day = new Date(2026, 10, 20);

test("Word picker commits and closes on the first click, including the current date", () => {
  for (const selection of [day, undefined]) {
    const events = [];
    const tree = DatePickerCalendar({ date: day, confirmOnDaySelect: true, onChange: value => events.push(value), onConfirm: () => events.push("close") });
    tree.props.children.find(node => node.type === Calendar).props.onSelect(selection, day);
    assert.deepEqual(events, [day, "close"]);
  }
});

test("other date pickers keep the existing selection behavior by default", () => {
  const events = [];
  const tree = DatePickerCalendar({ date: day, onChange: value => events.push(value), onConfirm: () => events.push("close") });
  tree.props.children.find(node => node.type === Calendar).props.onSelect(undefined, day);
  assert.deepEqual(events, [undefined]);
});

function loadComponent(path, deps, HTMLElementClass) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } });
  const result = {};
  new Function("exports", "require", "HTMLElement", outputText)(result, name => deps[name], HTMLElementClass);
  return result;
}

test("opening the Word date range focuses the panel, not the day input", () => {
  const calls = [];
  class Panel { focus(options) { calls.push(["focus panel", options]); } }
  const content = Symbol("PopoverContent");
  const { DateRangeFilter } = loadComponent("../components/ui/custom/date-range-filter.tsx", {
    ...modules,
    "@/components/ui/custom/date-picker-calendar": { DatePickerCalendar },
    "@/components/ui/button": { Button: Symbol("Button") },
    "@/components/ui/popover": { Popover: Symbol("Popover"), PopoverContent: content, PopoverTrigger: Symbol("PopoverTrigger") },
    "@/hooks/use-media-query": { useMediaQuery: () => false },
    "lucide-react": { CalendarDays: Symbol("CalendarDays"), Delete: Symbol("Delete") },
    "@/lib/utils": { cn: (...classes) => classes.filter(Boolean).join(" ") },
  }, Panel);
  const tree = DateRangeFilter({ dateRange: { from: undefined, to: day }, onChange: () => {}, confirmOnDaySelect: true });
  for (const index of [0, 2]) {
    const panel = tree.props.children[index].props.children.find(node => node.type === content);
    panel.props.onOpenAutoFocus({ preventDefault: () => calls.push(["prevent input focus"]), currentTarget: new Panel() });
  }
  assert.deepEqual(calls, [
    ["prevent input focus"], ["focus panel", { preventScroll: true }],
    ["prevent input focus"], ["focus panel", { preventScroll: true }],
  ]);
});

test("calendar rerenders retain the day subtree when the typed input blurs", () => {
  const { Calendar } = loadComponent("../components/ui/calendar.tsx", {
    ...modules,
    "lucide-react": {},
    "react-day-picker": { DayPicker: Symbol("DayPicker"), getDefaultClassNames: () => ({}) },
    "@/components/ui/button": { Button: Symbol("Button"), buttonVariants: () => "" },
    "@/lib/utils": { cn: (...classes) => classes.filter(Boolean).join(" ") },
  });
  const before = Calendar({ mode: "single", selected: day }).props.components;
  const after = Calendar({ mode: "single", selected: day }).props.components;
  for (const key of ["Root", "DayButton", "Chevron", "WeekNumber"]) assert.equal(before[key], after[key]);
});
