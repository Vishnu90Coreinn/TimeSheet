using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class UserNotificationPreferencesConfiguration : IEntityTypeConfiguration<UserNotificationPreferences>
{
    public void Configure(EntityTypeBuilder<UserNotificationPreferences> builder)
    {
        builder.ToTable("UserNotificationPreferences");
        builder.HasKey(x => x.UserId);
        builder.HasOne(x => x.User)
            .WithOne()
            .HasForeignKey<UserNotificationPreferences>(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
