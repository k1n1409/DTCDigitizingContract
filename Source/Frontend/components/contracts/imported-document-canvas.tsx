"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minus, Plus, PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewedBlockText, type ReviewField } from "@/lib/imported-contract-editing";

type Block = { id: string; text: string; context: string; editable: boolean; editMode?: string; editReason?: string };
const WIDTH = 794, HEIGHT = 1123, MARGIN = 76, BODY = HEIGHT - MARGIN * 2;

function PaperText({ blockId, value, label, disabled, onChange, onFocus }: {
  blockId: string; value: string; label: string; disabled: boolean; onChange: (value: string) => void; onFocus: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current; if (!node) return;
    node.style.height = "0px"; node.style.height = `${Math.max(28, node.scrollHeight)}px`;
  }, [value]);
  return <textarea ref={ref} id={`inline-${blockId}`} data-paper-block={blockId} rows={1} value={value} maxLength={10000} disabled={disabled}
    aria-label={label} placeholder="Nhập nội dung…" spellCheck={false}
    className="block min-h-7 w-full resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 text-[16px] leading-[1.7] text-black outline-none placeholder:text-slate-300 focus:ring-0 disabled:cursor-wait [font:inherit]"
    onFocus={onFocus} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault(); }}
    onChange={e => onChange(e.target.value.replace(/[\r\n\t]+/g, " "))} />;
}

export function ImportedDocumentCanvas({ viewport, blocks, fields, original, readOnly, busy, onChange, onDelete, renderOriginal, onSelect, onFocusBlock, panelOpen, onTogglePanel }: {
  viewport: RefObject<HTMLDivElement | null>;
  blocks: Block[]; fields: ReviewField[]; original: boolean; readOnly: boolean; busy: boolean;
  onChange: (block: Block, value: string) => void; renderOriginal: (block: Block) => ReactNode;
  onDelete?: (block: Block) => void;
  onSelect: (block: Block, node: HTMLElement) => void; onFocusBlock: (id: string) => void;
  panelOpen: boolean; onTogglePanel: () => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ id: string; start: number; end: number } | null>(null);
  const [groups, setGroups] = useState<{ ids: string[]; height: number }[]>([]);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const visible = blocks.filter(b => b.text.length > 0);
  const text = (b: Block) => original ? b.text : reviewedBlockText(b.text, b.id, fields);

  useLayoutEffect(() => {
    const root = measure.current; if (!root) return;
    let disposed = false;
    const paginate = () => {
      if (disposed) return;
      const pages: { ids: string[]; height: number }[] = [{ ids: [], height: HEIGHT }]; let used = 0;
      root.querySelectorAll<HTMLElement>("[data-measure-block]").forEach(node => {
        const height = Math.ceil(node.getBoundingClientRect().height) + 8;
        if (used && used + height > BODY) { pages.push({ ids: [], height: HEIGHT }); used = 0; }
        const page = pages[pages.length - 1]; page.ids.push(node.dataset.measureBlock!); used += height;
        page.height = Math.max(HEIGHT, used + MARGIN * 2);
      });
      setGroups(previous => {
        if (JSON.stringify(previous) === JSON.stringify(pages)) return previous;
        const active = document.activeElement;
        if (active instanceof HTMLTextAreaElement && active.dataset.paperBlock) pendingCaret.current = { id: active.dataset.paperBlock, start: active.selectionStart, end: active.selectionEnd };
        return pages;
      });
    };
    paginate();
    const observer = new ResizeObserver(paginate); observer.observe(root);
    void document.fonts.ready.then(paginate);
    return () => { disposed = true; observer.disconnect(); };
  }, [blocks, fields, original]);
  useLayoutEffect(() => {
    const caret = pendingCaret.current; if (!caret) return;
    const node = Array.from(viewport.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-paper-block]") || []).find(n => n.dataset.paperBlock === caret.id);
    node?.focus({ preventScroll: true }); node?.setSelectionRange(caret.start, caret.end); pendingCaret.current = null;
  }, [groups, viewport]);
  const renderedGroups = groups.length ? groups : [{ ids: visible.map(b => b.id), height: HEIGHT }];
  const pageCount = renderedGroups.length;
  const selectedPage = Math.min(currentPage, pageCount);
  const navigate = (page: number) => {
    const target = Math.max(1, Math.min(page, pageCount));
    viewport.current?.querySelector<HTMLElement>(`[data-editor-page="${target}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    setCurrentPage(target);
  };
  useEffect(() => {
    const root = viewport.current; if (!root) return;
    const track = () => {
      const top = root.getBoundingClientRect().top + 100;
      const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-editor-page]"));
      const page = pages.findIndex(n => n.getBoundingClientRect().bottom > top);
      if (page >= 0) setCurrentPage(page + 1);
    };
    root.addEventListener("scroll", track, { passive: true }); track();
    return () => root.removeEventListener("scroll", track);
  }, [groups, viewport, zoom]);
  const paperStyle = { fontFamily: '"Times New Roman", serif', fontSize: 16, lineHeight: 1.7 };
  return <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#f1f2f7]">
    <div className="flex shrink-0 justify-center border-b border-slate-200 bg-[#f1f2f7] px-3 py-2">
      <div className="flex max-w-full items-center gap-3 rounded-xl border bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
        <span className="font-medium text-slate-900">{original ? "Đối chiếu bản gốc · Chỉ xem" : readOnly ? "Bản lịch sử · Chỉ xem" : "Chỉ sửa chữ · Giữ định dạng Word gốc"}</span><span className="hidden border-l pl-3 sm:inline">Vùng bị giới hạn có lý do ngay bên dưới</span>
      </div>
    </div>
    <div ref={viewport} className="relative min-h-0 flex-1 overflow-auto overscroll-contain p-4 sm:p-8" aria-label="Vùng trang tài liệu">
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 invisible" ref={measure} style={{ width: WIDTH - 2 * MARGIN, ...paperStyle }}>
        {visible.map(b => <div key={b.id} data-measure-block={b.id} className="min-h-7 whitespace-pre-wrap break-words py-1">{text(b) || "\u00a0"}{!b.editable && <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 text-[11px] leading-4 [font-family:Arial,sans-serif]">Chỉ xem · {b.editReason || "Vùng Word phức tạp được giữ nguyên khi xuất."}</div>}</div>)}
      </div>
      <div className="mx-auto flex w-max min-w-0 flex-col gap-8">
        {renderedGroups.map(({ ids, height }, index) => <div key={index} data-editor-page={index + 1} className="relative shrink-0 scroll-mt-4" style={{ width: WIDTH * zoom / 100, height: height * zoom / 100 }}>
          <div className="absolute left-0 top-0 origin-top-left rounded-sm bg-white text-black shadow-[0_3px_24px_rgba(30,41,59,0.10)]" style={{ width: WIDTH, minHeight: height, padding: MARGIN, transform: `scale(${zoom / 100})`, ...paperStyle }}>
            {ids.map(id => {
              const block = blocks.find(b => b.id === id); if (!block) return null;
              const canEdit = !original && !readOnly && block.editable && block.text.length <= 10000;
              return <div key={id} id={`source-${id}`} tabIndex={-1} title={canEdit ? undefined : `${block.context}${block.editable ? "" : " · Vùng chỉ xem"}`}
                className={`relative mb-2 min-h-7 whitespace-pre-wrap break-words rounded-sm py-1 ${text(block) !== block.text ? "bg-amber-50/60 ring-1 ring-amber-300" : ""} ${!block.editable ? "bg-slate-50/60 ring-1 ring-slate-200" : ""} ${canEdit ? "hover:bg-sky-50/60 focus-within:bg-sky-50/40 focus-within:ring-1 focus-within:ring-sky-200" : ""}`}
                data-block={id}>
                {canEdit ? <><PaperText blockId={id} label={`Nội dung ${block.context} ${id}`} value={text(block)} disabled={busy} onFocus={() => onFocusBlock(id)} onChange={value => onChange(block, value)} />{onDelete && <Button type="button" size="icon" variant="ghost" className="absolute -right-9 top-1 size-7 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Xóa nội dung ${block.context} ${id}`} title="Xóa nội dung đoạn/ô" disabled={busy || !text(block)} onClick={() => onDelete(block)}><Trash2 className="size-3.5" /></Button>}</>
                  : <div tabIndex={0} onMouseUp={e => original && onSelect(block, e.currentTarget)} onKeyUp={e => original && onSelect(block, e.currentTarget)}>{original ? renderOriginal(block) : text(block) || <span className="text-slate-300">[Đã xóa nội dung]</span>}</div>}
                {!block.editable && <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 text-[11px] leading-4 text-amber-950 [font-family:Arial,sans-serif]">Chỉ xem · {block.editReason || "Vùng Word phức tạp được giữ nguyên khi xuất."}</p>}
              </div>;
            })}
            <span className="absolute bottom-5 right-8 select-none text-[11px] text-slate-400">{index + 1}</span>
          </div>
        </div>)}
      </div>
    </div>
    <footer className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <Button size="sm" variant="ghost" onClick={onTogglePanel}>{panelOpen ? <PanelRightClose className="mr-1 size-4" /> : <PanelRightOpen className="mr-1 size-4" />}<span className="hidden sm:inline">Dữ liệu rà soát</span></Button>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <Button size="icon" variant="ghost" aria-label="Thu nhỏ" disabled={zoom <= 25} onClick={() => setZoom(z => Math.max(25, z - 10))}><Minus className="size-4" /></Button>
        <input aria-label="Thu phóng tài liệu" type="range" min={25} max={200} step={1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-20 accent-sky-600 sm:w-28" />
        <Button size="icon" variant="ghost" aria-label="Phóng to" disabled={zoom >= 200} onClick={() => setZoom(z => Math.min(200, z + 10))}><Plus className="size-4" /></Button>
        <button className="w-12 rounded py-1 tabular-nums hover:bg-slate-100" title="Đặt lại 100%" onClick={() => setZoom(100)}>{zoom}%</button>
        <Button size="icon" variant="ghost" aria-label="Vừa chiều rộng" onClick={() => setZoom(Math.max(25, Math.min(200, Math.floor(((viewport.current?.clientWidth || WIDTH) - 64) / WIDTH * 100))))}><Maximize className="size-4" /></Button>
        <div className="ml-1 flex items-center gap-1 border-l pl-2" title="Trang soạn thảo được chia theo hiển thị, có thể khác số trang PDF/Word">
          <Button size="icon" variant="ghost" aria-label="Trang trước" disabled={selectedPage <= 1} onClick={() => navigate(selectedPage - 1)}><ChevronLeft className="size-4" /></Button>
          <label className="flex items-center gap-2">Trang<select aria-label="Chọn trang soạn thảo" value={selectedPage} onChange={e => navigate(Number(e.target.value))} className="rounded border-0 bg-transparent py-1 text-xs"><option value={selectedPage}>{selectedPage} / {pageCount}</option>{Array.from({ length: pageCount }, (_, i) => i + 1).filter(n => n !== selectedPage).map(n => <option key={n} value={n}>{n} / {pageCount}</option>)}</select></label>
          <Button size="icon" variant="ghost" aria-label="Trang sau" disabled={selectedPage >= pageCount} onClick={() => navigate(selectedPage + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </footer>
  </section>;
}
