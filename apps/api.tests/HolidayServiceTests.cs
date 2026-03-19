using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Application.Holidays.Services;
using TimeSheet.Api.Application.Holidays.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Holidays;
using TimeSheet.Api.Models;
using Xunit;

namespace TimeSheet.Api.Tests;

public class HolidayServiceTests
{
    [Fact]
    public async Task UpdateHoliday_ReturnsNotFound_WhenHolidayMissing()
    {
        var repository = new FakeHolidayRepository();
        var service = new HolidayService(repository, new HolidayListQueryValidator());

        var (data, error) = await service.UpdateHolidayAsync(Guid.NewGuid(), new UpsertHolidayRequest("Test", new DateOnly(2026, 1, 1), false), CancellationToken.None);

        Assert.Null(data);
        Assert.NotNull(error);
        Assert.Equal(404, error!.StatusCode);
    }

    private sealed class FakeHolidayRepository : IHolidayRepository
    {
        public Task<TimeSheet.Api.Application.Common.Models.PagedResult<HolidayResponse>> GetHolidaysAsync(HolidayListQuery query, CancellationToken cancellationToken)
            => throw new NotImplementedException();

        public void AddHoliday(Holiday holiday)
        {
        }

        public Task<Holiday?> GetHolidayByIdAsync(Guid id, CancellationToken cancellationToken)
            => Task.FromResult<Holiday?>(null);

        public void RemoveHoliday(Holiday holiday)
        {
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
