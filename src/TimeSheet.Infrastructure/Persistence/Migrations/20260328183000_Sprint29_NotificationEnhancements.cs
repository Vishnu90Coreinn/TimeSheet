using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TimeSheet.Infrastructure.Persistence;

#nullable disable

namespace TimeSheet.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(TimeSheetDbContext))]
    [Migration("20260328183000_Sprint29_NotificationEnhancements")]
    public partial class Sprint29_NotificationEnhancements : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActionUrl",
                table: "Notifications",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupKey",
                table: "Notifications",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActionUrl",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "GroupKey",
                table: "Notifications");
        }
    }
}
