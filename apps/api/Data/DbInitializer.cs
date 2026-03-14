using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        await db.Database.EnsureCreatedAsync();

        if (!await db.Roles.AnyAsync())
        {
            db.Roles.AddRange(
                new Role { Id = Guid.NewGuid(), Name = "admin" },
                new Role { Id = Guid.NewGuid(), Name = "manager" },
                new Role { Id = Guid.NewGuid(), Name = "employee" }
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

        if (!await db.TaskCategories.AnyAsync())
        {
            db.TaskCategories.AddRange(
                new TaskCategory { Id = Guid.NewGuid(), Name = "Development", IsActive = true },
                new TaskCategory { Id = Guid.NewGuid(), Name = "Meetings", IsActive = true },
                new TaskCategory { Id = Guid.NewGuid(), Name = "Support", IsActive = true }
            );
        }

        await db.SaveChangesAsync();
    }
}
