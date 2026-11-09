using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.API.Domains.Services.Contract;
using ContractManagement.Domains.Policies.ContractTemplate;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed class WordTextOnlyEditingTests
{
    private static byte[] Fixture()
    {
        using var stream = new MemoryStream();
        using (var word = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var main = word.AddMainDocumentPart();
            var shape = new Drawing(new DocumentFormat.OpenXml.Drawing.Wordprocessing.Anchor(
                new DocumentFormat.OpenXml.Drawing.Wordprocessing.DocProperties { Id = 1, Name = "Đường kẻ gốc" }));
            main.Document = new(new Body(new Paragraph(
                new ParagraphProperties(new Tabs(new TabStop { Val = TabStopValues.Center, Position = 4818 }), new SpacingBetweenLines { Line = "288", After = "0" }),
                new Run(new TabChar()), new Run(shape),
                new Run(new RunProperties(new Bold(), new RunFonts { Ascii = "Times New Roman" }), new Text("Độc Lập - ")),
                new Run(new RunProperties(new Italic()), new Text("Tự Do - Hạnh Phúc"))), new SectionProperties()));
            main.Document.Save();
        }
        return stream.ToArray();
    }
    private static void AssertFormatUnchanged(byte[] before, byte[] after)
    {
        using var oldStream = new MemoryStream(before); using var nextStream = new MemoryStream(after);
        using var old = WordprocessingDocument.Open(oldStream, false); using var next = WordprocessingDocument.Open(nextStream, false);
        var p = old.MainDocumentPart!.Document.Body!.Elements<Paragraph>().First();
        var q = next.MainDocumentPart!.Document.Body!.Elements<Paragraph>().First();
        Assert.Equal(p.ParagraphProperties!.OuterXml, q.ParagraphProperties!.OuterXml);
        Assert.Equal(p.Descendants<Drawing>().Select(d => d.OuterXml), q.Descendants<Drawing>().Select(d => d.OuterXml));
        Assert.Equal(p.Descendants<Picture>().Select(d => d.OuterXml), q.Descendants<Picture>().Select(d => d.OuterXml));
        Assert.Equal(p.Descendants<TabChar>().Count(), q.Descendants<TabChar>().Count());
        Assert.Equal(p.Descendants<RunProperties>().Select(r => r.OuterXml), q.Descendants<RunProperties>().Select(r => r.OuterXml));
    }
    [Fact]
    public void Review_CanEditLettersWhileKeepingTabsShapeRunPropertiesAndSource()
    {
        var bytes = Fixture(); var original = bytes.ToArray(); var block = Assert.Single(LegacyWordDocument.Read(bytes));
        Assert.True(block.Editable); Assert.DoesNotContain('\t', block.Text);
        var field = new LegacyField { BlockId = block.Id, Start = block.Text.IndexOf("Hạnh", StringComparison.Ordinal), Length = 4, Original = "Hạnh", Value = "HẠNH", Label = "Sửa chữ", Status = "confirmed" };
        var output = LegacyWordDocument.Apply(bytes, [field]);
        Assert.Contains("HẠNH Phúc", LegacyWordDocument.Read(output).Single().Text);
        AssertFormatUnchanged(bytes, output); Assert.Equal(original, bytes);
    }
    [Fact]
    public async Task Standalone_ImportsTextOnlyAndPatchesSourceWithoutApplyingFormattingOrSpacing()
    {
        await CheckStandalone(Fixture());
    }
    [Fact]
    public async Task UploadedWordFixture_TextOnlyRoundTrip_WhenProvided()
    {
        var path = Environment.GetEnvironmentVariable("WORD_TEXT_ONLY_FIXTURE");
        if (!System.IO.File.Exists(path)) return;
        await CheckStandalone(await System.IO.File.ReadAllBytesAsync(path), "Độc Lập");
    }
    private static async Task CheckStandalone(byte[] bytes, string? match = null)
    {
        await using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(1, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new TestSession() }; http.Session.SetInt32("EmployeeId", 10);
        var api = new ContractDocumentEditorController(new NoPdf(), db, tenant) { ControllerContext = new() { HttpContext = http } };
        using var input = new MemoryStream(bytes);
        var imported = Assert.IsType<OkObjectResult>(await api.Import(new FormFile(input, 0, input.Length, "file", "test.docx"), default));
        var content = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(imported.Value).Data).GetProperty("content").GetString();
        Assert.True(ContractTermRichText.TryParse(content, out var model));
        var block = model.Blocks.First(b => b.TextOnly && (match is null || string.Concat(b.Runs.Select(r => r.Text)).Contains(match)));
        var oldText = string.Concat(block.Runs.Select(r => r.Text));
        block.Runs = [new() { Text = oldText.Replace("Hạnh", "HẠNH"), FontFamily = "Arial", FontSize = 30 }];
        model.Layout = new() { LineSpacing = 2, SpaceAfter = 24 };
        var encoded = ContractTermRichText.Prefix + JsonSerializer.Serialize(model);
        var output = Assert.IsType<FileContentResult>(await api.Export("docx", new() { Content = encoded }, default));
        using var oldStream = new MemoryStream(bytes); using var nextStream = new MemoryStream(output.FileContents);
        using var old = WordprocessingDocument.Open(oldStream, false); using var next = WordprocessingDocument.Open(nextStream, false);
        var sourceIndex = int.Parse(block.SourceKey![1..]);
        var p = (Paragraph)old.MainDocumentPart!.Document.Body!.ChildElements[sourceIndex];
        var q = (Paragraph)next.MainDocumentPart!.Document.Body!.ChildElements[sourceIndex];
        Assert.Equal(oldText.Replace("Hạnh", "HẠNH"), WordParagraphText.Read(q));
        Assert.Equal(p.ParagraphProperties!.OuterXml, q.ParagraphProperties!.OuterXml);
        Assert.Equal(p.Descendants<Drawing>().Select(d => d.OuterXml), q.Descendants<Drawing>().Select(d => d.OuterXml));
        Assert.Equal(p.Descendants<Picture>().Select(d => d.OuterXml), q.Descendants<Picture>().Select(d => d.OuterXml));
        Assert.Equal(p.Descendants<TabChar>().Count(), q.Descendants<TabChar>().Count());
        Assert.Equal(p.Descendants<RunProperties>().Select(r => r.OuterXml), q.Descendants<RunProperties>().Select(r => r.OuterXml));
    }
    private sealed class NoPdf : IContractTemplatePdfRenderer { public Task<byte[]> ConvertPreviewToPdfAsync(byte[] data, CancellationToken ct = default) => throw new NotSupportedException(); }
    private sealed class TestSession : ISession
    {
        private readonly Dictionary<string, byte[]> data = []; public bool IsAvailable => true; public string Id => "test"; public IEnumerable<string> Keys => data.Keys;
        public void Clear() => data.Clear(); public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask; public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Remove(string key) => data.Remove(key); public void Set(string key, byte[] value) => data[key] = value; public bool TryGetValue(string key, out byte[] value) => data.TryGetValue(key, out value!);
    }
}
