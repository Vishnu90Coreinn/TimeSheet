using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AttendanceIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AttendanceIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CheckIn_PreventsDuplicateActiveSession()
    {
        using var client = await CreateAuthedEmployeeClient("employee.att.1");

        var first = await client.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(null));
        var duplicate = await client.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(null));

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }


    [Fact]
    public async Task CheckIn_ReclassifiesPriorDayActiveSessionBeforeDuplicateGuard()
    {
        using var client = await CreateAuthedEmployeeClient("employee.att.stale");

        var checkInAt = DateTime.UtcNow;
        var priorDayCheckIn = checkInAt.AddDays(-1).AddHours(-2);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var user = await db.Users.SingleAsync(u => u.Username == "employee.att.stale");

            db.WorkSessions.Add(new WorkSession
            {
                UserId = user.Id,
                WorkDate = DateOnly.FromDateTime(priorDayCheckIn),
                CheckInAtUtc = priorDayCheckIn,
                Status = WorkSessionStatus.Active
            });

            await db.SaveChangesAsync();
        }

        var response = await client.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(checkInAt));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var userId = await verifyDb.Users.Where(u => u.Username == "employee.att.stale").Select(u => u.Id).SingleAsync();
        var staleSession = await verifyDb.WorkSessions.SingleAsync(s => s.UserId == userId && s.WorkDate == DateOnly.FromDateTime(priorDayCheckIn));
        var newSession = await verifyDb.WorkSessions.SingleAsync(s => s.UserId == userId && s.WorkDate == DateOnly.FromDateTime(checkInAt));

        Assert.Equal(WorkSessionStatus.MissingCheckout, staleSession.Status);
        Assert.True(staleSession.HasAttendanceException);
        Assert.Equal(WorkSessionStatus.Active, newSession.Status);
    }

    [Fact]
    public async Task BreakSequence_ValidatesOverlapAndOrder()
    {
        using var client = await CreateAuthedEmployeeClient("employee.att.2");

        var nowUtc = DateTime.UtcNow;
        var checkInAtUtc = new DateTime(nowUtc.Year, nowUtc.Month, nowUtc.Day, 9, 0, 0, DateTimeKind.Utc);
        if (checkInAtUtc >= nowUtc)
        {
            checkInAtUtc = checkInAtUtc.AddDays(-1);
        }

        var checkIn = await client.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(checkInAtUtc));
        var start = await client.PostAsJsonAsync("/api/v1/attendance/breaks/start", new StartBreakRequest(checkInAtUtc.AddHours(2)));
        var duplicateStart = await client.PostAsJsonAsync("/api/v1/attendance/breaks/start", new StartBreakRequest(checkInAtUtc.AddHours(3)));
        var end = await client.PostAsJsonAsync("/api/v1/attendance/breaks/end", new EndBreakRequest(checkInAtUtc.AddHours(3).AddMinutes(30)));

        var checkInBody = await checkIn.Content.ReadAsStringAsync();
        var startBody = await start.Content.ReadAsStringAsync();
        var duplicateStartBody = await duplicateStart.Content.ReadAsStringAsync();
        var endBody = await end.Content.ReadAsStringAsync();

        Assert.True(checkIn.StatusCode == HttpStatusCode.OK, $"Check-in failed: {(int)checkIn.StatusCode} {checkInBody}");
        Assert.True(start.StatusCode == HttpStatusCode.OK, $"Start break failed: {(int)start.StatusCode} {startBody}");
        Assert.True(duplicateStart.StatusCode == HttpStatusCode.Conflict, $"Duplicate start expected conflict: {(int)duplicateStart.StatusCode} {duplicateStartBody}");
        Assert.True(end.StatusCode == HttpStatusCode.OK, $"End break failed: {(int)end.StatusCode} {endBody}");
    }

    private async Task<HttpClient> CreateAuthedEmployeeClient(string username)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var role = await db.Roles.SingleAsync(r => r.Name == "employee");
        var policy = await db.WorkPolicies.FirstAsync();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@timesheet.local",
            EmployeeId = $"{username}-id",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            WorkPolicyId = policy.Id,
            IsActive = true
        };
        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await db.SaveChangesAsync();

        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, "employee123"));
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
        return client;
    }
}
