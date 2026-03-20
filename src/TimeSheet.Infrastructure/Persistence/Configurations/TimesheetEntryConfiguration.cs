using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class TimesheetEntryConfiguration : IEntityTypeConfiguration<TimesheetEntry>
{
    public void Configure(EntityTypeBuilder<TimesheetEntry> builder)
    {
        builder.ToTable("TimesheetEntries");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.TimesheetId);
        builder.HasIndex(x => x.ProjectId);
        builder.Property(x => x.Notes).HasMaxLength(1000);

        builder.HasOne(x => x.Timesheet)
            .WithMany(x => x.Entries)
            .HasForeignKey(x => x.TimesheetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Project)
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.TaskCategory)
            .WithMany()
            .HasForeignKey(x => x.TaskCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
