using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class PushSubscriptionConfiguration : IEntityTypeConfiguration<PushSubscription>
{
    public void Configure(EntityTypeBuilder<PushSubscription> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Endpoint).IsRequired().HasMaxLength(2048);
        builder.Property(p => p.P256dh).IsRequired().HasMaxLength(256);
        builder.Property(p => p.Auth).IsRequired().HasMaxLength(128);
        builder.HasIndex(p => p.Endpoint).IsUnique();
        builder.HasOne(p => p.User)
               .WithMany()
               .HasForeignKey(p => p.UserId)
               .OnDelete(DeleteBehavior.Cascade);
        builder.ToTable("PushSubscriptions");
    }
}
