namespace ContractManagement.Infrastructure.Persistence.Application.Models;

public sealed class ContractEditorDocument
{
    public Guid Id { get; set; }
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Title { get; set; } = "";
    public bool IsTemplate { get; set; }
    public bool IsArchived { get; set; }
    public int Revision { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class ContractEditorRevision
{
    public Guid DocumentId { get; set; }
    public int Revision { get; set; }
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Bindings { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
}
