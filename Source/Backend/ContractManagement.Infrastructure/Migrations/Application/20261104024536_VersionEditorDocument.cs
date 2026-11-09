using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class VersionEditorDocument : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte>(
                name: "DocumentMode",
                table: "tbl_ContractVersion",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.CreateTable(
                name: "tbl_ContractVersionEditorDocument",
                columns: table => new
                {
                    VersionId = table.Column<int>(type: "int", nullable: false),
                    ContractId = table.Column<int>(type: "int", nullable: false),
                    EditorDocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EditorRevision = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DocxHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    BusinessHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Docx = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    BoundByEmployeeId = table.Column<int>(type: "int", nullable: false),
                    BoundAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tbl_ContractVersionEditorDocument", x => x.VersionId);
                    table.ForeignKey(
                        name: "FK_tbl_ContractVersionEditorDocument_tbl_ContractVersion_VersionId",
                        column: x => x.VersionId,
                        principalTable: "tbl_ContractVersion",
                        principalColumn: "VersionId",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tbl_ContractVersionEditorDocument");

            migrationBuilder.DropColumn(
                name: "DocumentMode",
                table: "tbl_ContractVersion");
        }
    }
}
