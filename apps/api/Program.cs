using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;
using TimeSheet.Api.Data;
using TimeSheet.Api.Application.Leave.Handlers;
using TimeSheet.Api.Application.Leave.Services;
using TimeSheet.Api.Application.Leave.Validators;
using TimeSheet.Api.Infrastructure.Persistence.Repositories;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Roles;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Holidays;
using TimeSheet.Api.Application.Roles.Validators;
using TimeSheet.Api.Application.Roles.Services;
using TimeSheet.Api.Application.Roles.Handlers;
using TimeSheet.Api.Application.Holidays.Validators;
using TimeSheet.Api.Application.Holidays.Services;
using TimeSheet.Api.Application.Holidays.Handlers;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Anomaly;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.ProjectBudget;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.TaskCategories;
using TimeSheet.Api.Application.Anomaly.Services;
using TimeSheet.Api.Application.Anomaly.Handlers;
using TimeSheet.Api.Application.ProjectBudget.Services;
using TimeSheet.Api.Application.ProjectBudget.Handlers;
using TimeSheet.Api.Application.TaskCategories.Validators;
using TimeSheet.Api.Application.TaskCategories.Services;
using TimeSheet.Api.Application.TaskCategories.Handlers;
using TimeSheet.Api.Middleware;
using TimeSheet.Api.Services;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
    builder.Services.AddProblemDetails();

    builder.Services.AddDbContext<TimeSheetDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

    builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
    builder.Services.AddScoped<ITokenService, TokenService>();
    builder.Services.AddScoped<IAttendanceCalculationService, AttendanceCalculationService>();
    builder.Services.AddScoped<IAuditService, AuditService>();
    builder.Services.AddScoped<INotificationService, NotificationService>();
    builder.Services.AddScoped<IApplyLeaveValidator, ApplyLeaveValidator>();
    builder.Services.AddScoped<IMyLeaveListQueryValidator, MyLeaveListQueryValidator>();
    builder.Services.AddScoped<ILeaveRepository, LeaveRepository>();
    builder.Services.AddScoped<ILeaveService, LeaveService>();
    builder.Services.AddScoped<IApplyLeaveHandler, ApplyLeaveHandler>();
    builder.Services.AddScoped<IGetMyLeaveRequestsHandler, GetMyLeaveRequestsHandler>();
    builder.Services.AddScoped<ICancelLeaveHandler, CancelLeaveHandler>();
    builder.Services.AddScoped<IGetPendingLeaveRequestsHandler, GetPendingLeaveRequestsHandler>();
    builder.Services.AddScoped<IReviewLeaveHandler, ReviewLeaveHandler>();
    builder.Services.AddScoped<IRoleListQueryValidator, RoleListQueryValidator>();
    builder.Services.AddScoped<IRoleCreateValidator, RoleCreateValidator>();
    builder.Services.AddScoped<IRoleRepository, RoleRepository>();
    builder.Services.AddScoped<IRoleService, RoleService>();
    builder.Services.AddScoped<IGetRolesHandler, GetRolesHandler>();
    builder.Services.AddScoped<ICreateRoleHandler, CreateRoleHandler>();
    builder.Services.AddScoped<IHolidayListQueryValidator, HolidayListQueryValidator>();
    builder.Services.AddScoped<IHolidayRepository, HolidayRepository>();
    builder.Services.AddScoped<IHolidayService, HolidayService>();
    builder.Services.AddScoped<IGetHolidaysHandler, GetHolidaysHandler>();
    builder.Services.AddScoped<ICreateHolidayHandler, CreateHolidayHandler>();
    builder.Services.AddScoped<IUpdateHolidayHandler, UpdateHolidayHandler>();
    builder.Services.AddScoped<IDeleteHolidayHandler, DeleteHolidayHandler>();
    builder.Services.AddScoped<ITaskCategoryQueryValidator, TaskCategoryQueryValidator>();
    builder.Services.AddScoped<ITaskCategoryRequestValidator, TaskCategoryRequestValidator>();
    builder.Services.AddScoped<ITaskCategoryRepository, TaskCategoryRepository>();
    builder.Services.AddScoped<ITaskCategoryService, TaskCategoryService>();
    builder.Services.AddScoped<IGetTaskCategoriesHandler, GetTaskCategoriesHandler>();
    builder.Services.AddScoped<ICreateTaskCategoryHandler, CreateTaskCategoryHandler>();
    builder.Services.AddScoped<IUpdateTaskCategoryHandler, UpdateTaskCategoryHandler>();
    builder.Services.AddScoped<IDeleteTaskCategoryHandler, DeleteTaskCategoryHandler>();
    builder.Services.AddScoped<IProjectBudgetRepository, ProjectBudgetRepository>();
    builder.Services.AddScoped<IProjectBudgetService, ProjectBudgetService>();
    builder.Services.AddScoped<IGetProjectBudgetHealthHandler, GetProjectBudgetHealthHandler>();
    builder.Services.AddScoped<IGetProjectBudgetSummaryHandler, GetProjectBudgetSummaryHandler>();
    builder.Services.AddScoped<IAnomalyRepository, AnomalyRepository>();
    builder.Services.AddScoped<IAnomalyService, AnomalyService>();
    builder.Services.AddScoped<IGetAnomaliesHandler, GetAnomaliesHandler>();
    builder.Services.AddScoped<IDismissAnomalyHandler, DismissAnomalyHandler>();
    builder.Services.AddHostedService<RefreshTokenCleanupService>();
    builder.Services.AddHostedService<NotificationSchedulerService>();
    builder.Services.AddHostedService<AnomalyDetectionService>();

    var jwt = builder.Configuration.GetSection("Jwt");
    var jwtKey = jwt["Key"] ?? throw new InvalidOperationException("JWT Key is not configured.");

    if (builder.Environment.IsProduction() && jwtKey == "ReplaceThisWithA32CharMinimumSecretKey123!")
        throw new InvalidOperationException("JWT Key must be overridden from the default placeholder in Production.");

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ValidIssuer = jwt["Issuer"],
                ValidAudience = jwt["Audience"],
                IssuerSigningKey = key
            };
        });

    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                         ?? ["http://localhost:5173"];

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("WebClient", policy =>
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod());
    });

    builder.Services.AddRateLimiter(options =>
    {
        options.AddFixedWindowLimiter("login", limiterOptions =>
        {
            limiterOptions.PermitLimit = 100;
            limiterOptions.Window = TimeSpan.FromMinutes(15);
            limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            limiterOptions.QueueLimit = 0;
        });
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    });

    var app = builder.Build();

    app.UseExceptionHandler(errApp =>
    {
        errApp.Run(async context =>
        {
            context.Response.ContentType = "application/problem+json";
            var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
            var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
            var traceId = context.TraceIdentifier;

            var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                Detail = env.IsDevelopment() ? feature?.Error?.ToString() : null,
                Extensions = { ["traceId"] = traceId }
            };

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(problem);
        });
    });

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseHttpsRedirection();
    app.UseCors("WebClient");
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();

    await DbInitializer.MigrateAsync(app.Services);
    await DbInitializer.SeedAsync(app.Services);

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application startup failed");
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program;
