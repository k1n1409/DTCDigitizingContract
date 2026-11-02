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

    private sealed class UnavailablePdf : IContractTemplatePdfRenderer
    {
        public Task<byte[]> ConvertPreviewToPdfAsync(byte[] docx, CancellationToken ct = default) =>
            throw new ContractTemplatePdfRenderingException("PdfConverterUnavailable", "Chưa có LibreOffice.");
    }
}
