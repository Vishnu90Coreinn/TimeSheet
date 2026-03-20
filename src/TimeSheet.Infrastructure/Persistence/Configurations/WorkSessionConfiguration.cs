using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class WorkSessionConfiguration : IEntityTypeConfiguration<WorkSession>
{
    public void Configure(EntityTypeBuilder<WorkSession> builder)
    {
        builder.ToTable("WorkSessions");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.WorkDate });
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.Status);
        builder.HasOne(x => x.User)
            .WithMany(u => u.WorkSessions)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
