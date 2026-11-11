using ContractManagement.Infrastructure.Persistence.Application;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ContractManagement.Infrastructure.Migrations.Application;

[DbContext(typeof(DbDtctechContext))]
[Migration("20261111090000_ContractEditorBindingReview")]
public sealed class ContractEditorBindingReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<string>(
            name: "BusinessReviewSnapshot",
            table: "tbl_ContractVersionEditorDocument",
            type: "nvarchar(max)",
            nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn("BusinessReviewSnapshot", "tbl_ContractVersionEditorDocument");
}
