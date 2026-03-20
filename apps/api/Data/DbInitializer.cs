using Microsoft.EntityFrameworkCore;

namespace TimeSheet.Api.Data;

public static class DbInitializer
{
    // ── Migration bootstrap ───────────────────────────────────────────────────
    // Handles three cases:
    //   1. New DB          → MigrateAsync creates DB + runs all migrations
    //   2. Existing DB, no migration history → bootstraps __EFMigrationsHistory,
    //      marks the "Initial" migration as already applied, then runs any newer ones
    //   3. Existing DB, history present → MigrateAsync applies only pending migrations
    public static async Task MigrateAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();

        // InMemory (used in tests) doesn't support migrations — use EnsureCreated instead
        if (!db.Database.IsRelational())
        {
            await db.Database.EnsureCreatedAsync();
            return;
        }

        bool canConnect;
        try { canConnect = await db.Database.CanConnectAsync(); }
        catch { canConnect = false; }

        if (!canConnect)
        {
            // New or unreachable DB — let EF create it from scratch
            await db.Database.MigrateAsync();
            return;
        }

        // DB exists — check whether migrations have been bootstrapped yet
        var usersExist   = await TableExistsAsync(db, "Users");
        var historyExist = await TableExistsAsync(db, "__EFMigrationsHistory");

        if (usersExist && !historyExist)
        {
            // Pre-migrations database: create history table and mark the
            // initial snapshot as already applied so EF won't try to
            // re-create tables that already exist.
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE [__EFMigrationsHistory] (
                    [MigrationId]    nvarchar(150) NOT NULL,
                    [ProductVersion] nvarchar(32)  NOT NULL,
                    CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
                )
                """);

            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
                VALUES ('20260316071602_Initial', '10.0.5')
                """);
        }

        // Apply any migrations that are pending (new tables, new columns, etc.)
        await db.Database.MigrateAsync();
    }

    private static async Task<bool> TableExistsAsync(TimeSheetDbContext db, string tableName)
    {
        var conn = db.Database.GetDbConnection();
        var shouldClose = conn.State != System.Data.ConnectionState.Open;
        if (shouldClose) await conn.OpenAsync();
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t";
            var p = cmd.CreateParameter();
            p.ParameterName = "@t";
            p.Value = tableName;
            cmd.Parameters.Add(p);
            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result) > 0;
        }
        finally
        {
            if (shouldClose) await conn.CloseAsync();
        }
    }

    // ── Seed ─────────────────────────────────────────────────────────────────
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        // DB is already created/migrated by MigrateAsync — no EnsureCreated needed

        if (!await db.Roles.AnyAsync())
        {
            db.Roles.AddRange(
                new Role { Id = Guid.NewGuid(), Name = "admin" },
                new Role { Id = Guid.NewGuid(), Name = "manager" },
                new Role { Id = Guid.NewGuid(), Name = "employee" },
                new Role { Id = Guid.NewGuid(), Name = "consultant" }
            );
        }

        if (!await db.Departments.AnyAsync())
        {
            db.Departments.AddRange(
                new Department { Id = Guid.NewGuid(), Name = "Engineering", IsActive = true },
                new Department { Id = Guid.NewGuid(), Name = "Operations", IsActive = true }
            );
        }

        if (!await db.WorkPolicies.AnyAsync())
        {
            db.WorkPolicies.Add(new WorkPolicy
            {
                Id = Guid.NewGuid(),
                Name = "Standard 8 Hours",
                DailyExpectedMinutes = 480,
                FixedLunchDeductionMinutes = 45,
                LowGrossThresholdMinutes = 300,
                SkipLunchDeductionForLowGross = true,
                AllowManualBreakEdits = true,
                TimesheetBackdateWindowDays = 7,
                RequireMismatchReason = true,
                IsActive = true
            });
        }

        if (!await db.Users.AnyAsync())
        {
            var policyId = db.WorkPolicies.Local.FirstOrDefault()?.Id
                ?? await db.WorkPolicies.Select(x => x.Id).FirstOrDefaultAsync();

            var adminUser = new User
            {
                Id = Guid.NewGuid(),
                Username = "admin",
                Email = "admin@timesheet.local",
                EmployeeId = "EMP-0001",
                PasswordHash = hasher.Hash("admin123"),
                Role = "admin",
                IsActive = true,
                WorkPolicyId = policyId == Guid.Empty ? null : policyId
            };

            db.Users.Add(adminUser);
            await db.SaveChangesAsync();

            var adminRole = await db.Roles.SingleAsync(r => r.Name == "admin");
            db.UserRoles.Add(new UserRole
            {
                UserId = adminUser.Id,
                RoleId = adminRole.Id
            });
        }

        if (!await db.LeaveTypes.AnyAsync())
        {
            db.LeaveTypes.AddRange(
                new LeaveType { Id = Guid.NewGuid(), Name = "Annual Leave", IsActive = true },
                new LeaveType { Id = Guid.NewGuid(), Name = "Sick Leave", IsActive = true },
                new LeaveType { Id = Guid.NewGuid(), Name = "Casual Leave", IsActive = true }
            );
        }

        if (!await db.TaskCategories.AnyAsync())
        {
            db.TaskCategories.AddRange(
                new TaskCategory { Id = Guid.NewGuid(), Name = "Development", IsActive = true, IsBillable = true },
                new TaskCategory { Id = Guid.NewGuid(), Name = "Meetings", IsActive = true, IsBillable = false },
                new TaskCategory { Id = Guid.NewGuid(), Name = "Support", IsActive = true, IsBillable = true }
            );
        }

        if (!await db.Holidays.AnyAsync())
        {
            db.Holidays.AddRange(
                new Holiday { Id = Guid.NewGuid(), Name = "New Year's Day", Date = new DateOnly(2026, 1, 1), IsRecurring = true, CreatedAtUtc = DateTime.UtcNow },
                new Holiday { Id = Guid.NewGuid(), Name = "Good Friday", Date = new DateOnly(2026, 4, 3), IsRecurring = false, CreatedAtUtc = DateTime.UtcNow },
                new Holiday { Id = Guid.NewGuid(), Name = "Labour Day", Date = new DateOnly(2026, 5, 1), IsRecurring = true, CreatedAtUtc = DateTime.UtcNow },
                new Holiday { Id = Guid.NewGuid(), Name = "Christmas Day", Date = new DateOnly(2026, 12, 25), IsRecurring = true, CreatedAtUtc = DateTime.UtcNow },
                new Holiday { Id = Guid.NewGuid(), Name = "Boxing Day", Date = new DateOnly(2026, 12, 26), IsRecurring = true, CreatedAtUtc = DateTime.UtcNow }
            );
        }

        await db.SaveChangesAsync();
    }
}
