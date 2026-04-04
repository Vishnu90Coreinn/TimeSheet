using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Dashboard.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/dashboard")]
public class DashboardController(ISender mediator) : ControllerBase
{
    [HttpGet("employee")]
    public async Task<IActionResult> Employee(CancellationToken ct)
    {
        var result = await mediator.Send(new GetEmployeeDashboardQuery(), ct);
        return result.IsSuccess
            ? Ok(ToEmployeeResponse(result.Value!))
            : Fail(result);
    }

    [HttpGet("manager")]
    public async Task<IActionResult> Manager(CancellationToken ct)
    {
        var result = await mediator.Send(new GetManagerDashboardQuery(), ct);
        return result.IsSuccess
            ? Ok(ToManagerResponse(result.Value!))
            : Fail(result);
    }

    [HttpGet("management")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Management(CancellationToken ct)
    {
        var result = await mediator.Send(new GetManagementDashboardQuery(), ct);
        return result.IsSuccess
            ? Ok(ToManagementResponse(result.Value!))
            : Fail(result);
    }

    private static EmployeeDashboardResponse ToEmployeeResponse(EmployeeDashboardResult dashboard)
        => new(
            dashboard.TodaySession,
            dashboard.TodayTimesheet,
            dashboard.WeeklyHours,
            dashboard.ProjectEffort.Select(static x => (object)x).ToList(),
            dashboard.MonthlyComplianceTrend.Select(static x => (object)x).ToList());

    private static ManagerDashboardResponse ToManagerResponse(ManagerDashboardResult dashboard)
        => new(
            dashboard.TeamAttendance,
            dashboard.TimesheetHealth,
            dashboard.Mismatches.Select(static x => (object)x).ToList(),
            dashboard.Utilization,
            dashboard.Contributions.Select(static x => (object)x).ToList());

    private static ManagementDashboardResponse ToManagementResponse(ManagementDashboardResult dashboard)
        => new(
            dashboard.EffortByDepartment.Select(static x => (object)x).ToList(),
            dashboard.EffortByProject.Select(static x => (object)x).ToList(),
            dashboard.Billable,
            dashboard.ConsultantVsInternal,
            dashboard.UnderOver.Select(static x => (object)x).ToList(),
            dashboard.Compliance.Select(static x => (object)x).ToList());

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}
