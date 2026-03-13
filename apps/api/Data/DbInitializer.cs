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

        if (!await db.Users.AnyAsync())
        {
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Username = "admin",
                Email = "admin@timesheet.local",
                EmployeeId = "EMP-0001",
                PasswordHash = hasher.Hash("admin123"),
                Role = "admin",
                IsActive = true
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
