using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class LeavePolicyAllocationConfiguration : IEntityTypeConfiguration<LeavePolicyAllocation>
{
    public void Configure(EntityTypeBuilder<LeavePolicyAllocation> builder)
    {
        builder.HasIndex(a => new { a.LeavePolicyId, a.LeaveTypeId }).IsUnique();

        builder.HasOne(a => a.LeaveType)
            .WithMany()
            .HasForeignKey(a => a.LeaveTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
