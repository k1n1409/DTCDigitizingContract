using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.API.Domains.DTOs.Requests.Contract;
using ContractManagement.API.Domains.Policies.Contract;
using ContractManagement.Filter;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.API.Domains.Controllers.Contract;
[ApiController, Route("api/contracts/saved-filters"), SessionAuthorize]
public sealed class SavedContractFiltersController(DbDtctechContext db, ICurrentTenant tenant) : ControllerBase
{
    public sealed class SaveRequest
    {
        [Required, MaxLength(100)] public string Name { get; set; } = "";
        [Required] public ContractFilterRequest Filter { get; set; } = new();
    }
    private int Actor => HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException();
    private IQueryable<SavedContractFilter> Own => db.Set<SavedContractFilter>().Where(x => x.TenantId == tenant.GetRequiredTenant().TenantId && x.EmployeeId == Actor);
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var rows = await Own.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        return Ok(ApiResponse<object>.Ok(rows.Select(x => new { x.Id, x.Name, filter = JsonSerializer.Deserialize<ContractFilterRequest>(x.FilterJson), x.CreatedAtUtc })));
    }
    [HttpPost, RequestSizeLimit(16 * 1024)]
    public async Task<IActionResult> Save(SaveRequest request, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100 || request.Filter is null) return BadRequest(ApiResponse<object>.Fail("Tên bộ lọc bắt buộc, tối đa 100 ký tự."));
        ContractWorkFilterPolicy.Validate(request.Filter);
        request.Filter.Page = 1; request.Filter.PageSize = 20;
        var json = JsonSerializer.Serialize(request.Filter);
        if (json.Length > 4000) return BadRequest(ApiResponse<object>.Fail("Bộ lọc vượt giới hạn lưu."));
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () => {
            await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : await db.Database.BeginTransactionAsync(ct);
            if (await Own.CountAsync(ct) >= 50) return Conflict(ApiResponse<object>.Fail("Đã có 50 bộ lọc. Xóa bộ lọc không dùng trước khi thêm."));
            var row = new SavedContractFilter { Id = Guid.NewGuid(), TenantId = tenant.GetRequiredTenant().TenantId, EmployeeId = Actor, Name = request.Name.Trim(), FilterJson = json, CreatedAtUtc = DateTime.UtcNow };
            db.Add(row); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            return Ok(ApiResponse<object>.Ok(new { row.Id, row.Name, filter = request.Filter, row.CreatedAtUtc }));
        });
    }
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await Own.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        db.Remove(row); await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<object>.Ok(new { id }));
    }
}
