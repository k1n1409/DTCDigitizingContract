"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, History, Undo2, Redo2, FileText, FileDown, Eye, Download, BookTemplate, Loader2, CheckCircle2, CircleDashed } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { hasPermission } from "@/lib/rbac";
import { prepareImportedTemplate, savePreparedTemplate, type PreparedImportedTemplate } from "@/services/imported-editor-template-api";
import { DocumentLibraryPanel } from "@/components/contracts/document-library-workspace";
import { DocumentWorkspaceStatus } from "@/components/contracts/document-workspace-status";
import { WorkspaceExpandButton } from "@/components/contracts/document-workspace-view";
import { TemplatePrivacyOptions } from "@/components/contracts/template-privacy-options";
import { DocumentFindReplace, type FindOptions } from "@/components/contracts/document-find-replace";
import { findTextMatches, replaceTextMatches } from "@/lib/document-find-replace";
import { DocumentPdfPreview } from "@/components/contracts/document-pdf-preview";
import { useReviewUndo } from "@/hooks/use-review-undo";
import { reviewedBlockText, replaceReviewedBlock, type ReviewField } from "@/lib/imported-contract-editing";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { RBAC_PERMISSIONS } from "@/lib/rbac";
import { ImportedDocumentCanvas } from "@/components/contracts/imported-document-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RoundedSelect } from "@/components/ui/custom/rounded-select";
import { DocumentFieldCard, DocumentFieldValue } from "@/components/ui/custom/document-field-card";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage, getBlobApiErrorMessage } from "@/lib/api-error";
import { ImportedReviewComparison } from "@/components/contracts/imported-review-comparison";
import { REVIEW_GROUPS, reviewGroup, reviewTemplateKey } from "@/lib/imported-review-tools";
import { readReviewRecovery, writeReviewRecovery, clearReviewRecovery, type Recovery } from "@/lib/review-recovery";

type Block = { id: string; text: string; context: string; editable: boolean };
type Field = ReviewField;
type Source = { id: string; name: string; sizeBytes: number; createdAtUtc: string; sourceSha256: string; currentRevision: number; revision: number; fields: Field[]; blocks: Block[]; warning: string; layout?: { tables:number; mergedCells:number; nestedTables:number; images:number; headers:number; footers:number; pageBreaks:number; readOnlyBlocks:number; editableBlocks:number } };
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
  const [sharedTemplate, setSharedTemplate] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const preparedTemplate = useRef<{ sourceId: string; revision: number; value: PreparedImportedTemplate } | null>(null);
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState(false);
  const [fieldGroup, setFieldGroup] = useState("");
  const [recoveryOffer, setRecoveryOffer] = useState<Recovery | null>(null);
  const [recoveryPreview, setRecoveryPreview] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const owner = user ? `${user.tenantId}:${user.employeeId}` : "";
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [pdfMode, setPdfMode] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [find, setFind] = useState<FindOptions>({ query: "", replacement: "", matchCase: false });
  const [findIndex, setFindIndex] = useState(0);

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
  const confirmLeave = (action: () => void) => dirty ? setPending({ title: "Rời bản đang sửa?", text: "Thay đổi chưa lưu và bản dự phòng của tài liệu này sẽ bị bỏ. Hãy lưu phiên bản trước nếu muốn giữ lại.", action: () => { if (sourceRef.current && owner) clearReviewRecovery(owner, sourceRef.current.id); action(); } }) : action();
  const open = async (id: string, revision?: number) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const data = await axiosClient.get<unknown, Source>(`${base}/${id}`, { params: { revision } }); sourceRef.current = data; setSource(data); edits.reset(data.fields); setPdfMode(false); setSaveError(""); setLastSaved(""); setDirty(false); setConflict(false); setActive(""); setFieldQuery(""); setFieldStatus("all"); setFieldGroup(""); setComparison(false); setRecoveryOffer(null); setRecoveryNotice(""); setSelected(null); setPreview(true); setListOpen(false); setHistoryOpen(false);
      if (owner && data.revision === data.currentRevision) { try { setRecoveryOffer(await readReviewRecovery(owner, id)); } catch { setRecoveryNotice("Không đọc được bản dự phòng trên trình duyệt này."); } }
    }
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
    try {
      const selected = head.fields.map(f => templateFields[f.id] ? { ...f, value: `{{${templateFields[f.id]}}}`, status: "confirmed" as const } : f);
      head.blocks.forEach(block => reviewedBlockText(block.text, block.id, selected));
    } catch { setTemplateError("Các vùng được chọn chồng lấn. Bỏ chọn một vùng hoặc rà soát lại trước khi làm mẫu."); return; }
    lock.current = true; setBusy(true); setTemplateError("");
    try {
      let prepared = preparedTemplate.current;
      if (!prepared || prepared.sourceId !== form.sourceId || prepared.revision !== form.revision) {
        const value = await prepareImportedTemplate(form.sourceId, form.revision, templateFields, head.sourceSha256);
        prepared = { sourceId: form.sourceId, revision: form.revision, value };
        preparedTemplate.current = prepared;
      }
      const result = await savePreparedTemplate(form.name, prepared.value.content, form.clientId, sharedTemplate);
      setTemplateForm(null); preparedTemplate.current = null;
      toast.success(`Đã lưu ${sharedTemplate ? "mẫu dùng chung" : "mẫu cá nhân"}. File Word gốc và lịch sử được giữ nguyên.`);
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
    if (!navigator.onLine) { setSaveError("Đang mất mạng. Nội dung vẫn ở trang này; sẽ thử lưu lại khi có mạng."); return false; }
    const captured = structuredClone(fieldsRef.current); const stamp = editGeneration.current;
    lock.current = true; setSaving(true); setSaveError("");
    try {
      const result = await axiosClient.put<unknown, { revision: number }>(`${base}/${head.id}`, { sourceSha256: head.sourceSha256, expectedRevision: head.currentRevision, fields: captured });
      const next = { ...head, revision: result.revision, currentRevision: result.revision, fields: captured };
      if (owner) clearReviewRecovery(owner, head.id);
      setRecoveryNotice("");
      sourceRef.current = next; setSource(next);
      setDirty(editGeneration.current !== stamp);
      setLastSaved(new Date().toLocaleTimeString("vi-VN"));
      return true;
    } catch (e) {
      setSaveError(getApiErrorMessage(e, "Không tự lưu được. Giữ trang mở, kiểm tra mạng và bấm Lưu lại."));
      return false;
    } finally { lock.current = false; setSaving(false); }
  }, [fieldsRef, editGeneration, owner]);
  useEffect(() => {
    if (!dirty || saving || busy || historical || saveError || !source || isComposing || pending || recoveryOffer || offline) return;
    const timer = setTimeout(() => { if (!composing.current) void save(); }, 1200);
    return () => clearTimeout(timer);
  }, [fields, dirty, saving, busy, historical, saveError, source, save, isComposing, pending, recoveryOffer, offline]);
  useEffect(() => {
    const online = () => { setOffline(false); setSaveError(""); };
    const lost = () => setOffline(true);
    queueMicrotask(() => setOffline(!navigator.onLine));
    window.addEventListener("online", online); window.addEventListener("offline", lost);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", lost); };
  }, []);
  useEffect(() => {
    if (!dirty || !source || historical || !owner || recoveryOffer) return;
    const timer = setTimeout(() => { void writeReviewRecovery(owner, source.id, { revision: source.revision, sha: source.sourceSha256, fields, savedAt: Date.now() }).then(() => setRecoveryNotice("Đã giữ bản dự phòng mã hóa trong phiên trình duyệt này; chưa thay thế việc lưu server.")).catch(() => setRecoveryNotice("Không lưu được bản dự phòng. Giữ trang mở và thử lưu server; đừng đóng trình duyệt.")); }, 300);
    return () => clearTimeout(timer);
  }, [fields, dirty, source, owner, historical, recoveryOffer]);
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
    const proposed = fields.filter(f => f.status === "proposed").length;
    if (!reviewed && format !== "original" && proposed > 0) { setPending({ title: "Xuất với trường chưa xác nhận?", text: `Còn ${proposed} trường gợi ý. Các trường này giữ nguyên giá trị gốc; chỉ trường đã xác nhận mới được sửa trong bản xuất.`, action: () => void download(format, true, previewPdf) }); return; }
    // Open synchronously from the click/confirmation, before awaiting the authenticated fetch.
    const popup = previewPdf ? window.open("about:blank", "_blank") : null;
    if (previewPdf && !popup) { toast.error("Trình duyệt chặn tab mới. Hãy cho phép popup hoặc chọn Tải PDF."); return; }
    if (popup) popup.opener = null;
    setBusy(true); setError("");
    try {
      if (dirty && format !== "original" && !await save()) { popup?.close(); toast.error("Chưa lưu được thay đổi. Không xuất bản cũ."); return; }
      const saved = sourceRef.current;
      if (!saved || (format !== "original" && !historical && JSON.stringify(fieldsRef.current) !== JSON.stringify(saved.fields))) { popup?.close(); toast.error("Nội dung vừa thay đổi. Hãy thử xuất lại sau khi lưu."); return; }
      lock.current = true;
      const blob = await axiosClient.get<unknown, Blob>(`${base}/${saved.id}/export/${format}`, { params: { revision: saved.revision }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([blob], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      if (previewPdf) {
        if (popup && !popup.closed) popup.location.replace(url);
        else { URL.revokeObjectURL(url); return; }
      } else {
        const a = document.createElement("a"); a.href = url;
        a.download = format === "original" ? saved.name : `${saved.name.replace(/\.docx$/i, "")}-v${saved.revision}.${format}`;
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
  const visibleFields = fields.filter(f => (fieldStatus === "all" || f.status === fieldStatus) && (!fieldGroup || reviewGroup(f) === fieldGroup) &&
    `${f.label} ${f.party} ${f.original} ${f.value}`.toLocaleLowerCase("vi-VN").includes(fieldQuery.toLocaleLowerCase("vi-VN"))).sort((a, b) => reviewGroup(a).localeCompare(reviewGroup(b), "vi-VN"));
  const templateItems = source?.fields || [];
  const allTemplateItemsSelected = templateItems.length > 0 && templateItems.every(field => !!templateFields[field.id]);
  const recoverDraft = () => {
    if (!source || !recoveryOffer || recoveryOffer.sha !== source.sourceSha256 || recoveryOffer.revision !== source.revision) return;
    try {
      for (const field of recoveryOffer.fields) {
        const block = source.blocks.find(b => b.id === field.blockId);
        if (!block?.editable || field.length <= 0 || field.start < 0 || block.text.slice(field.start, field.start + field.length) !== field.original || field.value.length > 10000) throw new Error();
      }
      source.blocks.forEach(block => reviewedBlockText(block.text, block.id, recoveryOffer.fields));
      setFields(recoveryOffer.fields); setDirty(true); setRecoveryOffer(null); setSaveError("");
    } catch { toast.error("Bản dự phòng không khớp vùng dữ liệu gốc. Không áp dụng tự động."); }
  };
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
  const findResults = useMemo(() => !find.query ? [] : (source?.blocks || []).filter(block => block.editable).flatMap(block => findTextMatches(reviewedBlockText(block.text, block.id, fields), find.query, find.matchCase).map(match => ({ ...match, block }))), [source?.blocks, fields, find.query, find.matchCase]);
  const currentFindIndex = Math.min(findIndex, Math.max(0, findResults.length - 1));
  const navigateFind = (direction: number) => {
    if (!findResults.length) return;
    const next = (currentFindIndex + direction + findResults.length) % findResults.length;
    setFindIndex(next); setComparison(false); setPdfMode(false); setPreview(true);
    requestAnimationFrame(() => { const match = findResults[next]; const node = document.getElementById(`source-${match.block.id}`); node?.scrollIntoView({ block: "center", behavior: "smooth" }); const input = node?.querySelector("textarea"); if (input) { input.focus({ preventScroll: true }); input.setSelectionRange(match.from, match.to); } });
  };
  const replaceFound = (all: boolean) => {
    if (historical || busy || !findResults.length) return;
    try {
      const chosen = all ? findResults : [findResults[currentFindIndex]];
      let next = fields;
      for (const block of [...new Map(chosen.map(result => [result.block.id, result.block])).values()]) {
        const text = reviewedBlockText(block.text, block.id, fields);
        const value = replaceTextMatches(text, chosen.filter(result => result.block.id === block.id), find.replacement);
        if (text === value) continue;
        next = replaceReviewedBlock(block.text, block.id, value, next, crypto.randomUUID());
      }
      setFields(next); setFindIndex(0); setComparison(false); setPdfMode(false); setPreview(true);
      toast.success(`Đã thay ${chosen.length} vị trí. Có thể hoàn tác bằng Ctrl+Z.`);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Không thể thay thế nội dung."); }
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
        <WorkspaceExpandButton beforeExpand={() => { setLibraryOpen(false); setPanelOpen(false); }} />
        <Button variant="outline" disabled={busy || saving || dirty || !!recoveryOffer} title={dirty ? "Chờ lưu thay đổi trước khi tạo mẫu" : "Tạo bản mẫu riêng từ phiên bản đang xem"} onClick={() => { preparedTemplate.current = null; setTemplateError(""); setSharedTemplate(false); setTemplateAcknowledged(false); setTemplateFields({}); setTemplateForm({ name: `Mẫu ${source.name.replace(/\.docx$/i, "")}`.slice(0, 100), sourceId: source.id, revision: source.revision, clientId: crypto.randomUUID() }); }}><BookTemplate className="size-3.5" aria-hidden />Lưu thành mẫu</Button>
        <Button variant="outline" disabled={busy || saving} onClick={() => { setHistoryPage(1); setHistoryOpen(true); }}><History className="size-3.5" aria-hidden />Lịch sử v{source.revision}</Button>
        <Button size="icon" className="size-8" variant="outline" title="Hoàn tác (Ctrl/Cmd+Z)" aria-label="Hoàn tác" disabled={busy || historical || !edits.canUndo} onClick={edits.undo}><Undo2 className="size-4" aria-hidden /></Button>
        <Button size="icon" className="size-8" variant="outline" title="Làm lại (Ctrl/Cmd+Shift+Z)" aria-label="Làm lại" disabled={busy || historical || !edits.canRedo} onClick={edits.redo}><Redo2 className="size-4" aria-hidden /></Button>
        <Button variant="outline" disabled={busy || saving} onClick={() => void download("original")}><FileDown className="size-3.5" aria-hidden />File gốc</Button>
        <Button variant="outline" title="Xem trước bản Word đã sửa dưới dạng PDF trong tab mới, không tải file" disabled={busy || saving} onClick={() => void download("pdf", false, true)}><FileText className="size-3.5" aria-hidden />Xem Word</Button>
        <Button size="icon" variant="outline" title="Tải bản Word đã sửa (.docx)" aria-label="Tải Word đã sửa" disabled={busy || saving} onClick={() => void download("docx")}><Download className="size-3.5" /></Button>
        <Button variant="outline" disabled={busy || saving} onClick={() => void download("pdf", false, true)}><Eye className="size-3.5" aria-hidden />Xem PDF</Button>
        <Button variant="outline" disabled={busy || saving} onClick={() => void download("pdf")}><Download className="size-3.5" aria-hidden />Tải PDF</Button>
      </>}
    </div>
    {error && <div role="alert" className="space-y-2 border-b bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p>{conflict && source && <Button size="sm" variant="outline" disabled={busy} onClick={() => confirmLeave(() => void open(source.id))}>Mở lại bản mới nhất</Button>}</div>}
    {source && (saveError || historical) && <DocumentWorkspaceStatus state={historical ? "readonly" : saveError ? "error" : saving ? "saving" : dirty ? "unsaved" : "saved"}>
      {historical ? "Bản lịch sử chỉ đọc — không tự lưu." : saveError ? <><span>{saveError} Tự lưu đã tạm dừng; thay đổi vẫn ở trang này.</span><Button size="sm" variant="outline" disabled={saving || busy} onClick={() => void save()}>Lưu lại</Button><Button size="sm" variant="outline" disabled={saving || busy} onClick={() => confirmLeave(() => void open(source.id))}>Mở bản mới nhất</Button></> : saving ? "Đang lưu trên server — bạn có thể tiếp tục gõ." : dirty ? "Chưa lưu · Tự lưu sau 1,2 giây ngừng nhập." : lastSaved ? `Đã lưu lúc ${lastSaved} · v${source.revision}` : "Đã lưu trên server."}
    </DocumentWorkspaceStatus>}
    {(offline || (dirty && recoveryNotice)) && <p role="status" className="border-b bg-amber-50 p-3 text-sm text-amber-950">{offline && "Đang mất mạng — chưa lưu server. "}{recoveryNotice}</p>}
    {source && recoveryOffer && <div role="alert" className="space-y-2 border-b bg-amber-50 p-3 text-sm text-amber-950"><p>Tìm thấy bản dự phòng lúc {new Date(recoveryOffer.savedAt).toLocaleString("vi-VN")}. {recoveryOffer.revision !== source.revision || recoveryOffer.sha !== source.sourceSha256 ? "Bản server/file gốc đã khác; không tự ghi đè. Xem đối chiếu trước khi quyết định bỏ bản dự phòng." : "Bạn có thể khôi phục thay đổi chưa lưu trong phiên trình duyệt này."}</p><Button variant="outline" disabled={busy || recoveryOffer.sha !== source.sourceSha256} onClick={() => { try { source.blocks.forEach(block => reviewedBlockText(block.text, block.id, recoveryOffer.fields)); setRecoveryPreview(true); } catch { toast.error("Bản dự phòng không khớp vùng gốc."); } }}>Xem bản dự phòng</Button><Button variant="outline" disabled={busy || recoveryOffer.revision !== source.revision || recoveryOffer.sha !== source.sourceSha256} onClick={recoverDraft}>Khôi phục bản đang sửa</Button><Button variant="ghost" disabled={busy} onClick={() => { clearReviewRecovery(owner, source.id); setRecoveryOffer(null); }}>Bỏ bản dự phòng, dùng bản server</Button></div>}
    {busy && <p role="status" className="p-3 text-sm">Đang xử lý, vui lòng đợi...</p>}
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {libraryOpen && <DocumentLibraryPanel activeId={source?.id} refreshKey={source ? `${source.id}:${source.currentRevision}` : ""} disabled={busy || saving}
        onDeleted={(kind, id) => { if (kind === "imported" && sourceRef.current?.id === id) { sourceRef.current = null; setSource(null); edits.reset([]); setDirty(false); setSaveError(""); setPdfMode(false); setActive(""); } }}
        onClose={() => setLibraryOpen(false)} onOpen={id => confirmLeave(() => void open(id))}
        onOpenEditor={id => confirmLeave(() => router.push(`/contract-editor?document=${encodeURIComponent(id)}`))}
        onUseTemplate={id => confirmLeave(() => router.push(`/contract-editor?template=${encodeURIComponent(id)}`))} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    {!source ? <div className="m-6 flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/60 p-6 text-center sm:p-12"><h2 className="text-xl font-semibold">Kéo DOCX vào đây hoặc chọn Upload DOCX</h2><p className="mt-3 text-muted-foreground">Tối đa 10 MB. Giữ bản gốc, nhận diện dữ liệu theo vị trí, không cần placeholder. Đây là rà soát tài liệu, chưa tạo hoặc thay đổi hồ sơ hợp đồng nghiệp vụ.</p><Button className="mt-6 h-12 px-8" disabled={busy || saving} onClick={() => uploadRef.current?.click()}>Upload DOCX</Button></div> : <>
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="document-workspace-ui sm:max-w-2xl"><DialogHeader><DialogTitle className="break-all">{source.name} · v{source.revision}</DialogTitle><DialogDescription>Thông tin tài liệu và giới hạn chỉnh sửa. File gốc được giữ nguyên.</DialogDescription></DialogHeader><div className="max-h-[65dvh] space-y-2 overflow-y-auto pt-3"><p className="font-semibold text-foreground">{source.name} · v{source.revision} {dirty ? "· Chưa lưu" : "· Đã lưu"}</p><p>File gốc: {(source.sizeBytes / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB · Nhập lúc {date(source.createdAtUtc)} · Được giữ nguyên, không ghi đè</p><p>{source.warning}</p><p>Đã đọc {source.blocks.filter(b => b.text.trim()).length} đoạn/ô có văn bản · {source.blocks.filter(b => !b.editable && b.text.trim()).length} vùng chỉ xem · {fields.length} trường đang rà soát. Nhận diện theo nhãn, không phải AI/OCR; kết quả có thể thiếu hoặc sai.</p>{fields.length >= 500 && <p className="text-amber-700 dark:text-amber-400">Đã đạt giới hạn 500 trường. Một số dữ liệu có thể chưa được đưa vào danh sách.</p>}<p className="break-all">SHA-256 gốc: {source.sourceSha256}</p>{historical && <div className="flex flex-wrap items-center gap-3 text-primary"><span>Đang xem bản cũ, chỉ đọc.</span><Button size="sm" disabled={busy} onClick={() => setPending({ title: "Khôi phục phiên bản này?", text: "Giữ toàn bộ lịch sử và lưu bản đang xem thành phiên bản mới.", action: () => void restore() })}>Khôi phục thành bản mới</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void open(source.id)}>Mở bản mới nhất</Button></div>}</div></DialogContent></Dialog>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-card px-3 py-1.5 [&_button]:h-8 [&_button]:rounded-lg">
            <Button size="sm" variant="ghost" className="mr-1 max-w-[240px] gap-2" title={source.name} onClick={() => setInfoOpen(true)}><FileText className="size-4 shrink-0" /><span className="truncate">{source.name}</span><span className="shrink-0 text-muted-foreground">v{source.revision}</span></Button>
            {!saveError && !historical && <span role="status" title={lastSaved ? `Lưu lúc ${lastSaved}` : undefined} className="mr-2 inline-flex items-center gap-1.5 whitespace-nowrap border-r pr-3 text-sm text-muted-foreground">{saving ? <Loader2 className="size-3.5 animate-spin" /> : dirty ? <CircleDashed className="size-3.5 text-amber-600" /> : <CheckCircle2 className="size-3.5 text-emerald-600" />}{saving ? "Đang lưu" : dirty ? "Chưa lưu" : "Đã lưu"}</span>}
          {!comparison && <DocumentFindReplace compact value={find} onChange={value => { setFind(value); setFindIndex(0); }} count={findResults.length} index={currentFindIndex} onNavigate={navigateFind} onReplace={replaceFound} disabled={historical || busy || !!recoveryOffer} note="Tìm trong các đoạn/ô có thể chỉnh sửa; không thay vùng chỉ đọc, ảnh hoặc header/footer. Thay tất cả có thể hoàn tác một lần bằng Ctrl+Z." />}
            <Button size="sm" title="Đặt bản gốc và bản đang sửa cạnh nhau" variant={comparison ? "secondary" : "ghost"} onClick={() => { setComparison(v => !v); setPdfMode(false); }}> {comparison ? "Chỉnh sửa" : "Đối chiếu"}</Button>
            <Button size="sm" variant={panelOpen ? "secondary" : "ghost"} aria-expanded={panelOpen} onClick={() => setPanelOpen(value => !value)}>Rà soát ({fields.length})</Button>
            {!comparison && <><Button size="sm" variant="ghost" onClick={() => { setSelected(null); setPdfMode(false); setPreview(value => !value); }}>{preview ? "Gán vùng" : "Chỉnh sửa"}</Button>
            <Button size="sm" variant={pdfMode ? "secondary" : "ghost"} disabled={busy || saving || (dirty && !pdfMode)} onClick={() => setPdfMode(v => !v)}>{pdfMode ? "Đóng PDF" : "PDF"}</Button></>}
            {historical && <Button size="sm" disabled={busy} onClick={() => setPending({ title: "Khôi phục phiên bản này?", text: "Tạo phiên bản mới từ bản đang xem, không xóa lịch sử.", action: () => void restore() })}>Khôi phục bản này</Button>}
          </div>
          {comparison ? <ImportedReviewComparison id={source.id} revision={source.revision} blocks={source.blocks} fields={fields} dirty={dirty} readOnly={historical || busy || !!recoveryOffer} onFocus={id => { setComparison(false); const field = fields.find(f => f.blockId === id); if (field) focus(field); else requestAnimationFrame(() => document.getElementById(`source-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })); }} onRestore={id => setPending({ title: "Khôi phục đoạn gốc?", text: "Bỏ các thay đổi của đoạn này trong bản đang sửa. File gốc và lịch sử server không bị xóa.", action: () => setFields(previous => previous.map(f => f.blockId === id ? { ...f, value: f.original, status: "proposed" } : f)) })} /> : pdfMode ? <DocumentPdfPreview key={`${source.id}:${source.revision}`} kind="imported" id={source.id} revision={source.revision} /> : <ImportedDocumentCanvas blocks={source.blocks} fields={fields} original={!preview} readOnly={historical || !!recoveryOffer} busy={busy}
            onChange={editBlock} renderOriginal={renderText} onSelect={capture}
            onFocusBlock={id => { const field = fields.find(f => f.blockId === id); if (field) setActive(field.id); }}
            panelOpen={panelOpen} onTogglePanel={() => setPanelOpen(value => !value)} />}
        </div>
        <aside className={`${panelOpen ? "block" : "hidden"} absolute inset-y-0 right-0 z-20 w-[min(360px,90vw)] shrink-0 space-y-4 overflow-y-auto border-l bg-card p-4 shadow-xl lg:static lg:w-[288px] lg:shadow-none xl:w-[324px]`}><div className="flex justify-end lg:hidden"><Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Đóng dữ liệu</Button></div><h2 className="font-semibold">Dữ liệu cần rà soát ({fields.length})</h2><p className="text-xs text-muted-foreground">Nhập giá trị thay thế sẽ áp dụng ngay trên văn bản và tự lưu. Gợi ý nhận diện chưa chỉnh vẫn cần Xác nhận để áp dụng. Bên A/B là ngữ cảnh gợi ý, hãy kiểm tra lại; không suy ra khách hàng chỉ từ ký hiệu bên.</p>
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">{(["proposed", "confirmed", "ignored"] as const).map(status => <div key={status}><p className="text-lg font-semibold tabular-nums">{fields.filter(f => f.status === status).length}</p><p className="text-muted-foreground">{status === "proposed" ? "Chờ rà soát" : status === "confirmed" ? "Đã xác nhận" : "Bỏ qua"}</p></div>)}</div>
            <Input aria-label="Tìm trường rà soát" placeholder="Tìm tên trường hoặc giá trị..." maxLength={100} showControls={false} value={fieldQuery} onChange={e => setFieldQuery(e.target.value)} />
            <RoundedSelect aria-label="Lọc trạng thái rà soát" value={fieldStatus} onValueChange={setFieldStatus} options={[{ value: "all", label: "Tất cả trạng thái" }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} />
          </div>
          <div className="space-y-3">
          <RoundedSelect aria-label="Lọc nhóm thông tin" value={fieldGroup} onValueChange={setFieldGroup} options={[{ value: "", label: "Tất cả nhóm thông tin" }, ...REVIEW_GROUPS.map(group => ({ value: group, label: `${group} (${fields.filter(f => reviewGroup(f) === group).length})` }))]} />
          <fieldset disabled={busy || historical || !!recoveryOffer} className="min-w-0 disabled:opacity-60">
            {selected && <div id="manual-field-selection" className="space-y-2 rounded-xl border border-primary bg-primary/5 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Gán trường thủ công</p><Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Hủy chọn</Button></div><p className="text-xs text-muted-foreground">{selected.blockId} · {selected.length} ký tự</p><p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-sm">{selected.original}</p><Input aria-label="Tên trường gán thủ công" maxLength={100} value={manualLabel} onChange={e => setManualLabel(e.target.value)} /><Button size="sm" disabled={!manualLabel.trim() || fields.length >= 500} onClick={() => { const existing = fields.find(f => f.blockId === selected.blockId && f.start === selected.start && f.length === selected.length); if (existing) focus(existing); else { const field: Field = { ...selected, id: crypto.randomUUID(), value: selected.original, label: manualLabel.trim(), party: "Chưa xác định", status: "proposed" }; setFields(previous => [...previous, field]); focus(field, false); setDirty(true); } setSelected(null); }}>Gán thành trường</Button></div>}
          </fieldset>
            {fields.length > 0 && visibleFields.length === 0 && <p className="text-sm text-muted-foreground">Không có trường khớp bộ lọc.</p>}
            {fields.length === 0 && <p className="text-sm text-muted-foreground">Chưa nhận diện được trường. Bôi đen giá trị trong bản gốc rồi gán thủ công.</p>}
            {visibleFields.map(field => <DocumentFieldCard key={field.id} id={`field-${field.id}`} title={field.label}
              subtitle={`${field.party} · ${field.blockId} · ${field.original}`} status={statusLabel[field.status]} expanded={active === field.id}
              onToggle={() => active === field.id ? setActive("") : focus(field)}>
              <fieldset disabled={busy || historical || !!recoveryOffer} className="min-w-0 space-y-3 disabled:opacity-60">
                <p className="text-xs text-muted-foreground">{source.blocks.find(b => b.id === field.blockId)?.context} · {field.blockId} · Vị trí {field.start}–{field.start + field.length}</p>
                <div className="space-y-1"><Label htmlFor={`label-${field.id}`}>Tên trường</Label><Input id={`label-${field.id}`} maxLength={100} showControls={false} value={field.label} onChange={e => change(field.id, { label: e.target.value, status: "proposed" })} /></div>
                <div className="space-y-1"><Label htmlFor={`party-${field.id}`}>Nhóm thông tin</Label><RoundedSelect id={`party-${field.id}`} value={reviewGroup(field)} onValueChange={party => change(field.id, { party })} options={REVIEW_GROUPS.map(value => ({ value, label: value }))} /><p className="text-xs text-muted-foreground">Nhóm chưa rõ cần bạn xác định; hệ thống không đoán Khách hàng chỉ từ Bên A/B.</p></div>
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
    <Dialog open={recoveryPreview && !!recoveryOffer} onOpenChange={setRecoveryPreview}><DialogContent className="flex h-[85vh] max-w-[95vw] flex-col sm:max-w-5xl"><DialogHeader><DialogTitle>Bản dự phòng so với file gốc</DialogTitle><DialogDescription>Chỉ đối chiếu; không tự ghi đè phiên bản server hiện tại.</DialogDescription></DialogHeader>{source && recoveryOffer && <ImportedReviewComparison id={source.id} revision={source.revision} blocks={source.blocks} fields={recoveryOffer.fields} dirty readOnly onRestore={() => {}} onFocus={() => {}} />}</DialogContent></Dialog>
    <Dialog open={listOpen} onOpenChange={setListOpen}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Hồ sơ hợp đồng cũ của tôi</DialogTitle><DialogDescription>Chỉ tài khoản và tenant hiện tại được truy cập.</DialogDescription></DialogHeader><Input aria-label="Tìm hồ sơ nhập" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm tên file..." />{list.map(item => <Button variant="outline" key={item.id} disabled={busy} className="h-auto justify-start whitespace-normal text-left" onClick={() => confirmLeave(() => void open(item.id))}><span className="flex min-w-0 flex-col gap-1"><span>{item.name} · v{item.revision}</span><span className="text-xs font-normal text-muted-foreground">{(item.sizeBytes / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} KB · {date(item.createdAtUtc)}</span></span></Button>)}{!list.length && <p>Chưa có hồ sơ.</p>}<div className="flex items-center justify-end gap-3"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</Button><span>{page}/{pages}</span><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau</Button></div></DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Lịch sử rà soát</DialogTitle><DialogDescription>Chọn bản để xem hoặc xuất. Khôi phục luôn tạo bản mới, không xóa hay ghi đè lịch sử.</DialogDescription></DialogHeader>
      <div className="space-y-2">{history.map(item => <button type="button" disabled={busy} key={item.revision} className="w-full space-y-2 rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50" onClick={() => source && confirmLeave(() => void open(source.id, item.revision))}>
        <span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">Phiên bản {item.revision}{item.isCurrent ? " · Mới nhất" : ""}</span><span className="text-xs text-muted-foreground">{date(item.createdAtUtc)}</span></span>
        <span className="block text-xs text-muted-foreground">{item.totalFields} trường · {item.confirmed} đã xác nhận · {item.changed} thay đổi so với gốc</span>
      </button>)}</div>
      {historyPages > 1 && <div className="flex items-center justify-end gap-3"><Button variant="ghost" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Trước</Button><span>{historyPage}/{historyPages}</span><Button variant="ghost" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(p => p + 1)}>Sau</Button></div>}
    </DialogContent></Dialog>
    <Dialog open={!!templateForm} onOpenChange={open => { if (!open && !busy) { setTemplateForm(null); preparedTemplate.current = null; } }}><DialogContent className="document-workspace-ui max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Chọn thông tin chuyển thành chỗ điền</DialogTitle><DialogDescription>Tạo mẫu riêng từ bản đã lưu v{templateForm?.revision}. Những vùng được chọn sẽ thành chỗ điền, không mang giá trị khách hàng cũ sang mẫu. File gốc không thay đổi.</DialogDescription></DialogHeader>
      <Label htmlFor="import-template-name">Tên mẫu</Label><Input id="import-template-name" maxLength={100} disabled={busy} value={templateForm?.name || ""} onChange={e => setTemplateForm(form => form ? { ...form, name: e.target.value } : form)} />
      <div className="space-y-3"><h3 className="font-semibold">Các giá trị đã thay đổi</h3><div className="flex items-center gap-2"><Checkbox id="select-all-template-items" checked={allTemplateItemsSelected ? true : Object.keys(templateFields).length ? "indeterminate" : false} disabled={busy || !templateItems.length || templateItems.length > 200} onCheckedChange={checked => { preparedTemplate.current = null; setTemplateAcknowledged(false); setTemplateFields(checked === true ? Object.fromEntries(templateItems.map((field, index) => [field.id, reviewTemplateKey(field, index)])) : {}); }} /><Label htmlFor="select-all-template-items" className="cursor-pointer">Chọn tất cả</Label></div>{templateItems.length > 200 && <p className="text-sm text-muted-foreground">Tối đa 200 mục mỗi mẫu. Hãy chọn từng mục cần dùng.</p>}<div className="max-h-72 space-y-2 overflow-auto rounded-xl border p-3">{templateItems.map((field, index) => <label key={field.id} className="flex items-start gap-2 rounded-lg border p-2"><input type="checkbox" checked={!!templateFields[field.id]} disabled={busy || (!templateFields[field.id] && Object.keys(templateFields).length >= 200)} onChange={e => { preparedTemplate.current = null; setTemplateAcknowledged(false); setTemplateFields(current => { const next = { ...current }; if (e.target.checked) next[field.id] = reviewTemplateKey(field, index); else delete next[field.id]; return next; }); }} /><span className="min-w-0"><strong>{field.label}</strong><span className="block text-xs text-muted-foreground">{reviewGroup(field)} · {field.blockId}</span><span className="block break-words">{field.status === "confirmed" ? field.value : field.original} → [{field.label}]</span></span></label>)}{!templateItems.length && <p>Chưa có vùng được gán. Có thể quay lại bôi đen và gán thông tin cần thay trước khi tạo mẫu.</p>}</div></div>
      <div className="rounded-xl border bg-amber-50 p-3 text-sm text-amber-950">Mẫu vẫn giữ dữ liệu ngoài các vùng đã chọn. Bố cục Word phức tạp có thể không được bảo toàn khi chuyển sang editor. Hãy kiểm tra bản PDF sau khi chuyển.</div>
      <TemplatePrivacyOptions shared={sharedTemplate} onChange={value => { setSharedTemplate(value); if (templateForm) setTemplateForm({ ...templateForm, clientId: crypto.randomUUID() }); }} canShare={canManageTemplates} acknowledged={templateAcknowledged} onAcknowledge={setTemplateAcknowledged} disabled={busy} />
      {templateError && <p role="alert" className="text-sm text-destructive">{templateError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setTemplateForm(null); preparedTemplate.current = null; }}>Hủy</Button><Button disabled={busy || saving || dirty || !templateAcknowledged || !templateForm?.name.trim()} onClick={() => void createEditorTemplate()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <BookTemplate className="size-4" />}{busy ? "Đang tạo mẫu..." : "Lưu mẫu và mở soạn thảo"}</Button></div></DialogContent></Dialog>
    <ConfirmDialog isOpen={pending !== null} isLoading={saving || busy} onClose={() => setPending(null)} title={pending?.title || "Xác nhận"} description={pending?.text || ""} confirmText="Tiếp tục" onConfirm={() => { const action = pending?.action; setPending(null); action?.(); }} />
  </main></>;
}
export default function ImportedContractPage() { return <PermissionGuard permission={RBAC_PERMISSIONS.contractCreate}><Review /></PermissionGuard>; }
