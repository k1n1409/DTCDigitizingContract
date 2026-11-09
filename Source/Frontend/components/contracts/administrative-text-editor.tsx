"use client";
import { useCallback, useEffect, useState } from "react";
import { PencilLine, Loader2, History, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { ContractRichTextEditor } from "@/components/ui/custom/contract-rich-text-editor";
import { ContractRichTextContent } from "@/components/ui/custom/contract-rich-text-content";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks/use-permission";
import { RBAC_PERMISSIONS } from "@/lib/rbac";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/components/ui/sonner";

type Row = { id: number; kind: "basis" | "term"; code: string; title: string | null; titleEn: string | null; contentVi: string | null; contentEn: string | null; bilingualMode: number; rowVersion: string };
type Log = { administrativeTextEditId: number; kind: string; rowId: number; reason: string; employeeId: number; employeeName?: string | null; createdAtUtc: string; beforeJson: string; afterJson: string };
type Data = { versionId: number; versionNo: number; languageMode: number; parentRowVersion: string; rows: Row[]; history: Log[] };
type Target = "contract" | "template";

export function AdministrativeTextEditor({ target, id, onSaved }: { target: Target; id: number; onSaved?: () => void }) {
  const { can } = usePermission(); const [open, setOpen] = useState(false);
  if (!can(RBAC_PERMISSIONS.contractTextCorrect)) return null;
  return <><Button variant="outline" onClick={() => setOpen(true)}><PencilLine className="mr-2 size-4" />Sửa trực tiếp căn cứ / điều khoản</Button>{open && <Editor target={target} id={id} onSaved={onSaved} onClose={() => setOpen(false)} />}</>;
}
function HistoryContent({ value }: { value: string }) {
  let row: { Title?: string; ContentVi?: string; ContentEn?: string } | null = null;
  try { row = JSON.parse(value); } catch { /* Malformed audit content remains read-only. */ }
  if (!row) return <p>Không đọc được bản lưu.</p>;
  return <div className="space-y-2">{row.Title && <strong>{row.Title}</strong>}<ContractRichTextContent value={row.ContentVi || ""} />{row.ContentEn && <ContractRichTextContent value={row.ContentEn} />}</div>;
}
function Editor({ target, id, onSaved, onClose }: { target: Target; id: number; onSaved?: () => void; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [kind, setKind] = useState<"basis" | "term">("basis");
  const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false); const [closeConfirm, setCloseConfirm] = useState(false);
  const [pending, setPending] = useState<Row | null>(null);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(selected);
  const url = `/api/administrative-text/${target}/${id}`;
  const load = useCallback(async () => {
    try { const result = await axiosClient.get<unknown, Data>(url); setData(result); setError(""); setSelected(null); setDraft(null); setReason(""); }
    catch (e) { setError(getApiErrorMessage(e, "Không tải được nội dung chỉnh sửa.")); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const choose = (row: Row) => { if (dirty) { setPending(row); return; } setSelected(row); setDraft({ ...row }); setReason(""); };
  const close = () => { if (saving) return; if (dirty) setCloseConfirm(true); else onClose(); };
  const save = async () => {
    setConfirm(false); if (!data || !draft || !dirty || !reason.trim()) return;
    setSaving(true); setError("");
    try {
      await axiosClient.post(url, { versionId: data.versionId, rowId: draft.id, kind: draft.kind,
        parentRowVersion: data.parentRowVersion, rowVersion: draft.rowVersion, title: draft.title,
        titleEn: draft.titleEn, contentVi: draft.contentVi, contentEn: draft.contentEn, reason: reason.trim(), confirmed: true });
      toast.success("Đã sửa trực tiếp và lưu nội dung trước/sau; không tạo version mới.");
      await load(); onSaved?.();
    } catch (e) { setError(getApiErrorMessage(e, "Chưa lưu được. Nếu dữ liệu vừa thay đổi, hãy đóng và mở lại để tải bản mới nhất.")); }
    finally { setSaving(false); }
  };
  return <><Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-6xl"><DialogHeader><DialogTitle>Sửa trực tiếp căn cứ / điều khoản · Version {data?.versionNo || "..."}</DialogTitle><DialogDescription>Không tạo phiên bản mới. Chỉ sửa nội dung các mục hiện có; không đổi mã, thứ tự, giá trị hợp đồng hay thông tin ký.</DialogDescription></DialogHeader>
    <div className="flex items-start gap-2 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{target === "contract" ? "Nội dung dữ liệu trên màn hình sẽ thay đổi. Bản Word/PDF và snapshot đã duyệt/ký vẫn là bản gốc, không tự thay đổi theo lần sửa này." : "Nội dung mới áp dụng khi tạo hợp đồng tiếp theo từ mẫu này. Hợp đồng đã tạo và file PDF phát hành trước đây không tự thay đổi."} Mỗi lần sửa cần lý do và có lịch sử trước/sau.</p></div>
    {loading ? <Loader2 className="mx-auto my-8 size-6 animate-spin" /> : <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="space-y-3"><div className="flex gap-2"><Button size="sm" variant={kind === "basis" ? "default" : "outline"} onClick={() => setKind("basis")}>Căn cứ</Button><Button size="sm" variant={kind === "term" ? "default" : "outline"} onClick={() => setKind("term")}>Điều khoản</Button></div><div className="max-h-[45vh] space-y-2 overflow-y-auto">{data?.rows.filter(x => x.kind === kind).map(row => <button type="button" key={`${row.kind}-${row.id}`} disabled={saving} onClick={() => choose(row)} className={`w-full rounded-xl border p-3 text-left text-sm ${selected?.id === row.id && selected.kind === row.kind ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}><strong>{row.title || row.code}</strong><span className="mt-1 block text-xs text-muted-foreground">{row.code}</span></button>)}{!data?.rows.some(x => x.kind === kind) && <p className="text-sm text-muted-foreground">Chưa có mục này.</p>}</div></aside>
      <section className="min-w-0 space-y-4">{draft ? <div inert={saving} className="space-y-3">{draft.kind === "term" && <><Label>Tiêu đề tiếng Việt</Label><Input maxLength={300} value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></>}<Label>Nội dung tiếng Việt</Label><ContractRichTextEditor key={`${draft.kind}-${draft.id}-vi`} value={draft.contentVi} onChange={value => setDraft(d => d ? { ...d, contentVi: value } : d)} />{data?.languageMode === 2 && <>{draft.kind === "term" && <><Label>Tiêu đề tiếng Anh</Label><Input maxLength={300} value={draft.titleEn || ""} onChange={e => setDraft({ ...draft, titleEn: e.target.value })} /></>}<Label>Nội dung tiếng Anh {draft.bilingualMode === 2 ? "(nội dung gộp nằm trong bản tiếng Việt)" : ""}</Label><ContractRichTextEditor className={draft.kind === "term" && draft.bilingualMode === 2 ? "hidden" : undefined} key={`${draft.kind}-${draft.id}-en`} value={draft.contentEn} onChange={value => setDraft(d => d ? { ...d, contentEn: value } : d)} /></>}<Label htmlFor="text-edit-reason">Lý do chỉnh sửa <span className="text-destructive">*</span></Label><Textarea id="text-edit-reason" rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Nêu rõ nội dung và căn cứ cho việc thay đổi sau phát hành/duyệt/ký..." /><Button disabled={saving || !dirty || !reason.trim()} onClick={() => setConfirm(true)}>Lưu trực tiếp nội dung này</Button></div> : <p className="rounded-xl border border-dashed p-6 text-muted-foreground">Chọn một căn cứ hoặc điều khoản bên trái để sửa.</p>}
      {!!data?.history.length && <details className="rounded-xl border p-4"><summary className="flex cursor-pointer items-center gap-2 font-medium"><History className="size-4" />20 lần sửa gần nhất</summary><div className="mt-4 space-y-3">{data.history.map(log => <details key={log.administrativeTextEditId} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">#{log.administrativeTextEditId} · {log.kind === "term" ? "Điều khoản" : "Căn cứ"} #{log.rowId} · {log.employeeName || `Nhân viên #${log.employeeId}`} · {log.reason}</summary><p className="my-2 text-xs text-muted-foreground">{new Date(`${log.createdAtUtc.replace(/Z$/, "")}Z`).toLocaleString("vi-VN")}</p><div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-red-200 p-3"><p className="mb-2 font-semibold">Trước khi sửa</p><HistoryContent value={log.beforeJson} /></div><div className="rounded-lg border border-emerald-300 p-3"><p className="mb-2 font-semibold">Sau khi sửa</p><HistoryContent value={log.afterJson} /></div></div></details>)}</div></details>}</section>
    </div>}
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-destructive">{error}</p>}
    <div className="flex justify-end"><Button variant="outline" disabled={saving} onClick={close}>{saving ? "Đang lưu..." : "Đóng"}</Button></div>
  </DialogContent></Dialog><ConfirmDialog isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => void save()} title="Lưu trực tiếp sau phát hành/duyệt/ký?" description="Không tạo version mới. Hệ thống ghi nội dung trước/sau và lý do. File đã phát hành/duyệt/ký không bị ghi đè." confirmText="Xác nhận lưu trực tiếp" /><ConfirmDialog isOpen={closeConfirm || !!pending} onClose={() => { setCloseConfirm(false); setPending(null); }} onConfirm={() => { if (pending) { setSelected(pending); setDraft({ ...pending }); setPending(null); setReason(""); } else onClose(); setCloseConfirm(false); }} title="Bỏ thay đổi chưa lưu?" description="Nội dung vừa nhập chưa được lưu. Bạn có muốn bỏ thay đổi này?" confirmText="Bỏ thay đổi" /></>;
}
