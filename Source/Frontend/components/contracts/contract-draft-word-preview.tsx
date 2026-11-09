"use client";

import { useState } from "react";
import { CircleCheck, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPdfPreview } from "@/components/contracts/document-pdf-preview";
import type { EditorStored } from "@/hooks/use-editor-server-draft";
import { cn } from "@/lib/utils";

export function ContractDraftWordPreview({ source, reviewed, onReview }: {
  source: EditorStored; reviewed: boolean; onReview: (value: boolean) => void;
}) {
  const [showPdf, setShowPdf] = useState(false);
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-semibold"><FileText aria-hidden className="size-4 text-primary" /> Bản Word dùng cho hợp đồng</h3>
        <p className="mt-1 break-words text-sm text-muted-foreground">{source.title} · Phiên bản {source.revision}</p>
      </div>
      <Button type="button" variant="outline" aria-expanded={showPdf} aria-controls="draft-word-pdf" onClick={() => setShowPdf(open => !open)}>
        <Eye className="size-4" />{showPdf ? "Ẩn bản xem trước" : "Xem trước PDF"}
      </Button>
    </div>
    <div id="draft-word-pdf" hidden={!showPdf}>
      {showPdf && <div className="flex h-[min(70dvh,44rem)] min-h-56 min-w-0 flex-col overflow-hidden rounded-xl border">
        <DocumentPdfPreview kind={source.isTemplate ? "template" : "editor"} id={source.id} revision={source.revision} />
      </div>}
    </div>
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors hover:bg-primary/5", reviewed ? "border-primary/45 bg-primary/5" : "border-border bg-muted/20")}>
      <input id="draft-word-review" type="checkbox" className="mt-0.5 size-5 shrink-0 rounded accent-primary" checked={reviewed} onChange={event => onReview(event.target.checked)} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Tôi đã đối chiếu và xác nhận dùng bản Word này</span>
        <span className="mt-0.5 block text-muted-foreground">Kiểm tra đối tác, sản phẩm, điều khoản và lịch thanh toán trước khi lưu nháp.</span>
      </span>
      {reviewed && <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />}
    </label>
  </section>;
}
