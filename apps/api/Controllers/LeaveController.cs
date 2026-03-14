using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/leave")]
public class LeaveController(TimeSheetDbContext dbContext, IAuditService auditService, INotificationService notificationService) : ControllerBase
{
    [HttpGet("types")]
    public async Task<IActionResult> GetLeaveTypes()
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var query = dbContext.LeaveTypes.AsNoTracking();
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.IsActive);
        }

        var items = await query.OrderBy(x => x.Name)
            .Select(x => new LeaveTypeResponse(x.Id, x.Name, x.IsActive))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("types")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpsertLeaveType([FromBody] UpsertLeaveTypeRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var existing = await dbContext.LeaveTypes.SingleOrDefaultAsync(x => x.Name == name);
        if (existing is null)
        {
            existing = new LeaveType { Id = Guid.NewGuid(), Name = name, IsActive = request.IsActive };
            dbContext.LeaveTypes.Add(existing);
        }
        else
        {
            existing.IsActive = request.IsActive;
        }

        await dbContext.SaveChangesAsync();
        return Ok(new LeaveTypeResponse(existing.Id, existing.Name, existing.IsActive));
    }

    [HttpPost("requests")]
    public async Task<IActionResult> ApplyLeave([FromBody] ApplyLeaveRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var leaveType = await dbContext.LeaveTypes.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == request.LeaveTypeId && x.IsActive);
        if (leaveType is null)
        {
            return BadRequest(new { message = "Invalid leave type." });
        }

        var overlap = await dbContext.LeaveRequests.AnyAsync(x =>
            x.UserId == userId.Value && x.LeaveDate == request.LeaveDate && x.Status != LeaveRequestStatus.Rejected);
        if (overlap)
        {
            return Conflict(new { message = "A leave request already exists for this date." });
        }

        var leave = new LeaveRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            LeaveTypeId = request.LeaveTypeId,
            LeaveDate = request.LeaveDate,
            IsHalfDay = request.IsHalfDay,
            Comment = request.Comment?.Trim(),
            Status = LeaveRequestStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.LeaveRequests.Add(leave);
        await dbContext.SaveChangesAsync();

        await auditService.WriteAsync("LeaveApplied", "LeaveRequest", leave.Id.ToString(), $"User applied leave for {leave.LeaveDate}", User);
        await dbContext.SaveChangesAsync();

        return Ok(await MapLeaveResponse(leave.Id));
    }

    [HttpGet("requests/my")]
    public async Task<IActionResult> GetMyLeaveRequests()
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var items = await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .OrderByDescending(x => x.LeaveDate)
            .Select(x => new LeaveRequestResponse(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("requests/pending")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> GetPendingLeaveRequests()
    {
        var managerId = GetUserId();
        if (managerId is null)
        {
            return Unauthorized();
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var query = dbContext.LeaveRequests.AsNoTracking().Where(x => x.Status == LeaveRequestStatus.Pending);

        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.User.ManagerId == managerId.Value);
        }

        var items = await query
            .OrderBy(x => x.LeaveDate)
            .Select(x => new LeaveRequestResponse(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("requests/{leaveRequestId:guid}/review")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> ReviewLeave(Guid leaveRequestId, [FromBody] ReviewLeaveRequest request)
    {
        var managerId = GetUserId();
        if (managerId is null)
        {
            return Unauthorized();
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";

        var leave = await dbContext.LeaveRequests
            .Include(x => x.User)
            .SingleOrDefaultAsync(x => x.Id == leaveRequestId);

        if (leave is null)
        {
            return NotFound();
        }

        if (leave.Status != LeaveRequestStatus.Pending)
        {
            return Conflict(new { message = "Only pending leaves can be reviewed." });
        }

        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) && leave.User.ManagerId != managerId.Value)
        {
            return Forbid();
        }

        if (!request.Approve && string.IsNullOrWhiteSpace(request.Comment))
        {
            return BadRequest(new { message = "Comment is required when rejecting leave." });
        }

        leave.Status = request.Approve ? LeaveRequestStatus.Approved : LeaveRequestStatus.Rejected;
        leave.ReviewedByUserId = managerId.Value;
        leave.ReviewerComment = request.Comment?.Trim();
        leave.ReviewedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        await auditService.WriteAsync(request.Approve ? "LeaveApproved" : "LeaveRejected", "LeaveRequest", leave.Id.ToString(), $"Manager reviewed leave for {leave.LeaveDate}", User);
        await notificationService.CreateAsync(leave.UserId, "Leave Request Updated",
            $"Your leave request for {leave.LeaveDate:yyyy-MM-dd} has been {(request.Approve ? "approved" : "rejected")}.", NotificationType.StatusChange);
        await dbContext.SaveChangesAsync();

        return Ok(await MapLeaveResponse(leave.Id));
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }

    private async Task<LeaveRequestResponse> MapLeaveResponse(Guid id)
    {
        return await dbContext.LeaveRequests.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new LeaveRequestResponse(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .SingleAsync();
    }
}
