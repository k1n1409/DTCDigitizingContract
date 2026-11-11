"use client";

import { useRef, useState } from "react";
import { CircleCheck, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPdfPreviewDialog } from "@/components/contracts/document-pdf-preview-dialog";
import type { EditorStored } from "@/hooks/use-editor-server-draft";
import { cn } from "@/lib/utils";

export function ContractDraftWordPreview({ source, reviewed, onReview }: {
  source: EditorStored; reviewed: boolean; onReview: (value: boolean) => void;
}) {
  const [showPdf, setShowPdf] = useState(false);
  const pdfButtonRef = useRef<HTMLButtonElement>(null);
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-semibold"><FileText aria-hidden className="size-4 text-primary" /> Bản Word dùng cho hợp đồng</h3>
        <p className="mt-1 break-words text-sm text-muted-foreground">{source.title} · Phiên bản {source.revision}</p>
      </div>
      <Button ref={pdfButtonRef} type="button" variant="outline" aria-haspopup="dialog" aria-expanded={showPdf} onClick={() => setShowPdf(true)}>
        <Eye aria-hidden className="size-4" /> Xem trước PDF
      </Button>
    </div>
    <DocumentPdfPreviewDialog preview={showPdf ? { kind: source.isTemplate ? "template" : "editor", id: source.id, revision: source.revision, title: source.title } : null}
      onClose={() => setShowPdf(false)} returnFocusRef={pdfButtonRef} closeLabel="Quay lại rà soát" />
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
