"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editorDraftApi, type DraftSummary, type RevisionSummary } from "@/hooks/use-editor-server-draft";
import { getApiErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";

export function EditorDraftsDialog({ mode, documentId, onClose, onOpen, onUseTemplate, canManage = false }: { mode: "list" | "history" | "templates" | null; documentId?: string; onClose: () => void; onOpen: (id: string, revision?: number) => void; onUseTemplate?: (id: string) => void; canManage?: boolean }) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<(DraftSummary | RevisionSummary)[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [archive, setArchive] = useState<DraftSummary | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = mode === "history" && documentId ? await editorDraftApi.history(documentId, page) : await editorDraftApi.list(page, query, mode === "templates");
        if (!cancelled) { setItems(result.items); setPages(result.totalPages); }
      } catch (cause) { if (!cancelled) setError(getApiErrorMessage(cause, "Không tải được danh sách tài liệu.")); }
      finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, page, query, documentId, reload]);
  const date = (value: string) => new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString("vi-VN");
  return <><Dialog open={!!mode} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{mode === "history" ? "Lịch sử phiên bản tài liệu" : mode === "templates" ? "Thư viện mẫu văn bản" : "Tài liệu của tôi trên server"}</DialogTitle><DialogDescription>{mode === "history" ? "Khôi phục sẽ lưu nội dung cũ thành phiên bản mới, không xóa lịch sử." : mode === "templates" ? "Mẫu dùng chung trong tenant. Dùng mẫu tạo bản riêng; sửa mẫu không thay các tài liệu đã tạo trước đó." : "Chỉ hiển thị tài liệu thuộc tài khoản và tenant hiện tại."}</DialogDescription></DialogHeader>
    {mode !== "history" && <Input aria-label="Tìm tài liệu" placeholder="Tìm tên tài liệu..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />}
    {error ? <p role="alert" className="text-destructive">{error}</p> : loading ? <p role="status">Đang tải...</p> : items.length === 0 ? <p>Chưa có tài liệu.</p> : items.map(item => <div key={"id" in item ? item.id : item.revision} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate font-medium">{item.title}</p><p className="text-xs text-muted-foreground">v{item.revision} · {date("updatedAtUtc" in item ? item.updatedAtUtc : item.createdAtUtc)}</p></div><div className="flex flex-wrap gap-2">{mode === "templates" && "id" in item ? <><Button size="sm" onClick={() => onUseTemplate?.(item.id)}>Dùng mẫu</Button>{canManage && <><Button size="sm" variant="outline" onClick={() => onOpen(item.id)}>Sửa mẫu</Button><Button size="sm" variant="ghost" onClick={() => setArchive(item)}>Ngừng dùng</Button></>}</> : <Button size="sm" variant="outline" onClick={() => onOpen("id" in item ? item.id : documentId!, "id" in item ? undefined : item.revision)}>{mode === "history" ? "Khôi phục" : "Mở"}</Button>}</div></div>)}
    <div className="flex justify-end items-center gap-3"><Button variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Trước</Button><span>{page}/{pages}</span><Button variant="ghost" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>Sau</Button></div>
  </DialogContent></Dialog><ConfirmDialog isOpen={!!archive} onClose={() => !archiving && setArchive(null)} title="Ngừng sử dụng mẫu?" description="Mẫu sẽ ẩn khỏi thư viện. Các tài liệu đã tạo từ mẫu vẫn được giữ nguyên." confirmText="Ngừng dùng" isLoading={archiving} onConfirm={() => { if (!archive) return; setArchiving(true); void editorDraftApi.archive(archive.id, archive.revision).then(() => { setArchive(null); setReload(n => n + 1); setPage(1); }).catch(e => setError(getApiErrorMessage(e, "Không ngừng dùng được mẫu."))).finally(() => setArchiving(false)); }} /></>;
}
