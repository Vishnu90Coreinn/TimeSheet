using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/task-categories")]
public class TaskCategoriesController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskCategoryResponse>>> GetAll()
    {
        var categories = await dbContext.TaskCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive))
            .ToListAsync();

        return Ok(categories);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<ActionResult<TaskCategoryResponse>> Create([FromBody] UpsertTaskCategoryRequest request)
    {
        if (await dbContext.TaskCategories.AnyAsync(c => c.Name == request.Name))
        {
            return Conflict(new { message = "Task category already exists." });
        }

        var category = new TaskCategory
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            IsActive = request.IsActive
        };

        dbContext.TaskCategories.Add(category);
        await dbContext.SaveChangesAsync();

        return Ok(new TaskCategoryResponse(category.Id, category.Name, category.IsActive));
    }
}
