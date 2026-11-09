"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readWordTerms, type WordTerm } from "@/lib/word-term-import";

export function WordTermImportDialog({ content, bindings, existingCodes, onClose, onImport }: {
  content: string; bindings: Record<string, string>; existingCodes: string[];
  onClose: () => void; onImport: (terms: WordTerm[]) => void;
}) {
  const terms = useMemo(() => readWordTerms(content, bindings), [content, bindings]);
  const existing = new Set(existingCodes.map(code => code.trim().toUpperCase()));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const picked = terms.filter(term => selected.has(term.key) && !existing.has(term.code));
  const selectedCodes = new Set(picked.map(term => term.code));
  const available = terms.filter(term => !existing.has(term.code));
  const codeCounts = new Map<string, number>();
  for (const term of available) codeCounts.set(term.code, (codeCounts.get(term.code) ?? 0) + 1);
  const unique = available.filter(term => codeCounts.get(term.code) === 1 && term.title.length <= 500);
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lấy điều khoản từ Word</DialogTitle>
          <DialogDescription>Chọn các mục cần thêm. Nội dung được sao sang hồ sơ để rà soát; không ghi đè điều khoản hiện có hoặc thay đổi bản Word.</DialogDescription>
        </DialogHeader>
        {!terms.length ? <p className="rounded-xl border bg-muted/40 p-4 text-sm">Không tìm thấy tiêu đề điều khoản rõ ràng. Thử đặt tiêu đề thành một đoạn riêng, ví dụ “Điều 1. Phạm vi công việc”, hoặc tiếp tục nhập thủ công.</p> : <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!unique.length} onClick={() => setSelected(new Set(unique.map(term => term.key)))}>Chọn các mục không trùng</Button>
            <Button type="button" size="sm" variant="ghost" disabled={!selected.size} onClick={() => setSelected(new Set())}>Bỏ chọn</Button>
            <span className="text-sm text-muted-foreground">{picked.length}/{terms.length} mục đã chọn</span>
          </div>
          <div className="min-h-0 space-y-3 overflow-y-auto p-1">
            {terms.map(term => {
              const checked = selected.has(term.key);
              const duplicate = existing.has(term.code) || (!checked && selectedCodes.has(term.code));
              return <section key={term.key} className="space-y-2 rounded-xl border p-3">
                <label className="flex items-start gap-2 text-sm font-semibold">
                  <input type="checkbox" className="mt-1" checked={checked} disabled={duplicate || term.title.length > 500} onChange={event => {
                    const next = event.target.checked;
                    setSelected(current => { const updated = new Set(current); if (next) updated.add(term.key); else updated.delete(term.key); return updated; });
                  }} />
                  <span className="min-w-0 break-words">{term.title}</span>
                </label>
                {duplicate && <p className="text-xs text-muted-foreground">Số điều đã có hoặc trùng mục đang chọn.</p>}
                {term.title.length > 500 && <p className="text-xs text-destructive">Tiêu đề vượt 500 ký tự. Hãy rút gọn trong Word hoặc nhập thủ công.</p>}
                {term.needsReview && <p className="text-xs text-amber-700 dark:text-amber-300">Cần đối chiếu bản Word: nội dung có thể trống, còn trường chưa điền hoặc có khối chỉ xem chưa được lấy.</p>}
                <details className="rounded-lg bg-muted/40 p-2 text-sm">
                  <summary className="cursor-pointer">Xem nội dung</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words">{term.preview || "Không có nội dung đọc được."}</p>
                </details>
              </section>;
            })}
          </div>
          <p className="text-xs text-muted-foreground">Sau khi thêm, bổ sung bản tiếng Anh nếu hợp đồng song ngữ. Nếu có điều khoản thanh toán, chọn loại Thanh toán và nhập các đợt trong bộ soạn điều khoản.</p>
        </>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
          <Button type="button" disabled={!picked.length || picked.length !== selectedCodes.size || picked.some(term => term.title.length > 500)} onClick={() => onImport(picked)}>Thêm điều khoản ({picked.length})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
