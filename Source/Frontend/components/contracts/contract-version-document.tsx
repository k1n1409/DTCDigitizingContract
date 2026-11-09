"use client";
import { useEffect, useState } from "react";
import { FileCheck2, RefreshCw } from "lucide-react";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";

type State = { documentMode: number; isLocked: boolean; matchesBusinessData: boolean | null; pin: { editorDocumentId: string; editorRevision: number; title: string; docxHash: string; boundAtUtc: string } | null };
export function ContractVersionDocument({ contractId, versionId, refreshKey }: { contractId: number; versionId: number; refreshKey: string }) {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void axiosClient.get<unknown, State>(`/api/contracts/${contractId}/versions/${versionId}/editor-document`).then(result => { if (active) { setData(result); setError(""); } }).catch(e => { if (active) setError(getApiErrorMessage(e, "Không tải được thông tin tài liệu chính thức.")); });
    return () => { active = false; };
  }, [contractId, versionId, refreshKey, reload]);
  if (!error && (!data || data.documentMode === 0)) return null;
  return <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-5 text-primary" />Tài liệu chính thức của version hợp đồng</h2><Button size="icon" variant="outline" aria-label="Tải lại trạng thái tài liệu" onClick={() => setReload(n => n + 1)}><RefreshCw className="size-4" /></Button></div>{error ? <p className="text-destructive">{error}</p> : data?.pin ? <><p>{data.pin.title} · Bản soạn v{data.pin.editorRevision}</p><p className="text-sm text-muted-foreground">{data.isLocked ? "Đã khóa khi gửi duyệt. Quy trình duyệt/ký sử dụng artifact Word/PDF đã lưu, không đọc lại bản nháp editor." : "Đã ghim độc lập. Xem hợp đồng PDF / tải hợp đồng sử dụng bản này; sửa editor không tự cập nhật hợp đồng."}</p><p className="break-all font-mono text-xs text-muted-foreground">SHA-256: {data.pin.docxHash}</p>{data.matchesBusinessData === false && <p className="font-medium text-destructive">Dữ liệu nghiệp vụ đã thay đổi. Rà soát trong editor và cập nhật tài liệu cho hợp đồng trước khi xuất hoặc gửi duyệt.</p>}</> : <p className="font-medium text-destructive">Version mới chưa có tài liệu chính thức. Mở bản soạn, rà soát và chọn “Cập nhật tài liệu cho hợp đồng đã có” để ghim lại.</p>}</section>;
}
