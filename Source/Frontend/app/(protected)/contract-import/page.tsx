"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, History, Undo2, Redo2, FileText, FileDown, Eye, Download, BookTemplate, Loader2 } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { hasPermission } from "@/lib/rbac";
import { prepareImportedTemplate, savePreparedTemplate, type PreparedImportedTemplate } from "@/services/imported-editor-template-api";
import { DocumentLibraryPanel } from "@/components/contracts/document-library-workspace";
import { DocumentPdfPreview } from "@/components/contracts/document-pdf-preview";
import { useReviewUndo } from "@/hooks/use-review-undo";
import { reviewedBlockText, replaceReviewedBlock, type ReviewField } from "@/lib/imported-contract-editing";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { RBAC_PERMISSIONS } from "@/lib/rbac";
import { ImportedDocumentCanvas } from "@/components/contracts/imported-document-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoundedSelect } from "@/components/ui/custom/rounded-select";
import { DocumentFieldCard, DocumentFieldValue } from "@/components/ui/custom/document-field-card";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage, getBlobApiErrorMessage } from "@/lib/api-error";

type Block = { id: string; text: string; context: string; editable: boolean };
type Field = ReviewField;
type Source = { id: string; name: string; sizeBytes: number; createdAtUtc: string; sourceSha256: string; currentRevision: number; revision: number; fields: Field[]; blocks: Block[]; warning: string };
type Summary = { id: string; name: string; revision: number; sizeBytes: number; createdAtUtc: string };
type Revision = { revision: number; createdAtUtc: string; isCurrent: boolean; totalFields: number; confirmed: number; changed: number };
const base = "/api/imported-contracts";
const statusLabel = { proposed: "Gợi ý — chưa áp dụng", confirmed: "Đã xác nhận", ignored: "Bỏ qua — giữ gốc" };

function Review() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const canManageTemplates = hasPermission(user?.permissions, RBAC_PERMISSIONS.templateManage);
  const [templateForm, setTemplateForm] = useState<{ name: string; sourceId: string; revision: number; clientId: string } | null>(null);
  const [templateAcknowledged, setTemplateAcknowledged] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const preparedTemplate = useRef<{ sourceId: string; revision: number; value: PreparedImportedTemplate } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [pdfMode, setPdfMode] = useState(false);
  const [source, setSource] = useState<Source | null>(null);

  const [active, setActive] = useState("");
  const [fieldQuery, setFieldQuery] = useState("");
  const [fieldStatus, setFieldStatus] = useState("all");
  const [dirty, setDirty] = useState(false);
  const edits = useReviewUndo<Field>(setDirty);
  const { fields, update: setFields, current: fieldsRef, generation: editGeneration } = edits;
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const sourceRef = useRef<Source | null>(null);
  const composing = useRef(false);
  const [isComposing, setIsComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [list, setList] = useState<Summary[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Revision[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [conflict, setConflict] = useState(false);
  const [selected, setSelected] = useState<{ blockId: string; start: number; length: number; original: string } | null>(null);
  const [manualLabel, setManualLabel] = useState("Thông tin hợp đồng");
  const [pending, setPending] = useState<{ title: string; text: string; action: () => void } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useLayoutEffect(() => { sourceRef.current = source; }, [source]);
  const historical = !!source && source.revision !== source.currentRevision;
  const date = (text: string) => new Date(text.endsWith("Z") ? text : `${text}Z`).toLocaleString("vi-VN");

  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    if (!listOpen) return;
    let stopped = false;
    const timer = setTimeout(() => { void axiosClient.get<unknown, { items: Summary[]; totalPages: number }>(base, { params: { page, keyword: query } }).then(result => { if (!stopped) { setList(result.items); setPages(result.totalPages); } }).catch(e => { if (!stopped) setError(getApiErrorMessage(e, "Không tải được hồ sơ nhập.")); }); }, 250);
    return () => { stopped = true; clearTimeout(timer); };
  }, [listOpen, page, query]);
  useEffect(() => {
    if (!historyOpen || !source) return;
    let stopped = false;
    void axiosClient.get<unknown, { items: Revision[]; totalPages: number }>(`${base}/${source.id}/history`, { params: { page: historyPage } }).then(result => { if (!stopped) { setHistory(result.items); setHistoryPages(result.totalPages); } }).catch(e => { if (!stopped) setError(getApiErrorMessage(e, "Không tải được lịch sử.")); });
    return () => { stopped = true; };
  }, [historyOpen, source, historyPage]);
  const confirmLeave = (action: () => void) => dirty ? setPending({ title: "Rời bản đang sửa?", text: "Thay đổi chưa lưu sẽ bị bỏ. Hãy lưu phiên bản trước nếu muốn giữ lại.", action }) : action();
  const open = async (id: string, revision?: number) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const data = await axiosClient.get<unknown, Source>(`${base}/${id}`, { params: { revision } }); sourceRef.current = data; setSource(data); edits.reset(data.fields); setPdfMode(false); setSaveError(""); setLastSaved(""); setDirty(false); setConflict(false); setActive(""); setFieldQuery(""); setFieldStatus("all"); setSelected(null); setPreview(true); setListOpen(false); setHistoryOpen(false); }
    catch (e) { setError(getApiErrorMessage(e, "Không mở được hợp đồng cũ.")); }
    finally { lock.current = false; setBusy(false); }
  };
  const libraryEntryOpened = useRef(false);
  useEffect(() => {
    if (libraryEntryOpened.current) return;
    libraryEntryOpened.current = true;
    const id = new URLSearchParams(window.location.search).get("document");
    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) queueMicrotask(() => void open(id));
    // Open a library deep link once; later navigation uses the library callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const createEditorTemplate = async () => {
    const head = sourceRef.current, form = templateForm;
    if (!head || !form || !templateAcknowledged || !form.name.trim() || lock.current || saving || dirty) return;
    if (head.id !== form.sourceId || head.revision !== form.revision) { setTemplateError("Tài liệu đã thay đổi. Đóng cửa sổ và chọn lại phiên bản cần làm mẫu."); return; }
    lock.current = true; setBusy(true); setTemplateError("");
    try {
      let prepared = preparedTemplate.current;
      if (!prepared || prepared.sourceId !== form.sourceId || prepared.revision !== form.revision) {
        const value = await prepareImportedTemplate(form.sourceId, form.revision);
        prepared = { sourceId: form.sourceId, revision: form.revision, value };
        preparedTemplate.current = prepared;
      }
      const result = await savePreparedTemplate(form.name, prepared.value.content, form.clientId);
      setTemplateForm(null); preparedTemplate.current = null;
      toast.success("Đã lưu mẫu văn bản riêng. File Word gốc và lịch sử rà soát được giữ nguyên.");
      if (prepared.value.warning) toast.info(prepared.value.warning);
      router.push(`/contract-editor?document=${encodeURIComponent(result.id)}`);
    } catch (e) { setTemplateError(await getBlobApiErrorMessage(e, "Không tạo được mẫu. Kiểm tra quyền quản lý mẫu và thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file || lock.current) return;
    if (!/\.docx$/i.test(file.name) || file.size === 0 || file.size > 10 * 1024 * 1024) { toast.error("Chọn DOCX không rỗng, tối đa 10 MB."); return; }
    lock.current = true; setBusy(true); setError("");
    let id: string | null = null;
    try { const form = new FormData(); form.append("file", file); const result = await axiosClient.post<unknown, { id: string }>(base, form, { headers: { "Content-Type": "multipart/form-data" } }); id = result.id; }
    catch (e) { setError(getApiErrorMessage(e, "Không nhập được DOCX.")); }
    finally { lock.current = false; setBusy(false); }
    if (id) { await open(id); toast.success("Đã giữ file gốc và tạo bản rà soát riêng."); }
  };
  const save = useCallback(async () => {
    const head = sourceRef.current;
    if (!head || lock.current || head.revision !== head.currentRevision || composing.current) return false;
    const captured = structuredClone(fieldsRef.current); const stamp = editGeneration.current;
    lock.current = true; setSaving(true); setSaveError("");
    try {
      const result = await axiosClient.put<unknown, { revision: number }>(`${base}/${head.id}`, { sourceSha256: head.sourceSha256, expectedRevision: head.currentRevision, fields: captured });
      const next = { ...head, revision: result.revision, currentRevision: result.revision, fields: captured };
      sourceRef.current = next; setSource(next);
      setDirty(editGeneration.current !== stamp);
      setLastSaved(new Date().toLocaleTimeString("vi-VN"));
      return true;
    } catch (e) {
      setSaveError(getApiErrorMessage(e, "Không tự lưu được. Giữ trang mở, kiểm tra mạng và bấm Lưu lại."));
      return false;
    } finally { lock.current = false; setSaving(false); }
  }, [fieldsRef, editGeneration]);
  useEffect(() => {
    if (!dirty || saving || busy || historical || saveError || !source || isComposing || pending) return;
    const timer = setTimeout(() => { if (!composing.current) void save(); }, 1200);
    return () => clearTimeout(timer);
  }, [fields, dirty, saving, busy, historical, saveError, source, save, isComposing, pending]);
  const restore = async () => {
    if (!source || lock.current || !historical) return;
    lock.current = true; setBusy(true); setError("");
    let restored = false;
    try {
      await axiosClient.post(`${base}/${source.id}/history/${source.revision}/restore`, { expectedRevision: source.currentRevision, sourceSha256: source.sourceSha256 });
      restored = true;
    } catch (e) { setError(getApiErrorMessage(e, "Không khôi phục được. Mở lại bản mới nhất rồi thử lại.")); setConflict(true); }
    finally { lock.current = false; setBusy(false); }
    if (restored) { await open(source.id); toast.success("Đã khôi phục thành phiên bản mới, lịch sử cũ vẫn được giữ."); }
  };
  const download = async (format: "original" | "docx" | "pdf", reviewed = false, previewPdf = false) => {
    if (!source || lock.current) return;
    if (dirty && format !== "original") { toast.info("Đợi tự lưu xong hoặc bấm Lưu ngay trước khi xuất."); return; }
    const proposed = fields.filter(f => f.status === "proposed").length;
    if (!reviewed && format !== "original" && proposed > 0) { setPending({ title: "Xuất với trường chưa xác nhận?", text: `Còn ${proposed} trường gợi ý. Các trường này giữ nguyên giá trị gốc; chỉ trường đã xác nhận mới được sửa trong bản xuất.`, action: () => void download(format, true, previewPdf) }); return; }
    // Open synchronously from the click/confirmation, before awaiting the authenticated fetch.
    const popup = previewPdf ? window.open("about:blank", "_blank") : null;
    if (previewPdf && !popup) { toast.error("Trình duyệt chặn tab mới. Hãy cho phép popup hoặc chọn Tải PDF."); return; }
    if (popup) popup.opener = null;
    lock.current = true; setBusy(true); setError("");
    try {
      const blob = await axiosClient.get<unknown, Blob>(`${base}/${source.id}/export/${format}`, { params: { revision: source.revision }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([blob], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      if (popup && !popup.closed) popup.location.replace(url);
      else {
        const a = document.createElement("a"); a.href = url;
        a.download = format === "original" ? source.name : `${source.name.replace(/\.docx$/i, "")}-v${source.revision}.${format}`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 300000);
    } catch (e) { popup?.close(); setError(await getBlobApiErrorMessage(e, "Không xuất được tài liệu.")); }
    finally { lock.current = false; setBusy(false); }
  };
  const change = (id: string, patch: Partial<Field>) => {
    const selectedField = fields.find(f => f.id === id);
    if (patch.status === "confirmed" && selectedField && fields.some(f => f.id !== id && f.status === "confirmed" && f.blockId === selectedField.blockId && f.start < selectedField.start + selectedField.length && selectedField.start < f.start + f.length)) { toast.error("Vùng này chồng lấn trường đã xác nhận. Bỏ qua hoặc bỏ gán vùng kia trước."); return; }
    setFields(previous => previous.map(f => f.id === id ? { ...f, ...patch } : f), `${id}-${Object.keys(patch).join("-")}`);
  };
  const focus = (field: Field, scrollSource = true) => {
    setActive(field.id); setFieldQuery(""); setFieldStatus("all");
    requestAnimationFrame(() => {
      document.getElementById(`field-${field.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (scrollSource) document.getElementById(`source-${field.blockId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };
  const visibleFields = fields.filter(f => (fieldStatus === "all" || f.status === fieldStatus) &&
    `${f.label} ${f.party} ${f.original} ${f.value}`.toLocaleLowerCase("vi-VN").includes(fieldQuery.toLocaleLowerCase("vi-VN")));
  const capture = (block: Block, node: HTMLElement) => {
    if (!block.editable || preview || historical || busy) { setSelected(null); return; }
    const selection = window.getSelection(); if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0); if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) { setSelected(null); return; }
    const before = range.cloneRange(); before.selectNodeContents(node); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length; const length = range.toString().length;
    if (length > 10000) { setSelected(null); toast.error("Mỗi trường tối đa 10.000 ký tự. Hãy chọn vùng ngắn hơn."); return; }
    if (length > 0 && start + length <= block.text.length && block.text.slice(start, start + length).trim()) {
      setSelected({ blockId: block.id, start, length, original: block.text.slice(start, start + length) });
      requestAnimationFrame(() => document.getElementById("manual-field-selection")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    } else setSelected(null);
  };
  const renderText = (block: Block) => {
    const matches = fields.filter(f => f.blockId === block.id && (f.status !== "ignored" || f.id === active)).sort((a, b) => a.start - b.start);
    if (preview) return reviewedBlockText(block.text, block.id, fields);
    const nodes = []; let cursor = 0;
    for (const f of matches) { if (f.start < cursor) continue; nodes.push(block.text.slice(cursor, f.start)); nodes.push(<mark key={f.id} onClick={() => focus(f, false)} className={`cursor-pointer rounded ${active === f.id ? "bg-blue-200 text-blue-950" : f.status === "confirmed" ? "bg-emerald-100 text-emerald-950" : "bg-amber-100 text-amber-950"}`}>{f.original}</mark>); cursor = f.start + f.length; }
    nodes.push(block.text.slice(cursor)); return nodes;
  };
  const editBlock = (block: Block, value: string) => {
    try { setFields(previous => replaceReviewedBlock(block.text, block.id, value, previous, crypto.randomUUID()), `block-${block.id}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Không sửa được đoạn."); }
  };
  return <><main onCompositionStart={() => { composing.current = true; setIsComposing(true); }} onCompositionEnd={() => { composing.current = false; setIsComposing(false); }}
    onKeyDown={e => {
      const target = e.target as HTMLElement;
      if (historical || busy || composing.current || !(e.ctrlKey || e.metaKey)) return;
      if (target.closest("input, textarea, [contenteditable=true]") && !target.matches("textarea[id^='inline-'], textarea[id^='value-']")) return;
      if (e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) edits.redo(); else edits.undo(); }
      if (e.key.toLowerCase() === "y") { e.preventDefault(); edits.redo(); }
    }} className="document-workspace-ui flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f1f2f7]" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={e => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); if (lock.current) { toast.info("Chờ thao tác lưu/xử lý hiện tại hoàn tất trước khi nhập file khác."); return; } if (e.dataTransfer.files.length !== 1) { toast.error("Chọn một DOCX mỗi lần."); return; } const file = e.dataTransfer.files[0]; confirmLeave(() => void upload(file)); }}>
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-primary px-4 py-3 [&_button]:h-8 [&_button]:text-xs"><h1 className="mr-auto text-sm font-semibold text-primary-foreground">Không gian tài liệu</h1><Button variant="outline" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(value => !value)}><FolderOpen className="size-3.5" aria-hidden />Thư viện</Button><input hidden ref={uploadRef} type="file" accept=".docx" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      {source && <>
        {canManageTemplates && <Button variant="outline" disabled={busy || saving || dirty} title={dirty ? "Chờ lưu thay đổi trước khi tạo mẫu" : "Tạo bản mẫu riêng từ phiên bản đang xem"} onClick={() => { preparedTemplate.current = null; setTemplateError(""); setTemplateAcknowledged(false); setTemplateForm({ name: `Mẫu ${source.name.replace(/\.docx$/i, "")}`.slice(0, 100), sourceId: source.id, revision: source.revision, clientId: crypto.randomUUID() }); }}><BookTemplate className="size-3.5" aria-hidden />Lưu thành mẫu</Button>}
        <Button variant="outline" disabled={busy || saving} onClick={() => { setHistoryPage(1); setHistoryOpen(true); }}><History className="size-3.5" aria-hidden />Lịch sử v{source.revision}</Button>
        <Button size="icon" className="size-8" variant="outline" title="Hoàn tác (Ctrl/Cmd+Z)" aria-label="Hoàn tác" disabled={busy || historical || !edits.canUndo} onClick={edits.undo}><Undo2 className="size-4" aria-hidden /></Button>
        <Button size="icon" className="size-8" variant="outline" title="Làm lại (Ctrl/Cmd+Shift+Z)" aria-label="Làm lại" disabled={busy || historical || !edits.canRedo} onClick={edits.redo}><Redo2 className="size-4" aria-hidden /></Button>
        <Button variant="outline" disabled={busy || saving} onClick={() => void download("original")}><FileDown className="size-3.5" aria-hidden />File gốc</Button>
        <Button variant="outline" disabled={busy || saving || dirty} onClick={() => void download("docx")}><FileText className="size-3.5" aria-hidden />Word đã sửa</Button>
        <Button variant="outline" disabled={busy || saving || dirty} onClick={() => void download("pdf", false, true)}><Eye className="size-3.5" aria-hidden />Xem PDF</Button>
        <Button variant="outline" disabled={busy || saving || dirty} onClick={() => void download("pdf")}><Download className="size-3.5" aria-hidden />Tải PDF</Button>
      </>}
    </div>
    {error && <div role="alert" className="space-y-2 border-b bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p>{conflict && source && <Button size="sm" variant="outline" disabled={busy} onClick={() => confirmLeave(() => void open(source.id))}>Mở lại bản mới nhất</Button>}</div>}
    {source && <div role="status" aria-live="polite" className={`flex flex-wrap items-center gap-2 border-b p-3 text-xs ${saveError ? "bg-destructive/10 text-destructive" : "bg-card text-muted-foreground"}`}>
      {historical ? "Bản lịch sử chỉ đọc — không tự lưu." : saveError ? <><span>{saveError} Tự lưu đã tạm dừng; thay đổi vẫn ở trang này.</span><Button size="sm" variant="outline" disabled={saving || busy} onClick={() => void save()}>Lưu lại</Button><Button size="sm" variant="outline" disabled={saving || busy} onClick={() => confirmLeave(() => void open(source.id))}>Mở bản mới nhất</Button></> : saving ? "Đang lưu trên server — bạn có thể tiếp tục gõ." : dirty ? "Chưa lưu · Tự lưu sau 1,2 giây ngừng nhập." : lastSaved ? `Đã lưu lúc ${lastSaved} · v${source.revision}` : "Đã lưu trên server."}
    </div>}
    {busy && <p role="status" className="p-3 text-sm">Đang xử lý, vui lòng đợi...</p>}
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {libraryOpen && <DocumentLibraryPanel activeId={source?.id} refreshKey={source ? `${source.id}:${source.currentRevision}` : ""} disabled={busy || saving}
        onDeleted={(kind, id) => { if (kind === "imported" && sourceRef.current?.id === id) { sourceRef.current = null; setSource(null); edits.reset([]); setDirty(false); setSaveError(""); setPdfMode(false); setActive(""); } }}
        onClose={() => setLibraryOpen(false)} onOpen={id => confirmLeave(() => void open(id))}
        onOpenEditor={id => confirmLeave(() => router.push(`/contract-editor?document=${encodeURIComponent(id)}`))}
        onUseTemplate={id => confirmLeave(() => router.push(`/contract-editor?template=${encodeURIComponent(id)}`))} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    {!source ? <div className="m-6 flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/60 p-6 text-center sm:p-12"><h2 className="text-xl font-semibold">Kéo DOCX vào đây hoặc chọn Upload DOCX</h2><p className="mt-3 text-muted-foreground">Tối đa 10 MB. Giữ bản gốc, nhận diện dữ liệu theo vị trí, không cần placeholder. Đây là rà soát tài liệu, chưa tạo hoặc thay đổi hồ sơ hợp đồng nghiệp vụ.</p><Button className="mt-6 h-12 px-8" disabled={busy || saving} onClick={() => uploadRef.current?.click()}>Upload DOCX</Button></div> : <>
      <details className="shrink-0 border-b bg-white px-4 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer truncate font-medium text-foreground">Thông tin tài liệu · {source.name} · v{source.revision}</summary><div className="max-h-48 space-y-2 overflow-y-auto pt-3"><p className="font-semibold text-foreground">{source.name} · v{source.revision} {dirty ? "· Chưa lưu" : "· Đã lưu"}</p><p>File gốc: {(source.sizeBytes / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB · Nhập lúc {date(source.createdAtUtc)} · Được giữ nguyên, không ghi đè</p><p>{source.warning}</p><p>Đã đọc {source.blocks.filter(b => b.text.trim()).length} đoạn/ô có văn bản · {source.blocks.filter(b => !b.editable && b.text.trim()).length} vùng chỉ xem · {fields.length} trường đang rà soát. Nhận diện theo nhãn, không phải AI/OCR; kết quả có thể thiếu hoặc sai.</p>{fields.length >= 500 && <p className="text-amber-700 dark:text-amber-400">Đã đạt giới hạn 500 trường. Một số dữ liệu có thể chưa được đưa vào danh sách.</p>}<p className="break-all">SHA-256 gốc: {source.sourceSha256}</p>{historical && <div className="flex flex-wrap items-center gap-3 text-primary"><span>Đang xem bản cũ, chỉ đọc.</span><Button size="sm" disabled={busy} onClick={() => setPending({ title: "Khôi phục phiên bản này?", text: "Giữ toàn bộ lịch sử và lưu bản đang xem thành phiên bản mới.", action: () => void restore() })}>Khôi phục thành bản mới</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void open(source.id)}>Mở bản mới nhất</Button></div>}</div></details>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2">
            <span className="text-xs text-muted-foreground">{preview ? "Gõ trực tiếp trên trang · Tự lưu · Giữ file gốc" : "Bản gốc · Bôi đen để gán vùng dữ liệu"}</span>
            <Button size="sm" variant="outline" onClick={() => { setSelected(null); setPdfMode(false); setPreview(value => !value); }}>{preview ? "Đối chiếu/gán vùng trên bản gốc" : "Quay lại bản đang chỉnh"}</Button>
            <Button size="sm" variant={pdfMode ? "default" : "outline"} disabled={busy || saving || (dirty && !pdfMode)} onClick={() => setPdfMode(v => !v)}>{pdfMode ? "Quay lại chỉnh sửa" : "Bản PDF thực tế"}</Button>
            {historical && <Button size="sm" disabled={busy} onClick={() => setPending({ title: "Khôi phục phiên bản này?", text: "Tạo phiên bản mới từ bản đang xem, không xóa lịch sử.", action: () => void restore() })}>Khôi phục bản này</Button>}
          </div>
          {pdfMode ? <DocumentPdfPreview key={`${source.id}:${source.revision}`} kind="imported" id={source.id} revision={source.revision} /> : <ImportedDocumentCanvas blocks={source.blocks} fields={fields} original={!preview} readOnly={historical} busy={busy}
            onChange={editBlock} renderOriginal={renderText} onSelect={capture}
            onFocusBlock={id => { const field = fields.find(f => f.blockId === id); if (field) setActive(field.id); }}
            panelOpen={panelOpen} onTogglePanel={() => setPanelOpen(value => !value)} />}
        </div>
        <aside className={`${panelOpen ? "block" : "hidden"} absolute inset-y-0 right-0 z-20 w-[min(360px,90vw)] shrink-0 space-y-4 overflow-y-auto border-l bg-card p-4 shadow-xl lg:static lg:w-[320px] lg:shadow-none xl:w-[360px]`}><div className="flex justify-end lg:hidden"><Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Đóng dữ liệu</Button></div><h2 className="font-semibold">Dữ liệu cần rà soát ({fields.length})</h2><p className="text-xs text-muted-foreground">Nhập giá trị thay thế sẽ áp dụng ngay trên văn bản và tự lưu. Gợi ý nhận diện chưa chỉnh vẫn cần Xác nhận để áp dụng. Bên A/B là ngữ cảnh gợi ý, hãy kiểm tra lại; không suy ra khách hàng chỉ từ ký hiệu bên.</p>
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">{(["proposed", "confirmed", "ignored"] as const).map(status => <div key={status}><p className="text-lg font-semibold tabular-nums">{fields.filter(f => f.status === status).length}</p><p className="text-muted-foreground">{status === "proposed" ? "Chờ rà soát" : status === "confirmed" ? "Đã xác nhận" : "Bỏ qua"}</p></div>)}</div>
            <Input aria-label="Tìm trường rà soát" placeholder="Tìm tên trường hoặc giá trị..." maxLength={100} showControls={false} value={fieldQuery} onChange={e => setFieldQuery(e.target.value)} />
            <RoundedSelect aria-label="Lọc trạng thái rà soát" value={fieldStatus} onValueChange={setFieldStatus} options={[{ value: "all", label: "Tất cả trạng thái" }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} />
          </div>
          <div className="space-y-3">
          <fieldset disabled={busy || historical} className="min-w-0 disabled:opacity-60">
            {selected && <div id="manual-field-selection" className="space-y-2 rounded-xl border border-primary bg-primary/5 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Gán trường thủ công</p><Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Hủy chọn</Button></div><p className="text-xs text-muted-foreground">{selected.blockId} · {selected.length} ký tự</p><p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-sm">{selected.original}</p><Input aria-label="Tên trường gán thủ công" maxLength={100} value={manualLabel} onChange={e => setManualLabel(e.target.value)} /><Button size="sm" disabled={!manualLabel.trim() || fields.length >= 500} onClick={() => { const existing = fields.find(f => f.blockId === selected.blockId && f.start === selected.start && f.length === selected.length); if (existing) focus(existing); else { const field: Field = { ...selected, id: crypto.randomUUID(), value: selected.original, label: manualLabel.trim(), party: "Chưa xác định", status: "proposed" }; setFields(previous => [...previous, field]); focus(field, false); setDirty(true); } setSelected(null); }}>Gán thành trường</Button></div>}
          </fieldset>
            {fields.length > 0 && visibleFields.length === 0 && <p className="text-sm text-muted-foreground">Không có trường khớp bộ lọc.</p>}
            {fields.length === 0 && <p className="text-sm text-muted-foreground">Chưa nhận diện được trường. Bôi đen giá trị trong bản gốc rồi gán thủ công.</p>}
            {visibleFields.map(field => <DocumentFieldCard key={field.id} id={`field-${field.id}`} title={field.label}
              subtitle={`${field.party} · ${field.blockId} · ${field.original}`} status={statusLabel[field.status]} expanded={active === field.id}
              onToggle={() => active === field.id ? setActive("") : focus(field)}>
              <fieldset disabled={busy || historical} className="min-w-0 space-y-3 disabled:opacity-60">
                <p className="text-xs text-muted-foreground">{source.blocks.find(b => b.id === field.blockId)?.context} · {field.blockId} · Vị trí {field.start}–{field.start + field.length}</p>
                <div className="space-y-1"><Label htmlFor={`label-${field.id}`}>Tên trường</Label><Input id={`label-${field.id}`} maxLength={100} showControls={false} value={field.label} onChange={e => change(field.id, { label: e.target.value, status: "proposed" })} /></div>
                <div className="space-y-1"><Label htmlFor={`party-${field.id}`}>Thuộc bên</Label><Input id={`party-${field.id}`} maxLength={100} showControls={false} value={field.party} onChange={e => change(field.id, { party: e.target.value, status: "proposed" })} /></div>
                <div className="rounded-lg border bg-background p-3"><p className="mb-1 text-xs font-medium text-muted-foreground">Giá trị gốc</p><p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-sm">{field.original}</p></div>
                <div className="space-y-1"><Label htmlFor={`value-${field.id}`}>Giá trị thay thế</Label><DocumentFieldValue id={`value-${field.id}`} value={field.value} singleLine onChange={value => change(field.id, { value, status: "confirmed" })} /></div>
                <div className="grid grid-cols-2 gap-2"><Button size="sm" disabled={!field.label.trim() || field.status === "confirmed"} onClick={() => change(field.id, { status: "confirmed" })}>Xác nhận</Button><Button size="sm" variant="outline" disabled={field.status === "ignored"} onClick={() => change(field.id, { status: "ignored" })}>Bỏ qua</Button></div>
                <div className="flex flex-wrap gap-1 border-t pt-2"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPending({ title: "Xóa giá trị khỏi bản xuất?", text: `Giá trị “${field.original.slice(0, 160)}${field.original.length > 160 ? "…" : ""}” tại vị trí đã chọn sẽ thành trống trong bản chỉnh sửa. File gốc vẫn giữ nguyên.`, action: () => change(field.id, { value: "", status: "confirmed" }) })}>Xóa giá trị</Button><Button size="sm" variant="ghost" onClick={() => setPending({ title: "Bỏ liên kết trường?", text: "Chỉ bỏ trường khỏi danh sách rà soát, không xóa nội dung trong file gốc hoặc bản xuất.", action: () => { setFields(previous => previous.filter(f => f.id !== field.id)); setActive(""); setDirty(true); } })}>Bỏ gán</Button></div>
              </fieldset>
            </DocumentFieldCard>)}
          </div>
        </aside>
      </div>
    </>}
      </div>
    </div>
    <Dialog open={listOpen} onOpenChange={setListOpen}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Hồ sơ hợp đồng cũ của tôi</DialogTitle><DialogDescription>Chỉ tài khoản và tenant hiện tại được truy cập.</DialogDescription></DialogHeader><Input aria-label="Tìm hồ sơ nhập" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm tên file..." />{list.map(item => <Button variant="outline" key={item.id} disabled={busy} className="h-auto justify-start whitespace-normal text-left" onClick={() => confirmLeave(() => void open(item.id))}><span className="flex min-w-0 flex-col gap-1"><span>{item.name} · v{item.revision}</span><span className="text-xs font-normal text-muted-foreground">{(item.sizeBytes / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB · {date(item.createdAtUtc)}</span></span></Button>)}{!list.length && <p>Chưa có hồ sơ.</p>}<div className="flex items-center justify-end gap-3"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</Button><span>{page}/{pages}</span><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau</Button></div></DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Lịch sử rà soát</DialogTitle><DialogDescription>Chọn bản để xem hoặc xuất. Khôi phục luôn tạo bản mới, không xóa hay ghi đè lịch sử.</DialogDescription></DialogHeader>
      <div className="space-y-2">{history.map(item => <button type="button" disabled={busy} key={item.revision} className="w-full space-y-2 rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50" onClick={() => source && confirmLeave(() => void open(source.id, item.revision))}>
        <span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">Phiên bản {item.revision}{item.isCurrent ? " · Mới nhất" : ""}</span><span className="text-xs text-muted-foreground">{date(item.createdAtUtc)}</span></span>
        <span className="block text-xs text-muted-foreground">{item.totalFields} trường · {item.confirmed} đã xác nhận · {item.changed} thay đổi so với gốc</span>
      </button>)}</div>
      {historyPages > 1 && <div className="flex items-center justify-end gap-3"><Button variant="ghost" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Trước</Button><span>{historyPage}/{historyPages}</span><Button variant="ghost" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(p => p + 1)}>Sau</Button></div>}
    </DialogContent></Dialog>
    <Dialog open={!!templateForm} onOpenChange={open => { if (!open && !busy) { setTemplateForm(null); preparedTemplate.current = null; } }}><DialogContent className="document-workspace-ui max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Lưu Word cũ thành mẫu văn bản</DialogTitle><DialogDescription>Tạo mẫu riêng từ bản đã lưu v{templateForm?.revision}, sau đó mở tại Soạn thảo hợp đồng. Không thay đổi file gốc hoặc hồ sơ hợp đồng.</DialogDescription></DialogHeader><Label htmlFor="import-template-name">Tên mẫu</Label><Input id="import-template-name" maxLength={100} disabled={busy} value={templateForm?.name || ""} onChange={e => setTemplateForm(form => form ? { ...form, name: e.target.value } : form)} /><div className="space-y-2 rounded-xl border bg-amber-50 p-3 text-sm text-amber-950"><p>Mẫu hiển thị dùng chung trong tenant. Nội dung đã sửa được giữ nguyên, không tự xóa thông tin riêng của khách hàng.</p><p>Editor giữ văn bản và bảng cơ bản; ảnh, chữ ký, header/footer, trường Word tự động và bố cục phức tạp có thể không được bảo toàn. Đây là mẫu soạn thảo, không tự phát hành thành mẫu nghiệp vụ.</p></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={busy} checked={templateAcknowledged} onChange={e => setTemplateAcknowledged(e.target.checked)} />Tôi đã rà soát nội dung và đồng ý lưu thành mẫu dùng chung.</label>{templateError && <p role="alert" className="text-sm text-destructive">{templateError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setTemplateForm(null); preparedTemplate.current = null; }}>Hủy</Button><Button disabled={busy || saving || dirty || !templateAcknowledged || !templateForm?.name.trim()} onClick={() => void createEditorTemplate()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <BookTemplate className="size-4" />}{busy ? "Đang tạo mẫu..." : "Lưu mẫu và mở soạn thảo"}</Button></div></DialogContent></Dialog>
    <ConfirmDialog isOpen={pending !== null} isLoading={saving || busy} onClose={() => setPending(null)} title={pending?.title || "Xác nhận"} description={pending?.text || ""} confirmText="Tiếp tục" onConfirm={() => { const action = pending?.action; setPending(null); action?.(); }} />
  </main></>;
}
export default function ImportedContractPage() { return <PermissionGuard permission={RBAC_PERMISSIONS.contractCreate}><Review /></PermissionGuard>; }
