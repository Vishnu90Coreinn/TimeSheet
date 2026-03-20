using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;
using TimeSheet.Infrastructure.BackgroundJobs;
using TimeSheet.Infrastructure.Persistence;
using TimeSheet.Infrastructure.Persistence.Repositories;
using TimeSheet.Infrastructure.Services;

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
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Core services
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAttendanceCalculationService, AttendanceCalculationService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<INotificationService, NotificationService>();

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
