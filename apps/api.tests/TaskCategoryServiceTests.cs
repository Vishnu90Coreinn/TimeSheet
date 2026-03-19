using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Application.TaskCategories.Services;
using TimeSheet.Api.Application.TaskCategories.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.TaskCategories;
using TimeSheet.Api.Models;
using Xunit;

namespace TimeSheet.Api.Tests;

public class TaskCategoryServiceTests
{
    [Fact]
    public async Task Create_ReturnsConflict_WhenNameExists()
    {
        var repository = new FakeRepo { Exists = true };
        var service = new TaskCategoryService(repository, new TaskCategoryQueryValidator(), new TaskCategoryRequestValidator());

        var (data, error) = await service.CreateAsync(new UpsertTaskCategoryRequest("General", true, true), CancellationToken.None);

        Assert.Null(data);
        Assert.NotNull(error);
        Assert.Equal(409, error!.StatusCode);
    }

    private sealed class FakeRepo : ITaskCategoryRepository
    {
        public bool Exists { get; set; }
        public Task<TimeSheet.Api.Application.Common.Models.PagedResult<TaskCategoryResponse>> GetTaskCategoriesAsync(TaskCategoryListQuery query, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<bool> ExistsByNameAsync(string name, Guid? excludingId, CancellationToken cancellationToken) => Task.FromResult(Exists);
        public void Add(TaskCategory category) { }
        public Task<TaskCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult<TaskCategory?>(null);
        public void Remove(TaskCategory category) { }
        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
