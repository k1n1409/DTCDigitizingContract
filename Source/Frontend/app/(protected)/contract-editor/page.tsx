"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, FileText, Plus, Save, Download, Search, Trash2, Library, Undo2, Redo2, FileDown, Loader2, Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { DocumentLibraryPanel } from "@/components/contracts/document-library-workspace";
import { DocumentWorkspaceStatus } from "@/components/contracts/document-workspace-status";
import { WorkspaceExpandButton } from "@/components/contracts/document-workspace-view";
import { TemplatePrivacyOptions } from "@/components/contracts/template-privacy-options";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { editorFieldLabel } from "@/lib/editor-smart-fields";
import { RoundedSelect } from "@/components/ui/custom/rounded-select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ContractRichTextEditor } from "@/components/ui/custom/contract-rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentFieldCard, DocumentFieldValue } from "@/components/ui/custom/document-field-card";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { useAuthStore } from "@/hooks/use-auth-store";
import { RBAC_PERMISSIONS } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";
import { parseContractRichText, serializeContractRichText, type ContractRichTextParagraph } from "@/lib/contract-rich-text";
import { getApiErrorMessage } from "@/lib/api-error";
import axiosClient from "@/lib/axios-interceptor";
import { toast } from "@/components/ui/sonner";
import { useEditorServerDraft, type EditorSnapshot } from "@/hooks/use-editor-server-draft";
import { EditorDraftsDialog } from "@/components/contracts/editor-drafts-dialog";
import { EditorDataPanel, editorFieldKeys, resolveEditorFields } from "@/components/contracts/editor-data-panel";
import { ContractRichTextContent } from "@/components/ui/custom/contract-rich-text-content";
import { getBlobApiErrorMessage } from "@/lib/api-error";
import { EditorBlocksPanel } from "@/components/contracts/editor-blocks-panel";
import { DocumentPdfPreviewDialog, type PdfPreviewDocument } from "@/components/contracts/document-pdf-preview-dialog";
import { usePreviewScrollReturn } from "@/hooks/use-preview-scroll-return";
import { EditorSnippetsPanel } from "@/components/contracts/editor-snippets-panel";
import { DocumentLayoutDialog } from "@/components/contracts/document-layout-dialog";
import { EditorContractBindingDialog } from "@/components/contracts/editor-contract-binding-dialog";
import { checkEditorDocument } from "@/lib/document-preflight";
import { DEFAULT_DOCUMENT_LAYOUT, documentPageSize } from "@/lib/contract-rich-text";
import { LayoutTemplate, FilePlus2 } from "lucide-react";

type Field = { label: string; original: string; value: string; paragraph: number };
function paragraphs(content: string) {
  const doc = parseContractRichText(content);
  const result: ContractRichTextParagraph[] = [];
  for (const block of doc.blocks) {
    if (block.type === "paragraph") { if (!block.locked) result.push(block); }
    else for (const row of block.rows) for (const cell of row.cells) result.push(...cell.paragraphs);
  }
  return { doc, result };
}

function EditorContent() {
  const router = useRouter();
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<{ key: string; detach?: (replacement?: string) => void } | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const user = useAuthStore(s => s.user);
  const [content, setContent] = useState(serializeContractRichText({ blocks: [{ type: "paragraph", runs: [{ text: "" }] }] }));
  const [title, setTitle] = useState("Hợp đồng mới");
  const [fields, setFields] = useState<Field[]>([]);
  const [activeReviewField, setActiveReviewField] = useState<number | null>(null);
  const [deleteReviewField, setDeleteReviewField] = useState<number | null>(null);
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [draftDialog, setDraftDialog] = useState<"list" | "history" | "templates" | null>(null);
  const [bindingDocument, setBindingDocument] = useState<{ id: string; revision: number } | null>(null);
  const [templateConfirm, setTemplateConfirm] = useState(false);
  const [sharedTemplate, setSharedTemplate] = useState(false);
  const [templateAcknowledged, setTemplateAcknowledged] = useState(false);
  const [sideTab, setSideTab] = useState<"blocks" | "data">("data");
  const [preview, setPreview] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewDocument | null>(null);
  const pdfMode = pdfPreview !== null;
  const [documentEpoch, setDocumentEpoch] = useState(0);
  const pdfButtonRef = useRef<HTMLButtonElement>(null);
  const { viewportRef: editorViewportRef, capture: captureEditorPosition, clear: clearEditorPosition } =
    usePreviewScrollReturn<HTMLElement>(pdfMode, documentEpoch);
  const [insertRequest, setInsertRequest] = useState<{ id: string; content: string }>();
  const [historyRequest, setHistoryRequest] = useState<{ id: string; action: "undo" | "redo" }>();
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const uploadRef = useRef<HTMLInputElement>(null);
  const draftKey = `contract-editor:${user?.tenantId}:${user?.employeeId}`;
  const applySnapshot = (value: EditorSnapshot) => {
    parseContractRichText(value.content);
    clearEditorPosition();
    setPdfPreview(null);
    setInsertRequest(undefined);
    setHistoryRequest(undefined);
    setHistoryState({ canUndo: false, canRedo: false });
    setDocumentEpoch(epoch => epoch + 1);
    setContent(value.content); setTitle(value.title); setBindings(value.bindings || {}); setFields([]); setWarning("");
  };
  const server = useEditorServerDraft({ title, content, bindings }, dirty, setDirty, applySnapshot, busy || pending !== null || templateConfirm || layoutOpen);
  const libraryEntryOpened = useRef(false);
  useEffect(() => {
    if (libraryEntryOpened.current) return;
    libraryEntryOpened.current = true;
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("template");
    const documentId = params.get("document");
    const id = templateId || documentId;
    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      void server.open(id, undefined, !!templateId);
    }
  }, [server]);
  const locked = busy || server.saving || server.loading;
  const documentModel = parseContractRichText(content);
  const pageLayout = documentModel.layout || DEFAULT_DOCUMENT_LAYOUT;
  const pageSize = documentPageSize(pageLayout);
  const ensureDocumentReady = () => {
    const blocking = checkEditorDocument(content, bindings).filter(check => check.blocking);
    if (!blocking.length) return true;
    const missing = blocking.filter(check => check.fieldKey);
    if (missing.length) {
      toast.error(`Cần bổ sung ${missing.length} thông tin trước khi tiếp tục.`);
      setPdfPreview(null);
      setPreview(false);
      selectField(missing[0].fieldKey!);
    } else toast.error(blocking[0].description);
    return false;
  };
  const prepareContract = async () => {
    if (locked || !ensureDocumentReady()) return;
    setBusy(true);
    try { const saved = await server.save(); if (saved) router.push(`/contracts/create-from-word?editorDocument=${encodeURIComponent(saved.id)}&editorRevision=${saved.revision}`); else toast.error("Chưa lưu được tài liệu, chưa chuyển sang tạo hợp đồng."); }
    finally { setBusy(false); }
  };
  const previewPdf = async () => {
    if (locked || pdfMode) return;
    captureEditorPosition();
    setBusy(true);
    try {
      const saved = await server.save();
      if (!saved) {
        clearEditorPosition();
        toast.error("Chưa lưu được tài liệu, không xem bản cũ.");
        return;
      }
      setPdfPreview({ kind: saved.isTemplate ? "template" : "editor", id: saved.id, revision: saved.revision, title });
    }
    finally { setBusy(false); }
  };
  const canManageTemplates = hasPermission(user?.permissions, RBAC_PERMISSIONS.templateManage);
  const missingFields = editorFieldKeys(content).filter(key => !bindings[key]?.trim());
  const selectField = (key: string, detach?: (replacement?: string) => void) => { setSelectedField({ key, detach }); setFieldValue(bindings[key] || ""); };
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);
  const update = (value: string) => { setContent(value); setDirty(true); setFields([]); };
  const confirmReplace = (action: () => void) => { if (dirty) setPending(() => action); else action(); };
  const detect = () => {
    const found: Field[] = [];
    paragraphs(content).result.forEach((p, paragraph) => {
      const text = p.runs.map(r => r.text).join("");
      const placeholders = [...text.matchAll(/\{\{\s*([^{}\n]+)\s*\}\}/g)];
      for (const match of placeholders) found.push({ label: match[1].trim(), original: match[0], value: match[0], paragraph });
      const match = text.match(/(?:^|\n)\s*(Tên (?:khách hàng|công ty)|Mã số thuế|Địa chỉ|Điện thoại|Email|Số hợp đồng|Ngày (?:ký|hiệu lực)|Đại diện|Chức vụ|Giá trị hợp đồng)\s*[:：]\s*([^\n]+)/i);
      if (match) found.push({ label: match[1], original: match[2], value: match[2], paragraph });
    });
    setFields(found.slice(0, 200));
    toast.info(found.length ? `Tìm thấy ${Math.min(found.length, 200)} trường gợi ý. Hãy kiểm tra trước khi áp dụng.` : "Chưa tìm thấy trường theo nhãn hoặc {{placeholder}}. Bạn vẫn có thể sửa trực tiếp nội dung.");
  };
  const applyField = (index: number, remove = false) => {
    const field = fields[index];
    const { doc, result } = paragraphs(content);
    const p = result[field.paragraph];
    const text = p?.runs.map(r => r.text).join("");
    if (!p || !text?.includes(field.original)) { toast.error("Nội dung đã thay đổi. Hãy nhận diện lại."); return; }
    const start = text.indexOf(field.original);
    const end = start + field.original.length;
    let offset = 0;
    let inserted = false;
    p.runs = p.runs.flatMap(run => {
      const from = offset; offset += run.text.length;
      if (offset <= start || from >= end) return [run];
      const parts = [];
      if (from < start) parts.push({ ...run, text: run.text.slice(0, start - from) });
      if (!inserted) { parts.push({ ...run, text: remove ? "" : field.value }); inserted = true; }
      if (offset > end) parts.push({ ...run, text: run.text.slice(end - from) });
      return parts;
    });
    setContent(serializeContractRichText(doc)); setDirty(true); setFields([]);
    toast.success(remove ? "Đã xóa giá trị trong nội dung." : "Đã cập nhật giá trị. Nhận diện lại nếu muốn sửa tiếp các trường.");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (server.saving || server.loading) { toast.info("Đợi tài liệu lưu xong rồi chọn lại file DOCX."); return; }
    if (!/\.docx$/i.test(file.name) || file.size === 0 || file.size > 10 * 1024 * 1024) { toast.error("Chọn DOCX không rỗng, tối đa 10 MB."); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.append("file", file);
      const result = await axiosClient.post<unknown, { content: string; warning: string }>("/api/contract-document-editor/import", form, { headers: { "Content-Type": "multipart/form-data" } });
      server.detach(); setBindings({});
      setDocumentEpoch(epoch => epoch + 1);
      setContent(result.content); setTitle(file.name.replace(/\.docx$/i, "").slice(0, 100)); setWarning(result.warning); setFields([]); setDirty(true);
      toast.success("Đã nhập DOCX. Hãy kiểm tra nội dung và nhận diện trường.");
    } catch (error) { toast.error(getApiErrorMessage(error, "Không nhập được DOCX.")); }
    finally { setBusy(false); }
  };
  const download = async (format: "docx" | "pdf", previewOnly = false) => {
    if (locked || !ensureDocumentReady()) return;
    const popup = previewOnly ? window.open("about:blank", "_blank") : null;
    if (previewOnly && !popup) { toast.error("Trình duyệt chặn tab xem trước. Hãy cho phép mở tab mới."); return; }
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      const saved = await server.save();
      if (!saved) { popup?.close(); toast.error("Chưa lưu được bản đang sửa. Không xuất phiên bản cũ; hãy thử lưu lại."); return; }
      const blob = await axiosClient.get<unknown, Blob>(`/api/document-library/${saved.isTemplate ? "template" : "editor"}/${saved.id}/export/${format}`, { params: { revision: saved.revision }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([blob], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      if (previewOnly) {
        if (popup && !popup.closed) popup.location.replace(url);
        else { URL.revokeObjectURL(url); return; }
      } else { const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[\\/:*?"<>|]/g, "-") || "Hop dong"}.${format}`; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 300000);
    } catch (error) { popup?.close(); toast.error(await getBlobApiErrorMessage(error, "Không xuất được tài liệu. Với PDF, kiểm tra cấu hình LibreOffice của môi trường.")); }
    finally { setBusy(false); }
  };
  return <main className="document-workspace-ui flex min-h-0 flex-1 flex-col bg-muted/40" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={e => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); if (locked) return; const files = [...e.dataTransfer.files]; if (files.length !== 1) { toast.error("Kéo một tệp DOCX mỗi lần."); return; } confirmReplace(() => void importFile(files[0])); }}>
    <header inert={busy} className="flex min-h-[4rem] shrink-0 flex-wrap items-center gap-3 border-b border-border bg-primary px-4 py-3">
      <div className="flex w-48 shrink-0 items-center gap-2 xl:w-64"><FileText className="size-5 shrink-0 text-primary-foreground" /><Input className="min-w-0 bg-background text-foreground" showControls={false} aria-label="Tên tài liệu" value={title} maxLength={100} onChange={e => { setTitle(e.target.value); setDirty(true); }} /></div>
      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 lg:basis-0 [&_button]:h-9">
      <WorkspaceExpandButton beforeExpand={() => setLibraryOpen(false)} />
      <Button variant="outline" disabled={locked} onClick={() => void server.save()}><Save className="size-4 mr-2" />{server.saving ? "Đang lưu..." : "Lưu server"}</Button>
      <Button size="icon" variant="outline" title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác văn bản" disabled={locked || preview || pdfMode || !historyState.canUndo} onClick={() => setHistoryRequest({ id: crypto.randomUUID(), action: "undo" })}><Undo2 className="size-4" /></Button>
      <Button size="icon" variant="outline" title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại văn bản" disabled={locked || preview || pdfMode || !historyState.canRedo} onClick={() => setHistoryRequest({ id: crypto.randomUUID(), action: "redo" })}><Redo2 className="size-4" /></Button>
      <Button variant="outline" onClick={() => setLibraryOpen(v => !v)}><Library className="mr-2 size-4" />Thư viện</Button>
      <Button variant="outline" disabled={locked || !content} onClick={() => { setSharedTemplate(false); setTemplateAcknowledged(false); setTemplateConfirm(true); }}>Lưu thành mẫu mới</Button>
      <Button ref={pdfButtonRef} type="button" variant="outline" aria-haspopup="dialog" aria-expanded={pdfMode} disabled={locked || !content} onClick={() => void previewPdf()}>
        <Eye aria-hidden className="size-4" /> Xem thử PDF
      </Button>
      <Button variant="outline" title="Xem trước bản Word dưới dạng PDF trong tab mới, không tải file" disabled={locked || !content} onClick={() => void download("pdf", true)}><FileText className="size-4 mr-2" />Xem Word</Button>
      <Button size="icon" variant="outline" title="Tải Word (.docx)" aria-label="Tải Word" disabled={locked || !content} onClick={() => void download("docx")}><Download className="size-4" /></Button>
      </div>
      <Button variant="secondary" className="h-9 shrink-0 gap-2 rounded-lg bg-white px-4 font-semibold text-primary shadow-sm hover:bg-white/90" disabled={busy || server.loading || !content} onClick={() => void download("pdf")}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}{busy ? "Đang xuất..." : "Xuất PDF"}</Button>
    </header>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2 [&>button]:border-slate-300 dark:[&>button]:border-slate-600">
      <Button variant="outline" disabled={locked} onClick={() => setLayoutOpen(true)}><LayoutTemplate className="mr-2 size-4" />Bố cục trang</Button>
      <Button variant="outline" disabled={locked || !content} onClick={() => void prepareContract()}><FilePlus2 className="mr-2 size-4" />Tạo hợp đồng từ tài liệu này</Button>
      <Button variant="outline" disabled={locked || !content} onClick={() => { if (!ensureDocumentReady()) return; void server.save().then(saved => { if (saved) setBindingDocument({ id: saved.id, revision: saved.revision }); else toast.error("Chưa lưu được bản đang soạn, chưa thể cập nhật hợp đồng."); }); }}><Save className="mr-2 size-4" />Cập nhật tài liệu cho hợp đồng đã có</Button>
      <Button variant="outline" disabled={locked} onClick={() => confirmReplace(() => { server.detach(); applySnapshot({ title: "Hợp đồng mới", content: "", bindings: {} }); setDirty(false); })}><Plus className="mr-2 size-4" />Tài liệu trắng</Button>
    </div>
    <DocumentWorkspaceStatus state={server.error ? "error" : server.saving ? "saving" : dirty || !server.identity ? "unsaved" : "saved"}>{server.error ? <><span>{server.error} Thay đổi chưa được lưu lên server.</span><Button size="sm" variant="outline" disabled={locked} onClick={() => void server.save()}>Thử lưu lại</Button></> : server.saving ? "Đang lưu — bạn có thể tiếp tục soạn thảo." : dirty ? "Có thay đổi mới · Tự lưu sau 2 giây ngừng nhập." : server.identity ? `Đã lưu trên server · phiên bản ${server.identity.revision}` : "Tài liệu mới · Bắt đầu soạn hoặc chọn một mẫu trong thư viện."}</DocumentWorkspaceStatus>
    {server.identity?.isTemplate && <p className="border-b bg-primary/5 px-4 py-2 text-sm text-primary">Đang sửa {server.identity.isSharedTemplate ? "mẫu dùng chung trong tenant" : "mẫu cá nhân — chỉ bạn truy cập được"}. Lưu server tạo phiên bản mới; không sửa tài liệu đã tạo từ mẫu.</p>}
    <input hidden type="file" accept=".docx" ref={uploadRef} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
    <div className="relative flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row">
      {libraryOpen && <DocumentLibraryPanel activeId={server.identity?.id} refreshKey={`${server.identity?.id}-${server.identity?.revision}`} disabled={locked || dirty} onClose={() => setLibraryOpen(false)} onOpen={id => confirmReplace(() => router.push(`/contract-import?document=${encodeURIComponent(id)}`))} onOpenEditor={id => confirmReplace(() => void server.open(id))} onUseTemplate={id => confirmReplace(() => void server.open(id, undefined, true))} onDeleted={(_, id) => { if (server.identity?.id === id) { server.detach(); applySnapshot({ title: "Hợp đồng mới", content: "", bindings: {} }); setDirty(false); } }} />}
      <Dialog open={toolsOpen} onOpenChange={setToolsOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{sideTab === "blocks" ? "Bố cục tài liệu" : "Thông tin cần điền"}</DialogTitle><DialogDescription>Điền một lần, các vị trí liên kết trong tài liệu sẽ cập nhật cùng nhau. Không thay đổi danh mục khách hàng.</DialogDescription></DialogHeader>
      <div className="space-y-4" inert={busy || server.loading}>
        <p className="text-xs text-muted-foreground">Tài liệu độc lập, chưa tạo/cập nhật hồ sơ hợp đồng hay thay bản đã duyệt/ký.</p>
        {sideTab === "blocks" && <EditorBlocksPanel content={content} onChange={update} />}
        <div hidden={sideTab !== "data"}><EditorDataPanel mode="fields" initialOnlyMissing key={documentEpoch} content={content} bindings={bindings} onChange={value => { setBindings(value); setDirty(true); }} onInsert={key => { const doc = parseContractRichText(content); doc.blocks.push({ type: "paragraph", runs: [{ text: `{{${key}}}` }] }); update(serializeContractRichText(doc)); }} /></div>
        <details><summary className="cursor-pointer text-sm text-muted-foreground">Công cụ nâng cao · Tài liệu cũ</summary>
        <Button className="w-full" variant="ghost" disabled={locked} onClick={() => confirmReplace(() => { try { const raw = localStorage.getItem(draftKey); if (!raw) { toast.info("Chưa có nháp trên trình duyệt này."); return; } const draft = JSON.parse(raw); if (typeof draft.content !== "string" || typeof draft.title !== "string") throw new Error(); applySnapshot(draft); server.detach(); setDirty(true); } catch { toast.error("Không đọc được nháp đã lưu."); } })}>Nhập nháp cũ từ trình duyệt</Button>
        <Button className="w-full" disabled={busy} onClick={detect}><Search className="size-4 mr-2" />Nhận diện thông tin trong văn bản</Button>
        {fields.map((field, index) => <DocumentFieldCard key={`${field.paragraph}-${index}`} title={field.label} subtitle={field.original} status="Gợi ý · Chưa áp dụng" expanded={activeReviewField === index} onToggle={() => setActiveReviewField(activeReviewField === index ? null : index)}>
          <div className="rounded-lg border bg-background p-3"><p className="mb-1 text-xs font-medium text-muted-foreground">Giá trị gốc · Đoạn {field.paragraph + 1}</p><p className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-sm">{field.original}</p></div>
          <Label htmlFor={`field-${index}`}>Giá trị thay thế</Label><DocumentFieldValue id={`field-${index}`} maxLength={2000} value={field.value} onChange={value => setFields(current => current.map((f, i) => i === index ? { ...f, value } : f))} />
          <RoundedSelect aria-label={`Liên kết ${field.label}`} value="" onValueChange={key => { if (key) setFields(current => current.map((f, i) => i === index ? { ...f, value: `{{${key}}}` } : f)); }} options={[{ value: "", label: "Chọn thông tin để liên kết..." }, ...Object.keys(bindings).filter(key => !key.startsWith("SOURCE_")).map(key => ({ value: key, label: editorFieldLabel(key) }))]} />
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={locked} onClick={() => applyField(index)}>Áp dụng</Button><Button size="sm" variant="ghost" disabled={locked} className="text-destructive" onClick={() => setDeleteReviewField(index)}><Trash2 className="mr-1 size-4" />Xóa giá trị</Button></div>
        </DocumentFieldCard>)}
        </details>
      </div></DialogContent></Dialog>
      <section ref={editorViewportRef} aria-label="Vùng soạn thảo hợp đồng" className="min-h-0 min-w-0 flex-1 overflow-auto p-4 lg:p-8">
        <div className="mx-auto mb-4 flex max-w-[210mm] justify-end"><Button disabled={locked} onClick={() => setSourcesOpen(true)}><Database className="mr-2 size-4" />Liên kết dữ liệu thật</Button></div>
        {(warning || parseContractRichText(content).preservation) && <p role="status" className="mx-auto mb-4 max-w-4xl rounded-lg border bg-amber-50 p-3 text-sm text-amber-950">{warning || "Tài liệu giữ Word gốc: ảnh, header/footer, lề trang và khối phức tạp được giữ khi xuất. Khối nét đứt chỉ xem; dùng PDF thực tế để đối chiếu bố cục."}</p>}
        <div className="mx-auto mb-4 max-w-[210mm] space-y-3 rounded-2xl border bg-card p-4 text-sm shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Thông tin trong tài liệu</h2><p className="mt-1 text-muted-foreground">Bấm nhãn màu xanh trên trang để điền. Các vị trí liên kết sẽ cập nhật cùng nhau.</p></div>{missingFields.length > 0 && <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-200">Còn {missingFields.length} thông tin chưa điền</span>}</div>{missingFields.length > 0 ? <><div className="flex flex-wrap gap-2">{missingFields.slice(0, 4).map(key => <Button key={key} className="max-w-full truncate rounded-full" size="sm" variant="outline" disabled={locked} onClick={() => selectField(key)}>{editorFieldLabel(key)}</Button>)}</div><Button disabled={locked} className="h-auto min-h-10 max-w-full whitespace-normal rounded-xl px-4 py-2 font-semibold shadow-sm" onClick={() => { setSideTab("data"); setToolsOpen(true); }}>Xem tất cả thông tin chưa điền</Button></> : <p className="rounded-xl bg-primary/5 px-3 py-2 text-primary">{editorFieldKeys(content).length ? "Đã điền đủ các trường đang dùng. Hãy kiểm tra bản PDF trước khi xuất." : "Thêm nội dung từ bảng bên phải hoặc bắt đầu gõ trên trang bên dưới."}</p>}</div>
        <div data-document-content inert={server.loading || busy} style={{ width: `${pageSize.width}mm`, maxWidth: "none", minHeight: `${pageSize.height}mm`, padding: `${pageLayout.marginTop}mm ${pageLayout.marginRight}mm ${pageLayout.marginBottom}mm ${pageLayout.marginLeft}mm`, "--document-line-spacing": String(pageLayout.lineSpacing), "--document-space-before": `${pageLayout.spaceBefore}pt`, "--document-space-after": `${pageLayout.spaceAfter}pt` } as React.CSSProperties} className={`mx-auto rounded-xl bg-card shadow-lg ${documentModel.layout || !documentModel.preservation ? "document-custom-layout" : ""}`}>{preview ? <ContractRichTextContent value={resolveEditorFields(content, Object.fromEntries(editorFieldKeys(content).map(key => [key, bindings[key]?.trim() ? bindings[key] : `［${editorFieldLabel(key)}］`])))} /> : <ContractRichTextEditor key={documentEpoch}
          historyRequest={historyRequest}
          onHistoryStateChange={setHistoryState}
          onHistoryHandled={id => setHistoryRequest(current => current?.id === id ? undefined : current)}
          smartFields={{ bindings, onSelect: selectField }} insertRequest={insertRequest} onInsertHandled={id => setInsertRequest(current => current?.id === id ? undefined : current)} className="[&_.tiptap]:!h-auto [&_.tiptap]:!min-h-[400px] [&_.tiptap]:!overflow-visible [&_.tiptap]:!p-0" value={content} onChange={update} ariaLabel="Nội dung tài liệu hợp đồng" placeholder="Bắt đầu soạn thảo hợp đồng hoặc nhập DOCX..." />}</div>
      </section>
      <EditorSnippetsPanel key={documentEpoch} bindings={bindings} onBindingsChange={values => { setBindings(current => ({ ...current, ...values })); setDirty(true); }} disabled={locked || preview || pdfMode} onInsert={content => setInsertRequest({ id: crypto.randomUUID(), content })} />
    </div>
    <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}><DialogContent className="document-workspace-ui max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Chọn nguồn dữ liệu</DialogTitle><DialogDescription>Lấy thông tin khách hàng, nhân viên, sản phẩm hoặc hồ sơ pháp lý công ty vào tài liệu đang soạn.</DialogDescription></DialogHeader><div inert={busy || server.loading}><EditorDataPanel mode="sources" content={content} bindings={bindings} onChange={value => { setBindings(value); setDirty(true); }} onInsert={() => {}} /></div></DialogContent></Dialog>
    <Dialog open={!!selectedField} onOpenChange={open => !open && setSelectedField(null)}><DialogContent><DialogHeader><DialogTitle>{selectedField ? editorFieldLabel(selectedField.key) : "Điền thông tin"}</DialogTitle><DialogDescription>Áp dụng cho mọi vị trí cùng liên kết trong tài liệu này. Không sửa dữ liệu khách hàng gốc.</DialogDescription></DialogHeader><Label htmlFor="smart-field-value">Nội dung</Label><Textarea id="smart-field-value" value={fieldValue} maxLength={10000} rows={4} onChange={e => setFieldValue(e.target.value)} /><div className="flex flex-wrap justify-end gap-2">{selectedField?.detach && <Button variant="outline" disabled={locked} onClick={() => { selectedField.detach?.(fieldValue); setSelectedField(null); }}>Chuyển vị trí này thành văn bản thường</Button>}<Button disabled={locked} onClick={() => { if (selectedField) { setBindings(current => ({ ...current, [selectedField.key]: fieldValue })); setDirty(true); } setSelectedField(null); }}>Áp dụng</Button></div></DialogContent></Dialog>
    <ConfirmDialog isOpen={pending !== null} onClose={() => setPending(null)} onConfirm={() => { const action = pending; setPending(null); action?.(); }} title="Thay nội dung đang soạn?" description="Có thay đổi chưa lưu. Hãy lưu nháp hoặc xuất Word trước nếu muốn giữ nội dung hiện tại." confirmText="Tiếp tục" />
    <EditorDraftsDialog key={draftDialog || "closed"} mode={draftDialog} documentId={server.identity?.id} canManage={canManageTemplates} onClose={() => setDraftDialog(null)} onOpen={(id, revision) => { setDraftDialog(null); confirmReplace(() => void server.open(id, revision)); }} onUseTemplate={id => { setDraftDialog(null); confirmReplace(() => void server.open(id, undefined, true)); }} />
    <ConfirmDialog isOpen={deleteReviewField !== null} onClose={() => setDeleteReviewField(null)} title="Xóa giá trị khỏi tài liệu?" description="Chỉ xóa giá trị tại đoạn được nhận diện trong tài liệu đang soạn. Thao tác này không xóa hồ sơ khách hàng." variant="destructive" confirmText="Xóa giá trị" onConfirm={() => { if (deleteReviewField !== null) applyField(deleteReviewField, true); setDeleteReviewField(null); }} />
    <ConfirmDialog isOpen={templateConfirm} onClose={() => setTemplateConfirm(false)} title="Lưu thành mẫu văn bản" description={<div className="space-y-4"><p>Giá trị liên kết được xóa để điền lại khi dùng mẫu. Văn bản gõ trực tiếp vẫn được giữ nguyên.</p><TemplatePrivacyOptions shared={sharedTemplate} onChange={setSharedTemplate} canShare={canManageTemplates} acknowledged={templateAcknowledged} onAcknowledge={setTemplateAcknowledged} /></div>} confirmDisabled={!templateAcknowledged} confirmText="Tạo mẫu văn bản" onConfirm={() => { if (!templateAcknowledged) return; setTemplateConfirm(false); void server.saveAsTemplate(sharedTemplate).then(ok => { if (ok) { setSideTab("blocks"); toast.success("Đã tạo mẫu trong thư viện."); } }); }} />
    <DocumentPdfPreviewDialog preview={pdfPreview} onClose={() => setPdfPreview(null)} returnFocusRef={pdfButtonRef} closeLabel="Quay lại soạn thảo" />
    <DocumentLayoutDialog key={`${layoutOpen}-${JSON.stringify(documentModel.layout)}`} open={layoutOpen} value={documentModel.layout} preserved={!!documentModel.preservation} onClose={() => setLayoutOpen(false)} onApply={layout => { update(serializeContractRichText({ ...documentModel, layout })); setLayoutOpen(false); }} />
    <EditorContractBindingDialog key={bindingDocument ? `${bindingDocument.id}-${bindingDocument.revision}` : "closed"} document={bindingDocument} onClose={() => setBindingDocument(null)} />
  </main>;
}
export default function ContractEditorPage() { return <PermissionGuard permission={RBAC_PERMISSIONS.contractCreate}><EditorContent /></PermissionGuard>; }
