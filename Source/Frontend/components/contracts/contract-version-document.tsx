"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck2, FilePenLine, RefreshCw, TriangleAlert } from "lucide-react";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";

type Change = {
  group: string;
  subject: string;
  field: string;
  before: string | null;
  after: string | null;
  needsWordReview: boolean;
};

export type EditorBindingState = {
  documentMode: number;
  isLocked: boolean;
  matchesBusinessData: boolean | null;
  currentBusinessHash: string | null;
  editableDocumentId: string | null;
  difference: { total: number; changes: Change[] } | null;
  pin: { editorDocumentId: string; editorRevision: number; title: string; docxHash: string; boundAtUtc: string } | null;
};

export const editorBindingUrl = (contractId: number, versionId: number) =>
  `/api/contracts/${contractId}/versions/${versionId}/editor-document`;

export function WordBindingDifferences({ data }: { data: EditorBindingState }) {
  if (data.matchesBusinessData !== false) return null;
  return (
    <div className="space-y-2">
      {!data.difference ? (
        <p className="text-sm text-muted-foreground">Bản Word này được gắn trước khi có đối chiếu chi tiết. Hãy kiểm tra toàn bộ bản Word trước khi gắn lại.</p>
      ) : data.difference.total === 0 ? (
        <p className="text-sm text-muted-foreground">Có thay đổi ngoài các trường hiển thị chi tiết. Hãy kiểm tra lại toàn bộ nội dung Word trước khi gắn lại.</p>
      ) : (
        <details className="rounded-lg border bg-background p-3" open>
          <summary className="cursor-pointer font-medium">Xem {data.difference.total} thay đổi nhận diện được kể từ khi gắn Word</summary>
          <ul className="mt-2 max-h-72 divide-y overflow-y-auto">
            {data.difference.changes.map((change, index) => (
              <li key={index} className="space-y-1 py-2 text-sm [overflow-wrap:anywhere]">
                <div className="text-xs text-muted-foreground">{change.group} · {change.subject}</div>
                <p className="font-medium">{change.field}</p>
                {change.before !== null || change.after !== null ? (
                  <div className="grid gap-1 text-sm sm:grid-cols-2">
                    <span><span className="text-muted-foreground">Lúc gắn: </span>{change.before ?? "—"}</span>
                    <span><span className="text-muted-foreground">Hiện tại: </span>{change.after ?? "—"}</span>
                  </div>
                ) : <p>{change.needsWordReview ? "Đã thay đổi · Cần đối chiếu trực tiếp trong Word." : "Đã thay đổi."}</p>}
              </li>
            ))}
          </ul>
          {data.difference.total > data.difference.changes.length && <p className="mt-2 text-xs text-muted-foreground">Đang hiển thị {data.difference.changes.length} thay đổi đầu tiên. Kiểm tra toàn bộ bản Word trước khi gắn lại.</p>}
        </details>
      )}
    </div>
  );
}

export function ContractVersionDocument({ contractId, versionId, refreshKey, canBind, onReviewRequired }: { contractId: number; versionId: number; refreshKey: string; canBind: boolean; onReviewRequired: (key: string | null) => void }) {
  const [data, setData] = useState<EditorBindingState | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void axiosClient.get<unknown, EditorBindingState>(editorBindingUrl(contractId, versionId)).then(result => {
      if (active) {
        setData(result);
        setError("");
        onReviewRequired(result.documentMode === 1 && !result.isLocked && (!result.pin || result.matchesBusinessData === false) ? refreshKey : null);
      }
    }).catch(e => {
      if (active) { setData(null); setError(getApiErrorMessage(e, "Không tải được thông tin tài liệu chính thức.")); }
    });
    return () => { active = false; };
  }, [contractId, versionId, refreshKey, reload, onReviewRequired]);

  if (!error && (!data || data.documentMode === 0)) return null;
  const needsReview = data && !data.isLocked && (data.matchesBusinessData === false || !data.pin);
  const editorParams = new URLSearchParams({ bindContract: String(contractId), bindVersion: String(versionId) });
  if (data?.editableDocumentId) editorParams.set("document", data.editableDocumentId);

  return (
    <section id="official-word-review" tabIndex={-1} className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-5 text-primary" />Tài liệu Word chính thức</h2>
        <Button size="icon" variant="outline" aria-label="Tải lại trạng thái tài liệu" onClick={() => setReload(n => n + 1)}><RefreshCw className="size-4" /></Button>
      </div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {data?.pin && (
        <div className="space-y-1">
          <p className="font-medium">{data.pin.title} · Bản soạn v{data.pin.editorRevision}</p>
          <p className="text-sm text-muted-foreground">{data.isLocked ? "Đã khóa. Bản dùng để duyệt/ký không thay đổi." : "Thay đổi trong trình soạn thảo chỉ áp dụng cho hợp đồng sau khi bạn gắn lại bản Word."}</p>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Mã kiểm tra tài liệu</summary><p className="break-all font-mono">SHA-256: {data.pin.docxHash}</p></details>
        </div>
      )}
      {needsReview && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-background p-3">
          <p className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4 shrink-0 text-amber-600" />{data.pin ? "Dữ liệu hợp đồng đã thay đổi sau khi gắn Word" : "Phiên bản này chưa có bản Word chính thức"}</p>
          <p className="text-sm text-muted-foreground">Đối chiếu bản Word với dữ liệu hợp đồng và xác nhận bản cập nhật trước khi gửi duyệt.</p>
          <WordBindingDifferences data={data} />
          {canBind && data.currentBusinessHash && (
            <>
              <Button asChild><Link href={`/contract-editor?${editorParams}`}><FilePenLine className="size-4" />Rà soát và cập nhật bản Word</Link></Button>
              {!data.editableDocumentId && <p className="text-sm text-muted-foreground">Nếu không mở được bản soạn ban đầu, hãy chọn bản Word bạn có quyền chỉnh sửa trong thư viện.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
