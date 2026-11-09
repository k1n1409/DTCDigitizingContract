namespace ContractManagement.Infrastructure.Persistence.Application.Models;

public sealed class AdministrativeTextEdit
{
    public long AdministrativeTextEditId { get; set; }
    public int TenantId { get; set; }
    public string Target { get; set; } = "";
    public int ParentId { get; set; }
    public int VersionId { get; set; }
    public string Kind { get; set; } = "";
    public int RowId { get; set; }
    public string BeforeJson { get; set; } = "";
    public string AfterJson { get; set; } = "";
    public string Reason { get; set; } = "";
    public int EmployeeId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
