using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class RetentionPolicyConfiguration : IEntityTypeConfiguration<RetentionPolicy>
{
    public void Configure(EntityTypeBuilder<RetentionPolicy> builder)
    {
        builder.ToTable("RetentionPolicies");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DataType).HasMaxLength(50).IsRequired();
        builder.HasIndex(x => x.DataType).IsUnique();
    }
}
