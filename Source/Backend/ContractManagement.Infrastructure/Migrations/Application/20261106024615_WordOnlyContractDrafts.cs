using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class WordOnlyContractDrafts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_tbl_ContractVersionLegalSnapshot_Ids",
                table: "tbl_ContractVersionLegalSnapshot");

            migrationBuilder.DropCheckConstraint(
                name: "CK_tbl_ContractVersion_TemplateVersionId",
                table: "tbl_ContractVersion");

            migrationBuilder.DropCheckConstraint(
                name: "CK_tbl_Contract_TemplateVersionId",
                table: "tbl_Contract");

            migrationBuilder.AddCheckConstraint(
                name: "CK_tbl_ContractVersionLegalSnapshot_Ids",
                table: "tbl_ContractVersionLegalSnapshot",
                sql: "[VersionId] > 0 AND [ContractId] > 0 AND [VersionNo] > 0 AND [TemplateVersionId] >= 0 AND [CreatedByEmployeeId] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_tbl_ContractVersion_TemplateVersionId",
                table: "tbl_ContractVersion",
                sql: "[TemplateVersionId] > 0 OR ([TemplateVersionId] = 0 AND [DocumentMode] = 1)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_tbl_Contract_TemplateVersionId",
                table: "tbl_Contract",
                sql: "[TemplateVersionId] > 0 OR ([TemplateVersionId] = 0 AND [EditorSourceDocumentId] IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM dbo.tbl_Contract WHERE TemplateVersionId = 0)
                   OR EXISTS (SELECT 1 FROM dbo.tbl_ContractVersion WHERE TemplateVersionId = 0)
                   OR EXISTS (SELECT 1 FROM dbo.tbl_ContractVersionLegalSnapshot WHERE TemplateVersionId = 0)
                    THROW 51000, 'Cannot roll back while Word-only contracts exist.', 1;
                """);
            migrationBuilder.DropCheckConstraint(
                name: "CK_tbl_ContractVersionLegalSnapshot_Ids",
                table: "tbl_ContractVersionLegalSnapshot");

            migrationBuilder.DropCheckConstraint(
                name: "CK_tbl_ContractVersion_TemplateVersionId",
                table: "tbl_ContractVersion");

            migrationBuilder.DropCheckConstraint(
                name: "CK_tbl_Contract_TemplateVersionId",
                table: "tbl_Contract");

            migrationBuilder.AddCheckConstraint(
                name: "CK_tbl_ContractVersionLegalSnapshot_Ids",
                table: "tbl_ContractVersionLegalSnapshot",
                sql: "[VersionId] > 0 AND [ContractId] > 0 AND [VersionNo] > 0 AND [TemplateVersionId] > 0 AND [CreatedByEmployeeId] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_tbl_ContractVersion_TemplateVersionId",
                table: "tbl_ContractVersion",
                sql: "[TemplateVersionId] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_tbl_Contract_TemplateVersionId",
                table: "tbl_Contract",
                sql: "[TemplateVersionId] > 0");
        }
    }
}
