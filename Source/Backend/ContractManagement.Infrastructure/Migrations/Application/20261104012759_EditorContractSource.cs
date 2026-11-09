using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class EditorContractSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EditorSourceDocumentId",
                table: "tbl_Contract",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "tbl_ContractEditorSourceSnapshot",
                columns: table => new { ContractId = table.Column<int>(type: "int", nullable: false), Docx = table.Column<byte[]>(type: "varbinary(max)", nullable: false) },
                constraints: table => { table.PrimaryKey("PK_tbl_ContractEditorSourceSnapshot", x => x.ContractId); table.ForeignKey("FK_tbl_ContractEditorSourceSnapshot_tbl_Contract_ContractId", x => x.ContractId, "tbl_Contract", "ContractId", onDelete: ReferentialAction.Cascade); });

            migrationBuilder.AddColumn<int>(
                name: "EditorSourceRevision",
                table: "tbl_Contract",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EditorSourceTitle",
                table: "tbl_Contract",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EditorSourceDocumentId",
                table: "tbl_Contract");

            migrationBuilder.DropTable(name: "tbl_ContractEditorSourceSnapshot");

            migrationBuilder.DropColumn(
                name: "EditorSourceRevision",
                table: "tbl_Contract");

            migrationBuilder.DropColumn(
                name: "EditorSourceTitle",
                table: "tbl_Contract");
        }
    }
}
