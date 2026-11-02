"use client";
import { createContext, useContext } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DocumentWorkspaceViewContext = createContext<{ expanded: boolean; setExpanded: (value: boolean) => void }>({ expanded: false, setExpanded: () => {} });
export function WorkspaceExpandButton({ beforeExpand }: { beforeExpand?: () => void }) {
  const { expanded, setExpanded } = useContext(DocumentWorkspaceViewContext);
  return <Button variant="outline" className="shrink-0 gap-2" aria-pressed={expanded} title={expanded ? "Hiện lại thanh điều hướng và chân trang" : "Ẩn thanh điều hướng và chân trang để mở rộng vùng làm việc"} onClick={() => { if (!expanded) beforeExpand?.(); setExpanded(!expanded); }}>{expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}{expanded ? "Thu về" : "Mở rộng"}</Button>;
}
