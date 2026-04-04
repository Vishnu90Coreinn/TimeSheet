using TimeSheet.Application.Common.Models;
using TimeSheet.Application.ReferenceData.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IReferenceDataQueryService
{
    Task<PagedResult<TimeSheet.Application.ReferenceData.Queries.TaskCategoryResult>> GetTaskCategoriesPageAsync(
        string? search,
        bool? isActive,
        bool? isBillable,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<PagedResult<TimeSheet.Application.ReferenceData.Queries.HolidayResult>> GetHolidaysPageAsync(
        int year,
        string? search,
        bool? isRecurring,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<PagedResult<TimeSheet.Application.ReferenceData.Queries.WorkPolicyResult>> GetWorkPoliciesPageAsync(
        string? search,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
}
