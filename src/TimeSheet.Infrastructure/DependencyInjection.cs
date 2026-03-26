using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;
using TimeSheet.Infrastructure.BackgroundJobs;
using TimeSheet.Infrastructure.Persistence;
using TimeSheet.Infrastructure.Persistence.Repositories;
using TimeSheet.Infrastructure.Services;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;
using InfraInterfaces = TimeSheet.Infrastructure.Services;

namespace TimeSheet.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Persistence
        services.AddDbContext<TimeSheetDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"),
                b => b.MigrationsAssembly("TimeSheet.Infrastructure")));

        // Repositories
        services.AddScoped<ITimesheetRepository, TimesheetRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ILeaveRepository, LeaveRepository>();
        services.AddScoped<ILeaveTypeRepository, LeaveTypeRepository>();
        services.AddScoped<ILeavePolicyRepository, LeavePolicyRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<ITaskCategoryRepository, TaskCategoryRepository>();
        services.AddScoped<IHolidayRepository, HolidayRepository>();
        services.AddScoped<IDepartmentRepository, DepartmentRepository>();
        services.AddScoped<IWorkPolicyRepository, WorkPolicyRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Core services — registered for Application interfaces (used by handlers)
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<AppInterfaces.IPasswordHasher, PasswordHasher>();
        services.AddScoped<AppInterfaces.ITokenService, TokenService>();

        services.AddScoped<IAttendanceCalculationService, AttendanceCalculationService>();
        services.AddScoped<InfraInterfaces.INotificationService, NotificationService>();

        services.AddScoped<AppInterfaces.IAuditService, AuditService>();
        services.AddScoped<AppInterfaces.INotificationService, NotificationService>();
        services.AddSingleton<AppInterfaces.IJwtSettings, JwtSettings>();

        services.AddScoped<AppInterfaces.ITimesheetQueryService, TimesheetQueryService>();
        services.AddScoped<AppInterfaces.IApprovalQueryService, ApprovalQueryService>();
        services.AddScoped<AppInterfaces.ILeaveQueryService, LeaveQueryService>();

        // CurrentUserService (requires IHttpContextAccessor)
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // Background jobs
        services.AddHostedService<RefreshTokenCleanupService>();
        services.AddHostedService<NotificationSchedulerService>();
        services.AddHostedService<AnomalyDetectionService>();

        return services;
    }
}
