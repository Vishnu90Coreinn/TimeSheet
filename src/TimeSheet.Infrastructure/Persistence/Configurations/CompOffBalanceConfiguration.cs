using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class CompOffBalanceConfiguration : IEntityTypeConfiguration<CompOffBalance>
{
    public void Configure(EntityTypeBuilder<CompOffBalance> builder)
    {
        builder.ToTable("CompOffBalances");
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.UserId, x.ExpiresAt }).IsUnique();
        builder.HasIndex(x => x.ExpiresAt);

        builder.Property(x => x.Credits).HasPrecision(8, 2);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

