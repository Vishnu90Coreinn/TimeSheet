using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeSheet.Api.Migrations
{
    /// <inheritdoc />
    public partial class Sprint13_WorkDaysPerWeek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WorkDaysPerWeek",
                table: "WorkPolicies",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WorkDaysPerWeek",
                table: "WorkPolicies");
        }
    }
}
