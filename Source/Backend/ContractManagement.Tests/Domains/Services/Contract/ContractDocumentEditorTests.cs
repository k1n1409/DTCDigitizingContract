using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Domains.Policies.ContractTemplate;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed class ContractDocumentEditorTests
{
    [Fact]
    public async Task ExportImport_PreservesMergedCellsVietnameseFontWidthsAndPageBreak()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        var model = new ContractTermRichTextDocument { Blocks = [
            new() { Type = "paragraph", PageBreakBefore = true, Alignment = "center", Runs = [new() { Text = "Hợp đồng tiếng Việt — Đặng Thị Hồng", FontFamily = "Times New Roman", FontSize = 14, Bold = true, Italic = true, Underline = true }] },
            new() { Type = "table", ColumnWidthsBps = [3000, 7000], Rows = [
                new() { Cells = [new() { Rowspan = 2, VerticalAlign = "center", Paragraphs = [new() { Runs = [new() { Text = "Ghép dọc" }] }] }, new() { Paragraphs = [new() { Runs = [new() { Text = "Cột 2" }] }] }] },
                new() { Cells = [new() { Paragraphs = [new() { Runs = [new() { Text = "Dòng 2" }] }] }] },
                new() { Cells = [new() { Colspan = 2, Paragraphs = [new() { Runs = [new() { Text = "Ghép ngang" }] }] }] }
            ] }
        ] };
        model.Blocks.Insert(0, new() { Type = "paragraph", Alignment = "center", Runs = [new() { Text = "TRANG 1 — KIỂM TRA BẢN XUẤT", Bold = true, FontSize = 16 }] });
        var content = ContractTermRichText.Prefix + JsonSerializer.Serialize(model, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        Assert.True(ContractTermRichText.TryParse(content, out _), content);
        var file = Assert.IsType<FileContentResult>(await controller.Export("docx", new() { Content = content }, default));
        var converter = Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH");
        if (System.IO.File.Exists(converter))
        {
            var renderer = new ContractManagement.Domains.Services.ContractTemplate.LibreOfficeContractTemplatePdfRenderer(Microsoft.Extensions.Options.Options.Create(new ContractManagement.Domains.Services.ContractTemplate.TemplatePdfRenderingOptions { ExecutablePath = converter }));
            var bytes = await renderer.ConvertPreviewToPdfAsync(file.FileContents);
            Assert.True(bytes.AsSpan(0, 5).SequenceEqual("%PDF-"u8));
            var target = Environment.GetEnvironmentVariable("EDITOR_EXPORT_PDF_FIXTURE_PATH");
            if (!string.IsNullOrWhiteSpace(target)) await System.IO.File.WriteAllBytesAsync(target, bytes);
        }
        using (var input = new MemoryStream(file.FileContents))
        using (var doc = DocumentFormat.OpenXml.Packaging.WordprocessingDocument.Open(input, false))
        {
            var errors = new DocumentFormat.OpenXml.Validation.OpenXmlValidator().Validate(doc).ToList();
            Assert.True(errors.Count == 0, string.Join("; ", errors.Select(e => e.Description)));
        }
        using var stream = new MemoryStream(file.FileContents);
        var imported = Assert.IsType<OkObjectResult>(await controller.Import(new FormFile(stream, 0, stream.Length, "file", "merged.docx"), default));
        var json = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(imported.Value).Data);
        Assert.True(ContractTermRichText.TryParse(json.GetProperty("content").GetString(), out var result));
        Assert.True(result.Blocks[1].PageBreakBefore);
        Assert.Equal("Hợp đồng tiếng Việt — Đặng Thị Hồng", result.Blocks[1].Runs[0].Text);
        Assert.Equal("Times New Roman", result.Blocks[1].Runs[0].FontFamily);
        Assert.Equal(new[] { 3000, 7000 }, result.Blocks[2].ColumnWidthsBps);
        Assert.Equal(2, result.Blocks[2].Rows[0].Cells[0].Rowspan);
        Assert.Single(result.Blocks[2].Rows[1].Cells);
        Assert.Equal(2, result.Blocks[2].Rows[2].Cells[0].Colspan);
    }
    private const string Content = ContractTermRichText.Prefix + "{\"blocks\":[{\"type\":\"paragraph\",\"runs\":[{\"text\":\"Mã số thuế: 123456789\",\"bold\":true}],\"alignment\":\"center\"}]}";

    [Fact]
    public async Task ExportAndImport_PreservesVietnameseAndFormatting()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        var file = Assert.IsType<FileContentResult>(await controller.Export("docx", new() { Content = Content, Title = "Hợp đồng" }, default));
        using var stream = new MemoryStream(file.FileContents);
        var result = Assert.IsType<OkObjectResult>(await controller.Import(new FormFile(stream, 0, stream.Length, "file", "contract.docx"), default));
        var payload = Assert.IsType<ApiResponse<object>>(result.Value);
        var json = JsonSerializer.SerializeToElement(payload.Data);
        Assert.True(ContractTermRichText.TryParse(json.GetProperty("content").GetString(), out var document));
        Assert.Equal("Mã số thuế: 123456789", document.Blocks[0].Runs[0].Text);
        Assert.True(document.Blocks[0].Runs[0].Bold);
        Assert.Equal("center", document.Blocks[0].Alignment);
    }

    [Fact]
    public async Task Import_RejectsInvalidDocx()
    {
        using var stream = new MemoryStream("not a zip"u8.ToArray());
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        Assert.IsType<BadRequestObjectResult>(await controller.Import(new FormFile(stream, 0, stream.Length, "file", "bad.docx"), default));
    }

    [Fact]
    public async Task Export_RejectsUnstructuredContent()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        Assert.IsType<BadRequestObjectResult>(await controller.Export("docx", new() { Content = "<script>bad</script>" }, default));
    }

    [Fact]
    public async Task PdfUnavailable_ReturnsServiceUnavailable()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        var result = Assert.IsType<ObjectResult>(await controller.Export("pdf", new() { Content = Content }, default));
        Assert.Equal(503, result.StatusCode);
    }

    [Fact]
    public async Task Export_BindsSplitRunTokens_AndRejectsMissingValues()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        const string linked = ContractTermRichText.Prefix + "{\"blocks\":[{\"type\":\"paragraph\",\"runs\":[{\"text\":\"Tên: {{CUSTOMER_\",\"bold\":true},{\"text\":\"NAME}} / {{CUSTOMER_NAME}}\"}]}]}";
        Assert.IsType<BadRequestObjectResult>(await controller.Export("docx", new() { Content = linked }, default));
        var file = Assert.IsType<FileContentResult>(await controller.Export("docx", new() { Content = linked, Bindings = new() { ["CUSTOMER_NAME"] = "Công ty A&B" } }, default));
        using var stream = new MemoryStream(file.FileContents);
        var result = Assert.IsType<OkObjectResult>(await controller.Import(new FormFile(stream, 0, stream.Length, "file", "bound.docx"), default));
        var json = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(result.Value).Data);
        Assert.True(ContractTermRichText.TryParse(json.GetProperty("content").GetString(), out var doc));
        Assert.Equal("Tên: Công ty A&B / Công ty A&B", string.Concat(doc.Blocks[0].Runs.Select(x => x.Text)));
    }

    [Fact]
    public async Task ExportImport_PreservesJustificationFontAndStrike()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        const string content = ContractTermRichText.Prefix + "{\"blocks\":[{\"type\":\"paragraph\",\"alignment\":\"justify\",\"runs\":[{\"text\":\"Nội dung đã chỉnh\",\"fontFamily\":\"Arial\",\"fontSize\":13,\"strike\":true}]}]}";
        var file = Assert.IsType<FileContentResult>(await controller.Export("docx", new() { Content = content }, default));
        using var stream = new MemoryStream(file.FileContents);
        var imported = Assert.IsType<OkObjectResult>(await controller.Import(new FormFile(stream, 0, stream.Length, "file", "styled.docx"), default));
        var json = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(imported.Value).Data);
        Assert.True(ContractTermRichText.TryParse(json.GetProperty("content").GetString(), out var doc));
        Assert.Equal("justify", doc.Blocks[0].Alignment);
        var run = Assert.Single(doc.Blocks[0].Runs);
        Assert.Equal("Arial", run.FontFamily); Assert.Equal(13, run.FontSize); Assert.True(run.Strike);
        Assert.False(ContractTermRichText.TryParse(content.Replace("Arial", "UntrustedFont"), out _));
    }

    [Fact]
    public async Task PageLayout_ExportsA5LandscapeMarginsSpacingAndExplicitBreak()
    {
        var controller = new ContractDocumentEditorController(new UnavailablePdf());
        var model = new ContractTermRichTextDocument { Layout = new() { Paper = "A5", Orientation = "landscape", MarginLeft = 25, MarginRight = 15, MarginTop = 20, MarginBottom = 12, LineSpacing = 1.5, SpaceBefore = 3, SpaceAfter = 12 }, Blocks = [new() { Type = "paragraph", Runs = [new() { Text = "Dữ liệu tiếng Việt" }], PageBreakBefore = true }] };
        var content = ContractTermRichText.Prefix + JsonSerializer.Serialize(model, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var file = Assert.IsType<FileContentResult>(await controller.Export("docx", new() { Content = content }, default));
        using var stream = new MemoryStream(file.FileContents);
        using var word = DocumentFormat.OpenXml.Packaging.WordprocessingDocument.Open(stream, false);
        var body = word.MainDocumentPart!.Document.Body!;
        var section = body.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.SectionProperties>()!;
        var size = section.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.PageSize>()!;
        Assert.Equal(11906U, size.Width!.Value); Assert.Equal(8391U, size.Height!.Value);
        Assert.Equal(1417U, section.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.PageMargin>()!.Left!.Value);
        var p = body.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.Paragraph>()!;
        Assert.NotNull(p.ParagraphProperties!.PageBreakBefore);
        Assert.Equal("360", p.ParagraphProperties.SpacingBetweenLines!.Line!.Value);
        Assert.Equal("240", p.ParagraphProperties.SpacingBetweenLines.After!.Value);
        model.Layout.MarginLeft = 100;
        Assert.False(ContractTermRichText.TryParse(ContractTermRichText.Prefix + JsonSerializer.Serialize(model), out _));
    }

    [Fact]
    public async Task NewDocument_HasCompanyLogoContactAndPageNumber_OnEveryPage()
    {
        var model = new ContractTermRichTextDocument { Blocks = [new() { Type = "paragraph", Runs = [new() { Text = "HỢP ĐỒNG KIỂM THỬ ĐẦU TRANG", Bold = true, FontSize = 14 }], Alignment = "center" }, new() { Type = "paragraph", Runs = [new() { Text = "Nội dung trang thứ nhất. Logo, tên công ty và thông tin liên hệ dùng chung với bản xuất." }] }, new() { Type = "paragraph", PageBreakBefore = true, Runs = [new() { Text = "Nội dung trang thứ hai." }] }] };
        var api = new ContractDocumentEditorController(new UnavailablePdf());
        var content = ContractTermRichText.Prefix + JsonSerializer.Serialize(model);
        var file = Assert.IsType<FileContentResult>(await api.Export("docx", new() { Content = content }, default));
        using (var stream = new MemoryStream(file.FileContents))
        using (var word = DocumentFormat.OpenXml.Packaging.WordprocessingDocument.Open(stream, false))
        {
            var main = word.MainDocumentPart!; var header = Assert.Single(main.HeaderParts);
            Assert.Contains("CÔNG TY TNHH", header.Header!.InnerText); Assert.Contains("www.dtctech.vn", header.Header.InnerText); Assert.Contains("info@dtctech.vn", header.Header.InnerText);
            Assert.Single(header.ImageParts);
            var section = main.Document.Body!.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.SectionProperties>()!;
            Assert.Single(section.Elements<DocumentFormat.OpenXml.Wordprocessing.HeaderReference>());
            Assert.Single(section.Elements<DocumentFormat.OpenXml.Wordprocessing.FooterReference>());
            Assert.Contains(Assert.Single(main.FooterParts).Footer!.Descendants<DocumentFormat.OpenXml.Wordprocessing.SimpleField>(), f => f.Instruction!.Value!.Contains("PAGE"));
            Assert.Null(main.Document.Body!.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.SectionProperties>()!.GetFirstChild<DocumentFormat.OpenXml.Wordprocessing.TitlePage>());
        }
        var converter = Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH");
        var target = Environment.GetEnvironmentVariable("EDITOR_STATIONERY_PDF_FIXTURE_PATH");
        if (System.IO.File.Exists(converter) && !string.IsNullOrEmpty(target))
        {
            await System.IO.File.WriteAllBytesAsync(System.IO.Path.ChangeExtension(target, ".docx"), file.FileContents);
            var pdf = new ContractManagement.Domains.Services.ContractTemplate.LibreOfficeContractTemplatePdfRenderer(Microsoft.Extensions.Options.Options.Create(new ContractManagement.Domains.Services.ContractTemplate.TemplatePdfRenderingOptions { ExecutablePath = converter }));
            await System.IO.File.WriteAllBytesAsync(target, await pdf.ConvertPreviewToPdfAsync(file.FileContents));
        }
    }

    [Fact]
    public async Task CompanyHeader_RejectsMarginsThatWouldOverlapBody()
    {
        var content = ContractTermRichText.Prefix + JsonSerializer.Serialize(new ContractTermRichTextDocument { Layout = new() { MarginTop = 5 }, Blocks = [new() { Type = "paragraph", Runs = [new() { Text = "Test" }] }] });
        Assert.IsType<BadRequestObjectResult>(await new ContractDocumentEditorController(new UnavailablePdf()).Export("docx", new() { Content = content }, default));
    }

    private sealed class UnavailablePdf : IContractTemplatePdfRenderer
    {
        public Task<byte[]> ConvertPreviewToPdfAsync(byte[] docx, CancellationToken ct = default) =>
            throw new ContractTemplatePdfRenderingException("PdfConverterUnavailable", "Chưa có LibreOffice.");
    }
}
