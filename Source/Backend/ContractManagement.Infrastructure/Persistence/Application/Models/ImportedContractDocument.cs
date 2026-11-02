namespace ContractManagement.Infrastructure.Persistence.Application.Models;

public sealed class ImportedContractDocument
{
    public Guid Id { get; set; }
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Name { get; set; } = "";
    public byte[] OriginalDocx { get; set; } = [];
    public string Sha256 { get; set; } = "";
    public int Revision { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
public sealed class ImportedContractRevision
{
    public Guid DocumentId { get; set; }
    public int Revision { get; set; }
    public string Fields { get; set; } = "[]";
    public DateTime CreatedAtUtc { get; set; }
}
