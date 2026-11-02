using System.Security.Cryptography;
using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.API.Domains.Services.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Filter;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController, Route("api/imported-contracts"), SessionAuthorize(RbacPermissions.ContractCreate)]
public sealed class ImportedContractsController(DbDtctechContext db, ICurrentTenant tenant, IContractTemplatePdfRenderer pdf) : ControllerBase
{
    public sealed class SaveRequest
    {
        public int ExpectedRevision { get; set; }
        public string SourceSha256 { get; set; } = "";
        public List<LegacyField> Fields { get; set; } = [];
    }
    public sealed class RestoreRequest
    {
        public int ExpectedRevision { get; set; }
        public string SourceSha256 { get; set; } = "";
    }
    private int Actor => HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException();
    private IQueryable<ImportedContractDocument> Owned => db.Set<ImportedContractDocument>().Where(x => x.EmployeeId == Actor && x.TenantId == tenant.GetRequiredTenant().TenantId && !x.IsArchived);
    private static List<LegacyField> Parse(ImportedContractRevision revision) => JsonSerializer.Deserialize<List<LegacyField>>(revision.Fields)!;
    private static bool Intact(ImportedContractDocument doc) => Convert.ToHexString(SHA256.HashData(doc.OriginalDocx)) == doc.Sha256;

    [HttpPost, RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile? file, CancellationToken ct)
    {
        if (file is null || !string.Equals(Path.GetExtension(file.FileName), ".docx", StringComparison.OrdinalIgnoreCase) || file.Length is <= 0 or > 10 * 1024 * 1024) return BadRequest(ApiResponse<object>.Fail("Chọn DOCX không rỗng, tối đa 10 MB."));
        using var stream = new MemoryStream(); await file.CopyToAsync(stream, ct); var bytes = stream.ToArray();
        List<LegacyTextBlock> blocks; List<LegacyField> fields;
        try { blocks = LegacyWordDocument.Read(bytes); fields = LegacyWordDocument.Detect(bytes, blocks); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        var now = DateTime.UtcNow;
        var document = new ImportedContractDocument { Id = Guid.NewGuid(), TenantId = tenant.GetRequiredTenant().TenantId, EmployeeId = Actor, Name = Path.GetFileName(file.FileName)[..Math.Min(Path.GetFileName(file.FileName).Length, 200)], OriginalDocx = bytes, Sha256 = Convert.ToHexString(SHA256.HashData(bytes)), Revision = 1, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.Add(document); db.Add(new ImportedContractRevision { DocumentId = document.Id, Revision = 1, Fields = JsonSerializer.Serialize(fields), CreatedAtUtc = now }); await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<object>.Ok(new { document.Id }));
    }

    [HttpGet]
    public async Task<IActionResult> List(int page = 1, string? keyword = null, CancellationToken ct = default)
    {
        page = Math.Clamp(page, 1, 100000); var query = Owned.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(keyword)) query = query.Where(x => x.Name.Contains(keyword));
        var count = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.UpdatedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 10).Take(10).Select(x => new { x.Id, x.Name, x.Revision, x.CreatedAtUtc, x.UpdatedAtUtc, sizeBytes = x.OriginalDocx.Length }).ToListAsync(ct);
        return Ok(ApiResponse<object>.Ok(new { items, totalCount = count, totalPages = Math.Max(1, (int)Math.Ceiling(count / 10d)) }));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Read(Guid id, int? revision = null, CancellationToken ct = default)
    {
        var document = await Owned.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct); if (document is null) return NotFound();
        if (!Intact(document)) return Conflict(ApiResponse<object>.Fail("File gốc không khớp hash. Dừng xử lý và liên hệ quản trị."));
        var snapshot = await db.Set<ImportedContractRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == (revision ?? document.Revision), ct); if (snapshot is null) return NotFound();
        return Ok(ApiResponse<object>.Ok(new { document.Id, document.Name, sourceSha256 = document.Sha256, sizeBytes = document.OriginalDocx.Length, document.CreatedAtUtc, currentRevision = document.Revision, snapshot.Revision, fields = Parse(snapshot), blocks = LegacyWordDocument.Read(document.OriginalDocx), warning = "Bản rà soát thể hiện văn bản phần thân, không phải bố cục Word/PDF. Vùng chứa trường Word tự động, tab/xuống dòng đặc biệt, ảnh hoặc tracked changes chỉ được xem. Header/footer và ảnh giữ trong bản xuất nhưng chưa chỉnh tại đây. Bản chỉnh sửa không có giá trị thay thế chữ ký/phê duyệt của bản gốc." }));
    }

    [HttpPut("{id:guid}"), RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> Save(Guid id, SaveRequest request, CancellationToken ct)
    {
        var document = await Owned.SingleOrDefaultAsync(x => x.Id == id, ct); if (document is null) return NotFound();
        if (document.Revision != request.ExpectedRevision || request.SourceSha256 != document.Sha256 || !Intact(document)) return Conflict(ApiResponse<object>.Fail("Phiên bản hoặc file gốc đã thay đổi. Mở lại trước khi lưu."));
        if (request.Fields is null) return BadRequest();
        try { LegacyWordDocument.Validate(LegacyWordDocument.Read(document.OriginalDocx), request.Fields); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        document.Revision++; document.UpdatedAtUtc = DateTime.UtcNow;
        db.Add(new ImportedContractRevision { DocumentId = id, Revision = document.Revision, Fields = JsonSerializer.Serialize(request.Fields), CreatedAtUtc = document.UpdatedAtUtc });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Conflict(ApiResponse<object>.Fail("Có người vừa lưu trước bạn. Mở lại bản mới nhất.")); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        { return Conflict(ApiResponse<object>.Fail("Phiên bản vừa được lưu bởi yêu cầu khác. Mở lại bản mới nhất.")); }
        return Ok(ApiResponse<object>.Ok(new { document.Revision }));
    }

    [HttpPost("{id:guid}/history/{revision:int}/restore")]
    public async Task<IActionResult> Restore(Guid id, int revision, RestoreRequest request, CancellationToken ct = default)
    {
        var document = await Owned.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (document is null) return NotFound();
        if (document.Revision != request.ExpectedRevision || document.Sha256 != request.SourceSha256 || !Intact(document))
            return Conflict(ApiResponse<object>.Fail("Phiên bản hoặc file gốc đã thay đổi. Mở lại trước khi khôi phục."));
        if (revision == document.Revision) return BadRequest(ApiResponse<object>.Fail("Đây đã là phiên bản mới nhất."));
        var snapshot = await db.Set<ImportedContractRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == revision, ct);
        if (snapshot is null) return NotFound();
        // Restore the server snapshot, never client-supplied fields. Save appends atomically.
        return await Save(id, new SaveRequest { ExpectedRevision = request.ExpectedRevision, SourceSha256 = request.SourceSha256, Fields = Parse(snapshot) }, ct);
    }

    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> History(Guid id, int page = 1, CancellationToken ct = default)
    {
        var current = await Owned.AsNoTracking().Where(x => x.Id == id).Select(x => (int?)x.Revision).SingleOrDefaultAsync(ct);
        if (current is null) return NotFound();
        page = Math.Clamp(page, 1, 100000); var query = db.Set<ImportedContractRevision>().AsNoTracking().Where(x => x.DocumentId == id); var count = await query.CountAsync(ct);
        var snapshots = await query.OrderByDescending(x => x.Revision).Skip((page - 1) * 10).Take(10).ToListAsync(ct);
        var items = snapshots.Select(x => {
            var fields = Parse(x);
            return new { x.Revision, x.CreatedAtUtc, isCurrent = x.Revision == current, totalFields = fields.Count, confirmed = fields.Count(f => f.Status == "confirmed"), changed = fields.Count(f => f.Status == "confirmed" && f.Value != f.Original) };
        }).ToList();
        return Ok(ApiResponse<object>.Ok(new { items, currentRevision = current.Value, totalCount = count, totalPages = Math.Max(1, (int)Math.Ceiling(count / 10d)) }));
    }

    [HttpGet("{id:guid}/export/{format}")]
    public async Task<IActionResult> Export(Guid id, string format, int? revision = null, CancellationToken ct = default)
    {
        var document = await Owned.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct); if (document is null) return NotFound();
        if (!Intact(document)) return Conflict(ApiResponse<object>.Fail("Hash file gốc không hợp lệ."));
        Response.Headers.CacheControl = "no-store";
        Response.Headers["X-Source-Sha256"] = document.Sha256;
        if (format == "original") return File(document.OriginalDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", document.Name);
        if (format is not ("docx" or "pdf")) return BadRequest();
        var snapshot = await db.Set<ImportedContractRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == (revision ?? document.Revision), ct); if (snapshot is null) return NotFound();
        Response.Headers["X-Document-Revision"] = snapshot.Revision.ToString(System.Globalization.CultureInfo.InvariantCulture);
        byte[] result;
        try { result = LegacyWordDocument.Apply(document.OriginalDocx, Parse(snapshot)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        if (format == "pdf")
        {
            try { result = await pdf.ConvertPreviewToPdfAsync(result, ct); }
            catch (ContractTemplatePdfRenderingException ex) { return StatusCode(503, ApiResponse<object>.Fail(ex.Message)); }
        }
        return File(result, format == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{Path.GetFileNameWithoutExtension(document.Name)}-v{snapshot.Revision}.{format}");
    }
}
