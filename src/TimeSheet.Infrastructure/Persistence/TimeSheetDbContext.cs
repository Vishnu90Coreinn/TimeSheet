using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence;

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
    public DbSet<OvertimePolicy> OvertimePolicies => Set<OvertimePolicy>();
    public DbSet<CompOffBalance> CompOffBalances => Set<CompOffBalance>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AuditLogChange> AuditLogChanges => Set<AuditLogChange>();
    public DbSet<WorkSession> WorkSessions => Set<WorkSession>();
    public DbSet<BreakEntry> BreakEntries => Set<BreakEntry>();
    public DbSet<Timesheet> Timesheets => Set<Timesheet>();
    public DbSet<TimesheetEntry> TimesheetEntries => Set<TimesheetEntry>();
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<LeavePolicy> LeavePolicies { get; set; }
    public DbSet<LeavePolicyAllocation> LeavePolicyAllocations { get; set; }
    public DbSet<LeaveBalance> LeaveBalances { get; set; }
    public DbSet<ApprovalAction> ApprovalActions => Set<ApprovalAction>();
    public DbSet<ApprovalDelegation> ApprovalDelegations => Set<ApprovalDelegation>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<UserNotificationPreferences> UserNotificationPreferences => Set<UserNotificationPreferences>();
    public DbSet<TimerSession> TimerSessions => Set<TimerSession>();
    public DbSet<TimesheetTemplate> TimesheetTemplates => Set<TimesheetTemplate>();
    public DbSet<SavedReport> SavedReports => Set<SavedReport>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<TenantSettings> TenantSettings => Set<TenantSettings>();
    public DbSet<DataExportRequest> DataExportRequests => Set<DataExportRequest>();
    public DbSet<ConsentLog> ConsentLogs => Set<ConsentLog>();
    public DbSet<RetentionPolicy> RetentionPolicies => Set<RetentionPolicy>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TimeSheetDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
            .Where(t => typeof(Domain.Common.Entity).IsAssignableFrom(t.ClrType)))
        {
            modelBuilder.Entity(entityType.ClrType).Ignore(nameof(Domain.Common.Entity.DomainEvents));
        }
    }
}
