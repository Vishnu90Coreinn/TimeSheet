using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class BreakEntryConfiguration : IEntityTypeConfiguration<BreakEntry>
{
    public void Configure(EntityTypeBuilder<BreakEntry> builder)
    {
        builder.ToTable("BreakEntries");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.WorkSessionId);
        builder.HasOne(x => x.WorkSession)
            .WithMany(ws => ws.Breaks)
            .HasForeignKey(x => x.WorkSessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
