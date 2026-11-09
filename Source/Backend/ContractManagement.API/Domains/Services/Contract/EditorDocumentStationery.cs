using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;

namespace ContractManagement.API.Domains.Services.Contract;

public sealed class EditorStationeryOptions
{
    public const string SectionName = "ContractEditorStationery";
    public bool Enabled { get; set; } = true;
    public string CompanyName { get; set; } = "CÔNG TY TNHH CÔNG NGHỆ ỨNG DỤNG VÀ TRUYỀN THÔNG DTC";
    public string Website { get; set; } = "www.dtctech.vn";
    public string Email { get; set; } = "info@dtctech.vn";
    public string LogoPath { get; set; } = "Assets/Email/logo_light.png";
}

/// <summary>One DOCX letterhead for both PDF preview and exports. Never overlays imported Word headers.</summary>
public static class EditorDocumentStationery
{
    public const string Version = "dtc-letterhead-v1";
    public static string ContactLine(EditorStationeryOptions o) => string.Join(" | ", new[] { string.IsNullOrWhiteSpace(o.Website) ? null : $"Website: {o.Website}", string.IsNullOrWhiteSpace(o.Email) ? null : $"Email: {o.Email}" }.Where(v => v is not null));
    public static byte[]? Logo(EditorStationeryOptions o)
    {
        var path = Path.IsPathRooted(o.LogoPath) ? o.LogoPath : Path.Combine(AppContext.BaseDirectory, o.LogoPath);
        return File.Exists(path) && new FileInfo(path).Length <= 2_000_000 ? File.ReadAllBytes(path) : null;
    }
    public static void Apply(MainDocumentPart main, SectionProperties section, EditorStationeryOptions options)
    {
        if (!options.Enabled || main.HeaderParts.Any() || main.FooterParts.Any()) return;
        var margin = section.GetFirstChild<PageMargin>()!;
        if (margin.Top?.Value < 1134 || margin.Bottom?.Value < 680)
            throw new ArgumentException("Đầu/chân trang công ty cần lề trên ít nhất 20 mm và lề dưới ít nhất 12 mm. Hãy điều chỉnh Bố cục trang trước khi xem/xuất.");
        margin.Header = 170; margin.Footer = 170;
        var header = main.AddNewPart<HeaderPart>();
        var footer = main.AddNewPart<FooterPart>();
        var width = (int)(section.GetFirstChild<PageSize>()!.Width!.Value - margin.Left!.Value - margin.Right!.Value);
        Paragraph TextLine(string text, bool bold = false) => new(new ParagraphProperties(new SpacingBetweenLines { Before = "0", After = "0", Line = "200", LineRule = LineSpacingRuleValues.Auto }), new Run(new RunProperties(new RunFonts { Ascii = "Arial", HighAnsi = "Arial" }, new Bold { Val = bold }, new FontSize { Val = bold ? "16" : "14" }), new Text(text) { Space = SpaceProcessingModeValues.Preserve }));
        var logoParagraph = TextLine("");
        var logo = Logo(options) ?? throw new ArgumentException("Không tìm thấy logo đầu trang. Kiểm tra ContractEditorStationery:LogoPath và file logo được triển khai cùng backend.");
        if (logo is not null)
        {
            var image = header.AddImagePart(ImagePartType.Png); using var bytes = new MemoryStream(logo); image.FeedData(bytes);
            var picture = new PIC.Picture(new PIC.NonVisualPictureProperties(new PIC.NonVisualDrawingProperties { Id = 1, Name = "Logo công ty" }, new PIC.NonVisualPictureDrawingProperties()), new PIC.BlipFill(new A.Blip { Embed = header.GetIdOfPart(image) }, new A.Stretch(new A.FillRectangle())), new PIC.ShapeProperties(new A.Transform2D(new A.Offset { X = 0, Y = 0 }, new A.Extents { Cx = 540000, Cy = 540000 }), new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle }));
            logoParagraph.Append(new Run(new Drawing(new DW.Inline(new DW.Extent { Cx = 540000, Cy = 540000 }, new DW.DocProperties { Id = 8001, Name = "Logo công ty" }, new A.Graphic(new A.GraphicData(picture) { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" })) { DistanceFromTop = 0, DistanceFromBottom = 0, DistanceFromLeft = 0, DistanceFromRight = 0 })));
        }
        var logoWidth = logo is null ? 0 : 950;
        var properties = new TableProperties(new TableWidth { Width = width.ToString(), Type = TableWidthUnitValues.Dxa }, new TableBorders(new BottomBorder { Val = BorderValues.Single, Color = "A6B5C5", Size = 4 }), new TableLayout { Type = TableLayoutValues.Fixed });
        var table = new Table(properties, new TableGrid(new GridColumn { Width = logoWidth.ToString() }, new GridColumn { Width = (width - logoWidth).ToString() }), new TableRow(new TableCell(new TableCellProperties(new TableCellWidth { Width = logoWidth.ToString(), Type = TableWidthUnitValues.Dxa }, new TableCellVerticalAlignment { Val = TableVerticalAlignmentValues.Center }), logoParagraph), new TableCell(new TableCellProperties(new TableCellWidth { Width = (width - logoWidth).ToString(), Type = TableWidthUnitValues.Dxa }, new TableCellVerticalAlignment { Val = TableVerticalAlignmentValues.Center }), TextLine(options.CompanyName, true), TextLine(ContactLine(options)))));
        header.Header = new Header(table, new Paragraph(new ParagraphProperties(new SpacingBetweenLines { Before = "0", After = "0", Line = "20", LineRule = LineSpacingRuleValues.Exact })));
        var page = TextLine(""); page.ParagraphProperties!.Justification = new() { Val = JustificationValues.Center };
        page.Append(new SimpleField(new Run(new RunProperties(new FontSize { Val = "16" }), new Text("1"))) { Instruction = " PAGE " });
        footer.Footer = new Footer(page);
        section.RemoveAllChildren<TitlePage>();
        // Header/footer references share a schema choice; AddChild would replace the first reference.
        section.PrependChild(new FooterReference { Id = main.GetIdOfPart(footer), Type = HeaderFooterValues.Default });
        section.PrependChild(new HeaderReference { Id = main.GetIdOfPart(header), Type = HeaderFooterValues.Default });
        header.Header.Save(); footer.Footer.Save();
    }
}
