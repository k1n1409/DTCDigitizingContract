"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, CalendarOff, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ContractOutcome, getContractOutcomeLabel, getContractStatusLabel } from "@/services/contract-api";
import { contractCompletionApi, type ContractOutcomeResponse } from "@/services/contract-completion-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/components/ui/sonner";

export function ContractOutcomeDialog({ contractId, onClose, onUpdated }: { contractId: number; onClose: () => void; onUpdated: () => void }) {
  const [data, setData] = useState<ContractOutcomeResponse | null>(null);
  const [selected, setSelected] = useState<ContractOutcome>(ContractOutcome.InProgress);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    void contractCompletionApi.getOutcome(contractId).then(result => { if (active) { setData(result); setError(""); setSelected(ContractOutcome.InProgress); } }).catch(e => { if (active) setError(getApiErrorMessage(e, "Không tải được điều kiện cập nhật kết quả.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contractId, reload]);
  const allowed = data?.options.some(x => x.value === selected && x.allowed);
  const valid = allowed && (selected === ContractOutcome.Succeeded || !!reason.trim());
  const save = async () => {
    setConfirm(false);
    if (!data || !valid) return;
    setSaving(true); setError("");
    try { await contractCompletionApi.updateOutcome(contractId, { currentVersionId: data.currentVersionId, contractRowVersion: data.contractRowVersion, versionRowVersion: data.versionRowVersion, outcome: selected, reason: reason.trim() }); toast.success("Đã cập nhật kết quả hợp đồng và lưu lịch sử."); onUpdated(); onClose(); }
    catch (e) { setError(getApiErrorMessage(e, "Chưa cập nhật được. Tải lại điều kiện trước khi thử lại.")); }
    finally { setSaving(false); }
  };
  return <><Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Cập nhật kết quả hợp đồng</DialogTitle><DialogDescription>Chốt kết quả xử lý hồ sơ; không thay đổi ngược lịch sử duyệt/ký, không xóa thanh toán hay công nợ.</DialogDescription></DialogHeader>
    {loading ? <div className="flex justify-center gap-2 p-8"><Loader2 className="size-5 animate-spin" />Đang kiểm tra điều kiện...</div> : data && <>
      <div className="rounded-xl border bg-muted/30 p-4"><strong>{data.contractCode} · {data.contractName}</strong><p className="mt-2 text-sm">Quy trình: {getContractStatusLabel(data.legalStatus)} · Kết quả: {getContractOutcomeLabel(data.outcome)}</p>{data.reason && <p className="mt-2 whitespace-pre-wrap text-sm">Lý do đã lưu: {data.reason}</p>}{data.updatedAtUtc && <p className="mt-1 text-sm text-muted-foreground">{data.updatedByEmployeeName || "Nhân viên"} · {new Date(`${data.updatedAtUtc.replace(/Z$/, "")}Z`).toLocaleString("vi-VN")}</p>}<Link className="mt-2 inline-block text-sm text-primary underline" href={`/contracts/${contractId}#completion`} target="_blank">Mở hồ sơ để kiểm tra ký, nghiệm thu và thanh toán</Link></div>
      <div className="space-y-3" role="radiogroup" aria-label="Kết quả mới">{data.options.map(option => { const Icon = option.value === ContractOutcome.Succeeded ? CheckCircle2 : option.value === ContractOutcome.Failed ? XCircle : CalendarOff; return <button type="button" role="radio" aria-checked={selected === option.value} disabled={!option.allowed || saving} key={option.value} onClick={() => setSelected(option.value)} className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors disabled:cursor-not-allowed ${selected === option.value ? "border-primary bg-primary/5" : option.allowed ? "border-border hover:border-primary/60" : "border-border bg-muted/30 text-muted-foreground"}`}><Icon className="mt-0.5 size-5 shrink-0" /><span><strong>{option.label}</strong><span className="mt-1 block text-sm">{option.blocker || (option.value === ContractOutcome.Succeeded ? "Đủ điều kiện đóng hợp đồng theo kiểm tra backend." : option.value === ContractOutcome.Failed ? "Ghi nhận không đạt kết quả; công nợ và chứng từ vẫn được giữ." : "Ghi nhận hợp đồng đã hết hạn và không gia hạn thêm.")}</span></span></button>; })}</div>
      <div className="space-y-2"><Label htmlFor="outcome-reason">Lý do / ghi chú {selected !== ContractOutcome.Succeeded && <span className="text-destructive">*</span>}</Label><Textarea id="outcome-reason" rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={saving} placeholder="Nêu kết quả xử lý và căn cứ xác nhận..." /><p className="text-right text-xs text-muted-foreground">{reason.length}/1000</p></div>
    </>}
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" disabled={loading || saving} onClick={() => { setLoading(true); setReload(n => n + 1); }}><RefreshCw className="mr-2 size-4" />Tải lại điều kiện</Button><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Đóng</Button><Button disabled={loading || saving || !valid} onClick={() => setConfirm(true)}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Xác nhận kết quả</Button></div></div>
  </DialogContent></Dialog><ConfirmDialog isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => void save()} title={`Chốt kết quả: ${getContractOutcomeLabel(selected)}?`} description="Hệ thống sẽ kiểm tra lại điều kiện và lưu người cập nhật, thời gian, lý do vào lịch sử. Không thể tự đổi ngược kết quả đã chốt." confirmText="Xác nhận cập nhật" /></>;
}
