using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class TenantSettingsConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> builder)
    {
        builder.ToTable("TenantSettings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.AppName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.LogoUrl).HasMaxLength(500);
        builder.Property(x => x.FaviconUrl).HasMaxLength(500);
        builder.Property(x => x.PrimaryColor).HasMaxLength(20);
        builder.Property(x => x.CustomDomain).HasMaxLength(255);
    }
}
