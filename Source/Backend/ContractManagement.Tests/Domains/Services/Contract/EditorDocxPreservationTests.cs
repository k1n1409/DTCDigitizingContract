using System.Security.Cryptography;
using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Domains.Policies.ContractTemplate;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using A = DocumentFormat.OpenXml.Drawing;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed class EditorDocxPreservationTests
{
    private static byte[] Fixture()
    {
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var main = doc.AddMainDocumentPart(); main.Document = new(new Body()); var body = main.Document.Body!;
            var header = main.AddNewPart<HeaderPart>(); header.Header = new(new Paragraph(new Run(new Text("DTC — {{CONTRACT_CODE}}"))));
            var footer = main.AddNewPart<FooterPart>(); footer.Footer = new(new Paragraph(new Run(new Text("CHÂN TRANG GIỮ NGUYÊN"))));
            var image = main.AddImagePart(ImagePartType.Png);
            var imageBytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1cAAAAASUVORK5CYII=");
            using (var png = new MemoryStream(imageBytes)) image.FeedData(png);
            body.Append(new Paragraph(new ParagraphProperties(new SpacingBetweenLines { After = "240", Line = "360", LineRule = LineSpacingRuleValues.Auto }), new Run(new RunProperties(new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" }), new Text("Nội dung cũ tiếng Việt"))));
            var picture = new PIC.Picture(new PIC.NonVisualPictureProperties(new PIC.NonVisualDrawingProperties { Id = 1, Name = "Ảnh kiểm thử" }, new PIC.NonVisualPictureDrawingProperties()), new PIC.BlipFill(new A.Blip { Embed = main.GetIdOfPart(image) }, new A.Stretch(new A.FillRectangle())), new PIC.ShapeProperties(new A.Transform2D(new A.Offset { X = 0, Y = 0 }, new A.Extents { Cx = 914400, Cy = 914400 }), new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle }));
            body.Append(new Paragraph(new Run(new Drawing(new DW.Inline(new DW.Extent { Cx = 914400, Cy = 914400 }, new DW.DocProperties { Id = 1, Name = "Logo" }, new A.Graphic(new A.GraphicData(picture) { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" }))))));
            var nested = new Table(new TableRow(new TableCell(new Paragraph(new Run(new Text("BẢNG LỒNG GIỮ NGUYÊN"))))));
            body.Append(new Table(new TableRow(new TableCell(new Paragraph(new Run(new Text("Ô ngoài"))), nested, new Paragraph()))));
            body.Append(new Paragraph());
            body.Append(new Table(new TableProperties(new TableBorders(new TopBorder { Val = BorderValues.Double, Color = "005BAA", Size = 12 })), new TableGrid(new GridColumn { Width = "3000" }, new GridColumn { Width = "5000" }), new TableRow(new TableCell(new Paragraph(new Run(new Text("Ô cũ")))), new TableCell(new Paragraph(new Run(new Text("Ô giữ nguyên")))))));
            body.Append(new SectionProperties(new HeaderReference { Id = main.GetIdOfPart(header), Type = HeaderFooterValues.Default }, new FooterReference { Id = main.GetIdOfPart(footer), Type = HeaderFooterValues.Default }, new PageSize { Width = 15840, Height = 12240, Orient = PageOrientationValues.Landscape }, new PageMargin { Top = 720, Bottom = 900, Left = 1440, Right = 1080, Header = 400, Footer = 500 }));
            main.Document.Save(); header.Header.Save(); footer.Footer.Save();
        }
        return stream.ToArray();
    }
    private static DbDtctechContext Db() => new(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static (ContractDocumentEditorController Editor, ContractEditorDraftsController Drafts) Api(DbDtctechContext db, int actor = 10, int tenantId = 1)
    {
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(tenantId, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new TestSession() }; http.Session.SetInt32("EmployeeId", actor);
        var context = new ControllerContext { HttpContext = http };
        return (new(new NoPdf(), db, tenant) { ControllerContext = context }, new(db, tenant) { ControllerContext = context });
    }
    private static string Encode(ContractTermRichTextDocument model) => ContractTermRichText.Prefix + JsonSerializer.Serialize(model, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
    private static async Task<ContractTermRichTextDocument> Import(ContractDocumentEditorController editor, byte[] bytes)
    {
        using var input = new MemoryStream(bytes);
        var response = Assert.IsType<OkObjectResult>(await editor.Import(new FormFile(input, 0, input.Length, "file", "layout.docx"), default));
        var content = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(response.Value).Data).GetProperty("content").GetString();
        Assert.True(ContractTermRichText.TryParse(content, out var model)); return model;
    }

    [Fact]
    public async Task ImportSaveReopenExport_PreservesImageHeaderFooterNestedTableMarginsAndParagraphSpacing()
    {
        await using var db = Db(); var api = Api(db); var bytes = Fixture(); var model = await Import(api.Editor, bytes);
        Assert.NotNull(model.Preservation); Assert.Equal(2, model.Blocks.Count(b => b.Locked));
        Assert.Contains("CONTRACT_CODE", model.Preservation.FieldKeys);
        Assert.StartsWith("data:image/png;base64,", model.Blocks.Single(b => b.Label == "Ảnh gốc được bảo toàn").PreviewImage);
        model.Blocks[0].Runs[0].Text = "Nội dung đã sửa tiếng Việt";
        model.Blocks.Last().Rows[0].Cells[0].Paragraphs[0].Runs[0].Text = "Ô đã sửa";
        var saved = Assert.IsType<OkObjectResult>(await api.Drafts.Create(new() { Title = "Giữ bố cục", Content = Encode(model), Bindings = new() { ["CONTRACT_CODE"] = "HD-TEST" } }, default));
        var id = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(saved.Value).Data).GetProperty("Id").GetGuid();
        var stored = Assert.IsType<OkObjectResult>(await api.Drafts.Read(id));
        var content = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(stored.Value).Data).GetProperty("Content").GetString()!;
        var result = Assert.IsType<FileContentResult>(await api.Editor.Export("docx", new() { Title = "Bản sửa", Content = content, Bindings = new() { ["CONTRACT_CODE"] = "HD-TEST" } }, default));
        using var beforeStream = new MemoryStream(bytes); using var before = WordprocessingDocument.Open(beforeStream, false);
        using var afterStream = new MemoryStream(result.FileContents); using var after = WordprocessingDocument.Open(afterStream, false);
        var body = after.MainDocumentPart!.Document!.Body!;
        Assert.Equal(before.MainDocumentPart!.Document!.Body!.GetFirstChild<SectionProperties>()!.OuterXml, body.GetFirstChild<SectionProperties>()!.OuterXml);
        Assert.Equal(before.MainDocumentPart.FooterParts.Single().Footer.OuterXml, after.MainDocumentPart.FooterParts.Single().Footer.OuterXml);
        Assert.Contains("HD-TEST", after.MainDocumentPart.HeaderParts.Single().Header.InnerText);
        Assert.DoesNotContain("{{CONTRACT_CODE}}", after.MainDocumentPart.HeaderParts.Single().Header.InnerText);
        Assert.Contains("Nội dung đã sửa", body.InnerText); Assert.Contains("Ô đã sửa", body.InnerText);
        Assert.Contains("BẢNG LỒNG GIỮ NGUYÊN", body.InnerText);
        Assert.Equal(before.MainDocumentPart.Document.Body.Elements<Table>().First().OuterXml, body.Elements<Table>().First().OuterXml);
        Assert.Equal(before.MainDocumentPart.Document.Body.Elements<Table>().Last().TableProperties!.OuterXml, body.Elements<Table>().Last().TableProperties!.OuterXml);
        Assert.Equal("240", body.Elements<Paragraph>().First().ParagraphProperties!.SpacingBetweenLines!.After!.Value);
        using var image = after.MainDocumentPart.ImageParts.Single().GetStream(); using var imageCopy = new MemoryStream(); image.CopyTo(imageCopy);
        using var oldImage = before.MainDocumentPart.ImageParts.Single().GetStream(); using var oldCopy = new MemoryStream(); oldImage.CopyTo(oldCopy);
        Assert.Equal(SHA256.HashData(oldCopy.ToArray()), SHA256.HashData(imageCopy.ToArray()));
        Assert.Equal(bytes, (await db.Set<ContractEditorSourceAsset>().SingleAsync()).Docx);
        var converter = Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH");
        if (System.IO.File.Exists(converter))
        {
            var renderer = new ContractManagement.Domains.Services.ContractTemplate.LibreOfficeContractTemplatePdfRenderer(Microsoft.Extensions.Options.Options.Create(new ContractManagement.Domains.Services.ContractTemplate.TemplatePdfRenderingOptions { ExecutablePath = converter }));
            var pdf = await renderer.ConvertPreviewToPdfAsync(result.FileContents); Assert.True(pdf.AsSpan(0, 5).SequenceEqual("%PDF-"u8));
            var target = Environment.GetEnvironmentVariable("EDITOR_LAYOUT_PDF_FIXTURE_PATH"); if (!string.IsNullOrEmpty(target)) await System.IO.File.WriteAllBytesAsync(target, pdf);
        }
    }

    [Fact]
    public async Task SharedTemplate_AllowsUsingSourceForOwnCopy_WithoutExposingItAcrossTenants()
    {
        await using var db = Db(); db.TblEmployees.Add(new TblEmployee { EmployeeId = 10, EmployeeType = 6, Status = 1 }); await db.SaveChangesAsync();
        var owner = Api(db); var model = await Import(owner.Editor, Fixture());
        var privateSource = model.Preservation!.SourceId;
        model.Blocks.RemoveAt(1); // The deleted image must not remain recoverable from the shared template source.
        Assert.IsType<OkObjectResult>(await owner.Drafts.Create(new() { Title = "Mẫu có bố cục gốc", IsTemplate = true, IsSharedTemplate = true, Content = Encode(model) }, default));
        var shared = await db.Set<ContractEditorDocument>().SingleAsync();
        var snapshot = await db.Set<ContractEditorRevision>().SingleAsync();
        Assert.True(ContractTermRichText.TryParse(snapshot.Content, out var sharedModel));
        Assert.NotEqual(privateSource, sharedModel.Preservation!.SourceId);
        using (var sourceBytes = new MemoryStream((await db.Set<ContractEditorSourceAsset>().SingleAsync(x => x.Id == shared.SourceAssetId)).Docx))
        using (var sourceDoc = WordprocessingDocument.Open(sourceBytes, false)) Assert.Empty(sourceDoc.MainDocumentPart!.ImageParts);
        var reader = Api(db, 20);
        Assert.IsType<NotFoundObjectResult>(await reader.Editor.Export("docx", new() { Content = Encode(model), Bindings = new() { ["CONTRACT_CODE"] = "HD-COPY" } }, default));
        Assert.IsType<OkObjectResult>(await reader.Drafts.Create(new() { Title = "Bản riêng", Content = Encode(sharedModel) }, default));
        Assert.IsType<FileContentResult>(await reader.Editor.Export("docx", new() { Content = Encode(sharedModel), Bindings = new() { ["CONTRACT_CODE"] = "HD-COPY" } }, default));
        Assert.IsType<NotFoundObjectResult>(await Api(db, 20, 2).Editor.Export("docx", new() { Content = Encode(sharedModel), Bindings = new() { ["CONTRACT_CODE"] = "HD-COPY" } }, default));
        // Moving/deleting a protected block is intentional; it must not flatten the remaining package.
        var file = Assert.IsType<FileContentResult>(await reader.Editor.Export("docx", new() { Content = Encode(sharedModel), Bindings = new() { ["CONTRACT_CODE"] = "HD-COPY" } }, default));
        using var bytes = new MemoryStream(file.FileContents); using var doc = WordprocessingDocument.Open(bytes, false);
        Assert.Empty(doc.MainDocumentPart!.Document!.Body!.Descendants<Drawing>());
        Assert.NotEmpty(doc.MainDocumentPart.HeaderParts);
        Assert.Contains("BẢNG LỒNG", doc.MainDocumentPart.Document.InnerText);
    }

    [Fact]
    public async Task SourceAssets_CannotBeBorrowedByOtherAccountOrTenant_AndCannotBeDroppedOnUpdate()
    {
        await using var db = Db(); var owner = Api(db); var model = await Import(owner.Editor, Fixture());
        foreach (var outsider in new[] { Api(db, 20), Api(db, 10, 2) })
        {
            Assert.IsType<NotFoundObjectResult>(await outsider.Editor.Export("docx", new() { Content = Encode(model) }, default));
            Assert.IsType<NotFoundObjectResult>(await outsider.Drafts.Create(new() { Title = "Bad", Content = Encode(model) }, default));
        }
        await owner.Drafts.Create(new() { Title = "Mine", Content = Encode(model) }, default);
        var id = (await db.Set<ContractEditorDocument>().SingleAsync()).Id;
        Assert.IsType<BadRequestObjectResult>(await owner.Drafts.Update(id, new() { Title = "Losing source", ExpectedRevision = 1 }, default));
        var asset = await db.Set<ContractEditorSourceAsset>().SingleAsync(); var corrupted = asset.Docx.ToArray(); corrupted[0] ^= 1; asset.Docx = corrupted; db.Entry(asset).Property(x => x.Docx).IsModified = true; await db.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>(await owner.Editor.Export("docx", new() { Content = Encode(model), Bindings = new() { ["CONTRACT_CODE"] = "HD" } }, default));
    }

    private sealed class NoPdf : IContractTemplatePdfRenderer { public Task<byte[]> ConvertPreviewToPdfAsync(byte[] bytes, CancellationToken ct = default) => throw new ContractTemplatePdfRenderingException("Unavailable", "No converter"); }
    private sealed class TestSession : ISession
    {
        private readonly Dictionary<string, byte[]> values = []; public bool IsAvailable => true; public string Id => "test"; public IEnumerable<string> Keys => values.Keys;
        public void Clear() => values.Clear(); public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask; public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Remove(string key) => values.Remove(key); public void Set(string key, byte[] value) => values[key] = value; public bool TryGetValue(string key, out byte[] value) => values.TryGetValue(key, out value!);
    }
}
