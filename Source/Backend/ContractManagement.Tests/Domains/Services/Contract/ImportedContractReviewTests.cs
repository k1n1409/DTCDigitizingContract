using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.API.Domains.Services.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
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
using ContractManagement.Domains.Services.ContractTemplate;
using Microsoft.Extensions.Options;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed class ImportedContractReviewTests
{
    private static byte[] Source()
    {
        using var buffer = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(buffer, WordprocessingDocumentType.Document, true))
        {
            var part = doc.AddMainDocumentPart();
            var header = part.AddNewPart<HeaderPart>(); header.Header = new Header(new Paragraph(new Run(new Text("CÔNG TY A")))); header.Header.Save();
            var image = part.AddImagePart(ImagePartType.Png); using var input = new MemoryStream(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }); image.FeedData(input);
            part.Document = new Document(new Body(
                new Paragraph(new Run(new Text("BÊN A: CÔNG TY A"))),
                new Paragraph(new Run(new RunProperties(new Bold()), new Text("Tên công ty: CÔNG ")), new Run(new Text("TY A"))),
                new Paragraph(new Run(new Text("Lặp lại: CÔNG TY A"))),
                new Table(new TableRow(new TableCell(new Paragraph(new Run(new Text("Mã số thuế")))), new TableCell(new Paragraph(new Run(new Text(":")))), new TableCell(new Paragraph(new Run(new Text("123456789")))))),
                new SectionProperties(new HeaderReference { Type = HeaderFooterValues.Default, Id = part.GetIdOfPart(header) })
            )); part.Document.Save();
        }
        return buffer.ToArray();
    }

    [Fact]
    public void Detect_ProposesTableAndParty_WithoutApplyingChanges()
    {
        var bytes = Source(); var blocks = LegacyWordDocument.Read(bytes); var fields = LegacyWordDocument.Detect(bytes, blocks);
        var company = Assert.Single(fields, f => f.Label == "Tên công ty");
        Assert.Equal("CÔNG TY A", company.Original); Assert.Equal("Bên A", company.Party); Assert.Equal("proposed", company.Status);
        Assert.Contains(fields, f => f.Label == "Mã số thuế" && f.Value == "123456789");
        var result = LegacyWordDocument.Apply(bytes, fields);
        Assert.Equal(blocks.Select(x => x.Text), LegacyWordDocument.Read(result).Select(x => x.Text));
    }

    [Fact]
    public void Apply_SplitRunRange_LeavesRepeatedTextAndOtherPartsIntact()
    {
        var original = Source(); var hash = SHA256.HashData(original);
        var fields = LegacyWordDocument.Detect(original, LegacyWordDocument.Read(original));
        var company = fields.Single(f => f.Label == "Tên công ty"); company.Value = "Công ty B & C"; company.Status = "confirmed";
        var result = LegacyWordDocument.Apply(original, fields);
        var blocks = LegacyWordDocument.Read(result);
        Assert.Contains(blocks, b => b.Text == "Tên công ty: Công ty B & C");
        Assert.Contains(blocks, b => b.Text == "Lặp lại: CÔNG TY A");
        using var input = new MemoryStream(result); using var doc = WordprocessingDocument.Open(input, false);
        Assert.Equal("CÔNG TY A", doc.MainDocumentPart!.HeaderParts.Single().Header!.InnerText);
        Assert.Single(doc.MainDocumentPart.ImageParts);
        Assert.Single(doc.MainDocumentPart.Document!.Body!.Elements<Table>());
        Assert.Equal(hash, SHA256.HashData(original));
    }

    [Fact]
    public void WrongOrOverlappingAnchors_AreRejected_EmptyValueDeletesOnlySelectedRange()
    {
        var bytes = Source(); var blocks = LegacyWordDocument.Read(bytes);
        var field = LegacyWordDocument.Detect(bytes, blocks).First(); field.Status = "confirmed";
        var other = JsonSerializer.Deserialize<LegacyField>(JsonSerializer.Serialize(field))!; other.Id = Guid.NewGuid();
        Assert.Throws<ArgumentException>(() => LegacyWordDocument.Validate(blocks, new[] { field, other }));
        other.Original = "Không khớp";
        Assert.Throws<ArgumentException>(() => LegacyWordDocument.Validate(blocks, new[] { other }));
        field.Value = "";
        Assert.Contains(LegacyWordDocument.Read(LegacyWordDocument.Apply(bytes, new[] { field })), b => b.Text == "Tên công ty: ");
    }

    [Fact]
    public void BrokenOrUnsupportedInput_IsRejected()
    {
        Assert.Throws<ArgumentException>(() => LegacyWordDocument.Read(Encoding.UTF8.GetBytes("bad docx")));
        Assert.Throws<ArgumentException>(() => LegacyWordDocument.Read(new byte[10 * 1024 * 1024 + 1]));
    }

    private static ImportedContractsController Controller(DbDtctechContext db, int actor = 10, int tenantId = 1, IContractTemplatePdfRenderer? renderer = null)
    {
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(tenantId, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new Session() }; http.Session.SetInt32("EmployeeId", actor);
        return new(db, tenant, renderer ?? new UnavailablePdf()) { ControllerContext = new ControllerContext { HttpContext = http } };
    }

    [Fact]
    public async Task Persistence_IsolatedVersioned_AndOriginalRemainsByteIdentical()
    {
        await using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var original = Source(); using var stream = new MemoryStream(original); var owner = Controller(db);
        Assert.IsType<OkObjectResult>(await owner.Upload(new FormFile(stream, 0, stream.Length, "file", "contract.docx"), default));
        var source = await db.Set<ImportedContractDocument>().SingleAsync();
        foreach (var outsider in new[] { Controller(db, 20), Controller(db, 10, 2) })
        {
            Assert.IsType<NotFoundResult>(await outsider.Read(source.Id, null, default));
            Assert.IsType<NotFoundResult>(await outsider.History(source.Id, 1, default));
            Assert.IsType<NotFoundResult>(await outsider.Export(source.Id, "original", null, default));
            Assert.IsType<NotFoundResult>(await outsider.Save(source.Id, new(), default));
        }
        var fields = LegacyWordDocument.Detect(original, LegacyWordDocument.Read(original)); fields[0].Value = "Công ty Mới"; fields[0].Status = "confirmed";
        var request = new ImportedContractsController.SaveRequest { ExpectedRevision = 1, SourceSha256 = source.Sha256, Fields = fields };
        Assert.IsType<OkObjectResult>(await owner.Save(source.Id, request, default));
        Assert.IsType<ConflictObjectResult>(await owner.Save(source.Id, request, default));
        Assert.Equal(2, await db.Set<ImportedContractRevision>().CountAsync());
        var old = await db.Set<ImportedContractRevision>().SingleAsync(x => x.Revision == 1);
        request.ExpectedRevision = 2; request.Fields = JsonSerializer.Deserialize<List<LegacyField>>(old.Fields)!;
        Assert.IsType<OkObjectResult>(await owner.Save(source.Id, request, default));
        Assert.Equal(3, await db.Set<ImportedContractRevision>().CountAsync());
        Assert.Equal(original, Assert.IsType<FileContentResult>(await owner.Export(source.Id, "original", null, default)).FileContents);
        Assert.Equal(503, Assert.IsType<ObjectResult>(await owner.Export(source.Id, "pdf", null, default)).StatusCode);
        source.OriginalDocx[0] ^= 1;
        db.Entry(source).Property(x => x.OriginalDocx).IsModified = true;
        await db.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>(await owner.Export(source.Id, "docx", null, default));
    }

    [Fact]
    public async Task Phase1_InvalidUploads_DoNotCreateAnyRecords()
    {
        await using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var controller = Controller(db);
        Assert.IsType<BadRequestObjectResult>(await controller.Upload(null, default));
        foreach (var (name, bytes, length) in new[]
        {
            ("contract.pdf", Source(), (long)Source().Length),
            ("empty.docx", Array.Empty<byte>(), 0L),
            ("broken.docx", Encoding.UTF8.GetBytes("not a word package"), 18L),
            ("large.docx", Array.Empty<byte>(), 10L * 1024 * 1024 + 1)
        })
        {
            using var stream = new MemoryStream(bytes);
            Assert.IsType<BadRequestObjectResult>(await controller.Upload(new FormFile(stream, 0, length, "file", name), default));
        }
        Assert.Empty(await db.Set<ImportedContractDocument>().ToListAsync());
        Assert.Empty(await db.Set<ImportedContractRevision>().ToListAsync());
    }

    [Fact]
    public async Task Phase1_ListMetadata_IsScopedAndOriginalDownloadMatchesHash()
    {
        await using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var controller = Controller(db); var bytes = Source();
        using var stream = new MemoryStream(bytes);
        Assert.IsType<OkObjectResult>(await controller.Upload(new FormFile(stream, 0, bytes.Length, "file", "contract.DOCX"), default));
        var source = await db.Set<ImportedContractDocument>().SingleAsync();
        var list = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await controller.List()).Value);
        var data = list.GetProperty("Data");
        Assert.Equal(1, data.GetProperty("totalCount").GetInt32());
        var item = Assert.Single(data.GetProperty("items").EnumerateArray());
        Assert.Equal(bytes.Length, item.GetProperty("sizeBytes").GetInt32());
        Assert.False(item.TryGetProperty("OriginalDocx", out _));
        Assert.Equal(DateTimeKind.Utc, source.CreatedAtUtc.Kind);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(bytes)), source.Sha256);
        foreach (var outsider in new[] { Controller(db, 20), Controller(db, 10, 2) })
        {
            var result = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await outsider.List()).Value);
            Assert.Equal(0, result.GetProperty("Data").GetProperty("totalCount").GetInt32());
        }
        var download = Assert.IsType<FileContentResult>(await controller.Export(source.Id, "original"));
        Assert.Equal("contract.DOCX", download.FileDownloadName);
        Assert.Equal(source.Sha256, Convert.ToHexString(SHA256.HashData(download.FileContents)));
    }

    private static byte[] DocumentWith(params OpenXmlElement[] content)
    {
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var part = doc.AddMainDocumentPart(); part.Document = new Document(new Body(content)); part.Document.Save();
        }
        return stream.ToArray();
    }

    [Fact]
    public void Phase2_MultipleLabelsAndParties_HaveExactNonOverlappingSourceAnchors()
    {
        var bytes = DocumentWith(
            new Paragraph(new Run(new Text("BÊN A: KHÁCH HÀNG"))),
            new Paragraph(new Run(new Text("  Điện thoại: 0901234567; Email： legal@example.test  "))),
            new Paragraph(new Run(new Text("BÊN B: NHÀ CUNG CẤP"))),
            new Paragraph(new Run(new Text("Tài khoản ngân hàng: 00123456 | Ngân hàng: Ngân hàng A"))),
            new Paragraph(new Run(new Text("Nội dung không có nhãn: 0901234567"))));
        var blocks = LegacyWordDocument.Read(bytes); var fields = LegacyWordDocument.Detect(bytes, blocks);
        Assert.Equal(4, fields.Count);
        Assert.Contains(fields, f => f.Label == "Điện thoại" && f.Value == "0901234567" && f.Party == "Bên A");
        Assert.Contains(fields, f => f.Label == "Email" && f.Value == "legal@example.test" && f.Party == "Bên A");
        Assert.Contains(fields, f => f.Label == "Tài khoản ngân hàng" && f.Value == "00123456" && f.Party == "Bên B");
        Assert.Contains(fields, f => f.Label == "Ngân hàng" && f.Value == "Ngân hàng A" && f.Party == "Bên B");
        Assert.All(fields, f =>
        {
            Assert.Equal("proposed", f.Status);
            Assert.Equal(f.Original, blocks.Single(b => b.Id == f.BlockId).Text.Substring(f.Start, f.Length));
        });
        LegacyWordDocument.Validate(blocks, fields);
        Assert.Equal(blocks, LegacyWordDocument.Read(bytes));
    }

    [Fact]
    public void Phase2_TableLocationsAreDistinct_AndSpecialRegionsAreNotSuggested()
    {
        Table MakeTable(string value) => new(new TableRow(
            new TableCell(new Paragraph(new Run(new Text("MST : ")))),
            new TableCell(new Paragraph(new Run(new Text(value))))));
        var bytes = DocumentWith(MakeTable("111"), MakeTable("222"),
            new Paragraph(new Run(new Text("Email: "), new FieldChar { FieldCharType = FieldCharValues.Begin }, new Text("hidden@example.test"))),
            new Paragraph(new Run(new Text("Địa chỉ: " + new string('a', 10001)))));
        var blocks = LegacyWordDocument.Read(bytes); var fields = LegacyWordDocument.Detect(bytes, blocks);
        Assert.Equal(2, fields.Count);
        Assert.Contains(blocks, b => b.Text == "111" && b.Context == "Bảng 1 · dòng 1 · ô 2");
        Assert.Contains(blocks, b => b.Text == "222" && b.Context == "Bảng 2 · dòng 1 · ô 2");
        Assert.Contains(blocks, b => b.Text.Contains("hidden@example.test") && !b.Editable);
        Assert.Equal(2, fields.Select(f => f.BlockId).Distinct().Count());
        LegacyWordDocument.Validate(blocks, fields);
    }

    [Fact]
    public void Phase2_DetectionIsCapped_WithoutProducingInvalidFields()
    {
        var bytes = DocumentWith(Enumerable.Range(0, 510).Select(i => (OpenXmlElement)new Paragraph(new Run(new Text($"MST: {i:D10}")))).ToArray());
        var blocks = LegacyWordDocument.Read(bytes); var fields = LegacyWordDocument.Detect(bytes, blocks);
        Assert.Equal(500, fields.Count);
        LegacyWordDocument.Validate(blocks, fields);
    }

    [Fact]
    public async Task Phase4_RestoreUsesServerSnapshot_AndPreservesHistoryWithConflictChecks()
    {
        await using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = Controller(db); var bytes = Source(); using var stream = new MemoryStream(bytes);
        await owner.Upload(new FormFile(stream, 0, bytes.Length, "file", "contract.docx"), default);
        var document = await db.Set<ImportedContractDocument>().SingleAsync();
        var first = await db.Set<ImportedContractRevision>().SingleAsync(); var firstFields = first.Fields;
        var fields = JsonSerializer.Deserialize<List<LegacyField>>(firstFields)!;
        fields[0].Value = "Công ty mới"; fields[0].Status = "confirmed";
        Assert.IsType<OkObjectResult>(await owner.Save(document.Id, new() { ExpectedRevision = 1, SourceSha256 = document.Sha256, Fields = fields }, default));
        var restore = new ImportedContractsController.RestoreRequest { ExpectedRevision = 2, SourceSha256 = document.Sha256 };
        Assert.IsType<NotFoundResult>(await Controller(db, 20).Restore(document.Id, 1, restore));
        Assert.IsType<NotFoundResult>(await Controller(db, 10, 2).Restore(document.Id, 1, restore));
        Assert.IsType<BadRequestObjectResult>(await owner.Restore(document.Id, 2, restore));
        Assert.IsType<NotFoundResult>(await owner.Restore(document.Id, 99, restore));
        Assert.IsType<ConflictObjectResult>(await owner.Restore(document.Id, 1, new() { ExpectedRevision = 1, SourceSha256 = document.Sha256 }));
        Assert.IsType<ConflictObjectResult>(await owner.Restore(document.Id, 1, new() { ExpectedRevision = 2, SourceSha256 = "wrong hash" }));
        Assert.IsType<OkObjectResult>(await owner.Restore(document.Id, 1, restore));
        Assert.Equal(3, document.Revision);
        var revisions = await db.Set<ImportedContractRevision>().OrderBy(x => x.Revision).ToListAsync();
        Assert.Equal(3, revisions.Count); Assert.Equal(firstFields, revisions[0].Fields); Assert.Equal(firstFields, revisions[2].Fields);
        Assert.Contains("Công ty mới", JsonSerializer.Deserialize<List<LegacyField>>(revisions[1].Fields)!.Select(f => f.Value));
        Assert.IsType<ConflictObjectResult>(await owner.Restore(document.Id, 1, restore));
        Assert.Equal(bytes, document.OriginalDocx);
        var history = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await owner.History(document.Id)).Value).GetProperty("Data");
        Assert.Equal(3, history.GetProperty("totalCount").GetInt32());
        Assert.True(history.GetProperty("items")[0].GetProperty("isCurrent").GetBoolean());
        Assert.Equal(1, history.GetProperty("items")[1].GetProperty("changed").GetInt32());
    }

    [Fact]
    public async Task Phase5_ExportsSelectedRevision_AndPdfReceivesExactlyThatDocx()
    {
        await using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var renderer = new CapturingPdf(); var owner = Controller(db, renderer: renderer); var bytes = Source(); using var stream = new MemoryStream(bytes);
        await owner.Upload(new FormFile(stream, 0, bytes.Length, "file", "contract.docx"), default);
        var document = await db.Set<ImportedContractDocument>().SingleAsync();
        var fields = LegacyWordDocument.Detect(bytes, LegacyWordDocument.Read(bytes)); fields[0].Status = "confirmed"; fields[0].Value = "Phiên bản hai";
        await owner.Save(document.Id, new() { ExpectedRevision = 1, SourceSha256 = document.Sha256, Fields = fields }, default);
        var old = Assert.IsType<FileContentResult>(await owner.Export(document.Id, "docx", 1));
        Assert.DoesNotContain(LegacyWordDocument.Read(old.FileContents), b => b.Text.Contains("Phiên bản hai"));
        var current = Assert.IsType<FileContentResult>(await owner.Export(document.Id, "docx", 2));
        Assert.Contains(LegacyWordDocument.Read(current.FileContents), b => b.Text.Contains("Phiên bản hai"));
        var pdf = Assert.IsType<FileContentResult>(await owner.Export(document.Id, "pdf", 1));
        Assert.Equal("contract-v1.pdf", pdf.FileDownloadName); Assert.Equal("application/pdf", pdf.ContentType);
        Assert.Equal(LegacyWordDocument.Read(old.FileContents), LegacyWordDocument.Read(renderer.Input!));
        Assert.Equal("1", owner.Response.Headers["X-Document-Revision"]);
        Assert.Equal("no-store", owner.Response.Headers.CacheControl);
        Assert.IsType<NotFoundResult>(await owner.Export(document.Id, "docx", 99));
        Assert.IsType<BadRequestResult>(await owner.Export(document.Id, "exe", 1));
        Assert.Equal(bytes, Assert.IsType<FileContentResult>(await owner.Export(document.Id, "original")).FileContents);
    }

    [ImportedWordLibreOfficeFact]
    public async Task Phase5_RealLibreOffice_ConvertsReviewedWordToPdf()
    {
        var bytes = DocumentWith(new Paragraph(new Run(new Text("Tên công ty: Công ty gốc"))),
            new Table(new TableRow(new TableCell(new Paragraph(new Run(new Text("MST")))), new TableCell(new Paragraph(new Run(new Text("0012345678")))))));
        var fields = LegacyWordDocument.Detect(bytes, LegacyWordDocument.Read(bytes));
        fields[0].Value = "Công ty kiểm thử"; fields[0].Status = "confirmed";
        var reviewed = LegacyWordDocument.Apply(bytes, fields);
        var renderer = new LibreOfficeContractTemplatePdfRenderer(Options.Create(new TemplatePdfRenderingOptions { ExecutablePath = Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH"), TimeoutSeconds = 60 }));
        var result = await renderer.ConvertPreviewToPdfAsync(reviewed);
        Assert.True(result.Length > 100); Assert.True(result.AsSpan(0, 5).SequenceEqual("%PDF-"u8));
        Assert.Contains(LegacyWordDocument.Read(reviewed), b => b.Text.Contains("Công ty kiểm thử"));
    }

    [Fact]
    public void InlineEdit_PreservesUnicodeAndUntouchedRuns_AndSupportsEmptyValue()
    {
        var bytes = DocumentWith(new Paragraph(new Run(new RunProperties(new Bold()), new Text("Tên: ")), new Run(new Text("A"))), new Paragraph(new Run(new Text("Không sửa"))));
        var blocks = LegacyWordDocument.Read(bytes);
        var patch = new LegacyField { BlockId = blocks[0].Id, Start = 5, Length = 1, Original = "A", Value = "B \U0001F600", Label = "Nội dung đoạn", Status = "confirmed" };
        var result = LegacyWordDocument.Apply(bytes, [patch]);
        Assert.Equal("Tên: B \U0001F600", LegacyWordDocument.Read(result)[0].Text);
        Assert.Equal("Không sửa", LegacyWordDocument.Read(result)[1].Text);
        using var doc = WordprocessingDocument.Open(new MemoryStream(result), false);
        Assert.NotNull(doc.MainDocumentPart!.Document!.Body!.Elements<Paragraph>().First().Elements<Run>().First().RunProperties!.Bold);
        patch.Value = "\uD800";
        Assert.Throws<ArgumentException>(() => LegacyWordDocument.Apply(bytes, [patch]));
        patch.Value = "";
        Assert.Equal("Tên: ", LegacyWordDocument.Read(LegacyWordDocument.Apply(bytes, [patch]))[0].Text);
    }

    private sealed class ImportedWordLibreOfficeFactAttribute : FactAttribute
    {
        public ImportedWordLibreOfficeFactAttribute()
        {
            if (!System.IO.File.Exists(Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH"))) Skip = "Set IMPORTED_CONTRACT_LIBREOFFICE_PATH to run the real converter.";
        }
    }
    private sealed class CapturingPdf : IContractTemplatePdfRenderer
    {
        public byte[]? Input { get; private set; }
        public Task<byte[]> ConvertPreviewToPdfAsync(byte[] bytes, CancellationToken ct = default) { Input = bytes; return Task.FromResult("%PDF-test"u8.ToArray()); }
    }

    private sealed class UnavailablePdf : IContractTemplatePdfRenderer
    {
        public Task<byte[]> ConvertPreviewToPdfAsync(byte[] bytes, CancellationToken ct = default) => throw new ContractTemplatePdfRenderingException("Unavailable", "Chưa cấu hình PDF.");
    }
    private sealed class Session : ISession
    {
        private readonly Dictionary<string, byte[]> values = [];
        public bool IsAvailable => true; public string Id => "test"; public IEnumerable<string> Keys => values.Keys;
        public void Clear() => values.Clear(); public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask; public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Remove(string key) => values.Remove(key); public void Set(string key, byte[] value) => values[key] = value;
        public bool TryGetValue(string key, out byte[] value) => values.TryGetValue(key, out value!);
    }
}
