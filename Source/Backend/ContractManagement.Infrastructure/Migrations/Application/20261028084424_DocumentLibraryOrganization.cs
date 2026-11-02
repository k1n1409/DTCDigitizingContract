using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class DocumentLibraryOrganization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tbl_DocumentLibraryFolder",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_DocumentLibraryFolder", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tbl_DocumentLibraryEntry",
                columns: table => new
                {
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    DocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FolderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsStarred = table.Column<bool>(type: "bit", nullable: false),
                    Revision = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_DocumentLibraryEntry", x => new { x.TenantId, x.EmployeeId, x.Kind, x.DocumentId });
                    table.ForeignKey(
                        name: "FK_tbl_DocumentLibraryEntry_tbl_DocumentLibraryFolder_FolderId",
                        column: x => x.FolderId,
                        principalTable: "tbl_DocumentLibraryFolder",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tbl_DocumentLibraryEntry_FolderId",
                table: "tbl_DocumentLibraryEntry",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_tbl_DocumentLibraryFolder_TenantId_EmployeeId",
                table: "tbl_DocumentLibraryFolder",
                columns: new[] { "TenantId", "EmployeeId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tbl_DocumentLibraryEntry");

            migrationBuilder.DropTable(
                name: "tbl_DocumentLibraryFolder");
        }
    }
}
