"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contractApi, ContractType, ContractStatus, type ContractListItemResponse, type ContractDetailResponse } from "@/services/contract-api";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/components/ui/sonner";

export function EditorContractBindingDialog({ document, onClose }: { document: { id: string; revision: number } | null; onClose: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState<ContractListItemResponse[]>([]);
  const [selected, setSelected] = useState<ContractDetailResponse | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!document) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      void contractApi.getList({ keyword, page, pageSize: 10, contractType: ContractType.SoftwareSupply }).then(result => {
        if (active) { setItems(result.items); setTotalPages(result.totalPages); }
      }).catch(e => { if (active) setError(getApiErrorMessage(e, "Không tải được hợp đồng.")); }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [document, keyword, page]);
  const choose = async (id: number) => {
    setLoading(true); setError(""); setSelected(null); setReviewed(false);
    try { setSelected(await contractApi.getDetail(id)); }
    catch (e) { setError(getApiErrorMessage(e, "Không tải được chi tiết.")); }
    finally { setLoading(false); }
  };
  const bind = async () => {
    if (!document || !selected || !reviewed) return;
    setSaving(true); setError("");
    try {
      await axiosClient.post(`/api/contracts/${selected.contractId}/versions/${selected.currentVersion.versionId}/editor-document`, {
        documentId: document.id, revision: document.revision, reviewed,
        contractRowVersion: selected.rowVersion, versionRowVersion: selected.currentVersion.rowVersion,
      });
      toast.success("Đã ghim bản Word này vào version hợp đồng. Bản gửi duyệt sẽ dùng đúng tài liệu đã ghim.");
      onClose();
    } catch (e) { setError(getApiErrorMessage(e, "Chưa ghim được. Tải lại chi tiết hợp đồng và rà soát trước khi thử lại.")); }
    finally { setSaving(false); }
  };
  return <Dialog open={!!document} onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />Cập nhật tài liệu cho hợp đồng đã có</DialogTitle><DialogDescription>Ghim bản Word đã lưu v{document?.revision} vào version hiện hành. Không tạo thêm hợp đồng. Những lần sửa tiếp trong editor không tự thay bản đã ghim.</DialogDescription></DialogHeader>
    <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-10" placeholder="Tìm mã hoặc tên hợp đồng..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} disabled={saving} /></div>
    <div className="max-h-56 space-y-2 overflow-y-auto" aria-busy={loading}>{loading ? <Loader2 className="mx-auto size-5 animate-spin" /> : items.map(item => { const eligible = !item.isCurrentVersionLocked && [ContractStatus.Draft, ContractStatus.Negotiating].includes(item.status); return <button key={item.contractId} type="button" disabled={saving || !eligible} onClick={() => void choose(item.contractId)} className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${selected?.contractId === item.contractId ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}><strong>{item.contractCode} · {item.contractName}</strong><span className="mt-1 block text-sm text-muted-foreground">{item.customerName || item.customerCompany} · Version {item.currentVersionNo} · {eligible ? item.status === ContractStatus.Draft ? "Nháp" : "Đàm phán" : "Đã khóa / không thể ghim"}</span></button>; })}{!loading && !items.length && <p className="p-3 text-muted-foreground">Chưa có hợp đồng phù hợp. Tạo Draft từ tài liệu này trước.</p>}</div>
    {totalPages > 1 && <div className="flex items-center justify-between"><Button variant="outline" disabled={page <= 1 || loading || saving} onClick={() => setPage(p => p - 1)}>Trước</Button><span>Trang {page}/{totalPages}</span><Button variant="outline" disabled={page >= totalPages || loading || saving} onClick={() => setPage(p => p + 1)}>Sau</Button></div>}
    {selected && <section className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"><strong>{selected.contractCode} · Version {selected.currentVersion.versionNo}</strong><p>Khách hàng: {selected.customer.customerCompany || selected.customer.customerFullName}<br />Nhân viên: {selected.responsibleEmployee.employeeFullName}<br />Tổng thanh toán: {selected.totalPayment.toLocaleString("vi-VN")} {selected.currencyCode}</p><Link className="text-primary underline" href={`/contracts/${selected.contractId}`} target="_blank">Mở chi tiết để đối chiếu</Link><label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3"><input type="checkbox" className="mt-1 size-5 accent-primary" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={saving} /><span>Tôi đã kiểm tra Word/PDF, khách hàng, giá trị và điều khoản khớp dữ liệu hợp đồng. Tài liệu này sẽ được dùng để gửi duyệt/ký.</span></label><p className="text-sm text-muted-foreground">Thay đổi dữ liệu nghiệp vụ hoặc tạo version mới sẽ yêu cầu rà soát và ghim lại. Ghim lại sẽ thay bản chính thức chưa gửi duyệt.</p></section>}
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Đóng</Button><Button disabled={saving || loading || !selected || !reviewed} onClick={() => void bind()}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Ghim vào version này</Button></div>
  </DialogContent></Dialog>;
}
