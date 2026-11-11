namespace ContractManagement.Infrastructure.Persistence.Application.Models;

public sealed class ContractEditorDocument
{
    public Guid Id { get; set; }
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Title { get; set; } = "";
    public bool IsTemplate { get; set; }
    public bool IsSharedTemplate { get; set; } = true;
    public Guid? SourceAssetId { get; set; }
    public bool IsArchived { get; set; }
    public int Revision { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class ContractEditorSourceAsset
{
    public Guid Id { get; set; }
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Sha256 { get; set; } = "";
    public byte[] Docx { get; set; } = [];
    public DateTime CreatedAtUtc { get; set; }
}

// Kept outside tbl_Contract so list/detail queries never load the DOCX binary.
public sealed class ContractEditorSourceSnapshot
{
    public int ContractId { get; set; }
    public byte[] Docx { get; set; } = [];
}

public sealed class ContractVersionEditorDocument
{
    public int VersionId { get; set; }
    public int ContractId { get; set; }
    public Guid EditorDocumentId { get; set; }
    public int EditorRevision { get; set; }
    public string Title { get; set; } = "";
    public string DocxHash { get; set; } = "";
    public string BusinessHash { get; set; } = "";
    public string? BusinessReviewSnapshot { get; set; }
    public byte[] Docx { get; set; } = [];
    public int BoundByEmployeeId { get; set; }
    public DateTime BoundAtUtc { get; set; }
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
