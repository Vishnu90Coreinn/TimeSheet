using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class ConsentLogConfiguration : IEntityTypeConfiguration<ConsentLog>
{
    public void Configure(EntityTypeBuilder<ConsentLog> builder)
    {
        builder.ToTable("ConsentLogs");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ConsentType).HasMaxLength(50).IsRequired();
        builder.Property(x => x.IpAddress).HasMaxLength(45);
        builder.HasIndex(x => new { x.UserId, x.ConsentType });
    }
}
