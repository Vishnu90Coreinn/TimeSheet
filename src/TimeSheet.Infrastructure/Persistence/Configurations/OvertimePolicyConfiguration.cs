using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class OvertimePolicyConfiguration : IEntityTypeConfiguration<OvertimePolicy>
{
    public void Configure(EntityTypeBuilder<OvertimePolicy> builder)
    {
        builder.ToTable("OvertimePolicies");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.WorkPolicyId).IsUnique();

        builder.Property(x => x.DailyOvertimeAfterHours).HasPrecision(5, 2);
        builder.Property(x => x.WeeklyOvertimeAfterHours).HasPrecision(6, 2);
        builder.Property(x => x.OvertimeMultiplier).HasPrecision(4, 2);

        builder.HasOne(x => x.WorkPolicy)
            .WithOne(x => x.OvertimePolicy)
            .HasForeignKey<OvertimePolicy>(x => x.WorkPolicyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

