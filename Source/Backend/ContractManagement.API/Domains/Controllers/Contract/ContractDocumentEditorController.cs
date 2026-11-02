using System.IO.Compression;
using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.Filter;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Domains.Policies.ContractTemplate;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Mvc;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController]
[Route("api/contract-document-editor")]
[SessionAuthorize(RbacPermissions.ContractCreate)]
public sealed class ContractDocumentEditorController(IContractTemplatePdfRenderer pdf) : ControllerBase
{
    public sealed class ExportRequest
    {
        internal bool AllowUnboundPreview { get; set; }
        public string Content { get; set; } = "";
        public string Title { get; set; } = "Hop dong";
        public Dictionary<string, string> Bindings { get; set; } = [];
    }

    [HttpPost("import")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken ct)
    {
        if (file.Length is <= 0 or > 10 * 1024 * 1024 || !string.Equals(Path.GetExtension(file.FileName), ".docx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<object>.Fail("Chọn tệp DOCX không rỗng, tối đa 10 MB."));
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        try
        {
            using (var zip = new ZipArchive(buffer, ZipArchiveMode.Read, true))
            {
                if (zip.Entries.Count > 3000 || zip.Entries.Sum(x => x.Length) > 40 * 1024 * 1024 || zip.Entries.Any(x => x.FullName.Contains("vbaProject", StringComparison.OrdinalIgnoreCase)))
                    return BadRequest(ApiResponse<object>.Fail("DOCX vượt giới hạn giải nén hoặc chứa macro không hỗ trợ."));
            }
            buffer.Position = 0;
            using var doc = WordprocessingDocument.Open(buffer, false, new OpenSettings { MaxCharactersInPart = 4_000_000 });
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null) return BadRequest(ApiResponse<object>.Fail("Không tìm thấy nội dung DOCX."));
            var model = new ContractTermRichTextDocument();
            foreach (var node in body.ChildElements)
            {
                if (node is Paragraph paragraph)
                {
                    var p = ReadParagraph(paragraph);
                    model.Blocks.Add(new() { Type = "paragraph", Runs = p.Runs, Alignment = p.Alignment });
                }
                else if (node is Table table)
                {
                    var rows = table.Elements<TableRow>().ToList();
                    var count = rows.Select(r => r.Elements<TableCell>().Sum(c => (int)(c.TableCellProperties?.GridSpan?.Val?.Value ?? 1))).DefaultIfEmpty(1).Max();
                    if (count is < 1 or > 20 || rows.Count > 50) return BadRequest(ApiResponse<object>.Fail("Bảng vượt giới hạn 50 dòng/20 cột."));
                    var block = new ContractTermRichTextBlock { Type = "table", ColumnWidthsBps = Enumerable.Range(0, count).Select(i => 10000 / count + (i < 10000 % count ? 1 : 0)).ToList() };
                    foreach (var row in rows)
                    {
                        var cells = row.Elements<TableCell>().Select(c => new ContractTermRichTextCell {
                            Colspan = (int)(c.TableCellProperties?.GridSpan?.Val?.Value ?? 1),
                            Paragraphs = c.Elements<Paragraph>().Select(ReadParagraph).ToList()
                        }).ToList();
                        foreach (var cell in cells) if (cell.Paragraphs.Count == 0) cell.Paragraphs.Add(new());
                        block.Rows.Add(new() { Cells = cells });
                    }
                    model.Blocks.Add(block);
                }
            }
            var content = ContractTermRichText.Prefix + JsonSerializer.Serialize(model, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            if (!ContractTermRichText.TryParse(content, out _)) return BadRequest(ApiResponse<object>.Fail("Cấu trúc tài liệu vượt giới hạn editor. Hãy chia tài liệu nhỏ hơn hoặc đơn giản hóa bảng."));
            return Ok(ApiResponse<object>.Ok(new {
                content,
                warning = "Đã nhập văn bản và bảng cơ bản. Ảnh, header/footer, chữ ký, trường Word tự động, bố cục trang và bảng lồng/ghép dọc chưa được bảo toàn. Hãy đối chiếu với bản gốc trước khi xuất."
            }));
        }
        catch (Exception ex) when (ex is OpenXmlPackageException or InvalidDataException or System.Xml.XmlException or ArgumentException)
        {
            return BadRequest(ApiResponse<object>.Fail("Không đọc được DOCX. Tệp có thể hỏng, mã hóa hoặc không đúng định dạng."));
        }
    }

    private static ContractTermRichTextParagraph ReadParagraph(Paragraph p) => new()
    {
        Alignment = p.ParagraphProperties?.Justification?.Val?.Value == JustificationValues.Center ? "center" : p.ParagraphProperties?.Justification?.Val?.Value == JustificationValues.Right ? "right" : p.ParagraphProperties?.Justification?.Val?.Value == JustificationValues.Both ? "justify" : "left",
        Runs = p.Descendants<Run>().Select(r => new ContractTermRichTextRun {
            Text = string.Concat(r.ChildElements.Select(n => n is Text t ? t.Text : n is Break ? "\n" : n is TabChar ? "\t" : "")),
            Bold = r.RunProperties?.Bold is { } b && (b.Val?.Value ?? true),
            Italic = r.RunProperties?.Italic is { } i && (i.Val?.Value ?? true),
            Underline = r.RunProperties?.Underline is { } u && u.Val?.Value != UnderlineValues.None,
            Strike = r.RunProperties?.Strike is { } s && (s.Val?.Value ?? true),
            FontFamily = r.RunProperties?.RunFonts?.Ascii?.Value is "Arial" ? "Arial" : r.RunProperties?.RunFonts?.Ascii?.Value is "Calibri" ? "Calibri" : null,
            FontSize = int.TryParse(r.RunProperties?.FontSize?.Val?.Value, out var size) ? Math.Clamp(size / 2, 8, 36) : null
        }).ToList()
    };

    [HttpPost("export/{format}")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> Export(string format, ExportRequest request, CancellationToken ct)
    {
        if (format is not ("docx" or "pdf")) return BadRequest(ApiResponse<object>.Fail("Chỉ hỗ trợ Word và PDF."));
        if (!ContractTermRichText.TryParse(request.Content, out var model)) return BadRequest(ApiResponse<object>.Fail("Nội dung editor không hợp lệ hoặc vượt giới hạn."));
        var missing = new HashSet<string>();
        IEnumerable<List<ContractTermRichTextRun>> allRuns = model.Blocks.SelectMany(b => b.Type == "paragraph" ? new[] { b.Runs } : b.Rows.SelectMany(r => r.Cells).SelectMany(c => c.Paragraphs).Select(p => p.Runs));
        foreach (var runs in allRuns)
        {
            var text = string.Concat(runs.Select(r => r.Text));
            var matches = System.Text.RegularExpressions.Regex.Matches(text, @"\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}");
            foreach (System.Text.RegularExpressions.Match match in matches.Cast<System.Text.RegularExpressions.Match>().Reverse())
            {
                var key = match.Groups[1].Value;
                if (request.Bindings is null || !request.Bindings.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value)) { if (!request.AllowUnboundPreview) missing.Add(key); continue; }
                if (value.Length > 10000 || value.Contains("{{")) return BadRequest(ApiResponse<object>.Fail("Giá trị trường không hợp lệ."));
                var start = match.Index; var end = start + match.Length; var offset = 0; var inserted = false;
                var updated = new List<ContractTermRichTextRun>();
                foreach (var run in runs)
                {
                    var from = offset; offset += run.Text.Length;
                    if (offset <= start || from >= end) { updated.Add(run); continue; }
                    ContractTermRichTextRun Copy(string t) => new() { Text = t, Bold = run.Bold, Italic = run.Italic, Underline = run.Underline, FontSize = run.FontSize, FontFamily = run.FontFamily, Strike = run.Strike };
                    if (from < start) updated.Add(Copy(run.Text[..(start - from)]));
                    if (!inserted) { updated.Add(Copy(value)); inserted = true; }
                    if (offset > end) updated.Add(Copy(run.Text[(end - from)..]));
                }
                runs.Clear(); runs.AddRange(updated);
            }
        }
        if (missing.Count > 0) return BadRequest(ApiResponse<object>.Fail("Chưa điền trường bắt buộc: " + string.Join(", ", missing)));
        if (model.Blocks.SelectMany(b => b.Rows).SelectMany(r => r.Cells).Any(c => c.Rowspan > 1))
            return BadRequest(ApiResponse<object>.Fail("Xuất bảng ghép ô theo chiều dọc chưa được hỗ trợ. Hãy tách ô ghép dọc trước khi xuất để tránh mất bố cục."));
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var part = doc.AddMainDocumentPart();
            var body = new Body();
            part.Document = new Document(body);
            foreach (var block in model.Blocks)
            {
                if (block.Type == "paragraph") body.Append(WriteParagraph(block.Runs, block.Alignment));
                else
                {
                    var table = new Table(new TableProperties(new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct }, new TableBorders(new TopBorder { Val = BorderValues.Single }, new BottomBorder { Val = BorderValues.Single }, new LeftBorder { Val = BorderValues.Single }, new RightBorder { Val = BorderValues.Single }, new InsideHorizontalBorder { Val = BorderValues.Single }, new InsideVerticalBorder { Val = BorderValues.Single })));
                    table.Append(new TableGrid(block.ColumnWidthsBps.Select(w => new GridColumn { Width = Math.Max(1, w * 9000 / 10000).ToString() })));
                    foreach (var row in block.Rows)
                    {
                        var tr = new TableRow();
                        foreach (var cell in row.Cells)
                        {
                            var tc = new TableCell(new TableCellProperties(new GridSpan { Val = cell.Colspan ?? 1 }));
                            foreach (var p in cell.Paragraphs) tc.Append(WriteParagraph(p.Runs, p.Alignment));
                            tr.Append(tc);
                        }
                        table.Append(tr);
                    }
                    body.Append(table);
                }
            }
            body.Append(new SectionProperties(new PageSize { Width = 11906, Height = 16838 }, new PageMargin { Top = 1134, Bottom = 1134, Left = 1134, Right = 1134 }));
            part.Document.Save();
        }
        var bytes = stream.ToArray();
        if (format == "pdf")
        {
            try { bytes = await pdf.ConvertPreviewToPdfAsync(bytes, ct); }
            catch (ContractTemplatePdfRenderingException ex) { return StatusCode(503, ApiResponse<object>.Fail(ex.Message)); }
        }
        var name = new string(request.Title.Take(100).Where(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_').ToArray()).Trim();
        return File(bytes, format == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{(name.Length > 0 ? name : "Hop dong")}.{format}");
    }

    private static Paragraph WriteParagraph(IEnumerable<ContractTermRichTextRun> runs, string? alignment)
    {
        var p = new Paragraph(new ParagraphProperties(new Justification { Val = alignment == "center" ? JustificationValues.Center : alignment == "right" ? JustificationValues.Right : alignment == "justify" ? JustificationValues.Both : JustificationValues.Left }));
        foreach (var r in runs)
        {
            var properties = new RunProperties(new RunFonts { Ascii = r.FontFamily ?? "Times New Roman", HighAnsi = r.FontFamily ?? "Times New Roman" }, new FontSize { Val = ((r.FontSize ?? 12) * 2).ToString() });
            if (r.Bold) properties.Append(new Bold());
            if (r.Strike) properties.Append(new Strike());
            if (r.Italic) properties.Append(new Italic());
            if (r.Underline) properties.Append(new Underline { Val = UnderlineValues.Single });
            var run = new Run(properties);
            foreach (var line in r.Text.Split('\n').Select((text, index) => (text, index)))
            {
                if (line.index > 0) run.Append(new Break());
                run.Append(new Text(line.text) { Space = SpaceProcessingModeValues.Preserve });
            }
            p.Append(run);
        }
        return p;
    }
}
