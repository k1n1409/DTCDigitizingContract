using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.API.Domains.Services.Contract;

public static class EditorDocxSourceAccess
{
    private static IQueryable<ContractEditorSourceAsset> Query(DbDtctechContext db, int tenantId, int actor, Guid id, string sha) =>
        db.Set<ContractEditorSourceAsset>().AsNoTracking().Where(x => x.Id == id && x.TenantId == tenantId && x.Sha256 == sha && (x.EmployeeId == actor || db.Set<ContractEditorDocument>().Any(d => d.TenantId == tenantId && !d.IsArchived && d.SourceAssetId == id && (d.EmployeeId == actor || (d.IsTemplate && d.IsSharedTemplate)))));
    public static Task<bool> CanReadAsync(DbDtctechContext db, int tenantId, int actor, Guid id, string sha, CancellationToken ct) => Query(db, tenantId, actor, id, sha).AnyAsync(ct);
    public static async Task<ContractEditorSourceAsset?> ReadAsync(DbDtctechContext db, int tenantId, int actor, Guid id, string sha, CancellationToken ct)
    {
        return await Query(db, tenantId, actor, id, sha).SingleOrDefaultAsync(ct);
    }
}
