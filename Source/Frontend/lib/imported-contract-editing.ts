export type ReviewField = {
  id: string; blockId: string; start: number; length: number; original: string;
  value: string; label: string; party: string; status: "proposed" | "confirmed" | "ignored";
};

export function reviewedBlockText(text: string, blockId: string, fields: ReviewField[]) {
  let result = text;
  const patches = fields.filter(f => f.blockId === blockId && f.status === "confirmed").sort((a, b) => b.start - a.start);
  let boundary = text.length;
  for (const f of patches) {
    if (f.start < 0 || f.length <= 0 || f.start + f.length > boundary || text.slice(f.start, f.start + f.length) !== f.original) throw new Error("Vùng chỉnh sửa không khớp bản gốc hoặc bị chồng lấn.");
    result = result.slice(0, f.start) + f.value + result.slice(f.start + f.length);
    boundary = f.start;
  }
  return result;
}

/** Consolidate one paragraph's existing patches before editing its displayed text. */
export function replaceReviewedBlock(text: string, blockId: string, value: string, fields: ReviewField[], newId: string) {
  const normalized = value.replace(/[\r\n\t]+/g, " ");
  if (!text.length || normalized.length > 10000) throw new Error("Mỗi đoạn chỉnh trực tiếp tối đa 10.000 ký tự.");
  const full = fields.find(f => f.blockId === blockId && f.label === "Nội dung đoạn");
  const others = fields.filter(f => f.blockId !== blockId);
  if (text === normalized) return others;
  if (others.length >= 500) throw new Error("Tối đa 500 trường. Bỏ bớt trường trước khi chỉnh đoạn mới.");
  // Use Unicode code points to avoid splitting surrogate pairs. Keep unchanged runs outside
  // the smallest changed span untouched instead of rewriting the entire paragraph.
  const before = Array.from(text); const after = Array.from(normalized);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length; let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  // An insertion needs an adjacent source character because anchors cannot be empty.
  if (oldEnd === start) {
    if (oldEnd < before.length) { oldEnd++; newEnd++; }
    else start--;
  }
  const offset = before.slice(0, start).join("").length;
  const original = before.slice(start, oldEnd).join("");
  return [...others, {
    id: full?.id || newId, blockId, start: offset, length: original.length, original,
    value: after.slice(start, newEnd).join(""), label: "Nội dung đoạn", party: full?.party || "Chưa xác định", status: "confirmed" as const,
  }];
}
