using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Data;
using TimeSheet.Api.Infrastructure.Persistence.Repositories;
using TimeSheet.Api.Models;
using Xunit;

namespace TimeSheet.Api.Tests;

public class LeaveRepositoryTests
{
    [Fact]
    public async Task GetMyLeaveRequests_SkipsFilteringAndPaging_WhenFetchAllTrue()
    {
        await using var dbContext = CreateDbContext();
        var userId = await SeedLeaveRequestsAsync(dbContext);
        var repository = new LeaveRepository(dbContext);

        var query = new MyLeaveListQuery
        {
            FetchAll = true,
            Status = "approved",
            PageNumber = 1,
            PageSize = 1,
            SortBy = "leaveDate",
            SortDirection = "desc"
        };

        var result = await repository.GetMyLeaveRequestsAsync(userId, query, CancellationToken.None);

        Assert.True(result.FetchAll);
        Assert.Equal(3, result.TotalCount);
        Assert.Equal(3, result.Items.Count);
        Assert.True(result.Items.SequenceEqual(result.Items.OrderByDescending(x => x.LeaveDate)));
    }

    [Fact]
    public async Task GetMyLeaveRequests_AppliesFilteringSortingAndPaging_WhenFetchAllFalse()
    {
        await using var dbContext = CreateDbContext();
        var userId = await SeedLeaveRequestsAsync(dbContext);
        var repository = new LeaveRepository(dbContext);

        var query = new MyLeaveListQuery
        {
            FetchAll = false,
            Status = "pending",
            PageNumber = 1,
            PageSize = 1,
            SortBy = "leaveDate",
            SortDirection = "asc"
        };

        var result = await repository.GetMyLeaveRequestsAsync(userId, query, CancellationToken.None);

        Assert.False(result.FetchAll);
        Assert.Equal(2, result.TotalCount);
        Assert.Single(result.Items);
        Assert.Equal("pending", result.Items[0].Status);
        Assert.Equal(new DateOnly(2026, 3, 25), result.Items[0].LeaveDate);
    }

    private static TimeSheetDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<TimeSheetDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TimeSheetDbContext(options);
    }

    private static async Task<Guid> SeedLeaveRequestsAsync(TimeSheetDbContext dbContext)
    {
        var userId = Guid.NewGuid();
        var leaveTypeId = Guid.NewGuid();

        dbContext.Users.Add(new User
        {
            Id = userId,
            Username = "alice",
            Email = "alice@example.com",
            EmployeeId = "E100",
            PasswordHash = "hash",
            Role = "employee",
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        });

        dbContext.LeaveTypes.Add(new LeaveType
        {
            Id = leaveTypeId,
            Name = "Annual",
            IsActive = true
        });

        dbContext.LeaveRequests.AddRange(
            new LeaveRequest
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LeaveTypeId = leaveTypeId,
                LeaveDate = new DateOnly(2026, 3, 25),
                Status = LeaveRequestStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow.AddDays(-3)
            },
            new LeaveRequest
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LeaveTypeId = leaveTypeId,
                LeaveDate = new DateOnly(2026, 3, 26),
                Status = LeaveRequestStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow.AddDays(-2)
            },
            new LeaveRequest
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LeaveTypeId = leaveTypeId,
                LeaveDate = new DateOnly(2026, 3, 24),
                Status = LeaveRequestStatus.Approved,
                CreatedAtUtc = DateTime.UtcNow.AddDays(-4)
            });

        await dbContext.SaveChangesAsync();
        return userId;
    }
}
