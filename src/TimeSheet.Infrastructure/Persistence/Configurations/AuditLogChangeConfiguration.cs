using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class AuditLogChangeConfiguration : IEntityTypeConfiguration<AuditLogChange>
{
    public void Configure(EntityTypeBuilder<AuditLogChange> builder)
    {
        builder.ToTable("AuditLogChanges");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
        builder.Property(c => c.FieldName).HasMaxLength(200).IsRequired();
        builder.Property(c => c.ValueType).HasMaxLength(50);
        builder.Property(c => c.IsMasked).HasDefaultValue(false);

        builder.HasIndex(c => c.AuditLogId);
        builder.HasIndex(c => c.FieldName);
    }
}
