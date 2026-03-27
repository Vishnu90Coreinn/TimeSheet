using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TimeSheet.Infrastructure.Persistence;

#nullable disable

namespace TimeSheet.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(TimeSheetDbContext))]
    [Migration("20260327233000_Sprint28_Onboarding")]
    public partial class Sprint28_Onboarding : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OnboardingCompletedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LeaveWorkflowVisitedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LeaveWorkflowVisitedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OnboardingCompletedAt",
                table: "Users");
        }
    }
}
