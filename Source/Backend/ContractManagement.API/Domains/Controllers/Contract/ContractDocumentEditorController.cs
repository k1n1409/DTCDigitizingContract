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
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.API.Domains.Services.Contract;
using System.Security.Cryptography;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController]
[Route("api/contract-document-editor")]
[SessionAuthorize(RbacPermissions.ContractCreate)]
public sealed partial class ContractDocumentEditorController(IContractTemplatePdfRenderer pdf, DbDtctechContext? db = null, ICurrentTenant? tenant = null) : ControllerBase
{
    private EditorStationeryOptions Stationery => HttpContext?.RequestServices?.GetService<Microsoft.Extensions.Options.IOptions<EditorStationeryOptions>>()?.Value ?? new();
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
            var originalBytes = buffer.ToArray();
            if (db is not null) LegacyWordDocument.Read(originalBytes);
            var sourceNodes = body.ChildElements.ToList();
            var sourceParagraphs = body.Descendants<Paragraph>().Where(p => !p.Ancestors<Paragraph>().Any()).ToList();
            ContractTermRichTextParagraph ReadBound(Paragraph p) { var result = ReadParagraph(p); if (db is not null) result.SourceKey = $"p{sourceParagraphs.IndexOf(p)}"; return result; }
            foreach (var node in body.ChildElements)
            {
                if (node is SectionProperties) continue;
                var sourceKey = db is not null ? $"b{sourceNodes.IndexOf(node)}" : null;
                if (db is not null && node is Paragraph sourceParagraph && WordParagraphText.TextOnly(sourceParagraph))
                {
                    model.Blocks.Add(new() { Type = "paragraph", SourceKey = sourceKey, TextOnly = true, Alignment = ReadParagraph(sourceParagraph).Alignment, Runs = [new() { Text = WordParagraphText.Read(sourceParagraph) }] });
                    continue;
                }
                if (db is not null && NeedsPreservation(node)) { model.Blocks.Add(PreservedBlock(node, sourceKey!, doc.MainDocumentPart!)); continue; }
                if (node is Paragraph paragraph)
                {
                    var p = ReadParagraph(paragraph);
                    model.Blocks.Add(new() { Type = "paragraph", SourceKey = sourceKey, Runs = p.Runs, Alignment = p.Alignment, PageBreakBefore = p.PageBreakBefore });
                }
                else if (node is Table table)
                {
                    var rows = table.Elements<TableRow>().ToList();
                    var count = rows.Select(r => r.Elements<TableCell>().Sum(c => (int)(c.TableCellProperties?.GridSpan?.Val?.Value ?? 1))).DefaultIfEmpty(1).Max();
                    if (count is < 1 or > 20 || rows.Count > 50) return BadRequest(ApiResponse<object>.Fail("Bảng vượt giới hạn 50 dòng/20 cột."));
                    var grid = table.GetFirstChild<TableGrid>()?.Elements<GridColumn>().Select(c => double.TryParse(c.Width?.Value, out var width) ? Math.Max(1, width) : 1).ToArray();
                    var weights = grid is { Length: > 0 } && grid.Length == count ? grid : Enumerable.Repeat(1d, count).ToArray();
                    // Keep column ratios, while meeting the editor's 2.5% minimum per column.
                    var widths = weights.Select(w => Math.Max(250, (int)Math.Round(10000 * w / weights.Sum()))).ToList();
                    while (widths.Sum() > 10000) { var largest = widths.IndexOf(widths.Max()); widths[largest] -= Math.Min(widths[largest] - 250, widths.Sum() - 10000); }
                    widths[^1] += 10000 - widths.Sum();
                    var block = new ContractTermRichTextBlock { Type = "table", SourceKey = sourceKey, ColumnWidthsBps = widths };
                    var previous = new Dictionary<int, ContractTermRichTextCell>();
                    foreach (var row in rows)
                    {
                        var cells = new List<ContractTermRichTextCell>(); var active = new Dictionary<int, ContractTermRichTextCell>(); var column = 0;
                        foreach (var c in row.Elements<TableCell>())
                        {
                            var span = (int)(c.TableCellProperties?.GridSpan?.Val?.Value ?? 1);
                            var merge = c.TableCellProperties?.VerticalMerge;
                            if (merge is not null && merge.Val?.Value != MergedCellValues.Restart)
                            {
                                if (!previous.TryGetValue(column, out var origin) || (origin.Colspan ?? 1) != span) return BadRequest(ApiResponse<object>.Fail("Bảng ghép dọc không hợp lệ."));
                                origin.Rowspan = (origin.Rowspan ?? 1) + 1; active[column] = origin;
                            }
                            else
                            {
                                var cell = new ContractTermRichTextCell { Colspan = span, Paragraphs = c.Elements<Paragraph>().Select(ReadBound).ToList(), VerticalAlign = c.TableCellProperties?.TableCellVerticalAlignment?.Val?.Value == TableVerticalAlignmentValues.Center ? "center" : c.TableCellProperties?.TableCellVerticalAlignment?.Val?.Value == TableVerticalAlignmentValues.Bottom ? "bottom" : "top" };
                                if (cell.Paragraphs.Count == 0) cell.Paragraphs.Add(new());
                                cells.Add(cell); if (merge is not null) active[column] = cell;
                            }
                            column += span;
                        }
                        previous = active;
                        block.Rows.Add(new() { Cells = cells });
                    }
                    model.Blocks.Add(block);
                }
            }
            ContractEditorSourceAsset? asset = null;
            if (db is not null && tenant is not null)
            {
                asset = new() { Id = Guid.NewGuid(), TenantId = tenant.GetRequiredTenant().TenantId, EmployeeId = HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException(), Docx = originalBytes, Sha256 = Convert.ToHexString(SHA256.HashData(originalBytes)), CreatedAtUtc = DateTime.UtcNow };
                var peripheralText = doc.MainDocumentPart!.HeaderParts.SelectMany(h => (h.Header?.Descendants<Paragraph>() ?? Enumerable.Empty<Paragraph>())).Concat(doc.MainDocumentPart.FooterParts.SelectMany(f => (f.Footer?.Descendants<Paragraph>() ?? Enumerable.Empty<Paragraph>()))).Select(p => string.Concat(p.Descendants<Text>().Select(t => t.Text)));
                model.Preservation = new() { SourceId = asset.Id, Sha256 = asset.Sha256, FieldKeys = peripheralText.SelectMany(text => System.Text.RegularExpressions.Regex.Matches(text, @"\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}").Select(m => m.Groups[1].Value)).Distinct().Take(200).ToList() };
            }
            var content = ContractTermRichText.Prefix + JsonSerializer.Serialize(model, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            if (System.Text.Encoding.UTF8.GetByteCount(content) > 4_000_000) return BadRequest(ApiResponse<object>.Fail("Nội dung soạn thảo vượt giới hạn 4 MB. Hãy chia tài liệu nhỏ hơn; có thể tiếp tục rà soát trong module Word cũ."));
            if (!ContractTermRichText.TryParse(content, out _)) return BadRequest(ApiResponse<object>.Fail("Cấu trúc tài liệu vượt giới hạn editor. Hãy chia tài liệu nhỏ hơn hoặc đơn giản hóa bảng."));
            if (asset is not null) { db!.Add(asset); await db.SaveChangesAsync(ct); }
            return Ok(ApiResponse<object>.Ok(new {
                content,
                warning = asset is null ? "Đã nhập văn bản và bảng cơ bản. Hãy kiểm tra bản PDF thực tế trước khi dùng." : "Đang giữ gói Word gốc: ảnh, header/footer, lề trang và bảng lồng được giữ khi xuất. Khối viền nét đứt chỉ xem/di chuyển/xóa cả khối; không chỉnh nội dung bên trong tại đây. Xem PDF thực tế để kiểm tra bố cục cuối cùng."
            }));
        }
        catch (Exception ex) when (ex is OpenXmlPackageException or InvalidDataException or System.Xml.XmlException or ArgumentException)
        {
            return BadRequest(ApiResponse<object>.Fail("Không đọc được DOCX. Tệp có thể hỏng, mã hóa hoặc không đúng định dạng."));
        }
    }

    private static ContractTermRichTextParagraph ReadParagraph(Paragraph p) => new()
    {
        PageBreakBefore = p.ParagraphProperties?.PageBreakBefore is { } pageBreak && (pageBreak.Val?.Value ?? true),
        Alignment = p.ParagraphProperties?.Justification?.Val?.Value == JustificationValues.Center ? "center" : p.ParagraphProperties?.Justification?.Val?.Value == JustificationValues.Right ? "right" : p.ParagraphProperties?.Justification?.Val?.Value == JustificationValues.Both ? "justify" : "left",
        Runs = p.Descendants<Run>().Select(r => new ContractTermRichTextRun {
            Text = string.Concat(r.ChildElements.Select(n => n is Text t ? t.Text : n is Break ? "\n" : n is TabChar ? "\t" : "")),
            Bold = r.RunProperties?.Bold is { } b && (b.Val?.Value ?? true),
            Italic = r.RunProperties?.Italic is { } i && (i.Val?.Value ?? true),
            Underline = r.RunProperties?.Underline is { } u && u.Val?.Value != UnderlineValues.None,
            Strike = r.RunProperties?.Strike is { } s && (s.Val?.Value ?? true),
            FontFamily = (r.RunProperties?.RunFonts?.Ascii?.Value ?? r.RunProperties?.RunFonts?.HighAnsi?.Value) switch { "Arial" => "Arial", "Calibri" => "Calibri", _ => "Times New Roman" },
            FontSize = int.TryParse(r.RunProperties?.FontSize?.Val?.Value, out var size) ? Math.Clamp(size / 2, 8, 36) : null
        }).ToList()
    };

    [HttpPost("export/{format}")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> Export(string format, ExportRequest request, CancellationToken ct)
    {
        if (request.Bindings is null || request.Bindings.Count > 200) return BadRequest(ApiResponse<object>.Fail("Trường dữ liệu không hợp lệ."));
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
        if (model.Preservation is not null)
        {
            try { return await ExportPreserved(format, request, model, ct); }
            catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
            catch (Exception ex) when (ex is OpenXmlPackageException or InvalidDataException or System.Xml.XmlException) { return BadRequest(ApiResponse<object>.Fail("Một thành phần trong Word gốc không hợp lệ. Hãy kiểm tra và nhập lại tài liệu.")); }
        }
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var part = doc.AddMainDocumentPart();
            var body = new Body();
            part.Document = new Document(body);
            model.Layout ??= new ContractDocumentLayout();
            var section = new SectionProperties(); ApplySectionLayout(section, model.Layout);
            var size = section.GetFirstChild<PageSize>()!; var margins = section.GetFirstChild<PageMargin>()!;
            var availableWidth = (int)(size.Width!.Value - margins.Left!.Value - margins.Right!.Value);
            foreach (var block in model.Blocks)
            {
                if (block.Type == "paragraph") body.Append(WriteParagraph(block.Runs, block.Alignment, block.PageBreakBefore));
                else
                {
                    body.Append(WriteTable(block, availableWidth));
                }
            }
            body.Append(section);
            ApplyDocumentLayout(body, model);
            try { EditorDocumentStationery.Apply(part, section, Stationery); }
            catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
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

    private static Paragraph WriteParagraph(IEnumerable<ContractTermRichTextRun> runs, string? alignment, bool pageBreakBefore = false)
    {
        var p = new Paragraph(new ParagraphProperties(new Justification { Val = alignment == "center" ? JustificationValues.Center : alignment == "right" ? JustificationValues.Right : alignment == "justify" ? JustificationValues.Both : JustificationValues.Left }));
        if (pageBreakBefore) p.ParagraphProperties!.PrependChild(new PageBreakBefore());
        foreach (var r in runs)
        {
            var properties = new RunProperties(new RunFonts { Ascii = r.FontFamily ?? "Times New Roman", HighAnsi = r.FontFamily ?? "Times New Roman", ComplexScript = r.FontFamily ?? "Times New Roman" }, new FontSize { Val = ((r.FontSize ?? 12) * 2).ToString() });
            if (r.Bold) properties.Bold = new Bold();
            if (r.Strike) properties.Strike = new Strike();
            if (r.Italic) properties.Italic = new Italic();
            if (r.Underline) properties.Underline = new Underline { Val = UnderlineValues.Single };
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

    private static Table WriteTable(ContractTermRichTextBlock block, int availableWidth = 11906 - 2 * 1134)
    {
        availableWidth = Math.Clamp(availableWidth, 1000, 30000);
        var widths = ContractTableLayoutPolicy.MapToDxa(block.ColumnWidthsBps, availableWidth);
        var table = new Table(new TableProperties(new TableWidth { Width = availableWidth.ToString(), Type = TableWidthUnitValues.Dxa }, new TableBorders(new TopBorder { Val = BorderValues.Single }, new LeftBorder { Val = BorderValues.Single }, new BottomBorder { Val = BorderValues.Single }, new RightBorder { Val = BorderValues.Single }, new InsideHorizontalBorder { Val = BorderValues.Single }, new InsideVerticalBorder { Val = BorderValues.Single }), new TableLayout { Type = TableLayoutValues.Fixed }));
        table.Append(new TableGrid(widths.Select(w => new GridColumn { Width = w.ToString() })));
        var active = new Dictionary<int, (int End, int Span)>();
        for (var rowIndex = 0; rowIndex < block.Rows.Count; rowIndex++)
        {
            var row = new TableRow(new TableRowProperties(new CantSplit())); var column = 0;
            void ContinueMerges()
            {
                while (active.TryGetValue(column, out var merge) && merge.End > rowIndex)
                {
                    row.Append(new TableCell(new TableCellProperties(new TableCellWidth { Type = TableWidthUnitValues.Dxa, Width = widths.Skip(column).Take(merge.Span).Sum().ToString() }, new GridSpan { Val = merge.Span }, new VerticalMerge { Val = MergedCellValues.Continue }), new Paragraph()));
                    column += merge.Span;
                }
            }
            foreach (var cell in block.Rows[rowIndex].Cells)
            {
                ContinueMerges(); var span = cell.Colspan ?? 1; var rowspan = cell.Rowspan ?? 1;
                var properties = new TableCellProperties(new TableCellWidth { Width = widths.Skip(column).Take(span).Sum().ToString(), Type = TableWidthUnitValues.Dxa }, new GridSpan { Val = span }, new TableCellVerticalAlignment { Val = cell.VerticalAlign == "center" ? TableVerticalAlignmentValues.Center : cell.VerticalAlign == "bottom" ? TableVerticalAlignmentValues.Bottom : TableVerticalAlignmentValues.Top });
                if (rowspan > 1) { properties.VerticalMerge = new VerticalMerge { Val = MergedCellValues.Restart }; active[column] = (rowIndex + rowspan, span); }
                var tc = new TableCell(properties);
                foreach (var p in cell.Paragraphs) tc.Append(WriteParagraph(p.Runs, p.Alignment, p.PageBreakBefore));
                row.Append(tc); column += span;
            }
            ContinueMerges(); table.Append(row);
        }
        return table;
    }
}
