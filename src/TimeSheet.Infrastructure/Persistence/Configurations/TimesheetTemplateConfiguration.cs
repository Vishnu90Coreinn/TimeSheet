using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Configurations;

public class TimesheetTemplateConfiguration : IEntityTypeConfiguration<TimesheetTemplate>
{
    public void Configure(EntityTypeBuilder<TimesheetTemplate> builder)
    {
        builder.ToTable("TimesheetTemplates");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.UserId);
        builder.Property(x => x.Name).HasMaxLength(120).IsRequired();
        builder.Property(x => x.EntriesJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
