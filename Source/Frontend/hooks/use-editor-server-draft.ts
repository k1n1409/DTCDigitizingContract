"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import axiosClient from "@/lib/axios-interceptor";
import { getApiErrorMessage } from "@/lib/api-error";

export interface EditorSnapshot { title: string; content: string; bindings: Record<string, string> }
export interface EditorStored extends EditorSnapshot { id: string; revision: number; currentRevision: number; isTemplate: boolean; isSharedTemplate: boolean }
export interface DraftSummary { id: string; title: string; revision: number; updatedAtUtc: string; isTemplate: boolean; isSharedTemplate: boolean }
export interface RevisionSummary { revision: number; title: string; createdAtUtc: string }
const base = "/api/contract-editor-drafts";

export function useEditorServerDraft(snapshot: EditorSnapshot, dirty: boolean, setDirty: (value: boolean) => void, apply: (value: EditorSnapshot) => void, paused = false) {
  const [identity, setIdentity] = useState<{ id: string; revision: number; isTemplate: boolean; isSharedTemplate: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const clientDocumentId = useRef<string | null>(null);
  const current = useRef(snapshot);
  const identityRef = useRef(identity);
  useLayoutEffect(() => { current.current = snapshot; }, [snapshot]);
  useLayoutEffect(() => { identityRef.current = identity; }, [identity]);
  const save = useCallback(async () => {
    if (lock.current || loading) return;
    const captured = current.current;
    if (!captured.title.trim()) { setError("Nhập tên tài liệu trước khi lưu."); return; }
    lock.current = true; setSaving(true); setError("");
    const head = identityRef.current;
    try {
      if (!clientDocumentId.current) clientDocumentId.current = crypto.randomUUID();
      const request = { ...captured, expectedRevision: head?.revision ?? 0, clientDocumentId: clientDocumentId.current, isTemplate: head?.isTemplate ?? false, isSharedTemplate: head?.isSharedTemplate ?? false };
      const result = head
        ? await axiosClient.put<unknown, NonNullable<typeof identityRef.current>>(`${base}/${head.id}`, request)
        : await axiosClient.post<unknown, NonNullable<typeof identityRef.current>>(base, request);
      identityRef.current = result; setIdentity(result);
      if (JSON.stringify(current.current) === JSON.stringify(captured)) { setDirty(false); return result; }
    } catch (cause) { setError(getApiErrorMessage(cause, "Không lưu được nháp trên server. Kiểm tra kết nối/migration rồi bấm Lưu lại.")); }
    finally { lock.current = false; setSaving(false); }
  }, [loading, setDirty]);
  useEffect(() => {
    if (!dirty || saving || loading || error || paused) return;
    const timer = setTimeout(() => void save(), 2000);
    return () => clearTimeout(timer);
  }, [snapshot.title, snapshot.content, snapshot.bindings, dirty, saving, loading, error, save, paused]);
  const open = async (id: string, revision?: number, copy = false) => {
    if (lock.current) { setError("Đang lưu tài liệu, đợi lưu xong rồi mở lại."); return false; }
    lock.current = true; setLoading(true);
    try {
      const result = await axiosClient.get<unknown, EditorStored>(`${base}/${id}`, { params: { revision } });
      if (copy) {
        apply({ ...result, title: `Bản sao ${result.title}`.slice(0, 100), bindings: Object.fromEntries(Object.keys(result.bindings).filter(k => !k.startsWith("SOURCE_")).map(k => [k, ""])) });
        setIdentity(null); identityRef.current = null; clientDocumentId.current = null; setDirty(true);
      } else {
        apply(result); const next = { id: result.id, revision: result.currentRevision, isTemplate: result.isTemplate, isSharedTemplate: result.isSharedTemplate }; setIdentity(next); identityRef.current = next;
        setDirty(revision !== undefined && revision !== result.currentRevision);
      }
      setError("");
      return true;
    } catch (cause) { setError(getApiErrorMessage(cause, "Không mở được tài liệu.")); return false; }
    finally { lock.current = false; setLoading(false); }
  };
  const detach = () => { setIdentity(null); identityRef.current = null; clientDocumentId.current = null; setError(""); };
  const saveAsTemplate = async (isSharedTemplate = false) => {
    if (lock.current || loading) return;
    const captured = current.current;
    if (!captured.title.trim()) { setError("Nhập tên mẫu trước khi lưu."); return; }
    lock.current = true; setSaving(true); setError("");
    try {
      const clean = { ...captured, bindings: Object.fromEntries(Object.keys(captured.bindings).filter(k => !k.startsWith("SOURCE_")).map(k => [k, ""])) };
      const result = await axiosClient.post<unknown, NonNullable<typeof identityRef.current> & { content?: string }>(base, { ...clean, expectedRevision: 0, isTemplate: true, isSharedTemplate, clientDocumentId: crypto.randomUUID() });
      apply({ ...clean, content: result.content || clean.content }); setIdentity(result); identityRef.current = result; setDirty(false);
      return true;
    } catch (cause) { setError(getApiErrorMessage(cause, "Không lưu được mẫu văn bản.")); return false; }
    finally { lock.current = false; setSaving(false); }
  };
  return { identity, saving, loading, error, save, open, detach, saveAsTemplate };
}

export const editorDraftApi = {
  list: (page: number, keyword: string, templates = false) => axiosClient.get<unknown, { items: DraftSummary[]; totalPages: number }>(base, { params: { page, keyword, templates } }),
  archive: (id: string, revision: number) => axiosClient.post(`${base}/${id}/archive`, revision),
  history: (id: string, page: number) => axiosClient.get<unknown, { items: RevisionSummary[]; totalPages: number }>(`${base}/${id}/history`, { params: { page } }),
};
