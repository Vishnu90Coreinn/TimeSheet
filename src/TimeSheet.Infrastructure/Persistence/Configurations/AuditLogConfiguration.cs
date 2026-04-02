using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Action).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityId).HasMaxLength(200).IsRequired();
        builder.Property(a => a.SourceContext).HasMaxLength(100);
        builder.Property(a => a.CorrelationId).HasMaxLength(50);
        builder.Property(a => a.Details).HasMaxLength(2000);

        builder.HasMany(a => a.Changes)
            .WithOne(c => c.AuditLog)
            .HasForeignKey(c => c.AuditLogId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => a.CreatedAtUtc);
        builder.HasIndex(a => new { a.EntityType, a.EntityId });
        builder.HasIndex(a => a.ActorUserId);
    }
}
