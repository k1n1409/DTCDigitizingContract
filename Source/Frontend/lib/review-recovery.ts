import type { ReviewField } from "@/lib/imported-contract-editing";
const PREFIX = "econtract-review-recovery:";
const generations = new Map<string, number>();
export type Recovery = { revision: number; sha: string; fields: ReviewField[]; savedAt: number };
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, n => String.fromCharCode(n)).join(""));
const decode = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export const recoveryKey = (owner: string, id: string) => `${PREFIX}${owner}:${id}`;
async function keyFor(owner: string) {
  const name = `${PREFIX}key:${owner}`;
  let raw = sessionStorage.getItem(name);
  if (!raw) { raw = encode(crypto.getRandomValues(new Uint8Array(32))); sessionStorage.setItem(name, raw); }
  return crypto.subtle.importKey("raw", decode(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function writeReviewRecovery(owner: string, id: string, value: Recovery) {
  const name = recoveryKey(owner, id), generation = (generations.get(name) || 0) + 1; generations.set(name, generation);
  const key = await keyFor(owner), iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(name) }, key, bytes);
  if (generations.get(name) === generation) sessionStorage.setItem(name, JSON.stringify({ iv: encode(iv), bytes: encode(new Uint8Array(encrypted)) }));
}
export async function readReviewRecovery(owner: string, id: string): Promise<Recovery | null> {
  const name = recoveryKey(owner, id), raw = sessionStorage.getItem(name); if (!raw) return null;
  try {
    const envelope = JSON.parse(raw), key = await keyFor(owner);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(envelope.iv), additionalData: new TextEncoder().encode(name) }, key, decode(envelope.bytes));
    const value = JSON.parse(new TextDecoder().decode(plain));
    if (!Number.isInteger(value.revision) || typeof value.sha !== "string" || !Array.isArray(value.fields) || value.fields.length > 500 || !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 24 * 60 * 60 * 1000) throw new Error();
    if (value.fields.some((f: ReviewField) => !f || ![f.id, f.blockId, f.original, f.value, f.label, f.party].every(x => typeof x === "string") || !Number.isInteger(f.start) || !Number.isInteger(f.length) || !["confirmed", "proposed", "ignored"].includes(f.status))) throw new Error();
    return value;
  } catch { clearReviewRecovery(owner, id); return null; }
}
export function clearReviewRecovery(owner: string, id: string) {
  const name = recoveryKey(owner, id); generations.set(name, (generations.get(name) || 0) + 1);
  try { sessionStorage.removeItem(name); } catch { /* A storage failure must not turn a successful server save into an error. */ }
}
export function purgeReviewRecovery() {
  try {
    if (typeof sessionStorage !== "undefined") for (let i = sessionStorage.length - 1; i >= 0; i--) { const name = sessionStorage.key(i); if (name?.startsWith(PREFIX)) sessionStorage.removeItem(name); }
  } catch { /* Storage denied must never prevent logout. */ }
  for (const [name, generation] of generations) generations.set(name, generation + 1);
}
