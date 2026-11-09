using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContractManagement.Infrastructure.Migrations.Application
{
    /// <inheritdoc />
    public partial class ContractAdministrativeOutcome : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte>(
                name: "Outcome",
                table: "tbl_Contract",
                type: "tinyint",
                nullable: false,
                defaultValue: (byte)0);

            migrationBuilder.AddColumn<string>(
                name: "OutcomeReason",
                table: "tbl_Contract",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OutcomeUpdatedAtUtc",
                table: "tbl_Contract",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OutcomeUpdatedByEmployeeId",
                table: "tbl_Contract",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Outcome",
                table: "tbl_Contract");

            migrationBuilder.DropColumn(
                name: "OutcomeReason",
                table: "tbl_Contract");

            migrationBuilder.DropColumn(
                name: "OutcomeUpdatedAtUtc",
                table: "tbl_Contract");

            migrationBuilder.DropColumn(
                name: "OutcomeUpdatedByEmployeeId",
                table: "tbl_Contract");
        }
    }
}
