import axiosClient from "@/lib/axios-interceptor";
export const editorProviderValues = () => axiosClient.get<unknown, Record<string, string>>("/api/contract-editor-drafts/binding-values", { params: { source: "provider", id: 1 } });
