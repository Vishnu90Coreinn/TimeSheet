using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TimeSheet.Infrastructure.Persistence.Interceptors;

namespace TimeSheet.Api.Tests;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"TimeSheetTests-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            // Remove DbContextOptions singleton
            services.RemoveAll<DbContextOptions<TimeSheetDbContext>>();

            // Remove IDbContextOptionsConfiguration<TimeSheetDbContext> — these carry the SQL Server
            // provider registration added by AddDbContext in Program.cs (EF Core 9 dual-provider check)
            var efConfigDescriptors = services
                .Where(d =>
                    d.ServiceType.IsGenericType &&
                    d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration") &&
                    d.ServiceType.GenericTypeArguments.Length == 1 &&
                    d.ServiceType.GenericTypeArguments[0] == typeof(TimeSheetDbContext))
                .ToList();
            foreach (var d in efConfigDescriptors) services.Remove(d);

            services.AddDbContext<TimeSheetDbContext>((serviceProvider, options) =>
                options.UseInMemoryDatabase(_databaseName)
                    .AddInterceptors(serviceProvider.GetRequiredService<AuditInterceptor>()));
        });
    }
}
