"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { catalogPickerApi, type CatalogPickerItem } from "@/services/catalog/picker-api";
import { ContractItemType } from "@/services/contract-api";
import { normalizeWordLabel, parseWordNumber, readWordItemTables, type WordItemRow } from "@/lib/word-catalog-import";

export const wordCatalogKey = (item: CatalogPickerItem) => `${item.itemType === ContractItemType.Product ? "p" : "s"}-${item.sourceId}`;
export type WordCatalogSelection = { item: CatalogPickerItem; quantity: number; unitPrice: number; source: WordItemRow };
type Review = { item?: CatalogPickerItem; quantity?: string; price?: string; skip?: boolean };
type QuickCreate = (kind: "product" | "service", pick: (item: CatalogPickerItem) => void) => void;
const label = (item: CatalogPickerItem) => `${item.code ? `${item.code} · ` : ""}${item.name ?? "Không tên"} · ${item.itemType === ContractItemType.Product ? "Sản phẩm" : "Dịch vụ"}`;

async function suggest(row: WordItemRow, signal: AbortSignal) {
  const matches = new Map<string, CatalogPickerItem>();
  for (const [value, field] of [[row.code, "code"] as const, ...[row.name, ...(row.alternateNames ?? [])].map(name => [name, "name"] as const)]) {
    if (!value || value.length > 500 || /\{\{/.test(value)) continue;
    const result = await catalogPickerApi.search({ keyword: value, pageSize: 30 }, signal);
    if (result.totalCount > result.items.length) return undefined;
    const exact = result.items.filter(item => field === "code"
      ? item.code?.trim().toLowerCase() === value.trim().toLowerCase()
      : [item.name, item.nameEn].some(name => !!name && normalizeWordLabel(name) === normalizeWordLabel(value)));
    if (exact.length > 1) return undefined;
    if (exact.length === 1) {
      if (field === "code") return exact[0];
      matches.set(wordCatalogKey(exact[0]), exact[0]);
    }
  }
  return matches.size === 1 ? matches.values().next().value : undefined;
}

function CatalogMatch({ row, item, onPick, onQuickCreate }: {
  row: WordItemRow; item?: CatalogPickerItem; onPick: (item: CatalogPickerItem) => void; onQuickCreate?: QuickCreate;
}) {
  const [query, setQuery] = useState(row.code || row.name);
  const [results, setResults] = useState<CatalogPickerItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function search() {
    if (busy || !query.trim()) return;
    setBusy(true); setResults([]); setMessage("");
    try {
      const result = await catalogPickerApi.search({ keyword: query.trim(), pageSize: 30 });
      setResults(result.items);
      if (!result.items.length) setMessage("Không tìm thấy. Thử mã hoặc tên khác.");
      else if (result.totalCount > result.items.length) setMessage("Chỉ hiển thị 30 kết quả đầu. Nhập mã hoặc tên cụ thể hơn.");
    } catch { setMessage("Không tải được danh mục. Hãy thử lại."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <p className="text-sm font-medium">{item ? `Đã ghép: ${label(item)}` : "Chưa ghép với danh mục"}</p>
    <div className="flex flex-wrap gap-2">
      <Input className="min-w-36 flex-1" value={query} maxLength={500} aria-label={`Tìm danh mục cho dòng ${row.line}`} onChange={e => { setQuery(e.target.value); setResults([]); setMessage(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
      <Button type="button" size="sm" variant="outline" disabled={busy || !query.trim()} onClick={() => void search()}>{busy ? "Đang tìm..." : "Tìm danh mục"}</Button>
    </div>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {!!results.length && <select aria-label={`Chọn kết quả cho dòng ${row.line}`} value="" className="w-full rounded-lg border bg-background p-2 text-sm" onChange={e => { const next = results.find(option => wordCatalogKey(option) === e.target.value); if (next) { onPick(next); setResults([]); } }}>
      <option value="" disabled>Chọn sản phẩm hoặc dịch vụ</option>
      {results.map(option => <option key={wordCatalogKey(option)} value={wordCatalogKey(option)}>{label(option)}</option>)}
    </select>}
    {!item && onQuickCreate && <div className="flex flex-wrap gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => onQuickCreate("product", onPick)}>Tạo nhanh sản phẩm</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => onQuickCreate("service", onPick)}>Tạo nhanh dịch vụ</Button>
    </div>}
  </div>;
}

export function WordCatalogImportDialog({ open, onClose, content, bindings, currency, selectedIds, onImport, onQuickCreate }: {
  open: boolean; onClose: () => void; content: string; bindings: Record<string, string>; currency: string;
  selectedIds: string[]; onImport: (rows: WordCatalogSelection[]) => void; onQuickCreate?: QuickCreate;
}) {
  const tables = useMemo(() => readWordItemTables(content, bindings), [content, bindings]);
  const [tableIndex, setTableIndex] = useState(0);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [matching, setMatching] = useState(false);
  const table = tables[tableIndex];
  const rowKey = (line: number) => `${tableIndex}:${line}`;
  const patch = (key: string, value: Review) => setReviews(current => ({ ...current, [key]: { ...current[key], ...value } }));

  useEffect(() => {
    if (!open || !table) return;
    const abort = new AbortController();
    let next = 0;
    const run = async () => {
      setMatching(true);
      await Promise.all(Array.from({ length: Math.min(4, table.rows.length) }, async () => {
        while (!abort.signal.aborted && next < table.rows.length) {
          const row = table.rows[next++];
          try {
            const item = await suggest(row, abort.signal);
            if (item && !abort.signal.aborted) {
              const key = `${tableIndex}:${row.line}`;
              setReviews(current => current[key]?.item ? current : { ...current, [key]: { ...current[key], item } });
            }
          } catch { /* Manual catalog search is still available. */ }
        }
      }));
      if (!abort.signal.aborted) setMatching(false);
    };
    void run();
    return () => abort.abort();
  }, [open, table, tableIndex]);

  const rows = (table?.rows ?? []).map(row => {
    const key = rowKey(row.line), review = reviews[key] ?? {};
    const quantity = parseWordNumber(review.quantity ?? row.quantity);
    const unitPrice = parseWordNumber(review.price ?? row.price, currency);
    return { row, key, review, quantity, unitPrice };
  });
  const included = rows.filter(x => !x.review.skip);
  const used = new Set(selectedIds);
  const duplicates = new Set<string>();
  for (const { review, key } of included) {
    if (!review.item) continue;
    const id = wordCatalogKey(review.item);
    if (used.has(id)) duplicates.add(key);
    used.add(id);
  }
  const valid = (entry: typeof rows[number]) => !!entry.review.item?.unitName?.trim() && !!entry.quantity
    && Number.isInteger(entry.quantity) && entry.unitPrice !== null && !duplicates.has(entry.key);
  const currencyMismatch = !!table?.currencyHint && table.currencyHint !== currency;
  const ready = !currencyMismatch && included.length > 0 && included.every(valid);

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Lấy từ bảng trong Word</DialogTitle>
        <DialogDescription>Ghép dòng Word với danh mục rồi rà soát trước khi thêm. Không tự áp giá danh mục, VAT hoặc chiết khấu.</DialogDescription>
      </DialogHeader>
      {!table ? <p className="rounded-xl border bg-muted/40 p-4 text-sm">Không tìm thấy bảng có cột tên, số lượng và đơn giá. Bảng ghép ô trong các dòng sản phẩm hoặc trên 100 dòng cần nhập thủ công.</p> : <>
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium">Bảng trong Word
          <select value={tableIndex} onChange={e => setTableIndex(Number(e.target.value))} className="rounded-lg border bg-background p-2">
            {tables.map((option, index) => <option key={option.index} value={index}>Bảng {option.index} · {option.rows.length} dòng{option.rows[0]?.name ? ` · ${option.rows[0].name.slice(0, 55)}` : ""}</option>)}
          </select>
        </label>
        {matching && <p role="status" className="text-sm text-muted-foreground">Đang đối chiếu theo mã hoặc tên…</p>}
        {currencyMismatch && <p role="alert" className="text-sm text-destructive">Cột đơn giá trong Word ghi {table.currencyHint}, nhưng hợp đồng dùng {currency}. Hãy chọn đúng đồng tiền ở bước thiết lập; hệ thống không tự quy đổi.</p>}
        <div className="min-h-0 space-y-3 overflow-y-auto px-1 py-1">
          {rows.map(entry => {
            const { row, key, review, quantity, unitPrice } = entry;
            const total = parseWordNumber(row.total, currency);
            const computed = quantity !== null && unitPrice !== null ? quantity * unitPrice : null;
            const mismatch = computed !== null && total !== null && Math.abs(total - computed) > (currency === "VND" ? 0.5 : 0.005);
            return <section key={key} className="space-y-3 rounded-xl border p-3 sm:p-4">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={!review.skip} onChange={e => patch(key, { skip: !e.target.checked })} />
                Dòng {row.line} · {[row.code, row.name].filter(Boolean).join(" · ") || "Thiếu mã/tên"}
              </label>
              {!review.skip && <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-sm"><span>Số lượng · Word: {row.quantity || "thiếu"}</span><Input inputMode="numeric" value={review.quantity ?? row.quantity} onChange={e => patch(key, { quantity: e.target.value })} /></label>
                  <label className="space-y-1 text-sm"><span>Đơn giá ({currency}) · Word: {row.price || "thiếu"}</span><Input inputMode="decimal" value={review.price ?? row.price} onChange={e => patch(key, { price: e.target.value })} /></label>
                </div>
                {(!quantity || !Number.isInteger(quantity) || unitPrice === null) && <p className="text-sm text-destructive">Số lượng phải là số nguyên dương; kiểm tra đơn giá hoặc nhập số không có dấu phân nhóm.</p>}
                {row.total && <p className={mismatch || total === null ? "text-sm text-amber-700 dark:text-amber-300" : "text-sm text-muted-foreground"}>Thành tiền Word: {row.total}{computed !== null ? ` · Tính lại trước thuế: ${computed.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}` : ""}{mismatch ? " · Không khớp, hãy kiểm tra thuế/chiết khấu." : total === null ? " · Chưa đọc được số để đối chiếu." : ""}</p>}
                {duplicates.has(key) && <p className="text-sm text-destructive">Mục đã được chọn hoặc trùng dòng khác. Bỏ chọn dòng này hoặc đổi mục danh mục.</p>}
                {review.item && <p className={row.unit && normalizeWordLabel(row.unit) !== normalizeWordLabel(review.item.unitName ?? "") ? "text-sm text-amber-700 dark:text-amber-300" : "text-sm text-muted-foreground"}>Đơn vị Word: {row.unit || "không có"} · Dùng đơn vị danh mục: {review.item.unitName || "thiếu (cần bổ sung trong danh mục)"}</p>}
                <CatalogMatch row={row} item={review.item} onPick={item => patch(key, { item })} onQuickCreate={onQuickCreate} />
              </>}
            </section>;
          })}
        </div>
      </>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
        <Button type="button" disabled={!ready} onClick={() => { if (ready) onImport(included.map(x => ({ item: x.review.item!, quantity: x.quantity!, unitPrice: x.unitPrice!, source: x.row }))); }}>Xác nhận thêm ({included.length})</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
