"use client";

import type { RefObject } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { DocumentPdfPreview } from "@/components/contracts/document-pdf-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LibraryKind } from "@/lib/document-pdf";

export type PdfPreviewDocument = {
  kind: LibraryKind;
  id: string;
  revision: number;
  title: string;
};

export function DocumentPdfPreviewDialog({ preview, onClose, returnFocusRef, closeLabel }: {
  preview: PdfPreviewDocument | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  closeLabel: string;
}) {
  return (
    <Dialog open={preview !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="document-workspace-ui flex h-[90dvh] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-3rem)] sm:max-w-6xl"
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocusRef.current?.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-b p-3 text-left sm:p-4">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <FileText aria-hidden className="size-4 shrink-0 text-primary" /> Xem trước PDF
            </DialogTitle>
            <DialogDescription className="break-words">{preview?.title} · Phiên bản {preview?.revision}</DialogDescription>
          </div>
          <Button type="button" size="sm" onClick={onClose}>
            <ArrowLeft aria-hidden className="size-4" /> {closeLabel}
          </Button>
        </DialogHeader>
        {preview && <DocumentPdfPreview kind={preview.kind} id={preview.id} revision={preview.revision} />}
      </DialogContent>
    </Dialog>
  );
}
