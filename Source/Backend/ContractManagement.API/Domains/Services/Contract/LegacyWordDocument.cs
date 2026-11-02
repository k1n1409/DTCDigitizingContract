using System.IO.Compression;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace ContractManagement.API.Domains.Services.Contract;

public sealed record LegacyTextBlock(string Id, string Text, string Context, bool Editable);
public sealed class LegacyField
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BlockId { get; set; } = "";
    public int Start { get; set; }
    public int Length { get; set; }
    public string Original { get; set; } = "";
    public string Value { get; set; } = "";
    public string Label { get; set; } = "";
    public string Party { get; set; } = "Chưa xác định";
    public string Status { get; set; } = "proposed";
}

public static class LegacyWordDocument
{
    public static object LayoutReport(byte[] bytes, IReadOnlyList<LegacyTextBlock>? knownBlocks = null)
    {
        var blocks = knownBlocks ?? Read(bytes);
        using var stream = new MemoryStream(bytes);
        using var doc = WordprocessingDocument.Open(stream, false);
        var body = doc.MainDocumentPart!.Document!.Body!;
        var tables = body.Descendants<Table>().ToList();
        return new {
            tables = tables.Count,
            mergedCells = body.Descendants<TableCell>().Count(c => c.TableCellProperties?.GridSpan is not null || c.TableCellProperties?.VerticalMerge is not null),
            nestedTables = tables.Count(t => t.Ancestors<Table>().Any()),
            images = doc.MainDocumentPart.ImageParts.Count() + doc.MainDocumentPart.HeaderParts.Sum(h => h.ImageParts.Count()) + doc.MainDocumentPart.FooterParts.Sum(f => f.ImageParts.Count()),
            headers = doc.MainDocumentPart.HeaderParts.Count(),
            footers = doc.MainDocumentPart.FooterParts.Count(),
            pageBreaks = body.Descendants<Break>().Count(b => b.Type?.Value == BreakValues.Page),
            readOnlyBlocks = blocks.Count(b => !b.Editable),
            editableBlocks = blocks.Count(b => b.Editable && b.Text.Length > 0),
            exportPreservesOriginalPackage = true,
            editorTemplateIsBasicLayout = false,
            editorTemplatePreservesOriginalPackage = true,
            editorComplexBlocksAreReadOnly = true
        };
    }

    public static byte[] TemplateDocument(byte[] original, IReadOnlyList<LegacyField> fields, IReadOnlyDictionary<Guid, string> replacements)
    {
        if (replacements.Count > 200 || replacements.Any(x => !Regex.IsMatch(x.Value, "^[A-Z][A-Z0-9_]{0,79}$") || x.Value.StartsWith("SOURCE_", StringComparison.Ordinal)))
            throw new ArgumentException("Trường mẫu không hợp lệ hoặc vượt giới hạn 200 trường.");
        if (replacements.Keys.Any(id => !fields.Any(f => f.Id == id))) throw new ArgumentException("Trường không thuộc phiên bản đang chọn.");
        var copy = fields.Select(f => new LegacyField {
            Id = f.Id, BlockId = f.BlockId, Start = f.Start, Length = f.Length, Original = f.Original,
            Label = f.Label, Party = f.Party,
            Value = replacements.TryGetValue(f.Id, out var key) ? "{{" + key + "}}" : f.Value,
            Status = replacements.ContainsKey(f.Id) ? "confirmed" : f.Status
        }).ToList();
        return Apply(original, copy);
    }
    private const string Labels = @"Tên (?:khách hàng|công ty|doanh nghiệp)|Mã số thuế|MST|Địa chỉ(?: trụ sở)?|Điện thoại|Số điện thoại|Fax|Email|Số hợp đồng|Mã hợp đồng|Ngày (?:ký|hiệu lực|hết hạn)|Đại diện|Người đại diện|Chức vụ|Chức danh|Giá trị hợp đồng|Tổng giá trị|(?:Số )?Tài khoản(?: ngân hàng)?|Ngân hàng";
    private static List<Paragraph> Paragraphs(WordprocessingDocument doc) => doc.MainDocumentPart?.Document?.Body?.Descendants<Paragraph>().Where(p => !p.Ancestors<Paragraph>().Any()).ToList() ?? throw new ArgumentException("Không có phần thân DOCX.");
    private static List<Text> Texts(Paragraph p) => p.Descendants<Text>().Where(t => t.Ancestors<Paragraph>().FirstOrDefault() == p).ToList();
    private static string TextOf(Paragraph p) => string.Concat(Texts(p).Select(t => t.Text));
    private static bool Editable(Paragraph p) => !p.Descendants<FieldChar>().Any() && !p.Descendants<SimpleField>().Any() && !p.Descendants<Drawing>().Any() && !p.Descendants<Break>().Any() && !p.Descendants<TabChar>().Any() && !p.Descendants<InsertedRun>().Any() && !p.Descendants<DeletedRun>().Any() && !p.Descendants<Hyperlink>().Any() && !p.Ancestors<SdtElement>().Any() && !p.Descendants<SdtElement>().Any();

    public static List<LegacyTextBlock> Read(byte[] bytes)
    {
        if (bytes.Length is 0 or > 10 * 1024 * 1024) throw new ArgumentException("DOCX tối đa 10 MB và không được rỗng.");
        try
        {
            using var stream = new MemoryStream(bytes);
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read, true))
            {
                if (zip.Entries.Count > 3000 || zip.Entries.Sum(x => x.Length) > 40 * 1024 * 1024 || zip.Entries.Any(x => x.FullName.Contains("vbaProject", StringComparison.OrdinalIgnoreCase))) throw new ArgumentException("DOCX vượt giới hạn giải nén hoặc chứa macro.");
            }
            stream.Position = 0;
            using var doc = WordprocessingDocument.Open(stream, false, new OpenSettings { MaxCharactersInPart = 4_000_000 });
            var visited = new HashSet<OpenXmlPart>();
            void Check(OpenXmlPart part)
            {
                if (!visited.Add(part)) return;
                if (part.ExternalRelationships.Any() || part.Parts.Any(x => x.OpenXmlPart is EmbeddedObjectPart or EmbeddedPackagePart)) throw new ArgumentException("DOCX có liên kết tài nguyên ngoài hoặc đối tượng nhúng chưa hỗ trợ. Hãy tạo bản Word không chứa các đối tượng này.");
                foreach (var child in part.Parts) Check(child.OpenXmlPart);
            }
            foreach (var part in doc.Parts) Check(part.OpenXmlPart);
            var paragraphs = Paragraphs(doc);
            var tables = doc.MainDocumentPart!.Document!.Body!.Descendants<Table>().ToList();
            if (paragraphs.Count > 3000) throw new ArgumentException("Tài liệu vượt giới hạn 3000 đoạn.");
            return paragraphs.Select((p, i) => {
                var cell = p.Ancestors<TableCell>().FirstOrDefault();
                var context = "Đoạn văn";
                if (cell?.Parent is TableRow row && row.Parent is Table table) context = $"Bảng {tables.IndexOf(table) + 1} · dòng {table.Elements<TableRow>().ToList().IndexOf(row) + 1} · ô {row.Elements<TableCell>().ToList().IndexOf(cell) + 1}";
                return new LegacyTextBlock($"p-{i}", TextOf(p), context, Editable(p));
            }).ToList();
        }
        catch (Exception ex) when (ex is InvalidDataException or OpenXmlPackageException or System.Xml.XmlException)
        { throw new ArgumentException("Không đọc được DOCX: tệp hỏng, mã hóa hoặc không đúng định dạng.", ex); }
    }

    public static List<LegacyField> Detect(byte[] bytes, List<LegacyTextBlock> blocks)
    {
        using var stream = new MemoryStream(bytes);
        using var doc = WordprocessingDocument.Open(stream, false);
        var paragraphs = Paragraphs(doc); var fields = new List<LegacyField>(); var party = "Chưa xác định";
        // These offsets refer to the immutable source, never to normalized display text.
        void Add(LegacyTextBlock block, string label, int start, string value)
        {
            if (fields.Count >= 500 || value.Length is 0 or > 10000) return;
            fields.Add(new() { BlockId = block.Id, Label = label, Party = party, Start = start, Length = value.Length, Original = value, Value = value });
        }
        for (var i = 0; i < blocks.Count; i++)
        {
            var block = blocks[i];
            var partyMatch = Regex.Match(block.Text, @"^\s*BÊN\s+([AB])\b", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
            if (partyMatch.Success) party = "Bên " + partyMatch.Groups[1].Value.ToUpperInvariant();
            if (!block.Editable || string.IsNullOrWhiteSpace(block.Text)) continue;
            // Only explicit label boundaries are accepted; do not guess labels inside values.
            var matches = Regex.Matches(block.Text, $@"(?:^|[;|])\s*(?<label>{Labels})\s*[:：]\s*", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
            string? label = null; var start = 0; var value = "";
            if (matches.Count > 0)
            {
                for (var m = 0; m < matches.Count; m++)
                {
                    var match = matches[m]; var valueStart = match.Index + match.Length;
                    var end = m + 1 < matches.Count ? matches[m + 1].Index : block.Text.Length;
                    Add(block, match.Groups["label"].Value, valueStart, block.Text[valueStart..end].TrimEnd());
                }
                continue;
            }
            else if (paragraphs[i].Ancestors<TableCell>().FirstOrDefault() is { Parent: TableRow row } cell)
            {
                var cells = row.Elements<TableCell>().ToList(); var index = cells.IndexOf(cell);
                if (index > 0 && block.Text.Trim() != ":")
                {
                    for (var c = index - 1; c >= Math.Max(0, index - 2); c--)
                    {
                        // Do not flatten nested tables or multiple paragraphs into a fake label.
                        var labelParagraphs = cells[c].Elements<Paragraph>().ToList();
                        var candidate = labelParagraphs.Count == 1 && !cells[c].Elements<Table>().Any() ? TextOf(labelParagraphs[0]).Trim().TrimEnd(':', '：').TrimEnd() : "";
                        if (candidate == ":" || candidate.Length == 0) continue;
                        if (Regex.IsMatch(candidate, $@"^(?:{Labels})$", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1))) { label = candidate; value = block.Text.Trim(); start = block.Text.IndexOf(value, StringComparison.Ordinal); }
                        break;
                    }
                }
            }
            if (label is not null) Add(block, label, start, value);
        }
        return fields.Take(500).ToList();
    }

    public static void Validate(List<LegacyTextBlock> blocks, IReadOnlyList<LegacyField> fields)
    {
        if (fields.Any(f => f is null) || fields.Count > 500 || fields.Select(f => f.Id).Distinct().Count() != fields.Count) throw new ArgumentException("Tối đa 500 trường, không chứa null và ID trường không được trùng.");
        var byId = blocks.ToDictionary(b => b.Id);
        foreach (var f in fields)
        {
            if (f is null || f.BlockId is null || f.Original is null || f.Value is null || f.Label is null || f.Party is null) throw new ArgumentException("Trường dữ liệu không được chứa giá trị null.");
            if (f.Id == Guid.Empty || !byId.TryGetValue(f.BlockId, out var b) || !b.Editable || f.Start < 0 || f.Length <= 0 || f.Start > b.Text.Length || f.Length > b.Text.Length - f.Start || b.Text.Substring(f.Start, f.Length) != f.Original)
                throw new ArgumentException("Vị trí/văn bản gốc không khớp. Hãy chọn lại vùng dữ liệu.");
            if (string.IsNullOrWhiteSpace(f.Label) || f.Label.Length > 100 || f.Party.Length > 100 || f.Value.Length > 10000 || f.Value.Any(c => c is '\r' or '\n' or '\t') || f.Status is not ("proposed" or "confirmed" or "ignored")) throw new ArgumentException("Thông tin trường không hợp lệ.");
            try { System.Xml.XmlConvert.VerifyXmlChars(f.Value); }
            catch (System.Xml.XmlException ex) { throw new ArgumentException("Giá trị chứa ký tự XML không hợp lệ.", ex); }
        }
        foreach (var group in fields.Where(f => f.Status == "confirmed").GroupBy(f => f.BlockId))
        {
            var end = -1;
            foreach (var f in group.OrderBy(f => f.Start)) { if (f.Start < end) throw new ArgumentException("Các vùng đã xác nhận bị chồng lấn. Bỏ qua một vùng trước khi áp dụng."); end = f.Start + f.Length; }
        }
    }

    public static byte[] Apply(byte[] original, IReadOnlyList<LegacyField> fields)
    {
        var blocks = Read(original); Validate(blocks, fields);
        using var output = new MemoryStream(); output.Write(original); output.Position = 0;
        using (var doc = WordprocessingDocument.Open(output, true))
        {
            var paragraphs = Paragraphs(doc);
            foreach (var group in fields.Where(f => f.Status == "confirmed").GroupBy(f => f.BlockId))
            {
                var index = blocks.FindIndex(b => b.Id == group.Key); var p = paragraphs[index];
                foreach (var f in group.OrderByDescending(f => f.Start))
                {
                    var nodes = Texts(p); var position = 0; var inserted = false;
                    foreach (var t in nodes)
                    {
                        var start = position; position += t.Text.Length;
                        if (position <= f.Start || start >= f.Start + f.Length) continue;
                        var before = start < f.Start ? t.Text[..(f.Start - start)] : "";
                        var after = position > f.Start + f.Length ? t.Text[(f.Start + f.Length - start)..] : "";
                        t.Text = before + (inserted ? "" : f.Value) + after; t.Space = SpaceProcessingModeValues.Preserve; inserted = true;
                    }
                }
            }
            doc.MainDocumentPart!.Document!.Save();
        }
        return output.ToArray();
    }
}
