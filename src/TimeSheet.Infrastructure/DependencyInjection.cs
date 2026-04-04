using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;
using TimeSheet.Infrastructure.BackgroundJobs;
using TimeSheet.Infrastructure.Persistence;
using TimeSheet.Infrastructure.Persistence.Interceptors;
using TimeSheet.Infrastructure.Services;

namespace TimeSheet.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        const string repositoriesNamespace = "TimeSheet.Infrastructure.Persistence.Repositories";
        const string servicesNamespace = "TimeSheet.Infrastructure.Services";

        // Persistence
        services.AddScoped<AuditInterceptor>();
        services.AddDbContext<TimeSheetDbContext>((serviceProvider, options) =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"),
                    sql => sql.MigrationsAssembly("TimeSheet.Infrastructure"))
                .AddInterceptors(serviceProvider.GetRequiredService<AuditInterceptor>()));

        // Convention-based registration for repositories and infrastructure services.
        // We keep special registrations explicit below where lifetime or behavior matters.
        services.Scan(scan => scan
            .FromAssemblyOf<TimeSheetDbContext>()
            .AddClasses(classes => classes
                .InNamespaces(repositoriesNamespace)
                .Where(type => type.Name.EndsWith("Repository", StringComparison.Ordinal)))
                .AsImplementedInterfaces()
                .WithScopedLifetime()
            .AddClasses(classes => classes
                .InNamespaces(servicesNamespace)
                .Where(type => type.Name.EndsWith("Service", StringComparison.Ordinal)))
                .AsImplementedInterfaces()
                .WithScopedLifetime());

        // Explicit registrations for non-conventional and configuration-backed types.
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddSingleton<IJwtSettings, JwtSettings>();

        services.AddHttpContextAccessor();
        services.TryAddScoped<ICurrentUserService, CurrentUserService>();
        services.TryAddScoped<ICorrelationIdAccessor, HttpContextCorrelationIdAccessor>();

        // Background jobs
        services.AddHostedService<RefreshTokenCleanupService>();
        services.AddHostedService<NotificationSchedulerService>();
        services.AddHostedService<AnomalyDetectionService>();
        services.AddHostedService<OvertimeCompOffSchedulerService>();
        services.AddHostedService<ReportSchedulerService>();
        services.AddHostedService<RetentionEnforcementService>();

        return services;
    }
}
