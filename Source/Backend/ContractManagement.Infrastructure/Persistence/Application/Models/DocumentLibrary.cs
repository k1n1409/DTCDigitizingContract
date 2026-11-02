namespace ContractManagement.Infrastructure.Persistence.Application.Models;

public sealed class DocumentLibraryFolder
{
    public Guid Id { get; set; }
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Name { get; set; } = "";
    public DateTime UpdatedAtUtc { get; set; }
}

// Personal library metadata never changes another employee's shared template.
public sealed class DocumentLibraryEntry
{
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Kind { get; set; } = "";
    public Guid DocumentId { get; set; }
    public string? DisplayName { get; set; }
    public Guid? FolderId { get; set; }
    public bool IsStarred { get; set; }
    public int Revision { get; set; }
}
