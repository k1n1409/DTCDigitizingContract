using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class EditorTemplatePrivacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSharedTemplate",
                table: "tbl_ContractEditorDocument",
                type: "bit",
                nullable: false,
                defaultValue: false);
            // Existing templates were already tenant-shared; preserve that visibility.
            migrationBuilder.Sql("UPDATE [tbl_ContractEditorDocument] SET [IsSharedTemplate] = 1 WHERE [IsTemplate] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSharedTemplate",
                table: "tbl_ContractEditorDocument");
        }
    }
}
