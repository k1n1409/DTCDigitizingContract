/* eslint-disable @next/next/no-img-element -- DOCX thumbnails are bounded local data URLs; retain their intrinsic aspect ratio. */
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import {
  parseContractRichText,
  type ContractRichTextAlignment,
  type ContractRichTextRun,
} from "@/lib/contract-rich-text";

interface ContractRichTextContentProps {
  value?: string | null;
  emptyText?: string;
  className?: string;
}

const RichRuns = ({ runs }: { runs: ContractRichTextRun[] }) =>
  runs.map((run, runIndex) => {
    const content = run.text.split("\n").map((part, partIndex) => (
      <Fragment key={`${runIndex}-${partIndex}`}>
        {partIndex > 0 && <br />}
        {part}
      </Fragment>
    ));

    return (
      <span
        key={runIndex}
        className={cn(
          run.bold && "font-bold",
          run.italic && "italic",
        )}
        style={{ ...(run.fontSize ? { fontSize: `${run.fontSize}pt` } : {}), ...(run.fontFamily ? { fontFamily: run.fontFamily } : {}), textDecorationLine: [run.underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined }}
      >
        {content}
      </span>
    );
  });

const alignmentClass = (alignment?: ContractRichTextAlignment) =>
  alignment === "justify" ? "text-justify" : alignment === "center"
    ? "text-center"
    : alignment === "right"
      ? "text-right"
      : "text-left";

export function ContractRichTextContent({
  value,
  emptyText = "Chưa có nội dung",
  className,
}: ContractRichTextContentProps) {
  const document = parseContractRichText(value);
  const hasContent = document.blocks.some(
    (block) =>
      block.type === "table" ||
      block.runs.some((run) => run.text.trim().length > 0),
  );

  if (!hasContent) {
    return <p className={className}>{emptyText}</p>;
  }

  return (
    <div data-rich-text-content className={cn("space-y-2 text-sm leading-6", className)}>
      {document.blocks.map((block, blockIndex) =>
        block.type === "paragraph" && block.locked ? (
          <div key={blockIndex} className="my-4 space-y-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-slate-800"><p className="font-semibold">{block.label || "Khối Word gốc"}</p>{block.previewImage && <img src={block.previewImage} alt="Ảnh gốc trong tài liệu" className="max-h-80 max-w-full object-contain" />}<p className="whitespace-pre-wrap text-sm">{block.runs.map(run => run.text).join("").slice(0, 1000)}</p><p className="text-xs text-slate-500">Giữ nguyên trong bản Word/PDF xuất ra. Xem PDF thực tế để đối chiếu.</p></div>
        ) : block.type === "paragraph" && block.textOnly ? (
          <div key={blockIndex} className="my-3 rounded-lg border border-sky-200 bg-sky-50/30 p-3"><p className="mb-2 text-xs text-sky-800">Chỉ sửa chữ · Định dạng, Tab và đường kẻ gốc được giữ khi xuất</p><p className={cn("whitespace-pre-wrap", alignmentClass(block.alignment))}>{block.runs.map(r => r.text).join("")}</p></div>
        ) : block.type === "paragraph" ? (
          <p key={blockIndex} style={block.pageBreakBefore ? { breakBefore: "page", borderTop: "1px dashed #94a3b8", paddingTop: 24, marginTop: 24 } : undefined} className={cn("min-h-[1lh] whitespace-pre-wrap", alignmentClass(block.alignment))}>
            <RichRuns runs={block.runs} />
          </p>
        ) : (
          <div key={blockIndex} className="overflow-x-auto">
            <table className="w-full min-w-96 table-fixed border-collapse text-left text-sm">
              <colgroup>
                {block.columnWidthsBps.map((width, columnIndex) => (
                  <col
                    key={columnIndex}
                    style={{ width: `${width / 100}%` }}
                  />
                ))}
              </colgroup>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.cells.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        colSpan={cell.colspan}
                        rowSpan={cell.rowspan}
                        className="min-w-24 border border-border px-2 py-1.5 align-top"
                        style={{
                          verticalAlign: cell.verticalAlign ?? "top",
                        }}
                      >
                        {cell.paragraphs.map((paragraph, paragraphIndex) => (
                          <p
                            key={paragraphIndex}
                            className={cn("min-h-[1lh] whitespace-pre-wrap", alignmentClass(paragraph.alignment))}
                          >
                            <RichRuns runs={paragraph.runs} />
                          </p>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
