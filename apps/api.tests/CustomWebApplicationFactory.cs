using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TimeSheet.Api.Data;

namespace TimeSheet.Api.Tests;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"TimeSheetTests-{Guid.NewGuid()}";

    private readonly string _databaseName = $"TimeSheetTests-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<TimeSheetDbContext>>();

            services.AddDbContext<TimeSheetDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }
}
