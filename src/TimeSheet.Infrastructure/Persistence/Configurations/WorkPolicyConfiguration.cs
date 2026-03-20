using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class WorkPolicyConfiguration : IEntityTypeConfiguration<WorkPolicy>
{
    public void Configure(EntityTypeBuilder<WorkPolicy> builder)
    {
        builder.ToTable("WorkPolicies");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.Name).IsUnique();
        builder.Property(x => x.Name).HasMaxLength(120).IsRequired();
    }
}
