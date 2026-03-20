using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class LeavePolicyConfiguration : IEntityTypeConfiguration<LeavePolicy>
{
    public void Configure(EntityTypeBuilder<LeavePolicy> builder)
    {
        builder.HasMany(lp => lp.Allocations)
            .WithOne(a => a.LeavePolicy)
            .HasForeignKey(a => a.LeavePolicyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
