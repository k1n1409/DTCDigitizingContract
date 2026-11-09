using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Wordprocessing;

namespace ContractManagement.API.Domains.Services.Contract;

/// <summary>Text anchors never include tabs, shapes, or text in a nested textbox.</summary>
public static class WordParagraphText
{
    public static List<Text> Nodes(Paragraph paragraph) => paragraph.Descendants<Text>()
        .Where(t => t.Ancestors<Paragraph>().FirstOrDefault() == paragraph).ToList();
    public static string Read(Paragraph paragraph) => string.Concat(Nodes(paragraph).Select(t => t.Text));
    public static bool CanEdit(Paragraph p) => Nodes(p).Count > 0
        && !p.Descendants<FieldChar>().Any() && !p.Descendants<SimpleField>().Any()
        && !p.Descendants<Break>().Any() && !p.Descendants<InsertedRun>().Any()
        && !p.Descendants<DeletedRun>().Any() && !p.Descendants<Hyperlink>().Any()
        && !p.Ancestors<SdtElement>().Any() && !p.Descendants<SdtElement>().Any();
    public static bool TextOnly(Paragraph p) => CanEdit(p)
        && (p.Descendants<TabChar>().Any() || p.Descendants<Drawing>().Any() || p.Descendants<Picture>().Any());

    public static void Replace(Paragraph paragraph, string value)
    {
        if (value.Any(c => c is '\r' or '\n' or '\t')) throw new ArgumentException("Chỉ sửa chữ trong đoạn này; Tab và ngắt dòng gốc được giữ riêng.");
        System.Xml.XmlConvert.VerifyXmlChars(value);
        var nodes = Nodes(paragraph); var original = string.Concat(nodes.Select(t => t.Text));
        if (original == value) return;
        if (nodes.Count == 0) throw new ArgumentException("Không có vùng chữ để chỉnh sửa.");
        // Keep unchanged prefixes/suffixes in their original styled runs.
        var start = 0;
        while (start < original.Length && start < value.Length && original[start] == value[start]) start++;
        var end = original.Length; var newEnd = value.Length;
        while (end > start && newEnd > start && original[end - 1] == value[newEnd - 1]) { end--; newEnd--; }
        if (start > 0 && start < original.Length && char.IsLowSurrogate(original[start])) start--;
        if (end < original.Length && char.IsLowSurrogate(original[end])) { end++; newEnd++; }
        var insert = value[start..newEnd]; var offset = 0; var inserted = false;
        foreach (var text in nodes)
        {
            var from = offset; offset += text.Text.Length;
            if (offset < start || from > end || (inserted && from >= end)) continue;
            var left = from < start ? text.Text[..Math.Min(text.Text.Length, start - from)] : "";
            var right = offset > end ? text.Text[Math.Max(0, end - from)..] : "";
            text.Text = left + (inserted ? "" : insert) + right;
            text.Space = SpaceProcessingModeValues.Preserve; inserted = true;
        }
        if (!inserted) throw new ArgumentException("Không xác định được vị trí chữ trong Word gốc.");
    }
}
