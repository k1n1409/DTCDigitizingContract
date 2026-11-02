import axiosClient from "@/lib/axios-interceptor";

export type PreparedImportedTemplate = { content: string; warning: string };

/** Export the exact saved review revision, then use the existing validated DOCX importer. */
export async function prepareImportedTemplate(id: string, revision: number, replacements?: Record<string, string>, sourceSha256?: string): Promise<PreparedImportedTemplate> {
  const blob = replacements && Object.keys(replacements).length
    ? await axiosClient.post<unknown, Blob>(`/api/imported-contracts/${id}/template-document`, { revision, sourceSha256, replacements }, { responseType: "blob" })
    : await axiosClient.get<unknown, Blob>(`/api/imported-contracts/${id}/export/docx`, { params: { revision }, responseType: "blob" });
  const form = new FormData();
  form.append("file", blob, `reviewed-v${revision}.docx`);
  return axiosClient.post<unknown, PreparedImportedTemplate>("/api/contract-document-editor/import", form, { headers: { "Content-Type": "multipart/form-data" } });
}

export function savePreparedTemplate(title: string, content: string, clientDocumentId: string, isSharedTemplate = false) {
  return axiosClient.post<unknown, { id: string; revision: number }>("/api/contract-editor-drafts", {
    title: title.trim(), content, bindings: {}, isTemplate: true, isSharedTemplate, expectedRevision: 0, clientDocumentId,
  });
}
