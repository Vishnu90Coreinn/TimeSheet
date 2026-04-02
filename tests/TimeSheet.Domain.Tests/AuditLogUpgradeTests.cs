using FluentAssertions;
using TimeSheet.Domain.Common;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Tests;

public class AuditLogUpgradeTests
{
    [Fact]
    public void AuditLog_Should_DefaultSourceContextAndInitialiseChangesCollection()
    {
        var auditLog = new AuditLog();

        auditLog.SourceContext.Should().Be("ManualCall");
        auditLog.HasFieldChanges.Should().BeFalse();
        auditLog.Changes.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void User_PasswordHash_ShouldBeMarkedSensitive()
    {
        var prop = typeof(User).GetProperty(nameof(User.PasswordHash));

        var attribute = prop?.GetCustomAttributes(typeof(SensitiveAttribute), inherit: false)
            .Cast<SensitiveAttribute>()
            .SingleOrDefault();

        attribute.Should().NotBeNull();
        attribute!.Reason.Should().Be(SensitiveDataReason.Credential);
    }
}
