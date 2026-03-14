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
            .Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive, c.IsBillable))
            .ToListAsync();

        return Ok(categories);
    }

    [Authorize(Roles = "admin")]
    [HttpGet("admin")]
    public async Task<ActionResult<IEnumerable<TaskCategoryResponse>>> GetAllForAdmin()
    {
        var categories = await dbContext.TaskCategories.AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive, c.IsBillable))
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
            IsActive = request.IsActive,
            IsBillable = request.IsBillable
        };

        dbContext.TaskCategories.Add(category);
        await dbContext.SaveChangesAsync();

        return Ok(new TaskCategoryResponse(category.Id, category.Name, category.IsActive, category.IsBillable));
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertTaskCategoryRequest request)
    {
        var category = await dbContext.TaskCategories.SingleOrDefaultAsync(c => c.Id == id);
        if (category is null)
        {
            return NotFound();
        }

        var duplicate = await dbContext.TaskCategories.AnyAsync(c => c.Id != id && c.Name == request.Name);
        if (duplicate)
        {
            return Conflict(new { message = "Task category already exists." });
        }

        category.Name = request.Name.Trim();
        category.IsActive = request.IsActive;
        category.IsBillable = request.IsBillable;
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var category = await dbContext.TaskCategories.SingleOrDefaultAsync(c => c.Id == id);
        if (category is null)
        {
            return NotFound();
        }

        dbContext.TaskCategories.Remove(category);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }
}
