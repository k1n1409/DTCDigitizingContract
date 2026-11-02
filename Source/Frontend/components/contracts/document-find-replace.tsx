"use client";

import { useId, useRef, useState } from "react";
import { Search, ChevronUp, ChevronDown, X, ArrowRightLeft, Replace, ReplaceAll, Info, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type FindOptions = { query: string; replacement: string; matchCase: boolean };
export function DocumentFindReplace({ value, onChange, count, index, onNavigate, onReplace, disabled, note, compact = false }: {
  value: FindOptions; onChange: (value: FindOptions) => void; count: number; index: number;
  onNavigate: (direction: number) => void; onReplace: (all: boolean) => void; disabled?: boolean; note?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const hasQuery = value.query.length > 0;
  const resultLabel = count ? `${Math.min(index + 1, count)} / ${count} kết quả` : hasQuery ? "Không tìm thấy kết quả" : "Bắt đầu bằng một từ hoặc cụm từ";
  const form = <div className="space-y-5">
    <section className="space-y-3" aria-label="Tìm nội dung">
      <label htmlFor={`${id}-query`} className="flex items-center gap-2 font-semibold"><span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">1</span>Tìm nội dung</label>
      <div className="relative rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-4 size-5 text-primary" />
        <Input ref={searchRef} id={`${id}-query`} autoFocus aria-label="Nội dung cần tìm" placeholder="Nhập từ hoặc cụm từ cần tìm…" showControls={false} maxLength={200} value={value.query} onChange={e => onChange({ ...value, query: e.target.value })} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onNavigate(e.shiftKey ? -1 : 1); } }} className="h-13 rounded-xl border-2 border-primary/60 bg-background pl-12 pr-12 text-base focus-visible:border-primary" />
        {hasQuery && <Button size="icon" variant="ghost" className="absolute right-2 top-2 size-9 rounded-lg" aria-label="Xóa nội dung tìm kiếm" onClick={() => { onChange({ ...value, query: "" }); searchRef.current?.focus(); }}><X className="size-4" /></Button>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-primary/25 bg-primary/[0.03] px-3 py-2">
        <span role="status" aria-live="polite" className={`flex items-center gap-2 text-sm font-medium ${count ? "text-primary" : hasQuery ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}><span aria-hidden className={`size-2 rounded-full ${count ? "bg-primary" : hasQuery ? "bg-amber-500" : "bg-muted-foreground/40"}`} />{resultLabel}</span>
        <div className="flex gap-1"><Button size="sm" variant="outline" className="h-9 gap-1 rounded-lg border-primary/40 bg-background" aria-label="Kết quả trước" title="Shift + Enter" disabled={!count} onClick={() => onNavigate(-1)}><ChevronUp className="size-4" />Trước</Button><Button size="sm" variant="outline" className="h-9 gap-1 rounded-lg border-primary/40 bg-background" aria-label="Kết quả tiếp theo" title="Enter" disabled={!count} onClick={() => onNavigate(1)}>Sau<ChevronDown className="size-4" /></Button></div>
      </div>
      <div className="flex items-center justify-between gap-3 px-1"><label htmlFor={`${id}-case`} className="cursor-pointer text-sm text-muted-foreground">Phân biệt chữ hoa / chữ thường</label><Switch id={`${id}-case`} aria-label="Phân biệt hoa/thường" checked={value.matchCase} onCheckedChange={matchCase => onChange({ ...value, matchCase })} /></div>
    </section>
    <section className="space-y-3 border-t border-primary/25 pt-5" aria-label="Thay thế nội dung">
      <label htmlFor={`${id}-replacement`} className="flex items-center gap-2 font-semibold"><span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">2</span>Thay bằng</label>
      <div className="relative"><ArrowRightLeft aria-hidden className="pointer-events-none absolute left-4 top-4 size-5 text-muted-foreground" /><Input id={`${id}-replacement`} aria-label="Nội dung thay thế" placeholder="Nhập nội dung mới…" showControls={false} maxLength={2000} value={value.replacement} onChange={e => onChange({ ...value, replacement: e.target.value })} className="h-13 rounded-xl border-2 border-primary/50 bg-background pl-12 pr-4 text-base" /></div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />Để trống ô này nếu muốn xóa nội dung tìm được.</p>
      <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" className="h-11 gap-2 rounded-xl border-primary/50 bg-background" disabled={disabled || !count} onClick={() => onReplace(false)}><Replace className="size-4" />Thay vị trí này</Button><Button className="h-11 gap-2 rounded-xl shadow-sm" disabled={disabled || !count} onClick={() => onReplace(true)}><ReplaceAll className="size-4" />Thay tất cả<span className="rounded-md bg-white/20 px-1.5 py-0.5 text-xs tabular-nums">({count})</span></Button></div>
    </section>
    <div className="space-y-3 border-t border-primary/25 pt-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Undo2 className="size-4 shrink-0" />Sửa nhầm? Hoàn tác bằng <kbd className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-sans text-xs">Ctrl + Z</kbd></p><details className="rounded-xl border border-primary/25 bg-muted/25 px-3 py-2 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">Phạm vi tìm kiếm</summary><p className="pt-2 leading-relaxed">{note || "Chỉ thay văn bản thường, không thay các trường dữ liệu liên kết. Dùng Enter / Shift + Enter để chuyển kết quả."}</p></details></div>
  </div>;
  if (compact) return <><Button size="sm" variant="ghost" className="gap-2 rounded-lg" onClick={() => setOpen(true)}><Search className="size-4" />Tìm & thay thế</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="document-workspace-ui max-h-[90dvh] gap-5 overflow-y-auto rounded-2xl border-2 border-primary/35 p-5 sm:max-w-xl sm:p-6"><DialogHeader className="pr-6 text-left"><div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Search className="size-5" /></span><div><DialogTitle>Tìm & thay thế</DialogTitle><DialogDescription className="mt-1">Tìm nhanh, sửa đúng vị trí trong tài liệu.</DialogDescription></div></div></DialogHeader>{form}</DialogContent></Dialog></>;
  return <div className="document-workspace-ui shrink-0 border-b bg-card px-4 py-2"><div className="flex items-center justify-between"><Button size="sm" variant={open ? "secondary" : "outline"} className="gap-2 rounded-full" aria-expanded={open} onClick={() => setOpen(v => !v)}><Search className="size-4" />Tìm & thay thế</Button>{open && <Button size="icon" variant="ghost" aria-label="Đóng tìm kiếm" onClick={() => setOpen(false)}><X className="size-4" /></Button>}</div>{open && <div className="mx-auto mt-3 max-w-3xl rounded-2xl border-2 border-primary/35 bg-background p-4 sm:p-5">{form}</div>}</div>;
}
