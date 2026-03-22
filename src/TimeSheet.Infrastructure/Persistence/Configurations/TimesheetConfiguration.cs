using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class TimesheetConfiguration : IEntityTypeConfiguration<Timesheet>
{
    public void Configure(EntityTypeBuilder<Timesheet> builder)
    {
        builder.ToTable("Timesheets");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.WorkDate }).IsUnique();
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.WorkDate);
        builder.Property(x => x.Status).HasConversion<int>();
        builder.Property(x => x.SubmissionNotes).HasMaxLength(2000);
        builder.Property(x => x.MismatchReason).HasMaxLength(1000);
        builder.Property(x => x.ManagerComment).HasMaxLength(1000);

        builder.HasOne(x => x.User)
            .WithMany(x => x.Timesheets)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.ApprovedByUser)
            .WithMany()
            .HasForeignKey(x => x.ApprovedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
