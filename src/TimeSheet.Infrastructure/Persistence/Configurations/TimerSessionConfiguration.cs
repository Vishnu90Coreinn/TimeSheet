using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class TimerSessionConfiguration : IEntityTypeConfiguration<TimerSession>
{
    public void Configure(EntityTypeBuilder<TimerSession> builder)
    {
        builder.ToTable("TimerSessions");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => new { x.UserId, x.StoppedAtUtc });
        builder.Property(x => x.Note).HasMaxLength(500);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Project)
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.ConvertedToEntry)
            .WithMany()
            .HasForeignKey(x => x.ConvertedToEntryId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
