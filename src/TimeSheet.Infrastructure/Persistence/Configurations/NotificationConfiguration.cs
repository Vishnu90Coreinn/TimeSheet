using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.IsRead });
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Message).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.GroupKey).HasMaxLength(120);
        builder.Property(x => x.ActionUrl).HasMaxLength(500);
        builder.Property(x => x.Type).HasConversion<int>();
        builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
