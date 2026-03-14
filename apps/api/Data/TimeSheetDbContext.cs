using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Data;

public class TimeSheetDbContext(DbContextOptions<TimeSheetDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<TaskCategory> TaskCategories => Set<TaskCategory>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<WorkPolicy> WorkPolicies => Set<WorkPolicy>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<WorkSession> WorkSessions => Set<WorkSession>();
    public DbSet<BreakEntry> BreakEntries => Set<BreakEntry>();
    public DbSet<Timesheet> Timesheets => Set<Timesheet>();
    public DbSet<TimesheetEntry> TimesheetEntries => Set<TimesheetEntry>();
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<ApprovalAction> ApprovalActions => Set<ApprovalAction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.EmployeeId).IsUnique();
            entity.Property(x => x.Username).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(200).IsRequired();
            entity.Property(x => x.EmployeeId).HasMaxLength(50).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(30).IsRequired();

            entity.HasOne(x => x.Department)
                .WithMany()
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.WorkPolicy)
                .WithMany()
                .HasForeignKey(x => x.WorkPolicyId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.Manager)
                .WithMany(x => x.DirectReports)
                .HasForeignKey(x => x.ManagerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("UserRoles");
            entity.HasKey(x => new { x.UserId, x.RoleId });
            entity.HasOne(x => x.User).WithMany(x => x.UserRoles).HasForeignKey(x => x.UserId);
            entity.HasOne(x => x.Role).WithMany(x => x.UserRoles).HasForeignKey(x => x.RoleId);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Token).IsUnique();
            entity.Property(x => x.Token).HasMaxLength(256).IsRequired();
            entity.HasOne(x => x.User).WithMany(x => x.RefreshTokens).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("Departments");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
        });

        modelBuilder.Entity<WorkPolicy>(entity =>
        {
            entity.ToTable("WorkPolicies");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
        });

        modelBuilder.Entity<WorkSession>(entity =>
        {
            entity.ToTable("WorkSessions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.UserId, x.WorkDate });
            entity.HasOne(x => x.User)
                .WithMany(u => u.WorkSessions)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BreakEntry>(entity =>
        {
            entity.ToTable("BreakEntries");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.WorkSessionId);
            entity.HasOne(x => x.WorkSession)
                .WithMany(ws => ws.Breaks)
                .HasForeignKey(x => x.WorkSessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Timesheet>(entity =>
        {
            entity.ToTable("Timesheets");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.UserId, x.WorkDate }).IsUnique();
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.SubmissionNotes).HasMaxLength(2000);
            entity.Property(x => x.MismatchReason).HasMaxLength(1000);
            entity.Property(x => x.ManagerComment).HasMaxLength(1000);

            entity.HasOne(x => x.User)
                .WithMany(x => x.Timesheets)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.ApprovedByUser)
                .WithMany()
                .HasForeignKey(x => x.ApprovedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TimesheetEntry>(entity =>
        {
            entity.ToTable("TimesheetEntries");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TimesheetId);
            entity.Property(x => x.Notes).HasMaxLength(1000);

            entity.HasOne(x => x.Timesheet)
                .WithMany(x => x.Entries)
                .HasForeignKey(x => x.TimesheetId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Project)
                .WithMany()
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.TaskCategory)
                .WithMany()
                .HasForeignKey(x => x.TaskCategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });


        modelBuilder.Entity<LeaveType>(entity =>
        {
            entity.ToTable("LeaveTypes");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
        });

        modelBuilder.Entity<LeaveRequest>(entity =>
        {
            entity.ToTable("LeaveRequests");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.UserId, x.LeaveDate }).IsUnique();
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.Comment).HasMaxLength(1000);
            entity.Property(x => x.ReviewerComment).HasMaxLength(1000);

            entity.HasOne(x => x.User)
                .WithMany(u => u.LeaveRequests)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.LeaveType)
                .WithMany()
                .HasForeignKey(x => x.LeaveTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ReviewedByUser)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ApprovalAction>(entity =>
        {
            entity.ToTable("ApprovalActions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Action).HasConversion<int>();
            entity.Property(x => x.Comment).HasMaxLength(1000).IsRequired();

            entity.HasOne(x => x.Timesheet)
                .WithMany(x => x.ApprovalActions)
                .HasForeignKey(x => x.TimesheetId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.ManagerUser)
                .WithMany()
                .HasForeignKey(x => x.ManagerUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Action).HasMaxLength(120).IsRequired();
            entity.Property(x => x.EntityType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Details).HasMaxLength(2000);
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("Projects");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<ProjectMember>(entity =>
        {
            entity.ToTable("ProjectMembers");
            entity.HasKey(x => new { x.ProjectId, x.UserId });
            entity.HasOne(x => x.Project).WithMany(x => x.Members).HasForeignKey(x => x.ProjectId);
            entity.HasOne(x => x.User).WithMany(x => x.ProjectMemberships).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<TaskCategory>(entity =>
        {
            entity.ToTable("TaskCategories");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
        });
    }
}
