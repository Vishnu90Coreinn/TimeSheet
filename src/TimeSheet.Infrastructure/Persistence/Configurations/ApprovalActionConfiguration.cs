using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class ApprovalActionConfiguration : IEntityTypeConfiguration<ApprovalAction>
{
    public void Configure(EntityTypeBuilder<ApprovalAction> builder)
    {
        builder.ToTable("ApprovalActions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Action).HasConversion<int>();
        builder.Property(x => x.Comment).HasMaxLength(1000).IsRequired();

        builder.HasOne(x => x.Timesheet)
            .WithMany(x => x.ApprovalActions)
            .HasForeignKey(x => x.TimesheetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.ManagerUser)
            .WithMany()
            .HasForeignKey(x => x.ManagerUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
