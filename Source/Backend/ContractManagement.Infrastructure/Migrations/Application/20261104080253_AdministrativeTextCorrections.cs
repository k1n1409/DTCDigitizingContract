using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class AdministrativeTextCorrections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tbl_AdministrativeTextEdit",
                columns: table => new
                {
                    AdministrativeTextEditId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantId = table.Column<int>(type: "int", nullable: false),
                    Target = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: false),
                    VersionId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RowId = table.Column<int>(type: "int", nullable: false),
                    BeforeJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AfterJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_AdministrativeTextEdit", x => x.AdministrativeTextEditId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tbl_AdministrativeTextEdit_TenantId_Target_ParentId_VersionId",
                table: "tbl_AdministrativeTextEdit",
                columns: new[] { "TenantId", "Target", "ParentId", "VersionId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tbl_AdministrativeTextEdit");
        }
    }
}
