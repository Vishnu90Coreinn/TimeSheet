using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class LeaveBalanceConfiguration : IEntityTypeConfiguration<LeaveBalance>
{
    public void Configure(EntityTypeBuilder<LeaveBalance> builder)
    {
        builder.HasIndex(lb => new { lb.UserId, lb.LeaveTypeId, lb.Year }).IsUnique();

        builder.HasOne(lb => lb.User)
            .WithMany()
            .HasForeignKey(lb => lb.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(lb => lb.LeaveType)
            .WithMany()
            .HasForeignKey(lb => lb.LeaveTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
