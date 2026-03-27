using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeSheet.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Sprint34_OvertimePolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CompOffBalances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Credits = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompOffBalances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CompOffBalances_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OvertimePolicies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkPolicyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DailyOvertimeAfterHours = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    WeeklyOvertimeAfterHours = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false),
                    OvertimeMultiplier = table.Column<decimal>(type: "decimal(4,2)", precision: 4, scale: 2, nullable: false),
                    CompOffEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CompOffExpiryDays = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OvertimePolicies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OvertimePolicies_WorkPolicies_WorkPolicyId",
                        column: x => x.WorkPolicyId,
                        principalTable: "WorkPolicies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompOffBalances_ExpiresAt",
                table: "CompOffBalances",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_CompOffBalances_UserId_ExpiresAt",
                table: "CompOffBalances",
                columns: new[] { "UserId", "ExpiresAt" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OvertimePolicies_WorkPolicyId",
                table: "OvertimePolicies",
                column: "WorkPolicyId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompOffBalances");

            migrationBuilder.DropTable(
                name: "OvertimePolicies");
        }
    }
}
