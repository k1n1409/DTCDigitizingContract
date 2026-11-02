using System.Text.Json;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ContractManagement.Domains.Policies.ContractTemplate;
using ContractManagement.Domains.Services.ContractTemplate;
using Microsoft.Extensions.Options;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed class DocumentLibraryTests
{
    private static DbDtctechContext Db() => new(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static DocumentLibraryController Controller(DbDtctechContext db, int actor = 10, int tenantId = 1, IContractTemplatePdfRenderer? renderer = null)
    {
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(tenantId, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new Session() }; http.Session.SetInt32("EmployeeId", actor);
        return new(db, tenant, renderer ?? new UnavailablePdf()) { ControllerContext = new ControllerContext { HttpContext = http } };
    }
    private static JsonElement Data(IActionResult result) => JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(result).Value).GetProperty("Data");
    [Fact]
    public async Task FoldersAndMetadata_ArePersonal_AndCannotTargetOtherTenantsOrAccounts()
    {
        await using var db = Db(); var api = Controller(db); var id = Guid.NewGuid();
        db.Add(new ImportedContractDocument { Id = id, TenantId = 1, EmployeeId = 10, Name = "source.docx", Revision = 1, UpdatedAtUtc = DateTime.UtcNow }); await db.SaveChangesAsync();
        var folder = Data(await api.CreateFolder(new() { Name = "Khách hàng A" }, default)).GetProperty("Id").GetGuid();
        Assert.IsType<ConflictObjectResult>(await api.CreateFolder(new() { Name = "Khách hàng A" }, default));
        Assert.IsType<OkObjectResult>(await api.Update("imported", id, new() { DisplayName = "Hợp đồng A", FolderId = folder, IsStarred = true }, default));
        Assert.IsType<ConflictObjectResult>(await api.Update("imported", id, new(), default));
        var list = Data(await api.List(keyword: "Hợp đồng A", folderId: folder, starred: true));
        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());
        Assert.Equal("Hợp đồng A", list.GetProperty("items")[0].GetProperty("Name").GetString());
        Assert.Equal("source.docx", (await db.Set<ImportedContractDocument>().SingleAsync()).Name);
        foreach (var other in new[] { Controller(db, 20), Controller(db, 10, 2) })
        {
            Assert.Empty(Data(await other.FolderList(default)).EnumerateArray());
            Assert.IsType<NotFoundResult>(await other.RenameFolder(folder, new() { Name = "X" }, default));
            Assert.IsType<NotFoundResult>(await other.Update("imported", id, new() { ExpectedRevision = 1 }, default));
            Assert.IsType<NotFoundResult>(await other.Preview("imported", id));
            Assert.Equal(0, Data(await other.List()).GetProperty("totalCount").GetInt32());
        }
        Assert.IsType<OkObjectResult>(await api.RenameFolder(folder, new() { Name = "Nhóm A" }, default));
    }

    [Fact]
    public async Task SharedTemplate_NameAndStarDoNotChangeAnotherUsersLibraryOrSource()
    {
        await using var db = Db(); var id = Guid.NewGuid();
        db.Add(new ContractEditorDocument { Id = id, TenantId = 1, EmployeeId = 99, Title = "Mẫu chung", IsTemplate = true, Revision = 1, UpdatedAtUtc = DateTime.UtcNow }); await db.SaveChangesAsync();
        var api = Controller(db);
        Assert.IsType<OkObjectResult>(await api.Update("template", id, new() { DisplayName = "Tên của tôi", IsStarred = true }, default));
        Assert.Equal("Tên của tôi", Data(await api.List()).GetProperty("items")[0].GetProperty("Name").GetString());
        Assert.Equal("Mẫu chung", Data(await Controller(db, 20).List()).GetProperty("items")[0].GetProperty("Name").GetString());
        Assert.Equal("Mẫu chung", (await db.Set<ContractEditorDocument>().SingleAsync()).Title);
        Assert.IsType<NotFoundResult>(await Controller(db, 10, 2).Update("template", id, new(), default));
    }

    [Fact]
    public async Task ListingPaginatesAcrossKinds_AndRejectsForeignFolderAssignment()
    {
        await using var db = Db();
        for (var i = 0; i < 17; i++) db.Add(new ImportedContractDocument { Id = Guid.NewGuid(), TenantId = 1, EmployeeId = 10, Name = $"File {i}", Revision = 1, UpdatedAtUtc = DateTime.UtcNow.AddMinutes(i) });
        await db.SaveChangesAsync(); var api = Controller(db);
        Assert.Equal(12, Data(await api.List()).GetProperty("items").GetArrayLength());
        Assert.Equal(5, Data(await api.List(page: 2)).GetProperty("items").GetArrayLength());
        var foreign = Data(await Controller(db, 20).CreateFolder(new() { Name = "Riêng" }, default)).GetProperty("Id").GetGuid();
        var id = await db.Set<ImportedContractDocument>().Select(x => x.Id).FirstAsync();
        Assert.IsType<NotFoundResult>(await api.Update("imported", id, new() { FolderId = foreign }, default));
        Assert.IsType<NotFoundResult>(await api.List(folderId: foreign));
        Assert.IsType<BadRequestResult>(await api.List(kind: "unknown"));
    }
    [Fact]
    public async Task SoftDeleteAndRestore_KeepOriginalAndHistory_AndBlockOldReaders()
    {
        await using var db = Db(); var id = Guid.NewGuid(); var bytes = new byte[] { 1, 2, 3 };
        db.Add(new ImportedContractDocument { Id = id, TenantId = 1, EmployeeId = 10, Name = "original.docx", Revision = 1, OriginalDocx = bytes });
        db.Add(new ImportedContractRevision { DocumentId = id, Revision = 1, Fields = "[]" }); await db.SaveChangesAsync();
        var api = Controller(db);
        Assert.IsType<NotFoundResult>(await Controller(db, 20).Delete("imported", id, 1));
        Assert.IsType<NotFoundResult>(await Controller(db, 10, 2).Delete("imported", id, 1));
        Assert.IsType<ConflictObjectResult>(await api.Delete("imported", id, 9));
        Assert.IsType<OkObjectResult>(await api.Delete("imported", id, 1));
        Assert.Equal(0, Data(await api.List()).GetProperty("totalCount").GetInt32());
        Assert.Equal(1, Data(await api.List(trash: true)).GetProperty("totalCount").GetInt32());
        Assert.IsType<NotFoundResult>(await api.Preview("imported", id));
        Assert.IsType<NotFoundResult>(await api.Update("imported", id, new(), default));
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(1, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var imports = new ImportedContractsController(db, tenant, new UnavailablePdf()) { ControllerContext = api.ControllerContext };
        Assert.IsType<NotFoundResult>(await imports.Read(id));
        Assert.IsType<NotFoundResult>(await imports.Save(id, new() { ExpectedRevision = 1 }, default));
        Assert.IsType<NotFoundResult>(await imports.Export(id, "original"));
        Assert.IsType<ConflictObjectResult>(await api.Restore("imported", id, 1));
        Assert.IsType<OkObjectResult>(await api.Restore("imported", id, 2));
        Assert.Equal(1, Data(await api.List()).GetProperty("totalCount").GetInt32());
        var root = await db.Set<ImportedContractDocument>().SingleAsync();
        Assert.False(root.IsArchived); Assert.Equal(3, root.Revision); Assert.Equal(bytes, root.OriginalDocx);
        Assert.Equal(3, await db.Set<ImportedContractRevision>().CountAsync());
        Assert.IsType<ConflictObjectResult>(await imports.Save(id, new() { ExpectedRevision = 1 }, default));
    }

    [Fact]
    public async Task SharedTemplateDeletionRequiresManager_AndDoesNotDeleteDerivedDocuments()
    {
        await using var db = Db(); var templateId = Guid.NewGuid(); var personalId = Guid.NewGuid();
        db.TblEmployees.AddRange(new TblEmployee { EmployeeId = 10, EmployeeType = 6, Status = 1 }, new TblEmployee { EmployeeId = 20, EmployeeType = 1, Status = 1 });
        foreach (var id in new[] { templateId, personalId }) {
            db.Add(new ContractEditorDocument { Id = id, TenantId = 1, EmployeeId = 20, IsTemplate = id == templateId, Title = "Tài liệu", Revision = 1 });
            db.Add(new ContractEditorRevision { DocumentId = id, Revision = 1, Title = "Tài liệu" });
        }
        await db.SaveChangesAsync(); var manager = Controller(db); var reader = Controller(db, 20);
        Assert.False(Data(await reader.List(kind: "template")).GetProperty("items")[0].GetProperty("CanDelete").GetBoolean());
        Assert.Equal(403, Assert.IsType<ObjectResult>(await reader.Delete("template", templateId, 1)).StatusCode);
        Assert.IsType<NotFoundResult>(await manager.Delete("editor", personalId, 1));
        Assert.IsType<OkObjectResult>(await manager.Delete("template", templateId, 1));
        Assert.Equal(0, Data(await reader.List(trash: true)).GetProperty("totalCount").GetInt32());
        Assert.Equal(1, Data(await manager.List(trash: true)).GetProperty("totalCount").GetInt32());
        Assert.True(await db.Set<ContractEditorDocument>().AnyAsync(x => x.Id == personalId && !x.IsArchived));
        Assert.Equal(403, Assert.IsType<ObjectResult>(await reader.Restore("template", templateId, 2)).StatusCode);
        Assert.IsType<OkObjectResult>(await manager.Restore("template", templateId, 2));
        Assert.IsType<OkObjectResult>(await reader.Delete("editor", personalId, 1));
        Assert.IsType<OkObjectResult>(await reader.Restore("editor", personalId, 2));
    }

    [Fact]
    public async Task PreviewCache_ReusesRevision_AndStillChecksAccessAndNewVersions()
    {
        await using var db = Db(); var id = Guid.NewGuid();
        db.Add(new ContractEditorDocument { Id = id, TenantId = 1, EmployeeId = 10, Title = "Cache test", Revision = 1 });
        var content = ContractTermRichText.Prefix + "{\"blocks\":[{\"type\":\"paragraph\",\"runs\":[{\"text\":\"Test\"}]}]}";
        db.Add(new ContractEditorRevision { DocumentId = id, Revision = 1, Title = "Cache test", Content = content });
        await db.SaveChangesAsync();
        var renderer = new CountingPdf(); var api = Controller(db, renderer: renderer);
        Assert.IsType<FileContentResult>(await api.Preview("editor", id, 1));
        Assert.IsType<FileContentResult>(await api.Preview("editor", id, 1));
        Assert.Equal(1, renderer.Calls);
        Assert.IsType<NotFoundResult>(await Controller(db, actor: 20, renderer: renderer).Preview("editor", id, 1));
        Assert.IsType<NotFoundResult>(await Controller(db, tenantId: 2, renderer: renderer).Preview("editor", id, 1));
        db.Add(new ContractEditorRevision { DocumentId = id, Revision = 2, Title = "Cache test", Content = content.Replace("Test", "Changed") });
        var doc = await db.Set<ContractEditorDocument>().SingleAsync(x => x.Id == id); doc.Revision = 2; await db.SaveChangesAsync();
        Assert.IsType<FileContentResult>(await api.Preview("editor", id));
        Assert.Equal(2, renderer.Calls);
        doc.IsArchived = true; await db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await api.Preview("editor", id, 1));
    }
    private sealed class CountingPdf : IContractTemplatePdfRenderer
    {
        public int Calls { get; private set; }
        public Task<byte[]> ConvertPreviewToPdfAsync(byte[] bytes, CancellationToken ct = default) { Calls++; return Task.FromResult("%PDF-test"u8.ToArray()); }
    }

    [LibraryPdfFact]
    public async Task RealPdfPreview_ShowsUnboundTemplateAndCanWriteOptInUiFixture()
    {
        await using var db = Db(); var id = Guid.NewGuid();
        db.Add(new ContractEditorDocument { Id = id, TenantId = 1, EmployeeId = 10, Title = "Thư viện kiểm thử", IsTemplate = true, Revision = 1 });
        db.Add(new ContractEditorRevision { DocumentId = id, Revision = 1, Content = ContractTermRichText.Prefix + "{\"blocks\":[{\"type\":\"paragraph\",\"runs\":[{\"text\":\"HỢP ĐỒNG KIỂM THỬ {{CUSTOMER_NAME}}\",\"bold\":true}],\"alignment\":\"center\"}]}" }); await db.SaveChangesAsync();
        var renderer = new LibreOfficeContractTemplatePdfRenderer(Options.Create(new TemplatePdfRenderingOptions { ExecutablePath = Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH") }));
        var api = Controller(db, renderer: renderer);
        var result = Assert.IsType<FileContentResult>(await api.Preview("template", id, 1));
        Assert.True(result.FileContents.AsSpan(0, 5).SequenceEqual("%PDF-"u8));
        Assert.IsType<NotFoundResult>(await api.Preview("template", id, 2));
        var target = Environment.GetEnvironmentVariable("DOCUMENT_LIBRARY_PDF_FIXTURE_PATH");
        if (!string.IsNullOrEmpty(target)) await System.IO.File.WriteAllBytesAsync(target, result.FileContents);
    }
    private sealed class LibraryPdfFactAttribute : FactAttribute
    {
        public LibraryPdfFactAttribute() { if (!System.IO.File.Exists(Environment.GetEnvironmentVariable("IMPORTED_CONTRACT_LIBREOFFICE_PATH"))) Skip = "Set IMPORTED_CONTRACT_LIBREOFFICE_PATH for the real PDF preview test."; }
    }
    private sealed class UnavailablePdf : IContractTemplatePdfRenderer
    {
        public Task<byte[]> ConvertPreviewToPdfAsync(byte[] bytes, CancellationToken ct = default) => throw new ContractTemplatePdfRenderingException("Unavailable", "No converter");
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
