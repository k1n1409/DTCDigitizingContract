using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Domains.Services.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Domains.Policies.ContractTemplate;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Mvc;

namespace ContractManagement.API.Domains.Controllers.Contract;

public sealed partial class ContractDocumentEditorController
{
    private static void ApplySectionLayout(SectionProperties section, ContractDocumentLayout layout)
    {
        var previousMargins = section.GetFirstChild<PageMargin>();
        var header = previousMargins?.Header?.Value ?? 567U;
        var footer = previousMargins?.Footer?.Value ?? 567U;
        var gutter = previousMargins?.Gutter?.Value ?? 0U;
        var shortSide = layout.Paper == "A5" ? 8391U : 11906U;
        var longSide = layout.Paper == "A5" ? 11906U : 16838U;
        section.RemoveAllChildren<PageSize>();
        section.RemoveAllChildren<PageMargin>();
        section.AddChild(new PageSize { Width = layout.Orientation == "landscape" ? longSide : shortSide, Height = layout.Orientation == "landscape" ? shortSide : longSide, Orient = layout.Orientation == "landscape" ? PageOrientationValues.Landscape : PageOrientationValues.Portrait }, true);
        var twips = (double mm) => (uint)Math.Round(mm * 1440 / 25.4);
        section.AddChild(new PageMargin { Top = (int)twips(layout.MarginTop), Bottom = (int)twips(layout.MarginBottom), Left = twips(layout.MarginLeft), Right = twips(layout.MarginRight), Header = header, Footer = footer, Gutter = gutter }, true);
    }

    private static void ApplyDocumentLayout(Body body, ContractTermRichTextDocument model)
    {
        if (model.Layout is not { } layout) return;
        foreach (var section in body.Descendants<SectionProperties>()) ApplySectionLayout(section, layout);
        // Protected blocks keep their paragraph formatting. Only editable blocks receive spacing.
        var nodes = body.ChildElements.Where(n => n is not SectionProperties).ToList();
        for (var i = 0; i < model.Blocks.Count && i < nodes.Count; i++)
        {
            if (model.Blocks[i].Locked || model.Blocks[i].TextOnly) continue;
            var paragraphs = nodes[i] is Paragraph p ? new[] { p }.AsEnumerable() : nodes[i].Descendants<Paragraph>();
            foreach (var paragraph in paragraphs)
            {
                var properties = paragraph.ParagraphProperties ?? paragraph.PrependChild(new ParagraphProperties());
                properties.SpacingBetweenLines = new SpacingBetweenLines { Before = Math.Round(layout.SpaceBefore * 20).ToString(System.Globalization.CultureInfo.InvariantCulture), After = Math.Round(layout.SpaceAfter * 20).ToString(System.Globalization.CultureInfo.InvariantCulture), Line = Math.Round(layout.LineSpacing * 240).ToString(System.Globalization.CultureInfo.InvariantCulture), LineRule = LineSpacingRuleValues.Auto };
            }
        }
    }
    private static bool NeedsPreservation(OpenXmlElement node)
    {
        if (node is not Paragraph and not Table) return true;
        if (node.Descendants<Drawing>().Any() || node.Descendants<Picture>().Any() || node.Descendants<FieldChar>().Any() || node.Descendants<SimpleField>().Any() || node.Descendants<Hyperlink>().Any() || node.Descendants<Break>().Any() || node.Descendants<TabChar>().Any() || node.Descendants<SdtElement>().Any() || node.Descendants<InsertedRun>().Any() || node.Descendants<DeletedRun>().Any()) return true;
        if (node is Table table && (table.Descendants<Table>().Any() || table.Elements<TableRow>().Count() > 50 || table.Elements<TableRow>().Any(r => r.Elements<TableCell>().Sum(c => (int)(c.TableCellProperties?.GridSpan?.Val?.Value ?? 1)) > 20))) return true;
        return false;
    }

    private static ContractTermRichTextBlock PreservedBlock(OpenXmlElement node, string key, MainDocumentPart main)
    {
        string? image = null;
        var relation = node.Descendants<DocumentFormat.OpenXml.Drawing.Blip>().FirstOrDefault()?.Embed?.Value;
        if (relation is not null && main.GetPartById(relation) is ImagePart part && part.ContentType is "image/png" or "image/jpeg")
        {
            using var stream = part.GetStream();
            if (stream.Length <= 180_000) { using var copy = new MemoryStream(); stream.CopyTo(copy); image = $"data:{part.ContentType};base64,{Convert.ToBase64String(copy.ToArray())}"; }
        }
        return new() { Type = "paragraph", SourceKey = key, Locked = true, Label = node is Table ? "Bảng / bố cục Word được bảo toàn" : node.Descendants<Drawing>().Any() || node.Descendants<Picture>().Any() ? "Ảnh gốc được bảo toàn" : "Khối Word được bảo toàn", PreviewImage = image, Runs = [new() { Text = string.IsNullOrWhiteSpace(node.InnerText) ? "Nội dung được giữ trong bản Word/PDF xuất ra." : node.InnerText }] };
    }

    private async Task<IActionResult> ExportPreserved(string format, ExportRequest request, ContractTermRichTextDocument model, CancellationToken ct)
    {
        if (db is null || tenant is null) return BadRequest(ApiResponse<object>.Fail("Không có kho tài liệu gốc để giữ bố cục."));
        var source = await EditorDocxSourceAccess.ReadAsync(db, tenant.GetRequiredTenant().TenantId, HttpContext.Session.GetInt32("EmployeeId") ?? 0, model.Preservation!.SourceId, model.Preservation.Sha256, ct);
        if (source is null) return NotFound(ApiResponse<object>.Fail("Không có quyền truy cập bản Word gốc hoặc bản gốc không khớp."));
        if (Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(source.Docx)) != source.Sha256) return Conflict(ApiResponse<object>.Fail("Word gốc không khớp dấu kiểm tra. Dừng xuất để tránh dùng tài liệu sai."));
        LegacyWordDocument.Read(source.Docx); // Validate relationships and archive limits again before conversion.
        using var output = new MemoryStream(); output.Write(source.Docx); output.Position = 0;
        using (var doc = WordprocessingDocument.Open(output, true))
        {
            var body = doc.MainDocumentPart!.Document!.Body!;
            var original = body.ChildElements.Select(n => n.CloneNode(true)).ToList();
            var pageSection = original.OfType<SectionProperties>().LastOrDefault();
            if (model.Layout is not null) ApplySectionLayout(pageSection ??= new SectionProperties(), model.Layout);
            var pageWidth = (int)(pageSection?.GetFirstChild<PageSize>()?.Width?.Value ?? 11906U);
            var pageMargin = pageSection?.GetFirstChild<PageMargin>();
            var availableWidth = pageWidth - (int)(pageMargin?.Left?.Value ?? 1134U) - (int)(pageMargin?.Right?.Value ?? 1134U);
            var paragraphs = body.Descendants<Paragraph>().Where(p => !p.Ancestors<Paragraph>().Any()).ToList();
            var byKey = paragraphs.Select((p, i) => (p, key: $"p{i}")).ToDictionary(x => x.key, x => x.p);
            var nodes = new List<OpenXmlElement>();
            foreach (var block in model.Blocks)
            {
                OpenXmlElement? originalNode = null;
                if (block.SourceKey is { } key)
                {
                    if (key.Length < 2 || key[0] != 'b' || !int.TryParse(key[1..], out var at) || at < 0 || at >= original.Count || original[at] is SectionProperties) throw new ArgumentException("Liên kết khối Word không hợp lệ. Hãy nhập lại tài liệu.");
                    originalNode = original[at].CloneNode(true);
                }
                if (block.TextOnly)
                {
                    if (originalNode is not Paragraph textParagraph || !WordParagraphText.TextOnly(textParagraph)) throw new ArgumentException("Vùng chỉ sửa chữ không khớp tài liệu gốc. Hãy nhập lại DOCX.");
                    WordParagraphText.Replace(textParagraph, string.Concat(block.Runs.Select(r => r.Text)));
                    nodes.Add(textParagraph); continue;
                }
                if (block.Locked)
                {
                    if (originalNode is null || !NeedsPreservation(originalNode)) throw new ArgumentException("Khối được bảo toàn không khớp Word gốc.");
                    nodes.Add(originalNode); continue;
                }
                if (originalNode is not null && NeedsPreservation(originalNode)) throw new ArgumentException("Không sửa trực tiếp vùng Word phức tạp. Giữ khối gốc hoặc xóa cả khối.");
                if (block.Type == "paragraph")
                {
                    var paragraph = originalNode as Paragraph;
                    nodes.Add(paragraph is null ? WriteParagraph(block.Runs, block.Alignment, block.PageBreakBefore) : PatchParagraph(paragraph, new() { Runs = block.Runs, Alignment = block.Alignment, PageBreakBefore = block.PageBreakBefore }));
                }
                else if (originalNode is Table originalTable && CanPatchTable((Table)body.ChildElements[int.Parse(block.SourceKey![1..])], block, byKey))
                {
                    var cells = originalTable.Elements<TableRow>().SelectMany(r => r.Elements<TableCell>()).Where(c => c.TableCellProperties?.VerticalMerge is null || c.TableCellProperties.VerticalMerge.Val?.Value == MergedCellValues.Restart).ToList();
                    var sourceCells = ((Table)body.ChildElements[int.Parse(block.SourceKey![1..])]).Elements<TableRow>().SelectMany(r => r.Elements<TableCell>()).Where(c => c.TableCellProperties?.VerticalMerge is null || c.TableCellProperties.VerticalMerge.Val?.Value == MergedCellValues.Restart).ToList();
                    var values = block.Rows.SelectMany(r => r.Cells).ToList();
                    for (var i = 0; i < cells.Count; i++)
                    {
                        var patched = values[i].Paragraphs.Select(value => value.SourceKey is not null && byKey.TryGetValue(value.SourceKey, out var sourceParagraph) && sourceParagraph.Parent == sourceCells[i] ? PatchParagraph(sourceParagraph, value) : WriteParagraph(value.Runs, value.Alignment, value.PageBreakBefore)).ToList();
                        cells[i].RemoveAllChildren<Paragraph>(); cells[i].Append(patched);
                    }
                    UpdateTableLayout(originalTable, block);
                    nodes.Add(originalTable);
                }
                else nodes.Add(WriteTable(block, availableWidth));
            }
            var section = pageSection;
            body.RemoveAllChildren(); body.Append(nodes);
            if (nodes.Count == 0) body.Append(new Paragraph());
            if (section is not null) body.Append(section);
            ApplyDocumentLayout(body, model);
            BindPreservedTokens(doc, request);
            doc.MainDocumentPart.Document.Save();
            RemoveUnusedImages(doc);
        }
        var bytes = output.ToArray();
        if (format == "pdf") { try { bytes = await pdf.ConvertPreviewToPdfAsync(bytes, ct); } catch (ContractTemplatePdfRenderingException ex) { return StatusCode(503, ApiResponse<object>.Fail(ex.Message)); } }
        var name = new string(request.Title.Take(100).Where(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_').ToArray()).Trim();
        return File(bytes, format == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{(name.Length > 0 ? name : "Hop dong")}.{format}");
    }

    private static void RemoveUnusedImages(WordprocessingDocument doc)
    {
        var all = new HashSet<OpenXmlPart>();
        void Walk(OpenXmlPart part) { if (!all.Add(part)) return; foreach (var child in part.Parts) Walk(child.OpenXmlPart); }
        foreach (var part in doc.Parts) Walk(part.OpenXmlPart);
        var used = new HashSet<Uri>();
        foreach (var part in all)
        {
            var root = part.RootElement;
            if (root is null) { foreach (var image in part.Parts.Where(p => p.OpenXmlPart is ImagePart)) used.Add(image.OpenXmlPart.Uri); continue; }
            var ids = root.Descendants().Prepend(root).SelectMany(n => n.GetAttributes()).Where(a => a.NamespaceUri.EndsWith("/relationships", StringComparison.Ordinal) || a.LocalName == "relid").Select(a => a.Value).ToHashSet();
            foreach (var image in part.Parts.Where(p => p.OpenXmlPart is ImagePart && ids.Contains(p.RelationshipId))) used.Add(image.OpenXmlPart.Uri);
        }
        var removals = all.SelectMany(part => part.Parts.Where(p => p.OpenXmlPart is ImagePart && !used.Contains(p.OpenXmlPart.Uri)).Select(image => (Parent: part, Id: image.RelationshipId))).ToList();
        foreach (var removal in removals) if (removal.Parent.Parts.Any(p => p.RelationshipId == removal.Id)) removal.Parent.DeletePart(removal.Id);
    }

    internal static byte[] CleanReusableTemplate(byte[] bytes)
    {
        using var output = new MemoryStream(); output.Write(bytes); output.Position = 0;
        using (var doc = WordprocessingDocument.Open(output, true))
        {
            var main = doc.MainDocumentPart!;
            var roots = new OpenXmlPartRootElement?[] { main.Document, main.FootnotesPart?.Footnotes, main.EndnotesPart?.Endnotes }.Concat(main.HeaderParts.Select(h => (OpenXmlPartRootElement?)h.Header)).Concat(main.FooterParts.Select(f => (OpenXmlPartRootElement?)f.Footer)).OfType<OpenXmlPartRootElement>().ToList();
            foreach (var root in roots) { foreach (var annotation in root.Descendants().Where(n => n is CommentRangeStart or CommentRangeEnd or CommentReference).ToList()) annotation.Remove(); root.Save(); }
            foreach (var part in main.Parts.Where(p => p.OpenXmlPart.RelationshipType.Contains("/comments", StringComparison.OrdinalIgnoreCase) || p.OpenXmlPart.RelationshipType.EndsWith("/people", StringComparison.OrdinalIgnoreCase)).ToList()) main.DeletePart(part.RelationshipId);
            if (doc.CustomFilePropertiesPart is { } custom) doc.DeletePart(custom);
            doc.PackageProperties.Creator = ""; doc.PackageProperties.LastModifiedBy = ""; doc.PackageProperties.Description = ""; doc.PackageProperties.Subject = ""; doc.PackageProperties.Keywords = "";
            doc.PackageProperties.Title = ""; doc.PackageProperties.Identifier = "";
            main.Document!.Save(); RemoveUnusedImages(doc);
        }
        return output.ToArray();
    }

    private static void BindPreservedTokens(WordprocessingDocument doc, ExportRequest request)
    {
        var main = doc.MainDocumentPart!;
        var paragraphs = main.Document!.Descendants<Paragraph>().Concat(main.HeaderParts.SelectMany(h => (h.Header?.Descendants<Paragraph>() ?? Enumerable.Empty<Paragraph>()))).Concat(main.FooterParts.SelectMany(f => (f.Footer?.Descendants<Paragraph>() ?? Enumerable.Empty<Paragraph>())));
        var missing = new HashSet<string>();
        foreach (var paragraph in paragraphs)
        {
            var texts = paragraph.Descendants<Text>().Where(t => t.Ancestors<Paragraph>().FirstOrDefault() == paragraph).ToList();
            var text = string.Concat(texts.Select(t => t.Text));
            foreach (System.Text.RegularExpressions.Match match in System.Text.RegularExpressions.Regex.Matches(text, @"\{\{\s*([A-Z][A-Z0-9_]{0,79})\s*\}\}").Reverse())
            {
                if (!request.Bindings.TryGetValue(match.Groups[1].Value, out var replacement) || string.IsNullOrWhiteSpace(replacement)) { if (!request.AllowUnboundPreview) missing.Add(match.Groups[1].Value); continue; }
                if (replacement.Length > 10000 || replacement.Contains("{{")) throw new ArgumentException("Giá trị trường không hợp lệ.");
                var offset = 0; var inserted = false;
                foreach (var item in texts)
                {
                    var from = offset; offset += item.Text.Length;
                    if (offset <= match.Index || from >= match.Index + match.Length) continue;
                    var before = from < match.Index ? item.Text[..(match.Index - from)] : "";
                    var after = offset > match.Index + match.Length ? item.Text[(match.Index + match.Length - from)..] : "";
                    item.Text = before + (inserted ? "" : replacement) + after; item.Space = SpaceProcessingModeValues.Preserve; inserted = true;
                }
            }
        }
        if (missing.Count > 0) throw new ArgumentException("Chưa điền trường trong khối/header/footer gốc: " + string.Join(", ", missing));
        foreach (var header in main.HeaderParts) header.Header?.Save();
        foreach (var footer in main.FooterParts) footer.Footer?.Save();
    }

    private static bool CanPatchTable(Table original, ContractTermRichTextBlock block, Dictionary<string, Paragraph> source)
    {
        var cells = original.Elements<TableRow>().SelectMany(r => r.Elements<TableCell>()).Where(c => c.TableCellProperties?.VerticalMerge is null || c.TableCellProperties.VerticalMerge.Val?.Value == MergedCellValues.Restart).ToList();
        var target = block.Rows.SelectMany(r => r.Cells).ToList();
        if (original.Elements<TableRow>().Count() != block.Rows.Count || cells.Count != target.Count) return false;
        var rowspans = new Dictionary<TableCell, int>(); var active = new Dictionary<int, TableCell>();
        foreach (var row in original.Elements<TableRow>())
        {
            var next = new Dictionary<int, TableCell>(); var column = 0;
            foreach (var cell in row.Elements<TableCell>())
            {
                var merge = cell.TableCellProperties?.VerticalMerge;
                if (merge is not null && merge.Val?.Value != MergedCellValues.Restart && active.TryGetValue(column, out var origin)) { rowspans[origin]++; next[column] = origin; }
                else { rowspans[cell] = 1; if (merge is not null) next[column] = cell; }
                column += (int)(cell.TableCellProperties?.GridSpan?.Val?.Value ?? 1);
            }
            active = next;
        }
        for (var i = 0; i < cells.Count; i++)
        {
            if (rowspans[cells[i]] != (target[i].Rowspan ?? 1)) return false;
            if ((int)(cells[i].TableCellProperties?.GridSpan?.Val?.Value ?? 1) != (target[i].Colspan ?? 1)) return false;
        }
        return true;
    }

    private static void UpdateTableLayout(Table original, ContractTermRichTextBlock block)
    {
        var grid = original.GetFirstChild<TableGrid>();
        var widths = grid?.Elements<GridColumn>().Select(c => int.TryParse(c.Width?.Value, out var width) ? width : 0).ToArray();
        if (widths is { Length: > 0 } && widths.Length == block.ColumnWidthsBps.Count && widths.Sum() > 0)
        {
            var total = widths.Sum();
            if (widths.Select((w, i) => Math.Abs(10000d * w / total - block.ColumnWidthsBps[i])).Any(delta => delta > 20))
            {
                var updated = ContractTableLayoutPolicy.MapToDxa(block.ColumnWidthsBps, total);
                grid!.Parent!.ReplaceChild(new TableGrid(updated.Select(w => new GridColumn { Width = w.ToString() })), grid);
                foreach (var row in original.Elements<TableRow>())
                {
                    var column = 0;
                    foreach (var cell in row.Elements<TableCell>())
                    {
                        var span = (int)(cell.TableCellProperties?.GridSpan?.Val?.Value ?? 1);
                        cell.TableCellProperties ??= new();
                        cell.TableCellProperties.TableCellWidth = new() { Type = TableWidthUnitValues.Dxa, Width = updated.Skip(column).Take(span).Sum().ToString() };
                        column += span;
                    }
                }
            }
        }
        var cells = original.Elements<TableRow>().SelectMany(r => r.Elements<TableCell>()).Where(c => c.TableCellProperties?.VerticalMerge is null || c.TableCellProperties.VerticalMerge.Val?.Value == MergedCellValues.Restart).ToList();
        var model = block.Rows.SelectMany(r => r.Cells).ToList();
        for (var i = 0; i < cells.Count; i++)
        {
            cells[i].TableCellProperties ??= new();
            cells[i].TableCellProperties!.TableCellVerticalAlignment = new() { Val = model[i].VerticalAlign == "center" ? TableVerticalAlignmentValues.Center : model[i].VerticalAlign == "bottom" ? TableVerticalAlignmentValues.Bottom : TableVerticalAlignmentValues.Top };
        }
    }

    private static Paragraph PatchParagraph(Paragraph original, ContractTermRichTextParagraph value)
    {
        var baseline = ReadParagraph(original);
        string Styles(IEnumerable<ContractTermRichTextRun> runs) { var list = runs.Select(r => JsonSerializer.Serialize(new { r.Bold, r.Italic, r.Underline, r.Strike, r.FontFamily, r.FontSize })).ToList(); return string.Join("|", list.Where((s, i) => i == 0 || s != list[i - 1])); }
        var next = (Paragraph)original.CloneNode(true);
        var before = string.Concat(baseline.Runs.Select(r => r.Text)); var after = string.Concat(value.Runs.Select(r => r.Text));
        if (Styles(baseline.Runs) != Styles(value.Runs))
        {
            var generated = WriteParagraph(value.Runs, value.Alignment, value.PageBreakBefore);
            next.RemoveAllChildren<Run>();
            foreach (var run in generated.Elements<Run>()) next.Append(run.CloneNode(true));
        }
        else if (before != after)
        {
            var start = 0; while (start < before.Length && start < after.Length && before[start] == after[start]) start++;
            var end = before.Length; var nextEnd = after.Length;
            while (end > start && nextEnd > start && before[end - 1] == after[nextEnd - 1]) { end--; nextEnd--; }
            if (start > 0 && start < before.Length && char.IsLowSurrogate(before[start])) start--;
            if (end < before.Length && char.IsLowSurrogate(before[end])) { end++; nextEnd++; }
            var insert = after[start..nextEnd]; var offset = 0; var inserted = false;
            foreach (var text in next.Descendants<Text>())
            {
                var from = offset; offset += text.Text.Length;
                if (offset < start || from > end || (inserted && from >= end)) continue;
                var left = from < start ? text.Text[..Math.Min(text.Text.Length, start - from)] : "";
                var right = offset > end ? text.Text[Math.Max(0, end - from)..] : "";
                text.Text = left + (inserted ? "" : insert) + right; text.Space = SpaceProcessingModeValues.Preserve; inserted = true;
            }
            if (!inserted && insert.Length > 0) next.Append(new Run(new Text(insert) { Space = SpaceProcessingModeValues.Preserve }));
        }
        if ((value.Alignment ?? "left") != (baseline.Alignment ?? "left") || value.PageBreakBefore != baseline.PageBreakBefore)
        {
            next.ParagraphProperties ??= new();
            next.ParagraphProperties.Justification = new() { Val = value.Alignment == "center" ? JustificationValues.Center : value.Alignment == "right" ? JustificationValues.Right : value.Alignment == "justify" ? JustificationValues.Both : JustificationValues.Left };
            next.ParagraphProperties.PageBreakBefore = value.PageBreakBefore ? new PageBreakBefore() : null;
        }
        return next;
    }
}
