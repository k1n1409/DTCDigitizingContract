"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Columns2, FileText, GitCompareArrows, RotateCcw, Rows3 } from "lucide-react";
import { reviewedBlockText, type ReviewField } from "@/lib/imported-contract-editing";
import { textDifference } from "@/lib/imported-review-tools";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DocumentPdfPreview } from "@/components/contracts/document-pdf-preview";
import { usePreviewScrollReturn } from "@/hooks/use-preview-scroll-return";
export function ImportedReviewComparison({ id, revision, blocks, fields, dirty, readOnly, onRestore, onFocus, onBack, backLabel = "Tiếp tục chỉnh sửa" }: {
  id: string; revision: number; blocks: {id:string;text:string;context:string;editable:boolean}[]; fields: ReviewField[];
  dirty: boolean; readOnly: boolean;
  onRestore?: (blockId: string) => void;
  onFocus?: (blockId: string) => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const [pdf, setPdf] = useState(false), [onlyChanged, setOnlyChanged] = useState(true), [page, setPage] = useState(1);
  const [compact, setCompact] = useState(true);
  const filterId = useId();
  const allRows = useMemo(() => {
    const byBlock = new Map<string, ReviewField[]>();
    for (const field of fields) { const group = byBlock.get(field.blockId) || []; group.push(field); byBlock.set(field.blockId, group); }
    return blocks.filter(block => block.text).map(block => ({ ...block, after: reviewedBlockText(block.text, block.id, byBlock.get(block.id) || []) }));
  }, [blocks, fields]);
  const changedCount = allRows.filter(block => block.text !== block.after).length;
  const rows = onlyChanged ? allRows.filter(block => block.text !== block.after) : allRows;
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages), showingPdf = pdf && !dirty;
  const { viewportRef, capture } = usePreviewScrollReturn<HTMLDivElement>(showingPdf, id);
  const columns = { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" };
  useEffect(() => { if (page > pages) queueMicrotask(() => setPage(pages)); }, [page, pages]);
  return <section aria-label="Đối chiếu tài liệu" className="document-workspace-ui flex min-h-0 flex-1 flex-col bg-muted/30">
    <div className={`shrink-0 border-b bg-card ${compact ? "flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3" : "space-y-4 p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><GitCompareArrows aria-hidden className="size-5 text-primary" /><h2 className="font-semibold">Đối chiếu tài liệu</h2></div><span role="status" className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">{changedCount} đoạn thay đổi <span className="font-normal text-muted-foreground">/ {allRows.length} đoạn</span></span></div>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "min-w-[min(100%,560px)] flex-1" : ""}`}>
        <Button size="sm" variant={compact ? "secondary" : "outline"} className="gap-2 rounded-full" aria-pressed={compact} onClick={() => setCompact(value => !value)}><Rows3 className="size-4" />Hiển thị gọn</Button>
        <div role="group" aria-label="Chế độ đối chiếu" className="flex max-w-full flex-wrap gap-1 rounded-2xl border bg-muted/40 p-1">
          <Button variant={!showingPdf ? "default" : "outline"} aria-pressed={!showingPdf} className="h-auto min-h-10 gap-2 whitespace-normal rounded-xl px-4 py-2" onClick={() => setPdf(false)}>
            {showingPdf ? <><ArrowLeft aria-hidden className="size-4" /> Quay lại đối chiếu chữ</> : <><GitCompareArrows aria-hidden className="size-4" /> Đối chiếu thay đổi</>}
          </Button>
          <Button variant={showingPdf ? "default" : "ghost"} aria-pressed={showingPdf} className="h-auto min-h-10 gap-2 whitespace-normal rounded-xl px-4 py-2" disabled={dirty} title={dirty ? "Chờ lưu thay đổi trước khi xem hai bản PDF" : "Đặt PDF gốc cạnh PDF đã sửa"}
            onClick={() => { if (!showingPdf) { capture(); setPdf(true); } }}>
            <Columns2 aria-hidden className="size-4" /> Hai bản PDF đã lưu
          </Button>
        </div>
        {!showingPdf && <div className={`flex items-center gap-3 rounded-full border px-4 py-2 transition-colors ${onlyChanged ? "border-primary/40 bg-primary/5" : "bg-background"}`}><Checkbox id={filterId} className="size-5 shrink-0 rounded-full" checked={onlyChanged} onCheckedChange={checked => { setOnlyChanged(checked === true); setPage(1); }} /><Label htmlFor={filterId} className="cursor-pointer font-medium leading-relaxed">Chỉ đoạn đã sửa</Label></div>}
      </div>
      {!compact && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">{showingPdf ? <span>So sánh PDF gốc và bản đã lưu v{revision}. Mỗi khung có điều khiển trang và thu phóng riêng.</span> : <><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-400" />Nội dung gốc bị thay</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" />Nội dung mới</span>{onFocus && <span>Chọn «Mở trong tài liệu» để đến đúng đoạn.</span>}</>}</div>}
      {dirty && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">Đang hiển thị cả thay đổi chưa lưu. Chờ lưu xong để xem hai bản PDF.</p>}
    </div>
    {showingPdf ? <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4" style={columns}><div className="flex min-h-[450px] flex-col overflow-hidden rounded-2xl border bg-card"><h3 className="flex items-center gap-2 border-b p-3 font-semibold"><FileText className="size-4 text-muted-foreground" />PDF gốc <span className="ml-auto text-sm font-normal text-muted-foreground">Chỉ xem</span></h3><DocumentPdfPreview kind="imported" id={id} revision={revision} original /></div><div className="flex min-h-[450px] flex-col overflow-hidden rounded-2xl border border-primary/25 bg-card"><h3 className="flex items-center gap-2 border-b p-3 font-semibold"><FileText className="size-4 text-primary" />PDF đã sửa <span className="ml-auto text-sm font-normal text-muted-foreground">v{revision}</span></h3><DocumentPdfPreview kind="imported" id={id} revision={revision} /></div></div> : <>
      <div ref={viewportRef} aria-label="Danh sách đoạn đối chiếu" className={`min-h-0 flex-1 overflow-auto ${compact ? "space-y-3 p-3" : "space-y-4 p-4"}`}>
        {!rows.length && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-10 text-center sm:px-6 sm:py-12">
            {allRows.length ? <CheckCircle2 aria-hidden className="size-9 text-emerald-600 dark:text-emerald-400" /> : <FileText aria-hidden className="size-9 text-muted-foreground" />}
            <h3 className="font-semibold">{allRows.length ? "Chưa có đoạn nào thay đổi" : "Chưa có nội dung để đối chiếu"}</h3>
            <p className="max-w-lg text-sm text-muted-foreground">
              {allRows.length ? "Nội dung đang hiển thị giống bản gốc. Bạn vẫn có thể xem tất cả các đoạn cạnh nhau." : "Tài liệu này không có đoạn văn để so sánh."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {onBack && <Button type="button" onClick={onBack}><ArrowLeft aria-hidden className="size-4" />{backLabel}</Button>}
              {onlyChanged && allRows.length > 0 && <Button type="button" variant="outline" onClick={() => { setOnlyChanged(false); setPage(1); }}>Xem tất cả đoạn</Button>}
            </div>
          </div>
        )}
        {rows.slice((currentPage - 1) * 10, currentPage * 10).map(block => { const diff = textDifference(block.text, block.after), changed = block.text !== block.after;
          return <article key={block.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className={`flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-4 ${compact ? "py-2" : "py-3"}`}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="break-words font-semibold">{block.context}</h3>
                <span className="text-xs text-muted-foreground">{block.id}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${changed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{changed ? "Đã thay đổi" : "Không thay đổi"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onFocus && <Button type="button" size="sm" variant="outline" className="rounded-full text-primary" aria-label={`Mở trong tài liệu: ${block.context} ${block.id}`} onClick={() => onFocus(block.id)}>Mở trong tài liệu<ArrowUpRight aria-hidden className="size-4" /></Button>}
                {changed && onRestore && <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={readOnly} onClick={() => onRestore(block.id)}><RotateCcw aria-hidden className="size-4" />Khôi phục đoạn gốc</Button>}
              </div>
            </div>
            <div className={`grid ${compact ? "gap-3 p-3" : "gap-4 p-4"}`} style={columns}><div className={`min-w-0 rounded-xl border ${compact ? "p-3" : "p-4"} ${changed ? "border-rose-200 bg-rose-50/30" : "bg-muted/15"}`}><p className={`${compact ? "mb-1" : "mb-3"} flex items-center gap-2 text-sm font-semibold text-muted-foreground`}><FileText className="size-4" />Bản gốc</p><p className={`whitespace-pre-wrap break-words ${compact ? "leading-6" : "leading-7"}`}>{diff.prefix}{diff.removed && <del className="rounded bg-rose-100 px-0.5 text-rose-950 decoration-rose-500">{diff.removed}</del>}{diff.suffix}</p></div><div className={`min-w-0 rounded-xl border ${compact ? "p-3" : "p-4"} ${changed ? "border-emerald-200 bg-emerald-50/30" : "bg-muted/15"}`}><p className={`${compact ? "mb-1" : "mb-3"} flex items-center gap-2 text-sm font-semibold text-muted-foreground`}><FileText className="size-4" />Bản đang sửa</p><p className={`whitespace-pre-wrap break-words ${compact ? "leading-6" : "leading-7"}`}>{diff.prefix}{diff.added && <mark className="rounded bg-emerald-100 px-0.5 text-emerald-950">{diff.added}</mark>}{diff.suffix}{!block.after && <span className="italic text-muted-foreground">Đã xóa nội dung đoạn</span>}</p></div></div>
          </article>;
        })}
      </div>
      {rows.length > 0 && <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3"><p className="text-sm text-muted-foreground">Hiển thị {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, rows.length)} / {rows.length} đoạn</p>{pages > 1 && <div className="flex items-center gap-3"><Button size="icon" variant="outline" className="rounded-full" aria-label="Trang đối chiếu trước" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></Button><span className="text-sm tabular-nums">{currentPage}/{pages}</span><Button size="icon" variant="outline" className="rounded-full" aria-label="Trang đối chiếu sau" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></Button></div>}</footer>}
    </>}
  </section>;
}
