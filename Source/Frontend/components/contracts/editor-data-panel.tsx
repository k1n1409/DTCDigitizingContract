"use client";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { customerApi, type CustomerLookupResponse } from "@/services/customers-api";
import { employeeApi, type EmployeeDirectoryResponse } from "@/services/employees-api";
import { catalogPickerApi, type CatalogPickerItem } from "@/services/catalog/picker-api";
import { ContractItemType } from "@/services/contract-api";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DocumentFieldCard, DocumentFieldValue } from "@/components/ui/custom/document-field-card";
import { parseContractRichText, serializeContractRichText } from "@/lib/contract-rich-text";
import { editorFieldLabel } from "@/lib/editor-smart-fields";
import { RoundedSelect } from "@/components/ui/custom/rounded-select";

export function resolveEditorFields(content: string, bindings: Record<string, string>) {
  const doc = parseContractRichText(content);
  const groups = doc.blocks.flatMap(b => b.type === "paragraph" ? [b.runs] : b.rows.flatMap(r => r.cells.flatMap(c => c.paragraphs.map(p => p.runs))));
  for (const runs of groups) {
    const text = runs.map(r => r.text).join("");
    const matches = [...text.matchAll(/\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}/g)].reverse();
    for (const match of matches) {
      const value = bindings[match[1]];
      if (!value?.trim()) continue;
      const start = match.index!; const end = start + match[0].length;
      let offset = 0; let inserted = false;
      const updated = runs.flatMap(run => {
        const from = offset; offset += run.text.length;
        if (offset <= start || from >= end) return [run];
        const parts = [];
        if (from < start) parts.push({ ...run, text: run.text.slice(0, start - from) });
        if (!inserted) { parts.push({ ...run, text: value }); inserted = true; }
        if (offset > end) parts.push({ ...run, text: run.text.slice(end - from) });
        return parts;
      });
      runs.splice(0, runs.length, ...updated);
    }
  }
  return serializeContractRichText(doc);
}

export function editorFieldKeys(content: string) {
  const doc = parseContractRichText(content);
  const texts = doc.blocks.flatMap(b => b.type === "paragraph" ? [b.runs.map(r => r.text).join("")] : b.rows.flatMap(r => r.cells.flatMap(c => c.paragraphs.map(p => p.runs.map(r => r.text).join("")))));
  return [...new Set(texts.flatMap(t => [...t.matchAll(/\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}/g)].map(m => m[1])))];
}

export function EditorDataPanel({ content, bindings, onChange, onInsert }: { content: string; bindings: Record<string, string>; onChange: (value: SetStateAction<Record<string, string>>) => void; onInsert: (key: string) => void }) {
  const [customers, setCustomers] = useState<CustomerLookupResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryResponse[]>([]);
  const [products, setProducts] = useState<CatalogPickerItem[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [activeKey, setActiveKey] = useState("");
  const [fieldQuery, setFieldQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([customerApi.lookup(), employeeApi.getDirectory()]).then(([c, e]) => {
      if (cancelled) return;
      if (c.status === "fulfilled") setCustomers(c.value.filter(x => x.status === 1));
      if (e.status === "fulfilled") setEmployees(e.value.filter(x => x.status === 1));
      if (c.status === "rejected" || e.status === "rejected") setError("Không tải được một số danh mục. Hãy mở lại trang hoặc kiểm tra quyền.");
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => { void catalogPickerApi.search({ keyword: query, page, pageSize: 10, itemType: ContractItemType.Product }, abort.signal).then(data => {
      if (!abort.signal.aborted) { setProducts(data.items); setPages(Math.max(1, data.totalPages)); }
    }).catch(e => { if (!abort.signal.aborted) setError(getApiErrorMessage(e, "Không tải được sản phẩm.")); }); }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [page, query]);
  const bind = async (source: string, id: string) => {
    if (!id || busy) return;
    setBusy(true); setError("");
    try {
      const values = await axiosClient.get<unknown, Record<string, string>>("/api/contract-editor-drafts/binding-values", { params: { source, id } });
      if (!mounted.current) return;
      const indexed = source === "product" ? Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith("PRODUCT_")).map(([key, value]) => [key.replace("PRODUCT_", `PRODUCT_${id}_`), value])) : {};
      onChange(previous => ({ ...previous, ...values, ...indexed }));
    } catch (e) { if (mounted.current) setError(getApiErrorMessage(e, "Không liên kết được dữ liệu.")); }
    finally { if (mounted.current) setBusy(false); }
  };
  const required = editorFieldKeys(content);
  const missing = required.filter(k => !bindings[k]?.trim());
  const keys = [...new Set([...required, ...Object.keys(bindings).filter(k => !k.startsWith("SOURCE_"))])];
  const visibleKeys = keys.filter(key => (!onlyMissing || missing.includes(key)) && `${editorFieldLabel(key)} ${bindings[key] || ""}`.toLocaleLowerCase("vi-VN").includes(fieldQuery.toLocaleLowerCase("vi-VN")));
  return <section className="document-workspace-ui space-y-3 border-t pt-4">
    <h2 className="font-semibold">Liên kết dữ liệu thật</h2>
    <p className="text-xs text-muted-foreground">Giá trị lấy từ danh mục của tenant và lưu cùng phiên bản. Đổi dữ liệu nguồn không tự thay tài liệu đã lưu; chọn nguồn để cập nhật lại.</p>
    <details className="space-y-3 rounded-xl border bg-muted/15 p-3">
    <summary className="cursor-pointer text-sm font-medium">Chọn nguồn dữ liệu từ danh mục</summary>
    <Label htmlFor="bind-customer">Khách hàng</Label><RoundedSelect id="bind-customer" disabled={busy} value={bindings.SOURCE_CUSTOMER_ID || ""} onValueChange={value => void bind("customer", value)} options={[{ value: "", label: "Chọn khách hàng" }, ...customers.map(x => ({ value: String(x.customerId), label: x.customerCompany || x.customerFullName || `Khách hàng #${x.customerId}` }))]} />
    <Label htmlFor="bind-employee">Nhân viên</Label><RoundedSelect id="bind-employee" disabled={busy} value={bindings.SOURCE_EMPLOYEE_ID || ""} onValueChange={value => void bind("employee", value)} options={[{ value: "", label: "Chọn nhân viên" }, ...employees.map(x => ({ value: String(x.employeeId), label: x.employeeFullName || `Nhân viên #${x.employeeId}` }))]} />
    <Label htmlFor="bind-product">Sản phẩm</Label><Input aria-label="Tìm sản phẩm liên kết" placeholder="Tìm sản phẩm..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /><RoundedSelect id="bind-product" disabled={busy} value="" onValueChange={value => void bind("product", value)} options={[{ value: "", label: "Chọn sản phẩm để lấy dữ liệu" }, ...products.map(x => ({ value: String(x.sourceId), label: x.name || `Sản phẩm #${x.sourceId}` }))]} />
    <p className="text-xs text-muted-foreground">Mỗi sản phẩm có nhóm thông tin riêng. Chọn nguồn chỉ lấy dữ liệu vào tài liệu này, không chỉnh sửa danh mục.</p>
    <div className="flex flex-wrap gap-2">{["customer", "employee"].map(source => <Button key={source} size="sm" variant="outline" disabled={busy || !bindings[`SOURCE_${source.toUpperCase()}_ID`]} onClick={() => void bind(source, bindings[`SOURCE_${source.toUpperCase()}_ID`])}>Lấy lại {source === "customer" ? "khách hàng" : "nhân viên"}</Button>)}</div>
    <div className="flex items-center justify-between"><Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</Button><span className="text-xs">{page}/{pages}</span><Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau</Button></div>
    </details>
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-2 text-center text-xs"><div><p className="text-lg font-semibold tabular-nums">{keys.length}</p><p className="text-muted-foreground">Trường dữ liệu</p></div><div><p className={`text-lg font-semibold tabular-nums ${missing.length ? "text-destructive" : "text-primary"}`}>{missing.length}</p><p className="text-muted-foreground">Cần bổ sung</p></div></div>
      <Input aria-label="Tìm trường soạn thảo" maxLength={100} showControls={false} placeholder="Tìm tên thông tin hoặc giá trị..." value={fieldQuery} onChange={e => setFieldQuery(e.target.value)} />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />Chỉ hiện trường đang dùng còn thiếu</label>
    </div>
    <p role="status" className={`text-xs ${missing.length ? "text-destructive" : "text-muted-foreground"}`}>{missing.length ? `Cần bổ sung ${missing.length} trường đang dùng trong tài liệu.` : "Các trường đang dùng đã có giá trị."}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {visibleKeys.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{keys.length ? "Không có trường khớp bộ lọc." : "Chưa có trường. Chọn nguồn dữ liệu hoặc thêm mã trường bên dưới."}</p>}
    {visibleKeys.map(key => <DocumentFieldCard key={key} title={editorFieldLabel(key)} subtitle={bindings[key] || "Chưa nhập giá trị"} status={required.includes(key) ? (missing.includes(key) ? "Đang dùng · Cần bổ sung" : "Đang dùng · Đã có giá trị") : "Chưa dùng trong tài liệu"} expanded={activeKey === key} onToggle={() => { setActiveKey(activeKey === key ? "" : key); setOnlyMissing(false); setFieldQuery(""); }}>
      <Label htmlFor={`binding-${key}`} className="text-xs">Giá trị trường</Label>
      <DocumentFieldValue id={`binding-${key}`} value={bindings[key] || ""} onChange={value => onChange(previous => ({ ...previous, [key]: value }))} />
      <Button size="sm" variant="outline" className="h-auto w-full whitespace-normal" onClick={() => onInsert(key)}>Chèn trường cuối tài liệu</Button>
    </DocumentFieldCard>)}
    <details><summary className="cursor-pointer text-xs text-muted-foreground">Nâng cao · Cấu hình trường tùy chỉnh</summary><Input aria-label="Mã trường tự nhập" placeholder="Ví dụ CONTRACT_NAME" value={custom} maxLength={80} onChange={e => setCustom(e.target.value.toUpperCase())} /><Button size="sm" variant="outline" onClick={() => { if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(custom) || custom.startsWith("SOURCE_")) { setError("Mã trường gồm chữ hoa, số, dấu gạch dưới; bắt đầu bằng chữ, không dùng SOURCE_."); return; } onChange({ ...bindings, [custom]: bindings[custom] || "" }); setCustom(""); }}>Thêm trường nhập tay</Button></details>
  </section>;
}
