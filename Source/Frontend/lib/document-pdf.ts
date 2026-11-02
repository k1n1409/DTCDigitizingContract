import axiosClient from "@/lib/axios-interceptor";
export type LibraryKind = "imported" | "template" | "editor";
const buffers = new Map<string, ArrayBuffer>();
let bytesUsed = 0;
let cacheOwner = "";
let running = 0;
const queue: { start: () => void; priority: number }[] = [];
type Pending = { promise: Promise<ArrayBuffer>; controller: AbortController; users: number; settled: boolean; priority: number };
const pending = new Map<string, Pending>();
function pump() {
  while (running < 2 && queue.length) { queue.sort((a, b) => b.priority - a.priority); queue.shift()!.start(); }
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new DOMException("Aborted", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
  });
}

export async function documentPdf(kind: LibraryKind, id: string, revision: number, owner: string, signal: AbortSignal, purpose: "preview" | "thumbnail" = "preview") {
  signal.throwIfAborted();
  if (cacheOwner !== owner) { buffers.clear(); bytesUsed = 0; cacheOwner = owner; for (const task of pending.values()) task.controller.abort(); pending.clear(); }
  const key = `${owner}:${kind}:${id}:${revision}`;
  const cached = buffers.get(key); if (cached) return cached.slice(0);
  let task = pending.get(key);
  if (!task) {
    const controller = new AbortController();
    const priority = purpose === "preview" ? 1 : 0;
    task = { controller, users: 0, settled: false, priority, promise: Promise.resolve(new ArrayBuffer(0)) };
    const entry = task;
    entry.promise = new Promise<ArrayBuffer>((resolve, reject) => {
      const job = { get priority() { return entry.priority; }, start: () => {
        running++;
        void (async () => {
          controller.signal.throwIfAborted();
          const data = await axiosClient.get<unknown, ArrayBuffer>(`/api/document-library/${kind}/${id}/preview`, { params: { revision }, responseType: "arraybuffer", signal: controller.signal });
          if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") throw new Error("Phản hồi preview không phải PDF hợp lệ.");
          if (!controller.signal.aborted && cacheOwner === owner) {
            while (buffers.size && bytesUsed + data.byteLength > 32 * 1024 * 1024) {
              const first = buffers.keys().next().value!; bytesUsed -= buffers.get(first)!.byteLength; buffers.delete(first);
            }
            if (data.byteLength <= 32 * 1024 * 1024) { const previous = buffers.get(key); if (previous) bytesUsed -= previous.byteLength; buffers.set(key, data.slice(0)); bytesUsed += data.byteLength; }
          }
          return data;
        })().then(resolve, reject).finally(() => { entry.settled = true; if (pending.get(key) === entry) pending.delete(key); running--; pump(); });
      } };
      queue.push(job);
      // The getter upgrades queued thumbnails when opened as a full preview.
    });
    pending.set(key, entry);
  }
  if (purpose === "preview") task.priority = 1;
  task.users++;
  pump();
  try { return (await abortable(task.promise, signal)).slice(0); }
  finally { task.users--; if (!task.users && !task.settled) { task.controller.abort(); if (pending.get(key) === task) pending.delete(key); } }
}

export async function openPdf(data: ArrayBuffer) {
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker-${pdf.version}.min.mjs`;
  return pdf.getDocument({ data: new Uint8Array(data), cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
}
