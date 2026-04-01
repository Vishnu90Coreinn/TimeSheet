using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AuditInterceptorIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuditInterceptorIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SaveChanges_WhenTrackedEntityUpdated_WritesAuditLogChanges()
    {
        using var scope = _factory.Services.CreateScope();
        var services = scope.ServiceProvider;
        var dbContext = services.GetRequiredService<TimeSheetDbContext>();
        var httpContextAccessor = services.GetRequiredService<IHttpContextAccessor>();

        var actorId = Guid.NewGuid();
        var correlationId = $"corr-{Guid.NewGuid():N}";
        var httpContext = new DefaultHttpContext();
        httpContext.Items["X-Correlation-ID"] = correlationId;
        httpContext.Request.Headers["X-Correlation-ID"] = correlationId;
        httpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, actorId.ToString()),
                    new Claim(ClaimTypes.Name, "audit-tester"),
                    new Claim(ClaimTypes.Role, "admin")
                ],
                authenticationType: "Test"));
        httpContextAccessor.HttpContext = httpContext;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "audit.phase2.user",
            DisplayName = "Audit Phase2 User",
            Email = "audit.phase2@timesheet.local",
            EmployeeId = "AUD-P2-01",
            PasswordHash = "hash",
            Role = "employee",
            IsActive = true
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        user.DisplayName = "Audit Phase2 User Updated";
        user.Email = "audit.phase2.updated@timesheet.local";
        await dbContext.SaveChangesAsync();

        var auditLog = await dbContext.AuditLogs
            .Include(a => a.Changes)
            .Where(a =>
                a.EntityType == nameof(User)
                && a.EntityId == user.Id.ToString()
                && a.Action == "UserUpdated")
            .OrderByDescending(a => a.CreatedAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(auditLog);
        Assert.True(auditLog!.HasFieldChanges);
        Assert.Equal("EFInterceptor", auditLog.SourceContext);
        Assert.Equal(correlationId, auditLog.CorrelationId);
        Assert.Equal(actorId, auditLog.ActorUserId);

        var displayNameChange = auditLog.Changes.Single(c => c.FieldName == nameof(User.DisplayName));
        Assert.Equal("Audit Phase2 User", displayNameChange.OldValue);
        Assert.Equal("Audit Phase2 User Updated", displayNameChange.NewValue);
        Assert.False(displayNameChange.IsMasked);

        var emailChange = auditLog.Changes.Single(c => c.FieldName == nameof(User.Email));
        Assert.Equal("[REDACTED]", emailChange.OldValue);
        Assert.Equal("[REDACTED]", emailChange.NewValue);
        Assert.True(emailChange.IsMasked);
    }
}
