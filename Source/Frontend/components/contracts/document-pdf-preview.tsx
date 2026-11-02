"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning, Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth-store";
import { documentPdf, openPdf, type LibraryKind } from "@/lib/document-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

const thumbnails = new Map<string, string>();
let thumbnailOwner = "";

export function PdfThumbnail({ kind, id, revision, name }: { kind: LibraryKind; id: string; revision: number; name: string }) {
  const root = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false); const [failed, setFailed] = useState(false);
  const user = useAuthStore(s => s.user); const owner = `${user?.tenantId}:${user?.employeeId}`;
  useEffect(() => { const node = root.current; if (!node) return; const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "80px" }); observer.observe(node); return () => observer.disconnect(); }, []);
  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController(); let task: Awaited<ReturnType<typeof openPdf>> | undefined;
    void (async () => {
      try {
        if (thumbnailOwner !== owner) { thumbnails.clear(); thumbnailOwner = owner; }
        const key = `${owner}:${kind}:${id}:${revision}`;
        const cached = thumbnails.get(key);
        if (cached) {
          const image = new Image(); image.src = cached; await image.decode();
          const node = canvas.current; if (!node || abort.signal.aborted) return;
          node.width = image.width; node.height = image.height; node.getContext("2d")?.drawImage(image, 0, 0); return;
        }
        const bytes = await documentPdf(kind, id, revision, owner, abort.signal, "thumbnail"); if (abort.signal.aborted) return;
        task = await openPdf(bytes); const doc = await task.promise; const page = await doc.getPage(1);
        const node = canvas.current; if (!node || abort.signal.aborted) return;
        const viewport = page.getViewport({ scale: 260 / page.getViewport({ scale: 1 }).width });
        node.width = Math.ceil(viewport.width); node.height = Math.ceil(viewport.height);
        await page.render({ canvas: node, viewport }).promise;
        if (!abort.signal.aborted && thumbnailOwner === owner) {
          while (thumbnails.size >= 16) thumbnails.delete(thumbnails.keys().next().value!);
          thumbnails.set(key, node.toDataURL("image/webp", 0.75));
        }
      } catch { if (!abort.signal.aborted) setFailed(true); }
      finally { await task?.destroy(); }
    })();
    return () => { abort.abort(); void task?.destroy(); };
  }, [visible, kind, id, revision, owner]);
  return <div ref={root} className="flex h-full w-full items-center justify-center overflow-hidden bg-white">{failed ? <span className="flex h-full items-center gap-1 p-2 text-[10px] text-muted-foreground"><FileWarning className="size-4" />Chưa có preview</span> : <canvas ref={canvas} aria-label={`Trang đầu ${name}`} className="h-full w-auto max-w-full object-contain" />}</div>;
}

export function DocumentPdfPreview({ kind, id, revision }: { kind: LibraryKind; id: string; revision: number }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null); const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null); const user = useAuthStore(s => s.user); const owner = `${user?.tenantId}:${user?.employeeId}`;
  useEffect(() => {
    const abort = new AbortController(); let task: Awaited<ReturnType<typeof openPdf>> | undefined;
    const run = async () => {
      setLoading(true); setError(""); setDocument(null); setPage(1);
      try { const bytes = await documentPdf(kind, id, revision, owner, abort.signal); if (abort.signal.aborted) return; task = await openPdf(bytes); const pdf = await task.promise; if (!abort.signal.aborted) setDocument(pdf); }
      catch { if (!abort.signal.aborted) setError("Không dựng được bản PDF. Kiểm tra LibreOffice/quyền truy cập rồi thử lại."); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    };
    void run(); return () => { abort.abort(); void task?.destroy(); };
  }, [kind, id, revision, owner, retry]);
  useEffect(() => {
    if (!document) return; let cancelled = false; let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    void (async () => {
      try { const pdfPage = await document.getPage(page); const node = canvas.current; if (!node || cancelled) return;
        const viewport = pdfPage.getViewport({ scale: zoom / 100 * 96 / 72 }); const ratio = Math.min(window.devicePixelRatio || 1, 2);
        node.width = Math.ceil(viewport.width * ratio); node.height = Math.ceil(viewport.height * ratio); node.style.width = `${viewport.width}px`; node.style.height = `${viewport.height}px`;
        render = pdfPage.render({ canvas: node, viewport, transform: [ratio, 0, 0, ratio, 0, 0] }); await render.promise;
      } catch { if (!cancelled) setError("Không hiển thị được trang PDF này."); }
    })(); return () => { cancelled = true; render?.cancel(); };
  }, [document, page, zoom]);
  return <section className="flex min-h-0 flex-1 flex-col bg-slate-100">
    <div className="min-h-0 flex-1 overflow-auto p-6">{loading ? <p role="status" className="text-center text-sm text-muted-foreground">Đang tạo PDF từ phiên bản đã lưu v{revision}...</p> : error ? <div role="alert" className="space-y-3 text-center text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}><RefreshCw className="mr-2 size-4" />Thử lại</Button></div> : <canvas ref={canvas} className="mx-auto block bg-white shadow-lg" aria-label={`Bản PDF thật, trang ${page}`} />}</div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-card px-3 py-2 text-xs"><span>PDF thực tế · v{revision} · Chỉ xem</span><div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label="Thu nhỏ PDF" onClick={() => setZoom(z => Math.max(25, z - 10))}><Minus className="size-4" /></Button><button onClick={() => setZoom(100)}>{zoom}%</button><Button size="icon" variant="ghost" aria-label="Phóng to PDF" onClick={() => setZoom(z => Math.min(200, z + 10))}><Plus className="size-4" /></Button><Button size="icon" variant="ghost" disabled={!document || page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button><span>Trang {document ? page : "–"}/{document?.numPages ?? "–"}</span><Button size="icon" variant="ghost" disabled={!document || page >= document.numPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button></div></footer>
  </section>;
}
