using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.Filter;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using ContractManagement.Domains.Services.Contract;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController, Route("api/document-library"), SessionAuthorize(RbacPermissions.ContractCreate)]
public sealed class DocumentLibraryController(DbDtctechContext db, ICurrentTenant tenant, IContractTemplatePdfRenderer pdf) : ControllerBase
{
    private int Actor => HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException();
    private int TenantId => tenant.GetRequiredTenant().TenantId;
    private IQueryable<DocumentLibraryEntry> Entries => db.Set<DocumentLibraryEntry>().Where(x => x.TenantId == TenantId && x.EmployeeId == Actor);
    private IQueryable<DocumentLibraryFolder> Folders => db.Set<DocumentLibraryFolder>().Where(x => x.TenantId == TenantId && x.EmployeeId == Actor);
    private async Task<bool> CanManageTemplates(CancellationToken ct) => EmployeePermissionCatalog.HasPermission(await db.TblEmployees.AsNoTracking().Where(x => x.EmployeeId == Actor && x.Status == 1).Select(x => x.EmployeeType).SingleOrDefaultAsync(ct), RbacPermissions.TemplateManage);
    public sealed class Row
    {
        public Guid Id { get; set; } public string Kind { get; set; } = "";
        public string Name { get; set; } = ""; public string OriginalName { get; set; } = "";
        public string? DisplayName { get; set; }
        public int Revision { get; set; } public DateTime UpdatedAtUtc { get; set; }
        public Guid? FolderId { get; set; } public bool IsStarred { get; set; } public int MetadataRevision { get; set; }
        public bool CanDelete { get; set; }
        public bool IsSharedTemplate { get; set; }
    }
    public sealed class MetadataRequest
    {
        public string? DisplayName { get; set; } public Guid? FolderId { get; set; }
        public bool IsStarred { get; set; } public int ExpectedRevision { get; set; }
    }
    public sealed class FolderRequest { public string Name { get; set; } = ""; }
    private async Task<bool> Readable(string kind, Guid id, CancellationToken ct) => kind == "imported"
        ? await db.Set<ImportedContractDocument>().AnyAsync(x => x.Id == id && x.TenantId == TenantId && x.EmployeeId == Actor && !x.IsArchived, ct)
        : kind is "template" or "editor" && await db.Set<ContractEditorDocument>().AnyAsync(x => x.Id == id && x.TenantId == TenantId && !x.IsArchived && (kind == "template" ? x.IsTemplate && (x.IsSharedTemplate || x.EmployeeId == Actor) : !x.IsTemplate && x.EmployeeId == Actor), ct);

    [HttpGet]
    public async Task<IActionResult> List(string? kind = null, string? keyword = null, Guid? folderId = null, bool starred = false, int page = 1, CancellationToken ct = default, bool trash = false)
    {
        if (kind is not (null or "imported" or "template" or "editor")) return BadRequest();
        if (folderId.HasValue && !await Folders.AnyAsync(x => x.Id == folderId, ct)) return NotFound();
        page = Math.Clamp(page, 1, 1000); keyword = keyword?.Trim();
        var metadata = Entries.AsNoTracking();
        var manageTemplates = await CanManageTemplates(ct);
        var imports = from d in db.Set<ImportedContractDocument>().AsNoTracking().Where(x => x.TenantId == TenantId && x.EmployeeId == Actor && x.IsArchived == trash)
                      join m in metadata.Where(x => x.Kind == "imported") on d.Id equals m.DocumentId into joined
                      from m in joined.DefaultIfEmpty()
                      select new Row { Id = d.Id, Kind = "imported", Name = m != null && m.DisplayName != null ? m.DisplayName : d.Name, DisplayName = m == null ? null : m.DisplayName, OriginalName = d.Name, Revision = d.Revision, UpdatedAtUtc = d.UpdatedAtUtc, FolderId = m == null ? null : m.FolderId, IsStarred = m != null && m.IsStarred, MetadataRevision = m == null ? 0 : m.Revision };
        var editors = from d in db.Set<ContractEditorDocument>().AsNoTracking().Where(x => x.TenantId == TenantId && x.IsArchived == trash && (x.EmployeeId == Actor || (x.IsTemplate && x.IsSharedTemplate)) && (!trash || !x.IsTemplate || !x.IsSharedTemplate || manageTemplates))
                      join m in metadata on new { d.Id, Kind = d.IsTemplate ? "template" : "editor" } equals new { Id = m.DocumentId, m.Kind } into joined
                      from m in joined.DefaultIfEmpty()
                      select new Row { Id = d.Id, Kind = d.IsTemplate ? "template" : "editor", IsSharedTemplate = d.IsTemplate && d.IsSharedTemplate, Name = m != null && m.DisplayName != null ? m.DisplayName : d.Title, DisplayName = m == null ? null : m.DisplayName, OriginalName = d.Title, Revision = d.Revision, UpdatedAtUtc = d.UpdatedAtUtc, FolderId = m == null ? null : m.FolderId, IsStarred = m != null && m.IsStarred, MetadataRevision = m == null ? 0 : m.Revision };
        IQueryable<Row> Filter(IQueryable<Row> q) {
            if (!string.IsNullOrEmpty(keyword)) q = q.Where(x => x.Name.Contains(keyword));
            if (folderId.HasValue) q = q.Where(x => x.FolderId == folderId);
            if (starred) q = q.Where(x => x.IsStarred);
            return q;
        }
        imports = Filter(imports); editors = Filter(editors);
        if (kind != null) { imports = imports.Where(x => x.Kind == kind); editors = editors.Where(x => x.Kind == kind); }
        var count = await imports.CountAsync(ct) + await editors.CountAsync(ct);
        // Bounded merge avoids provider-dependent UNION conversions of 100/200-character names.
        var take = page * 12;
        var first = await imports.OrderByDescending(x => x.UpdatedAtUtc).ThenBy(x => x.Id).Take(take).ToListAsync(ct);
        var second = await editors.OrderByDescending(x => x.UpdatedAtUtc).ThenBy(x => x.Id).Take(take).ToListAsync(ct);
        var items = first.Concat(second).OrderByDescending(x => x.UpdatedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 12).Take(12).ToList();
        foreach (var item in items) item.CanDelete = item.Kind != "template" || !item.IsSharedTemplate || manageTemplates;
        return Ok(ApiResponse<object>.Ok(new { items, totalCount = count, totalPages = Math.Max(1, (int)Math.Ceiling(count / 12d)) }));
    }

    [HttpDelete("{kind}/{id:guid}")]
    public Task<IActionResult> Delete(string kind, Guid id, int expectedRevision, CancellationToken ct = default) => SetArchived(kind, id, expectedRevision, true, ct);

    [HttpPost("{kind}/{id:guid}/restore")]
    public Task<IActionResult> Restore(string kind, Guid id, [FromBody] int expectedRevision, CancellationToken ct = default) => SetArchived(kind, id, expectedRevision, false, ct);

    private async Task<IActionResult> SetArchived(string kind, Guid id, int expectedRevision, bool archived, CancellationToken ct)
    {
        if (kind == "imported")
        {
            var doc = await db.Set<ImportedContractDocument>().SingleOrDefaultAsync(x => x.Id == id && x.TenantId == TenantId && x.EmployeeId == Actor, ct);
            if (doc is null) return NotFound();
            if (doc.Revision != expectedRevision || doc.IsArchived == archived) return Conflict(ApiResponse<object>.Fail("Tài liệu đã thay đổi. Làm mới thư viện trước khi tiếp tục."));
            var current = await db.Set<ImportedContractRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == doc.Revision, ct);
            if (current is null) return Conflict(ApiResponse<object>.Fail("Thiếu snapshot của tài liệu. Liên hệ quản trị."));
            doc.IsArchived = archived; doc.Revision++; doc.UpdatedAtUtc = DateTime.UtcNow;
            db.Add(new ImportedContractRevision { DocumentId = id, Revision = doc.Revision, Fields = current.Fields, CreatedAtUtc = doc.UpdatedAtUtc });
        }
        else if (kind is "editor" or "template")
        {
            var doc = await db.Set<ContractEditorDocument>().SingleOrDefaultAsync(x => x.Id == id && x.TenantId == TenantId && (kind == "template" ? x.IsTemplate && (x.IsSharedTemplate || x.EmployeeId == Actor) : !x.IsTemplate && x.EmployeeId == Actor), ct);
            if (doc is null) return NotFound();
            if (kind == "template" && doc.IsSharedTemplate && !await CanManageTemplates(ct)) return StatusCode(403, ApiResponse<object>.Fail("Bạn không có quyền xóa/khôi phục mẫu dùng chung."));
            if (doc.Revision != expectedRevision || doc.IsArchived == archived) return Conflict(ApiResponse<object>.Fail("Tài liệu đã thay đổi. Làm mới thư viện trước khi tiếp tục."));
            var current = await db.Set<ContractEditorRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == doc.Revision, ct);
            if (current is null) return Conflict(ApiResponse<object>.Fail("Thiếu snapshot của tài liệu. Liên hệ quản trị."));
            doc.IsArchived = archived; doc.Revision++; doc.UpdatedAtUtc = DateTime.UtcNow;
            db.Add(new ContractEditorRevision { DocumentId = id, Revision = doc.Revision, Title = current.Title, Content = current.Content, Bindings = current.Bindings, CreatedAtUtc = doc.UpdatedAtUtc });
        }
        else return NotFound();
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Conflict(ApiResponse<object>.Fail("Có phiên khác vừa cập nhật tài liệu. Làm mới trước khi tiếp tục.")); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 }) { return Conflict(); }
        return Ok(ApiResponse<object>.Ok(new { id, isArchived = archived }));
    }

    [HttpGet("folders")]
    public async Task<IActionResult> FolderList(CancellationToken ct) => Ok(ApiResponse<object>.Ok(await Folders.AsNoTracking().OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync(ct)));

    [HttpPost("folders")]
    public async Task<IActionResult> CreateFolder(FolderRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim(); if (string.IsNullOrWhiteSpace(name) || name.Length > 100) return BadRequest(ApiResponse<object>.Fail("Tên thư mục từ 1–100 ký tự."));
        if (await Folders.AnyAsync(x => x.Name == name, ct)) return Conflict(ApiResponse<object>.Fail("Tên thư mục đã tồn tại."));
        var folder = new DocumentLibraryFolder { Id = Guid.NewGuid(), TenantId = TenantId, EmployeeId = Actor, Name = name, UpdatedAtUtc = DateTime.UtcNow };
        db.Add(folder); await db.SaveChangesAsync(ct); return Ok(ApiResponse<object>.Ok(new { folder.Id, folder.Name }));
    }
    [HttpPut("folders/{id:guid}")]
    public async Task<IActionResult> RenameFolder(Guid id, FolderRequest request, CancellationToken ct)
    {
        var folder = await Folders.SingleOrDefaultAsync(x => x.Id == id, ct); if (folder is null) return NotFound();
        var name = request.Name?.Trim(); if (string.IsNullOrWhiteSpace(name) || name.Length > 100) return BadRequest();
        if (await Folders.AnyAsync(x => x.Id != id && x.Name == name, ct)) return Conflict(ApiResponse<object>.Fail("Tên thư mục đã tồn tại."));
        folder.Name = name; folder.UpdatedAtUtc = DateTime.UtcNow; await db.SaveChangesAsync(ct); return Ok(ApiResponse<object>.Ok(new { folder.Id, folder.Name }));
    }
    [HttpPut("{kind}/{id:guid}/metadata")]
    public async Task<IActionResult> Update(string kind, Guid id, MetadataRequest request, CancellationToken ct)
    {
        if (!await Readable(kind, id, ct)) return NotFound();
        if (request.FolderId.HasValue && !await Folders.AnyAsync(x => x.Id == request.FolderId, ct)) return NotFound();
        var name = request.DisplayName?.Trim(); if (name?.Length > 200 || request.DisplayName != null && string.IsNullOrEmpty(name)) return BadRequest();
        var entry = await Entries.SingleOrDefaultAsync(x => x.Kind == kind && x.DocumentId == id, ct);
        if ((entry?.Revision ?? 0) != request.ExpectedRevision) return Conflict(ApiResponse<object>.Fail("Thông tin thư viện đã thay đổi. Làm mới trước khi sửa."));
        if (entry is null) { entry = new() { TenantId = TenantId, EmployeeId = Actor, Kind = kind, DocumentId = id }; db.Add(entry); }
        entry.DisplayName = name; entry.FolderId = request.FolderId; entry.IsStarred = request.IsStarred; entry.Revision++;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Conflict(); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 }) { return Conflict(); }
        return Ok(ApiResponse<object>.Ok(new { entry.Revision }));
    }

    [HttpGet("{kind}/{id:guid}/preview")]
    public async Task<IActionResult> Preview(string kind, Guid id, int? revision = null, CancellationToken ct = default)
    {
        if (!await Readable(kind, id, ct)) return NotFound();
        Response.Headers.CacheControl = "no-store";
        var version = revision ?? (kind == "imported"
            ? await db.Set<ImportedContractDocument>().Where(x => x.Id == id && x.TenantId == TenantId && x.EmployeeId == Actor).Select(x => x.Revision).SingleAsync(ct)
            : await db.Set<ContractEditorDocument>().Where(x => x.Id == id && x.TenantId == TenantId).Select(x => x.Revision).SingleAsync(ct));
        var key = $"document-preview:{TenantId}:{Actor}:{kind}:{id}:{version}";
        Response.Headers["X-Document-Revision"] = version.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return await DocumentPreviewCache.GetAsync(key, async () => {
            if (kind == "imported") return await new ImportedContractsController(db, tenant, pdf) { ControllerContext = ControllerContext }.Export(id, "pdf", version, ct);
            var snapshot = await db.Set<ContractEditorRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == version, ct);
            if (snapshot is null) return NotFound();
            return await new ContractDocumentEditorController(pdf, db, tenant) { ControllerContext = ControllerContext }.Export("pdf", new() { Content = snapshot.Content, Title = snapshot.Title, Bindings = JsonSerializer.Deserialize<Dictionary<string, string>>(snapshot.Bindings)!, AllowUnboundPreview = true }, ct);
        }, ct);
    }

    [HttpGet("{kind}/{id:guid}/export/{format}")]
    public async Task<IActionResult> Export(string kind, Guid id, string format, int revision, CancellationToken ct = default)
    {
        if (format is not ("docx" or "pdf") || revision < 1) return BadRequest();
        if (!await Readable(kind, id, ct)) return NotFound();
        Response.Headers.CacheControl = "no-store";
        Response.Headers["X-Document-Revision"] = revision.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (kind == "imported") return await new ImportedContractsController(db, tenant, pdf) { ControllerContext = ControllerContext }.Export(id, format, revision, ct);
        var snapshot = await db.Set<ContractEditorRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == revision, ct);
        if (snapshot is null) return NotFound();
        return await new ContractDocumentEditorController(pdf, db, tenant) { ControllerContext = ControllerContext }.Export(format, new() { Content = snapshot.Content, Title = snapshot.Title, Bindings = JsonSerializer.Deserialize<Dictionary<string, string>>(snapshot.Bindings)! }, ct);
    }
}
