"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contractApi, ContractType, ContractStatus, type ContractListItemResponse, type ContractDetailResponse } from "@/services/contract-api";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/components/ui/sonner";
import { editorBindingUrl, WordBindingDifferences, type EditorBindingState } from "./contract-version-document";

export type EditorBindingTarget = { contractId: number; versionId: number };
const reviewError = (e: unknown) => axios.isAxiosError(e)
  ? getApiErrorMessage(e, "Không tải được thông tin để rà soát.")
  : e instanceof Error ? e.message : "Không tải được thông tin để rà soát.";

export function EditorContractBindingDialog({ document, target, onClose, onBound }: { document: { id: string; revision: number } | null; target?: EditorBindingTarget | null; onClose: () => void; onBound?: (target: EditorBindingTarget) => void }) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState<ContractListItemResponse[]>([]);
  const [selected, setSelected] = useState<ContractDetailResponse | null>(null);
  const [reviewState, setReviewState] = useState<EditorBindingState | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!document || target) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      void contractApi.getList({ keyword, page, pageSize: 10, contractType: ContractType.SoftwareSupply }).then(result => {
        if (active) { setItems(result.items); setTotalPages(result.totalPages); }
      }).catch(e => { if (active) setError(getApiErrorMessage(e, "Không tải được hợp đồng.")); }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [document, keyword, page, target]);

  const loadReview = async (id: number, expectedVersionId?: number) => {
    const detail = await contractApi.getDetail(id);
    const versionId = detail.currentVersion.versionId;
    if ((expectedVersionId && versionId !== expectedVersionId) || ![ContractStatus.Draft, ContractStatus.Negotiating].includes(detail.status))
      throw new Error("Hợp đồng không còn ở phiên bản có thể cập nhật. Quay về chi tiết hợp đồng rồi thử lại.");
    const state = await axiosClient.get<unknown, EditorBindingState>(editorBindingUrl(id, versionId), { params: { review: true } });
    if (state.isLocked || !state.currentBusinessHash)
      throw new Error("Không thể cập nhật Word cho phiên bản này. Kiểm tra quyền hoặc tải lại hợp đồng.");
    return { detail, state };
  };

  useEffect(() => {
    if (!document || !target) return;
    let active = true;
    setLoading(true);
    void loadReview(target.contractId, target.versionId).then(({ detail, state }) => {
      if (active) { setSelected(detail); setReviewState(state); }
    }).catch(e => {
      if (active) setError(reviewError(e));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [document, target]);

  const choose = async (id: number) => {
    setLoading(true); setError(""); setSelected(null); setReviewState(null); setReviewed(false);
    try {
      const { detail, state } = await loadReview(id);
      setSelected(detail); setReviewState(state);
    }
    catch (e) { setError(reviewError(e)); }
    finally { setLoading(false); }
  };
  const bind = async () => {
    if (!document || !selected || !reviewed || !reviewState?.currentBusinessHash) return;
    setSaving(true); setError("");
    try {
      await axiosClient.post(editorBindingUrl(selected.contractId, selected.currentVersion.versionId), {
        documentId: document.id, revision: document.revision, reviewed,
        reviewedBusinessHash: reviewState.currentBusinessHash,
        contractRowVersion: selected.rowVersion, versionRowVersion: selected.currentVersion.rowVersion,
      });
      toast.success("Đã ghim bản Word này vào version hợp đồng. Bản gửi duyệt sẽ dùng đúng tài liệu đã ghim.");
      onBound?.({ contractId: selected.contractId, versionId: selected.currentVersion.versionId });
      onClose();
    } catch (e) { setReviewed(false); setError(getApiErrorMessage(e, "Chưa ghim được. Tải lại chi tiết hợp đồng và rà soát trước khi thử lại.")); }
    finally { setSaving(false); }
  };
  return <Dialog open={!!document} onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />Cập nhật tài liệu cho hợp đồng đã có</DialogTitle><DialogDescription>Ghim bản Word đã lưu v{document?.revision} vào version hiện hành. Không tạo thêm hợp đồng. Những lần sửa tiếp trong editor không tự thay bản đã ghim.</DialogDescription></DialogHeader>
    {!target && <><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-10" placeholder="Tìm mã hoặc tên hợp đồng..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} disabled={saving} /></div>
    <div className="max-h-56 space-y-2 overflow-y-auto" aria-busy={loading}>{loading ? <Loader2 className="mx-auto size-5 animate-spin" /> : items.map(item => { const eligible = !item.isCurrentVersionLocked && [ContractStatus.Draft, ContractStatus.Negotiating].includes(item.status); return <button key={item.contractId} type="button" disabled={saving || !eligible} onClick={() => void choose(item.contractId)} className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${selected?.contractId === item.contractId ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}><strong>{item.contractCode} · {item.contractName}</strong><span className="mt-1 block text-sm text-muted-foreground">{item.customerName || item.customerCompany} · Version {item.currentVersionNo} · {eligible ? item.status === ContractStatus.Draft ? "Nháp" : "Đàm phán" : "Đã khóa / không thể ghim"}</span></button>; })}{!loading && !items.length && <p className="p-3 text-muted-foreground">Chưa có hợp đồng phù hợp. Tạo Draft từ tài liệu này trước.</p>}</div>
    {totalPages > 1 && <div className="flex items-center justify-between"><Button variant="outline" disabled={page <= 1 || loading || saving} onClick={() => setPage(p => p - 1)}>Trước</Button><span>Trang {page}/{totalPages}</span><Button variant="outline" disabled={page >= totalPages || loading || saving} onClick={() => setPage(p => p + 1)}>Sau</Button></div>}</>}
    {target && loading && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Đang tải dữ liệu hợp đồng…</p>}
    {selected && reviewState && <section className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"><strong>{selected.contractCode} · Phiên bản {selected.currentVersion.versionNo}</strong><p>Khách hàng: {selected.customer.customerCompany || selected.customer.customerFullName}<br />Nhân viên: {selected.responsibleEmployee.employeeFullName}<br />Tổng thanh toán: {selected.totalPayment.toLocaleString("vi-VN")} {selected.currencyCode}</p><WordBindingDifferences data={reviewState} /><Link className="text-primary underline" href={`/contracts/${selected.contractId}`} target="_blank">Mở chi tiết để đối chiếu</Link><label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3"><input type="checkbox" className="mt-1 size-5 accent-primary" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={saving} /><span>Tôi đã đối chiếu bản Word với dữ liệu hiện tại, bao gồm nội dung điều khoản. Bản Word này sẽ được dùng để gửi duyệt và ký.</span></label></section>}
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Đóng</Button><Button disabled={saving || loading || !selected || !reviewed} onClick={() => void bind()}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Ghim vào version này</Button></div>
  </DialogContent></Dialog>;
}
