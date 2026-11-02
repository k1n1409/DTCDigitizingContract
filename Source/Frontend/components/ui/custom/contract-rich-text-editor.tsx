"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Extension, Node, isProseMirrorCellSelection, type JSONContent, type Editor } from "@tiptap/core";
import { editorFieldLabel, tokenizeEditorFields } from "@/lib/editor-smart-fields";
import { TableCell, TableHeader, TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { FontSize, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import { CONTRACT_SNIPPET_MIME } from "@/lib/contract-editor-snippets";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify,
  Strikethrough,
  RemoveFormatting,
  ChevronDown,
  Combine,
  Italic,
  Maximize2,
  Minimize2,
  Redo2,
  Table2,
  Underline,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoundedSelect } from "@/components/ui/custom/rounded-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONTRACT_RICH_TEXT_FONT_SIZES,
  columnWidthsBpsToPixels,
  normalizeColumnWidthsBps,
  parseContractRichText,
  serializeContractRichText,
  type ContractRichTextBlock,
  type ContractRichTextAlignment,
  type ContractRichTextParagraph,
  type ContractRichTextRun,
  type ContractRichTextRow,
  type ContractRichTextVerticalAlignment,
} from "@/lib/contract-rich-text";
import { cn } from "@/lib/utils";
import { closeHistory } from "@tiptap/pm/history";
import { DocumentFindReplace, type FindOptions } from "@/components/contracts/document-find-replace";
import { richDocumentMatches, replaceRichDocumentMatches } from "@/lib/rich-document-find";

interface ContractRichTextEditorProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  insertRequest?: { id: string; content: string };
  onInsertHandled?: (id: string) => void;
  historyRequest?: { id: string; action: "undo" | "redo" };
  onHistoryHandled?: (id: string) => void;
  onHistoryStateChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  smartFields?: { bindings: Record<string, string>; onSelect: (key: string, detach: (replacement?: string) => void) => void };
}

const DEFAULT_EDITOR_CONTENT_WIDTH = 800;
const DocumentSourceKeys = Extension.create({ name: "documentSourceKeys", addGlobalAttributes() { return [{ types: ["paragraph", "table"], attributes: { sourceKey: { default: null, keepOnSplit: false, parseHTML: element => element.getAttribute("data-word-source"), renderHTML: attributes => attributes.sourceKey ? { "data-word-source": attributes.sourceKey } : {} } } }]; } });
const PreservedWordBlock = Node.create({
  name: "preservedWordBlock", group: "block", atom: true, draggable: true,
  addAttributes() { return { sourceKey: { default: null, parseHTML: element => element.getAttribute("data-word-source") }, label: { default: "Khối Word gốc", parseHTML: element => element.getAttribute("data-word-label") }, previewText: { default: "", parseHTML: element => element.getAttribute("data-word-text") || "" }, previewImage: { default: null, parseHTML: element => element.querySelector("img")?.getAttribute("src") || null } }; },
  parseHTML() { return [{ tag: "div[data-preserved-word]" }]; },
  renderHTML({ node }) {
    const preview = typeof node.attrs.previewImage === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(node.attrs.previewImage) ? node.attrs.previewImage : null;
    return ["div", { "data-preserved-word": "true", "data-word-source": node.attrs.sourceKey, "data-word-label": node.attrs.label, "data-word-text": node.attrs.previewText, contenteditable: "false", class: "my-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-slate-800 cursor-grab", title: "Giữ nguyên bố cục gốc. Có thể di chuyển hoặc xóa cả khối; xem PDF để đối chiếu." }, ["div", { class: "mb-2 text-sm font-semibold" }, String(node.attrs.label)], ...(preview ? [["img", { src: preview, alt: "Ảnh gốc trong tài liệu", style: "max-width:100%;max-height:320px;object-fit:contain" }]] : []), ["p", { class: "whitespace-pre-wrap text-sm" }, String(node.attrs.previewText).slice(0, 1000)], ["small", { class: "mt-2 block text-slate-500" }, "Bố cục được giữ trong bản Word/PDF · Không chỉnh trực tiếp trong khối này."]];
  },
});
const DocumentPageBreak = Extension.create({ name: "documentPageBreak", addGlobalAttributes() { return [{ types: ["paragraph"], attributes: { pageBreakBefore: { default: false, parseHTML: element => element.dataset.pageBreakBefore === "true", renderHTML: attributes => attributes.pageBreakBefore ? { "data-page-break-before": "true", style: "break-before:page;border-top:1px dashed #94a3b8;padding-top:24px;margin-top:24px" } : {} } } }]; } });
const insertStructured = (editor: Editor, content: JSONContent[], position = editor.state.selection.from) => {
  // The persisted contract schema does not allow nested tables.
  if (content.some(node => node.type === "table")) {
    const resolved = editor.state.doc.resolve(position);
    for (let depth = resolved.depth; depth > 0; depth--) {
      if (resolved.node(depth).type.name === "table") { position = resolved.after(depth); break; }
    }
  }
  return editor.chain().focus().insertContentAt(position, content).run();
};
const EDITOR_HORIZONTAL_PADDING = 24;
const EDITOR_VIEWPORT_GUTTER = 16;

const measureEditorContentWidth = (surface: HTMLDivElement) => {
  const surfaceRect = surface.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const visibleSurfaceWidth = Math.max(
    0,
    viewportWidth - Math.max(0, surfaceRect.left) - EDITOR_VIEWPORT_GUTTER,
  );

  return Math.max(
    200,
    Math.floor(
      Math.min(surface.clientWidth, visibleSurfaceWidth) -
        EDITOR_HORIZONTAL_PADDING,
    ),
  );
};

const verticalAlignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => {
    const value = element.style.verticalAlign;
    return value === "top" || value === "center" || value === "bottom"
      ? value
      : null;
  },
  renderHTML: (attributes: Record<string, unknown>) => {
    const value = attributes.verticalAlign;
    return value === "top" || value === "center" || value === "bottom"
      ? { style: `vertical-align:${value}` }
      : {};
  },
};

const ContractTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      verticalAlign: verticalAlignAttribute,
    };
  },
});

const ContractTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      verticalAlign: verticalAlignAttribute,
    };
  },
});

const runsToTiptapContent = (runs: ContractRichTextRun[]): JSONContent[] => {
  const content: JSONContent[] = [];
  runs.forEach((run) => {
    const marks: JSONContent["marks"] = [];
    if (run.bold) marks.push({ type: "bold" });
    if (run.italic) marks.push({ type: "italic" });
    if (run.underline) marks.push({ type: "underline" });
    if (run.strike) marks.push({ type: "strike" });
    if (run.fontSize || run.fontFamily) {
      marks.push({
        type: "textStyle",
        attrs: { ...(run.fontSize ? { fontSize: `${run.fontSize}pt` } : {}), ...(run.fontFamily ? { fontFamily: run.fontFamily } : {}) },
      });
    }

    run.text.split("\n").forEach((part, index) => {
      if (index > 0) content.push({ type: "hardBreak" });
      if (part) content.push({ type: "text", text: part, marks });
    });
  });
  return content;
};

const cellStartColumns = (rows: ContractRichTextRow[], columnCount: number) => {
  const activeRowspans = Array<number>(columnCount).fill(0);
  return rows.map((row) => {
    const occupied = activeRowspans.map((remaining) => remaining > 0);
    activeRowspans.forEach((remaining, index) => {
      if (remaining > 0) activeRowspans[index] = remaining - 1;
    });
    let cursor = 0;
    return row.cells.map((cell) => {
      while (cursor < columnCount && occupied[cursor]) cursor += 1;
      const start = cursor;
      const colspan = cell.colspan ?? 1;
      const rowspan = cell.rowspan ?? 1;
      for (let column = start; column < start + colspan; column += 1) {
        occupied[column] = true;
        if (rowspan > 1) activeRowspans[column] = rowspan - 1;
      }
      cursor += colspan;
      return start;
    });
  });
};

const toTiptapContent = (
  value?: string | null,
  availableWidth = 800,
): JSONContent => ({
  type: "doc",
  content: parseContractRichText(value).blocks.map((block) => {
    if (block.type === "paragraph" && block.locked) return { type: "preservedWordBlock", attrs: { sourceKey: block.sourceKey, label: block.label, previewText: block.runs.map(run => run.text).join(""), previewImage: block.previewImage } };
    if (block.type === "paragraph") {
      return {
        type: "paragraph",
        attrs: { textAlign: block.alignment ?? "left", pageBreakBefore: block.pageBreakBefore ?? false, sourceKey: block.sourceKey ?? null },
        content: runsToTiptapContent(block.runs),
      };
    }

    const columnWidths = columnWidthsBpsToPixels(
      block.columnWidthsBps,
      availableWidth,
    );
    const starts = cellStartColumns(block.rows, columnWidths.length);
    return {
      type: "table",
      attrs: { sourceKey: block.sourceKey ?? null },
      content: block.rows.map((row, rowIndex) => ({
        type: "tableRow",
        content: row.cells.map((cell, cellIndex) => ({
          type: "tableCell",
          attrs: {
            colspan: cell.colspan ?? 1,
            rowspan: cell.rowspan ?? 1,
            colwidth: columnWidths.slice(
              starts[rowIndex][cellIndex],
              starts[rowIndex][cellIndex] + (cell.colspan ?? 1),
            ),
            verticalAlign: cell.verticalAlign ?? null,
          },
          content: cell.paragraphs.map((paragraph) => ({
            type: "paragraph",
            attrs: { textAlign: paragraph.alignment ?? "left", pageBreakBefore: paragraph.pageBreakBefore ?? false, sourceKey: paragraph.sourceKey ?? null },
            content: runsToTiptapContent(paragraph.runs),
          })),
        })),
      })),
    };
  }),
});

const appendRun = (
  runs: ContractRichTextRun[],
  text: string,
  bold?: boolean,
  italic?: boolean,
  underline?: boolean,
  fontSize?: number,
  fontFamily?: string,
  strike?: boolean,
) => {
  if (!text) return;
  const run: ContractRichTextRun = { text };
  if (bold) run.bold = true;
  if (italic) run.italic = true;
  if (underline) run.underline = true;
  if (fontSize) run.fontSize = fontSize;
  if (fontFamily) run.fontFamily = fontFamily;
  if (strike) run.strike = true;
  const previous = runs.at(-1);
  if (
    previous &&
    previous.bold === run.bold &&
    previous.italic === run.italic &&
    previous.underline === run.underline &&
    previous.fontSize === run.fontSize && previous.fontFamily === run.fontFamily && previous.strike === run.strike
  ) {
    previous.text += run.text;
  } else {
    runs.push(run);
  }
};

const tiptapInlineToRuns = (nodes?: JSONContent[]) => {
  const runs: ContractRichTextRun[] = [];
  nodes?.forEach((node) => {
    if (node.type === "hardBreak") {
      appendRun(runs, "\n");
      return;
    }
    const text = node.type === "smartField" ? `{{${node.attrs?.fieldKey}}}` : node.text;
    if ((node.type !== "text" && node.type !== "smartField") || !text) return;
    const bold = node.marks?.some((mark) => mark.type === "bold");
    const italic = node.marks?.some((mark) => mark.type === "italic");
    const underline = node.marks?.some((mark) => mark.type === "underline");
    const fontSizeValue = node.marks?.find((mark) => mark.type === "textStyle")
      ?.attrs?.fontSize;
    const fontSize =
      typeof fontSizeValue === "string"
        ? Number(fontSizeValue.replace("pt", ""))
        : undefined;
    const fontFamily = node.marks?.find(mark => mark.type === "textStyle")?.attrs?.fontFamily;
    appendRun(runs, text, bold, italic, underline, fontSize, typeof fontFamily === "string" ? fontFamily : undefined, node.marks?.some(mark => mark.type === "strike"));
  });
  return runs;
};

const paragraphAlignment = (
  paragraph: JSONContent,
): ContractRichTextAlignment | undefined => {
  const value = paragraph.attrs?.textAlign;
  return value === "center" || value === "right" || value === "justify" ? value : undefined;
};

const tiptapParagraph = (paragraph: JSONContent): ContractRichTextParagraph => {
  const alignment = paragraphAlignment(paragraph);
  return {
    runs: tiptapInlineToRuns(paragraph.content),
    ...(paragraph.attrs?.sourceKey ? { sourceKey: String(paragraph.attrs.sourceKey) } : {}),
    ...(alignment ? { alignment } : {}),
    ...(paragraph.attrs?.pageBreakBefore ? { pageBreakBefore: true } : {}),
  };
};

const cellVerticalAlignment = (
  value: unknown,
): ContractRichTextVerticalAlignment | undefined =>
  value === "top" || value === "center" || value === "bottom"
    ? value
    : undefined;

const tablePixelWidths = (table: JSONContent) => {
  const firstRow = (table.content ?? []).find((row) => row.type === "tableRow");
  const widths: number[] = [];
  (firstRow?.content ?? [])
    .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
    .forEach((cell) => {
      const colspan = Math.max(1, Number(cell.attrs?.colspan) || 1);
      const colwidth = Array.isArray(cell.attrs?.colwidth)
        ? cell.attrs.colwidth.filter(
            (width): width is number =>
              typeof width === "number" && Number.isFinite(width) && width > 0,
          )
        : [];
      widths.push(
        ...(colwidth.length === colspan
          ? colwidth
          : Array<number>(colspan).fill(100)),
      );
    });
  return widths;
};

const fromTiptapDocument = (document: JSONContent) => {
  const blocks: ContractRichTextBlock[] = [];
  document.content?.forEach((node) => {
    if (node.type === "preservedWordBlock") { blocks.push({ type: "paragraph", locked: true, sourceKey: String(node.attrs?.sourceKey || ""), label: String(node.attrs?.label || "Khối Word gốc"), runs: [{ text: String(node.attrs?.previewText || "") }], ...(node.attrs?.previewImage ? { previewImage: String(node.attrs.previewImage) } : {}) }); return; }
    if (node.type === "paragraph") {
      blocks.push({ type: "paragraph", ...tiptapParagraph(node) });
      return;
    }
    if (node.type !== "table") return;
    const rows = (node.content ?? [])
      .filter((row) => row.type === "tableRow")
      .map((row) => ({
        cells: (row.content ?? [])
          .filter(
            (cell) => cell.type === "tableCell" || cell.type === "tableHeader",
          )
          .map((cell) => {
            const colspan = Number(cell.attrs?.colspan);
            const rowspan = Number(cell.attrs?.rowspan);
            const verticalAlign = cellVerticalAlignment(
              cell.attrs?.verticalAlign,
            );
            return {
              paragraphs: (cell.content ?? [])
                .filter((paragraph) => paragraph.type === "paragraph")
                .map(tiptapParagraph),
              ...(Number.isInteger(colspan) && colspan > 1 ? { colspan } : {}),
              ...(Number.isInteger(rowspan) && rowspan > 1 ? { rowspan } : {}),
              ...(verticalAlign ? { verticalAlign } : {}),
            };
          }),
      }));
    if (rows.length > 0) {
      const pixels = tablePixelWidths(node);
      blocks.push({
        type: "table",
        ...(node.attrs?.sourceKey ? { sourceKey: String(node.attrs.sourceKey) } : {}),
        columnWidthsBps: normalizeColumnWidthsBps(pixels),
        rows,
      });
    }
  });
  return { blocks };
};

const fromTiptapContent = (document: JSONContent, preservation?: ReturnType<typeof parseContractRichText>["preservation"]) =>
  serializeContractRichText({ ...fromTiptapDocument(document), ...(preservation ? { preservation } : {}) });

export function ContractRichTextEditor({
  id,
  value,
  onChange,
  placeholder = "Nhập nội dung điều khoản...",
  ariaLabel = "Nội dung điều khoản",
  className,
  insertRequest,
  onInsertHandled,
  historyRequest,
  onHistoryHandled,
  onHistoryStateChange,
  smartFields,
}: ContractRichTextEditorProps) {
  const smartRef = useRef(smartFields);
  const preservationRef = useRef(parseContractRichText(value).preservation);
  const smartEnabled = !!smartFields;
  const [find, setFind] = useState<FindOptions>({ query: "", replacement: "", matchCase: false });
  const [matchIndex, setMatchIndex] = useState(0);
  const prepareContent = useCallback((raw?: string | null, width = DEFAULT_EDITOR_CONTENT_WIDTH) => {
    const doc = toTiptapContent(raw, width);
    return smartEnabled ? tokenizeEditorFields(doc) : doc;
  }, [smartEnabled]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resizeHint, setResizeHint] = useState<{
    left: number;
    top: number;
    label: string;
  }>();
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const editorSurfaceRef = useRef<HTMLDivElement>(null);
  const editorContentWidthRef = useRef(DEFAULT_EDITOR_CONTENT_WIDTH);
  const lastEmittedValue = useRef(value ?? "");
  const lastInsert = useRef("");
  const lastHistory = useRef("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Node.create({
        name: "smartField", group: "inline", inline: true, atom: true,
        addAttributes: () => ({ fieldKey: { default: "" } }),
        parseHTML: () => [],
        renderHTML: ({ node }) => ["span", {}, `{{${node.attrs.fieldKey}}}`],
        renderText: ({ node }) => `{{${node.attrs.fieldKey}}}`,
        addNodeView() {
          return ({ node, editor, getPos }) => {
            const dom = document.createElement("span");
            const key = String(node.attrs.fieldKey);
            dom.dataset.editorField = key;
            dom.contentEditable = "false";
            dom.setAttribute("role", "button"); dom.tabIndex = 0;
            dom.className = "inline-block cursor-pointer rounded border border-primary/30 bg-primary/5 px-1 text-primary whitespace-pre-wrap";
            const refresh = () => {
              const value = smartRef.current?.bindings[key];
              dom.textContent = value?.trim() ? value : `［${editorFieldLabel(key)}］`;
              dom.title = `${editorFieldLabel(key)} · Bấm để điền hoặc chỉnh sửa`;
              dom.setAttribute("aria-label", dom.title);
              dom.dataset.empty = value?.trim() ? "false" : "true";
            };
            refresh(); editor.on("transaction", refresh);
            const select = () => {
              const pos = getPos();
              smartRef.current?.onSelect(key, (replacement?: string) => {
              if (typeof pos !== "number" || editor.state.doc.nodeAt(pos)?.attrs.fieldKey !== key) return;
              const text = replacement === undefined ? smartRef.current?.bindings[key] || "" : replacement;
              const range = { from: pos, to: pos + node.nodeSize };
              if (text) editor.chain().focus().insertContentAt(range, { type: "text", text, marks: node.marks.map(m => m.toJSON()) }).run();
              else editor.chain().focus().deleteRange(range).run();
              });
            };
            dom.addEventListener("click", select);
            dom.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
            return { dom, stopEvent: () => true, ignoreMutation: () => true, destroy: () => { editor.off("transaction", refresh); } };
          };
        },
      }),
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        code: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        link: false,
        horizontalRule: false,
      }),
      TextStyle,
      FontSize,
      FontFamily,
      TextAlign.configure({
        types: ["paragraph"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      TableKit.configure({
        table: {
          resizable: true,
          cellMinWidth: 20,
          HTMLAttributes: { class: "contract-rich-text-table" },
        },
        tableCell: false,
        tableHeader: false,
      }),
      DocumentPageBreak,
      DocumentSourceKeys,
      PreservedWordBlock,
      ContractTableCell,
      ContractTableHeader,
    ],
    content: prepareContent(value, DEFAULT_EDITOR_CONTENT_WIDTH),
    editorProps: {
      handleDrop(view, event) {
        if (!event.dataTransfer?.types.includes(CONTRACT_SNIPPET_MIME)) return false;
        event.preventDefault();
        const raw = event.dataTransfer.getData(CONTRACT_SNIPPET_MIME);
        if (!raw || raw.length > 100000) return true;
        try {
          const content = prepareContent(raw, editorContentWidthRef.current).content || [];
          const point = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (editor) insertStructured(editor, content, point?.pos ?? view.state.selection.from);
        } catch { /* Ignore malformed external drag data; never insert arbitrary HTML. */ }
        return true;
      },
      attributes: {
        id: id ?? "",
        role: "textbox",
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        class:
          "h-56 overflow-y-auto px-3 py-2 text-sm leading-6 outline-none " +
          "[&_p]:min-h-[1.5rem] [&_table]:my-2 [&_table]:w-full " +
          "[&_table]:border-collapse [&_td]:min-w-24 [&_td]:border " +
          "[&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextValue = fromTiptapContent(currentEditor.getJSON(), preservationRef.current);
      lastEmittedValue.current = nextValue;
      onChange(nextValue);
    },
  });

  useEffect(() => {
    if (!editor || !onHistoryStateChange) return;
    let previous = "";
    const publish = () => {
      const state = { canUndo: editor.can().undo(), canRedo: editor.can().redo() };
      const stamp = JSON.stringify(state);
      if (stamp !== previous) { previous = stamp; onHistoryStateChange(state); }
    };
    publish(); editor.on("transaction", publish);
    return () => { editor.off("transaction", publish); };
  }, [editor, onHistoryStateChange]);

  useEffect(() => {
    if (!editor || !historyRequest || lastHistory.current === historyRequest.id) return;
    lastHistory.current = historyRequest.id;
    if (historyRequest.action === "undo") editor.chain().focus().undo().run();
    else editor.chain().focus().redo().run();
    onHistoryHandled?.(historyRequest.id);
  }, [editor, historyRequest, onHistoryHandled]);

  useEffect(() => {
    if (!editor || !insertRequest || lastInsert.current === insertRequest.id) return;
    lastInsert.current = insertRequest.id;
    insertStructured(editor, prepareContent(insertRequest.content, editorContentWidthRef.current).content || []);
    onInsertHandled?.(insertRequest.id);
  }, [editor, insertRequest, onInsertHandled, prepareContent]);

  useEffect(() => {
    const nextValue = value ?? "";
    preservationRef.current = parseContractRichText(nextValue).preservation;
    if (!editor || lastEmittedValue.current === nextValue) return;
    lastEmittedValue.current = nextValue;
    editor.commands.setContent(
      prepareContent(nextValue, editorContentWidthRef.current),
      {
        emitUpdate: false,
      },
    );
  }, [editor, value, prepareContent]);

  useEffect(() => {
    const surface = editorSurfaceRef.current;
    if (!editor || !surface) return;

    const applyMeasuredWidth = () => {
      const nextWidth = measureEditorContentWidth(surface);
      if (Math.abs(nextWidth - editorContentWidthRef.current) < 2) return;
      editorContentWidthRef.current = nextWidth;
      const current = fromTiptapContent(editor.getJSON(), preservationRef.current);
      editor.chain().setMeta("addToHistory", false).setContent(prepareContent(current, nextWidth), {
        emitUpdate: false,
      }).run();
    };

    applyMeasuredWidth();
    const observer = new ResizeObserver(applyMeasuredWidth);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [editor, isFullscreen, prepareContent]);

  useEffect(() => {
    smartRef.current = smartFields;
    if (editor && smartFields) editor.view.dispatch(editor.state.tr.setMeta("smartFieldValues", true));
  }, [editor, smartFields]);

  const clearResizeHint = () => {
    editorSurfaceRef.current?.classList.remove("contract-table-edge-hover");
    setResizeHint(undefined);
  };

  const showResizeHint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const surface = editorSurfaceRef.current;
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLTableCellElement>(
      ".contract-rich-text-table td, .contract-rich-text-table th",
    );
    if (!surface || !cell) {
      if (event.buttons === 0) clearResizeHint();
      return;
    }

    const cellRect = cell.getBoundingClientRect();
    const table = cell.closest<HTMLTableElement>("table");
    if (!table || Math.abs(cellRect.right - event.clientX) > 10) {
      if (event.buttons === 0) clearResizeHint();
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const tableWidth = Math.max(1, table.getBoundingClientRect().width);
    surface.classList.add("contract-table-edge-hover");
    setResizeHint({
      left: cellRect.right - surfaceRect.left,
      top: cellRect.top - surfaceRect.top + 4,
      label: `${((cellRect.width / tableWidth) * 100).toFixed(1)}%`,
    });
  };

  const tableState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return { inTable: false, selectedCellCount: 0, canMerge: false };
      }
      const selection = currentEditor.state.selection;
      return {
        inTable: currentEditor.isActive("table"),
        selectedCellCount: isProseMirrorCellSelection(selection)
          ? selection.ranges.length
          : 0,
        canMerge: currentEditor.can().chain().mergeCells().run(),
      };
    },
  }) ?? { inTable: false, selectedCellCount: 0, canMerge: false };

  const matches = useEditorState({ editor, selector: ({ editor: currentEditor }) => {
    return currentEditor ? richDocumentMatches(currentEditor.state.doc, find.query, find.matchCase) : [];
  } }) || [];
  const activeMatch = Math.min(matchIndex, Math.max(0, matches.length - 1));
  const navigateMatch = (direction: number) => {
    if (!editor || !matches.length) return;
    const index = (activeMatch + direction + matches.length) % matches.length;
    setMatchIndex(index); editor.chain().focus().setTextSelection(matches[index]).scrollIntoView().run();
  };
  const replaceMatches = (all: boolean) => {
    if (!editor || !matches.length) return;
    const chosen = all ? matches : [matches[activeMatch]];
    editor.view.dispatch(replaceRichDocumentMatches(editor.state, chosen, find.replacement).scrollIntoView());
    editor.view.dispatch(closeHistory(editor.state.tr));
    setMatchIndex(0);
  };
  if (!editor) {
    return <div className="h-64 animate-pulse rounded-md border bg-muted/30" />;
  }

  const { inTable, selectedCellCount, canMerge } = tableState;

  const editorSurface = (
    <div
      ref={editorSurfaceRef}
      onPointerMove={showResizeHint}
      onPointerLeave={(event) => {
        if (event.buttons === 0) clearResizeHint();
      }}
      onPointerUp={clearResizeHint}
      className={cn(
        "contract-rich-text-editor-surface relative w-full min-w-0 max-w-full overflow-hidden rounded-md border bg-background",
        className,
        isFullscreen && "flex min-h-0 flex-1 flex-col rounded-none border-0",
      )}
    >
      {smartEnabled && <DocumentFindReplace value={find} onChange={value => { setFind(value); setMatchIndex(0); }} count={matches.length} index={activeMatch} onNavigate={navigateMatch} onReplace={replaceMatches} />}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
        {smartEnabled && <Button type="button" size="sm" variant={editor.isActive("paragraph", { pageBreakBefore: true }) ? "secondary" : "ghost"} title="Bật/tắt ngắt trang trước đoạn đang chọn" onClick={() => editor.chain().focus().updateAttributes("paragraph", { pageBreakBefore: !editor.isActive("paragraph", { pageBreakBefore: true }) }).run()}>Ngắt trang</Button>}
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon"
          className="size-8"
          title="In đậm"
          aria-label="In đậm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon"
          className="size-8"
          title="In nghiêng"
          aria-label="In nghiêng"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("underline") ? "secondary" : "ghost"}
          size="icon"
          className="size-8"
          title="Gạch chân"
          aria-label="Gạch chân"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
            >
              Cỡ chữ <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl p-1.5 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:text-[15px]">
            <DropdownMenuLabel>Cỡ chữ</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CONTRACT_RICH_TEXT_FONT_SIZES.map((fontSize) => (
              <DropdownMenuItem
                key={fontSize}
                onSelect={() =>
                  editor.chain().focus().setFontSize(`${fontSize}pt`).run()
                }
              >
                {fontSize} pt
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <RoundedSelect aria-label="Phông chữ" className="h-9 max-w-44" value={editor.getAttributes("textStyle").fontFamily || "Times New Roman"} onValueChange={font => editor.chain().focus().setFontFamily(font).run()} options={["Times New Roman", "Arial", "Calibri"].map(font => ({ value: font, label: font }))} />
        <Button type="button" size="icon" variant={editor.isActive("strike") ? "secondary" : "ghost"} className="size-8" aria-label="Gạch ngang" title="Gạch ngang" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Xóa định dạng chữ" title="Xóa định dạng chữ" onClick={() => editor.chain().focus().unsetAllMarks().run()}><RemoveFormatting className="size-4" /></Button>
        {(
          [
            ["left", AlignLeft, "Căn trái"],
            ["center", AlignCenter, "Căn giữa"],
            ["right", AlignRight, "Căn phải"],
            ["justify", AlignJustify, "Căn đều hai bên"],
          ] as const
        ).map(([alignment, Icon, label]) => (
          <Button
            key={alignment}
            type="button"
            variant={
              editor.isActive({ textAlign: alignment }) ? "secondary" : "ghost"
            }
            size="icon"
            className="size-8"
            title={label}
            aria-label={label}
            aria-pressed={editor.isActive({ textAlign: alignment })}
            onClick={() => editor.chain().focus().setTextAlign(alignment).run()}
          >
            <Icon className="size-4" />
          </Button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
            >
              <Table2 className="size-4" /> Thêm bảng
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl p-1.5 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:text-[15px]">
            <DropdownMenuLabel>Kích thước bảng</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[2, 3, 4].map((size) => (
              <DropdownMenuItem
                key={size}
                onSelect={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({
                      rows: size,
                      cols: size,
                      withHeaderRow: false,
                    })
                    .run()
                }
              >
                Bảng {size} × {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {inTable && (
          <>
            <Button
              type="button"
              variant={canMerge ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1"
              title="Chọn từ hai ô liền nhau để gộp"
              disabled={!canMerge}
              onClick={() => editor.chain().focus().mergeCells().run()}
            >
              <Combine className="size-4" /> Gộp ô
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1"
                >
                  Sửa bảng <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl p-1.5 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:text-[15px]">
                <DropdownMenuLabel>Hàng và cột</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => editor.chain().focus().addRowBefore().run()}
                >
                  Thêm hàng phía trên
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => editor.chain().focus().addRowAfter().run()}
                >
                  Thêm hàng phía dưới
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    editor.chain().focus().addColumnBefore().run()
                  }
                >
                  Thêm cột bên trái
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => editor.chain().focus().addColumnAfter().run()}
                >
                  Thêm cột bên phải
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => editor.chain().focus().deleteRow().run()}
                >
                  Xóa hàng hiện tại
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => editor.chain().focus().deleteColumn().run()}
                >
                  Xóa cột hiện tại
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Ô</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!canMerge}
                  onSelect={() => editor.chain().focus().mergeCells().run()}
                >
                  Gộp các ô đã chọn
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor.can().chain().focus().splitCell().run()}
                  onSelect={() => editor.chain().focus().splitCell().run()}
                >
                  Tách ô
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Căn dọc nội dung ô</DropdownMenuLabel>
                {(["top", "center", "bottom"] as const).map((alignment) => (
                  <DropdownMenuItem
                    key={alignment}
                    onSelect={() =>
                      editor
                        .chain()
                        .focus()
                        .setCellAttribute("verticalAlign", alignment)
                        .run()
                    }
                  >
                    {alignment === "top"
                      ? "Căn trên"
                      : alignment === "center"
                        ? "Căn giữa"
                        : "Căn dưới"}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => editor.chain().focus().deleteTable().run()}
                >
                  Xóa bảng
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title="Hoàn tác"
            aria-label="Hoàn tác"
            disabled={!editor.can().chain().focus().undo().run()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title="Làm lại"
            aria-label="Làm lại"
            disabled={!editor.can().chain().focus().redo().run()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            ref={fullscreenButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title={isFullscreen ? "Thoát toàn màn hình (Esc)" : "Toàn màn hình"}
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            aria-pressed={isFullscreen}
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {inTable && (
        <div className="shrink-0 border-b bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground">
          {selectedCellCount > 1 ? (
            <span className="font-medium text-primary">
              Đã chọn {selectedCellCount} ô. Bấm “Gộp ô” để gộp vùng đang chọn.
            </span>
          ) : (
            <span>
              Để gộp ô: đặt con trỏ ở ô đầu, giữ Shift rồi bấm ô cuối (hoặc kéo
              chuột qua các ô).
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "relative min-w-0 max-w-full overflow-hidden",
          isFullscreen && "min-h-0 flex-1",
        )}
      >
        {resizeHint && (
          <span
            className="pointer-events-none absolute z-30 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow"
            style={{ left: resizeHint.left, top: resizeHint.top }}
          >
            {resizeHint.label}
          </span>
        )}
        {editor.isEmpty && (
          <span className="pointer-events-none absolute left-3 top-2.5 z-10 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <EditorContent
          editor={editor}
          className={cn(
            "min-w-0 max-w-full",
            isFullscreen && "h-full [&_.tiptap]:h-full",
          )}
        />
      </div>
    </div>
  );

  return (
    <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
      {!isFullscreen && editorSurface}
      {isFullscreen && (
        <DialogContent
          className="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
          showCloseButton={false}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            editor.commands.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            fullscreenButtonRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">{ariaLabel}</DialogTitle>
          {editorSurface}
        </DialogContent>
      )}
    </Dialog>
  );
}
