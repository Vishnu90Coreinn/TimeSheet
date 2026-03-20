using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/masters")]
public class MastersController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet("departments")]
    public async Task<ActionResult<IEnumerable<DepartmentResponse>>> GetDepartments()
    {
        var departments = await dbContext.Departments.AsNoTracking()
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentResponse(d.Id, d.Name, d.IsActive))
            .ToListAsync();

        return Ok(departments);
    }

    [HttpPost("departments")]
    public async Task<ActionResult<DepartmentResponse>> CreateDepartment([FromBody] DepartmentResponse request)
    {
        if (await dbContext.Departments.AnyAsync(d => d.Name == request.Name))
        {
            return Conflict(new { message = "Department already exists." });
        }

        var department = new Department { Id = Guid.NewGuid(), Name = request.Name.Trim(), IsActive = request.IsActive };
        dbContext.Departments.Add(department);
        await dbContext.SaveChangesAsync();

        return Ok(new DepartmentResponse(department.Id, department.Name, department.IsActive));
    }

    [HttpGet("work-policies")]
    public async Task<ActionResult<IEnumerable<WorkPolicyResponse>>> GetWorkPolicies()
    {
        var policies = await dbContext.WorkPolicies.AsNoTracking()
            .OrderBy(w => w.Name)
            .Select(w => new WorkPolicyResponse(w.Id, w.Name, w.DailyExpectedMinutes, w.WorkDaysPerWeek, w.IsActive))
            .ToListAsync();

        return Ok(policies);
    }

    [HttpPost("work-policies")]
    public async Task<ActionResult<WorkPolicyResponse>> CreateWorkPolicy([FromBody] WorkPolicyResponse request)
    {
        if (await dbContext.WorkPolicies.AnyAsync(w => w.Name == request.Name))
        {
            return Conflict(new { message = "Work policy already exists." });
        }

        var policy = new WorkPolicy
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            DailyExpectedMinutes = request.DailyExpectedMinutes,
            WorkDaysPerWeek = request.WorkDaysPerWeek is >= 5 and <= 6 ? request.WorkDaysPerWeek : 5,
            IsActive = request.IsActive
        };

        dbContext.WorkPolicies.Add(policy);
        await dbContext.SaveChangesAsync();

        return Ok(new WorkPolicyResponse(policy.Id, policy.Name, policy.DailyExpectedMinutes, policy.WorkDaysPerWeek, policy.IsActive));
    }

    [HttpPut("work-policies/{id:guid}")]
    public async Task<ActionResult<WorkPolicyResponse>> UpdateWorkPolicy(Guid id, [FromBody] WorkPolicyResponse request)
    {
        var policy = await dbContext.WorkPolicies.FindAsync(id);
        if (policy is null) return NotFound();

        if (await dbContext.WorkPolicies.AnyAsync(w => w.Name == request.Name && w.Id != id))
            return Conflict(new { message = "A work policy with that name already exists." });

        policy.Name = request.Name.Trim();
        policy.DailyExpectedMinutes = request.DailyExpectedMinutes;
        policy.WorkDaysPerWeek = request.WorkDaysPerWeek is >= 5 and <= 6 ? request.WorkDaysPerWeek : 5;
        policy.IsActive = request.IsActive;

        await dbContext.SaveChangesAsync();
        return Ok(new WorkPolicyResponse(policy.Id, policy.Name, policy.DailyExpectedMinutes, policy.WorkDaysPerWeek, policy.IsActive));
    }

    [HttpDelete("work-policies/{id:guid}")]
    public async Task<IActionResult> DeleteWorkPolicy(Guid id)
    {
        var policy = await dbContext.WorkPolicies.FindAsync(id);
        if (policy is null) return NotFound();
        dbContext.WorkPolicies.Remove(policy);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }
}
