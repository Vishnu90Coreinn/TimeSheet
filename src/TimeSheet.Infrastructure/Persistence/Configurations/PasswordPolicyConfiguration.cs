using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class PasswordPolicyConfiguration : IEntityTypeConfiguration<PasswordPolicy>
{
    public void Configure(EntityTypeBuilder<PasswordPolicy> builder)
    {
        builder.ToTable("PasswordPolicy");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.MinLength).IsRequired();
        builder.Property(x => x.MaxAgeDays).IsRequired();
    }
}
