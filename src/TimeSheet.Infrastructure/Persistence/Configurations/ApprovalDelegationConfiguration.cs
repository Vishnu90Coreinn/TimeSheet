using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class ApprovalDelegationConfiguration : IEntityTypeConfiguration<ApprovalDelegation>
{
    public void Configure(EntityTypeBuilder<ApprovalDelegation> builder)
    {
        builder.ToTable("ApprovalDelegations");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.FromDate).IsRequired();
        builder.Property(d => d.ToDate).IsRequired();
        builder.Property(d => d.IsActive).IsRequired();
        builder.Property(d => d.CreatedAtUtc).IsRequired();

        builder.HasOne(d => d.FromUser)
            .WithMany()
            .HasForeignKey(d => d.FromUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.ToUser)
            .WithMany()
            .HasForeignKey(d => d.ToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(d => d.FromUserId);
        builder.HasIndex(d => d.ToUserId);
    }
}
